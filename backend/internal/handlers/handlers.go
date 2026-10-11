package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/your-org/lisan-ksa/backend/internal/config"
	"github.com/your-org/lisan-ksa/backend/internal/middleware"
	"github.com/your-org/lisan-ksa/backend/internal/providers"
)

type AppState struct {
	DB         *pgxpool.Pool
	Redis      *redis.Client
	Translator providers.Translator
	OCR        providers.OCRProvider
	Explainer  providers.ExplanationProvider
	Config     config.Config
}

type Response map[string]any

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	reqID := middleware.GetRequestID(r.Context())
	writeJSON(w, status, Response{
		"error":     code,
		"message":   message,
		"requestId": reqID,
	})
}
