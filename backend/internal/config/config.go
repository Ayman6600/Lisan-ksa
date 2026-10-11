package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port                string
	Environment         string
	DatabaseURL         string
	RedisURL            string
	AutoMigrate         bool
	RateLimitRPM        int
	MaxBodySizeBytes    int64
	TranslationProvider string
	TranslationAPIKey   string
	AssemblyAIKey       string
	JWTSecret           string
}

func loadDotEnv() {
	paths := []string{".env", "../.env", "../../.env"}
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				val = strings.Trim(val, "\"'")
				if os.Getenv(key) == "" {
					_ = os.Setenv(key, val)
				}
			}
		}
		break
	}
}

func Load() Config {
	loadDotEnv()

	assemblyKey := os.Getenv("ASSEMBLYAI_API_KEY")
	if assemblyKey == "" {
		assemblyKey = os.Getenv("ASSEMBLY_AI_API_KEY")
	}

	return Config{
		Port:                env("PORT", "8080"),
		Environment:         env("ENVIRONMENT", "development"),
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		RedisURL:            os.Getenv("REDIS_URL"),
		AutoMigrate:         envBool("AUTO_MIGRATE", true),
		RateLimitRPM:        envInt("RATE_LIMIT_RPM", 60),
		MaxBodySizeBytes:    envInt64("MAX_BODY_SIZE_BYTES", 10*1024*1024),
		TranslationProvider: os.Getenv("TRANSLATION_PROVIDER"),
		TranslationAPIKey:   os.Getenv("TRANSLATION_API_KEY"),
		AssemblyAIKey:       assemblyKey,
		JWTSecret:           env("JWT_SECRET", "lisan-ksa-production-secure-signing-key-2026"),
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	b, err := strconv.ParseBool(val)
	if err != nil {
		return fallback
	}
	return b
}

func envInt(key string, fallback int) int {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	i, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return i
}

func envInt64(key string, fallback int64) int64 {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	i, err := strconv.ParseInt(val, 10, 64)
	if err != nil {
		return fallback
	}
	return i
}
