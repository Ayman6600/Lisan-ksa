package handlers

import (
	"github.com/go-chi/chi/v5"
	"github.com/your-org/lisan-ksa/backend/internal/middleware"
)

// RegisterRoutes mounts all Section 7 API routes, middleware, and documentation.
func RegisterRoutes(r chi.Router, app *AppState) {
	r.Use(middleware.RequestID)
	r.Use(middleware.Recoverer)
	r.Use(middleware.CORS)
	r.Use(middleware.RedactedLogger)
	r.Use(middleware.MaxBodyLimit(app.Config.MaxBodySizeBytes))
	r.Use(middleware.AuthContext(app.jwtSecret()))

	limiter := middleware.NewRateLimiter(app.Redis, app.Config.RateLimitRPM)
	r.Use(limiter.Handler())

	// Liveness & Readiness (P0)
	r.Get("/health", app.Health)
	r.Get("/ready", app.Ready)

	// OpenAPI Spec
	r.Get("/openapi.yaml", app.OpenAPI)
	r.Get("/api/openapi.yaml", app.OpenAPI)

	// API v1
	r.Route("/api/v1", func(r chi.Router) {
		// Authentication & Identity (Nafath SSO & Accounts)
		r.Post("/auth/login", app.Login)
		r.Post("/auth/register", app.Register)
		r.Post("/auth/nafath", app.NafathLogin)
		r.Get("/auth/me", app.GetMe)
		r.Post("/auth/logout", app.Logout)

		r.Get("/languages", app.Languages)
		r.Post("/translations/text", app.TranslateText)
		r.Post("/translations/image", app.TranslateImage)
		r.Post("/voice/translate", app.TranslateVoice)
		r.Post("/explanations", app.ExplainContent)
		r.Get("/knowledge/search", app.KnowledgeSearch)
		r.Get("/glossary", app.Glossary)
		r.Get("/me/preferences", app.GetPreferences)
		r.Put("/me/preferences", app.UpdatePreferences)
		r.Get("/history", app.GetHistory)
		r.Delete("/history", app.DeleteHistory)
		r.Get("/usage", app.Usage)
	})
}
