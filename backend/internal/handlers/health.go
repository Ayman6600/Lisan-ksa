package handlers

import (
	"context"
	"net/http"
	"time"
)

// Health provides the P0 liveness check only.
func (app *AppState) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, Response{
		"status":  "ok",
		"service": "lisan-ksa-api",
		"time":    time.Now().UTC().Format(time.RFC3339),
	})
}

// Ready provides the P0 dependency readiness check without exposing secrets.
func (app *AppState) Ready(w http.ResponseWriter, r *http.Request) {
	allReady := true
	dbStatus := "not_configured"
	if app.DB != nil {
		dbCtx, dbCancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer dbCancel()
		if err := app.DB.Ping(dbCtx); err != nil {
			dbStatus = "disconnected"
			allReady = false
		} else {
			dbStatus = "connected"
		}
	}

	redisStatus := "not_configured"
	if app.Redis != nil {
		redisCtx, redisCancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer redisCancel()
		if err := app.Redis.Ping(redisCtx).Err(); err != nil {
			redisStatus = "disconnected"
			allReady = false
		} else {
			redisStatus = "connected"
		}
	}

	statusCode := http.StatusOK
	overallStatus := "ready"
	if !allReady {
		statusCode = http.StatusServiceUnavailable
		overallStatus = "not_ready"
	}

	writeJSON(w, statusCode, Response{
		"status":   overallStatus,
		"database": dbStatus,
		"redis":    redisStatus,
	})
}
