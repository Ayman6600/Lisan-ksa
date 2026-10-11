package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type RateLimiter struct {
	redisClient *redis.Client
	limitRPM    int
	mu          sync.Mutex
	memCounts   map[string]map[int64]int
}

func NewRateLimiter(client *redis.Client, limitRPM int) *RateLimiter {
	if limitRPM <= 0 {
		limitRPM = 60
	}
	rl := &RateLimiter{
		redisClient: client,
		limitRPM:    limitRPM,
		memCounts:   make(map[string]map[int64]int),
	}
	// Background cleanup of in-memory buckets
	go rl.cleanupLoop()
	return rl
}

func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		nowMinute := time.Now().Unix() / 60
		for key, buckets := range rl.memCounts {
			for m := range buckets {
				if m < nowMinute-1 {
					delete(buckets, m)
				}
			}
			if len(buckets) == 0 {
				delete(rl.memCounts, key)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *RateLimiter) Handler() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip health endpoints from strict rate limiting
			if r.URL.Path == "/health" || r.URL.Path == "/ready" {
				next.ServeHTTP(w, r)
				return
			}

			key := rl.extractIdentity(r)
			allowed, remaining, err := rl.allow(r.Context(), key)

			w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", rl.limitRPM))
			w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))

			if !allowed {
				w.Header().Set("Retry-After", "60")
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(`{"error":"rate_limit_exceeded","message":"Too many requests. Please slow down."}`))
				return
			}

			_ = err
			next.ServeHTTP(w, r)
		})
	}
}

func (rl *RateLimiter) extractIdentity(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		hash := sha256.Sum256([]byte(authHeader))
		return "user:" + hex.EncodeToString(hash[:8])
	}

	ip := clientIP(r)
	return "ip:" + ip
}

func clientIP(r *http.Request) string {
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		parts := strings.Split(xff, ",")
		ip := strings.TrimSpace(parts[0])
		if ip != "" {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}

func (rl *RateLimiter) allow(ctx context.Context, identity string) (bool, int, error) {
	currentMinute := time.Now().Unix() / 60
	redisKey := fmt.Sprintf("ratelimit:%s:%d", identity, currentMinute)

	if rl.redisClient != nil {
		reqCtx, cancel := context.WithTimeout(ctx, 250*time.Millisecond)
		defer cancel()

		pipe := rl.redisClient.Pipeline()
		incr := pipe.Incr(reqCtx, redisKey)
		pipe.Expire(reqCtx, redisKey, 70*time.Second)
		_, err := pipe.Exec(reqCtx)

		if err == nil {
			count := int(incr.Val())
			if count > rl.limitRPM {
				return false, 0, nil
			}
			return true, rl.limitRPM - count, nil
		}
		// Redis failed or timed out: fall back safely to in-memory limiter (never silently disable protection!)
	}

	// In-memory fallback
	rl.mu.Lock()
	defer rl.mu.Unlock()

	if _, ok := rl.memCounts[identity]; !ok {
		rl.memCounts[identity] = make(map[int64]int)
	}
	rl.memCounts[identity][currentMinute]++
	count := rl.memCounts[identity][currentMinute]

	if count > rl.limitRPM {
		return false, 0, nil
	}
	return true, rl.limitRPM - count, nil
}
