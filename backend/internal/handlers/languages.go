package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

type Language struct {
	Code       string `json:"code"`
	Name       string `json:"name"`
	NativeName string `json:"nativeName"`
	Direction  string `json:"direction"`
}

var SupportedLanguages = []Language{
	{Code: "ar", Name: "Arabic", NativeName: "العربية", Direction: "rtl"},
	{Code: "en", Name: "English", NativeName: "English", Direction: "ltr"},
	{Code: "ur", Name: "Urdu", NativeName: "اردو", Direction: "rtl"},
	{Code: "hi", Name: "Hindi", NativeName: "हिन्दी", Direction: "ltr"},
	{Code: "bn", Name: "Bengali", NativeName: "বাংলা", Direction: "ltr"},
}

func IsSupportedLanguage(code string) bool {
	for _, l := range SupportedLanguages {
		if l.Code == code {
			return true
		}
	}
	return false
}

// Languages returns supported language metadata and capabilities (P0), caching in Redis if configured.
func (app *AppState) Languages(w http.ResponseWriter, r *http.Request) {
	cacheKey := "cache:public:languages"

	if app.Redis != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 500*time.Millisecond)
		defer cancel()

		val, err := app.Redis.Get(ctx, cacheKey).Result()
		if err == nil && val != "" {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("X-Cache", "HIT")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(val))
			return
		}
	}

	payload := Response{
		"languages": SupportedLanguages,
	}

	if app.Redis != nil {
		data, err := json.Marshal(payload)
		if err == nil {
			ctx, cancel := context.WithTimeout(r.Context(), 500*time.Millisecond)
			defer cancel()
			_ = app.Redis.Set(ctx, cacheKey, string(data), 1*time.Hour).Err()
		}
	}

	w.Header().Set("X-Cache", "MISS")
	writeJSON(w, http.StatusOK, payload)
}
