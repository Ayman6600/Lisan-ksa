package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

type contextKey string

const (
	RequestIDKey contextKey = "requestId"
)

// GenerateUUIDv4 creates an RFC 4122 compliant UUID v4 string.
func GenerateUUIDv4() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40 // Version 4
	b[8] = (b[8] & 0x3f) | 0x80 // RFC 4122 variant
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// RequestID attaches or propagates a unique Request ID on every request.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := r.Header.Get("X-Request-ID")
		if reqID == "" {
			reqID = GenerateUUIDv4()
		}
		w.Header().Set("X-Request-ID", reqID)
		ctx := context.WithValue(r.Context(), RequestIDKey, reqID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetRequestID(ctx context.Context) string {
	if val, ok := ctx.Value(RequestIDKey).(string); ok && val != "" {
		return val
	}
	return GenerateUUIDv4()
}

// Recoverer catches panics and responds with a safe 500 JSON payload without leaking stack traces.
func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				reqID := GetRequestID(r.Context())
				log.Printf("[PANIC RECOVERED] reqID=%s err=%v", reqID, rec)
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(fmt.Sprintf(`{"error":"internal_server_error","requestId":%q}`, reqID)))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// CORS provides CORS headers.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (rec *statusRecorder) WriteHeader(code int) {
	rec.status = code
	rec.ResponseWriter.WriteHeader(code)
}

// RedactedLogger logs HTTP requests with timing and status code, strictly omitting sensitive bodies and tokens.
func RedactedLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		duration := time.Since(start)

		reqID := GetRequestID(r.Context())
		ip := clientIP(r)

		// Never log body contents, tokens, passwords, or OTPs
		authStatus := "anonymous"
		if r.Header.Get("Authorization") != "" {
			authStatus = "authenticated"
		}

		log.Printf("[HTTP] id=%s method=%s path=%s status=%d duration=%s ip=%s auth=%s",
			reqID, r.Method, r.URL.Path, rec.status, duration, ip, authStatus)
	})
}

// MaxBodyLimit limits the size of the incoming request body with safe media bypass.
func MaxBodyLimit(maxBytes int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			limit := maxBytes
			if strings.Contains(r.Header.Get("Content-Type"), "multipart/form-data") ||
				strings.HasPrefix(r.URL.Path, "/api/v1/voice/") ||
				strings.HasPrefix(r.URL.Path, "/api/v1/translations/image") {
				limit = 15 * 1024 * 1024 // Allow up to 15MB for audio and image uploads
			}
			if limit > 0 && r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, limit)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// PseudoToken generates a quick random token for testing/session identification.
func NewRandomToken(bytesLen int) string {
	b := make([]byte, bytesLen)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
