package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRateLimiter_InMemoryLimit(t *testing.T) {
	// Set low limit of 3 RPM for testing
	rl := NewRateLimiter(nil, 3)

	handler := rl.Handler()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))

	for i := 1; i <= 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("request %d should succeed, got %d", i, rec.Code)
		}
	}

	// 4th request must be rate limited
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("request 4 should be 429 Too Many Requests, got %d", rec.Code)
	}

	if rec.Header().Get("Retry-After") != "60" {
		t.Fatalf("expected Retry-After header: got %q", rec.Header().Get("Retry-After"))
	}
}

func TestRateLimiter_HealthBypass(t *testing.T) {
	rl := NewRateLimiter(nil, 1)

	handler := rl.Handler()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodGet, "/health", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("health request %d should never be blocked, got %d", i, rec.Code)
		}
	}
}
