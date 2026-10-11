package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/your-org/lisan-ksa/backend/internal/auth"
)

const UserContextKey contextKey = "authenticatedUser"

// AuthContext middleware parses Authorization: Bearer <token> and places claims into request context.
func AuthContext(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenStr := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
				claims, err := auth.ValidateToken(tokenStr, secret)
				if err == nil && claims != nil {
					ctx := context.WithValue(r.Context(), UserContextKey, claims)
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// GetUser retrieves the authenticated user claims from context, or nil if anonymous.
func GetUser(ctx context.Context) *auth.UserClaims {
	if val, ok := ctx.Value(UserContextKey).(*auth.UserClaims); ok {
		return val
	}
	return nil
}
