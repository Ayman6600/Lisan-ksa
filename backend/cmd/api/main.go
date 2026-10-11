package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/your-org/lisan-ksa/backend/internal/config"
	"github.com/your-org/lisan-ksa/backend/internal/handlers"
	"github.com/your-org/lisan-ksa/backend/internal/providers"
	"github.com/your-org/lisan-ksa/backend/internal/storage"
)

func main() {
	cfg := config.Load()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	translator := providers.CreateTranslator(cfg.TranslationProvider, cfg.TranslationAPIKey)
	ocrProvider := providers.CreateOCRProvider(os.Getenv("OCR_PROVIDER"), os.Getenv("OCR_API_KEY"))
	explanationProvider := providers.CreateExplanationProvider(os.Getenv("EXPLANATION_PROVIDER"), os.Getenv("EXPLANATION_API_KEY"))

	appState := &handlers.AppState{
		Config:     cfg,
		Translator: translator,
		OCR:        ocrProvider,
		Explainer:  explanationProvider,
	}

	// Initialize Neon PostgreSQL if configured
	if cfg.DatabaseURL != "" {
		dbPool, err := storage.OpenPostgres(ctx, cfg.DatabaseURL)
		if err != nil {
			log.Printf("[DATABASE WARN] failed to connect to PostgreSQL: %v", err)
		} else {
			defer dbPool.Close()
			appState.DB = dbPool
			log.Printf("[DATABASE] PostgreSQL connection pool initialized")

			if cfg.AutoMigrate {
				applied, err := storage.RunMigrations(ctx, dbPool)
				if err != nil {
					log.Printf("[MIGRATION ERROR] migration run failed: %v", err)
				} else if len(applied) > 0 {
					log.Printf("[MIGRATION] successfully applied %d migrations: %v", len(applied), applied)
				} else {
					log.Printf("[MIGRATION] schema is up to date")
				}
			}
		}
	} else {
		log.Printf("[DATABASE] DATABASE_URL not set; running in local in-memory mode")
	}

	// Initialize Redis if configured
	if cfg.RedisURL != "" {
		redisClient, err := storage.OpenRedis(ctx, cfg.RedisURL)
		if err != nil {
			log.Printf("[REDIS WARN] failed to connect to Redis: %v (using safe in-memory fallback)", err)
		} else {
			defer func() { _ = redisClient.Close() }()
			appState.Redis = redisClient
			log.Printf("[REDIS] Redis client connected")
		}
	} else {
		log.Printf("[REDIS] REDIS_URL not set; rate limiting will use fail-safe in-memory store")
	}

	log.Printf("[PROVIDERS] Translation: %s | OCR: %s | Explanation: %s",
		translator.Name(), ocrProvider.Name(), explanationProvider.Name())

	r := chi.NewRouter()
	handlers.RegisterRoutes(r, appState)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("Lisan KSA API listening on :%s (env: %s)", cfg.Port, cfg.Environment)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server failed: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown error: %v", err)
	}
	log.Printf("Lisan KSA API stopped cleanly")
}
