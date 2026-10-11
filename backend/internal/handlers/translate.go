package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/your-org/lisan-ksa/backend/internal/middleware"
	"github.com/your-org/lisan-ksa/backend/internal/providers"
)

type TranslateTextRequest struct {
	Text       string `json:"text"`
	SourceLang string `json:"sourceLang"`
	TargetLang string `json:"targetLang"`
}

type TranslateTextResponse struct {
	RequestID      string `json:"requestId"`
	SourceLang     string `json:"sourceLang"`
	TargetLang     string `json:"targetLang"`
	TranslatedText string `json:"translatedText"`
	Provider       string `json:"provider"`
	Status         string `json:"status"`
}

// TranslateText translates user-supplied text according to Section 7 contract.
func (app *AppState) TranslateText(w http.ResponseWriter, r *http.Request) {
	reqID := middleware.GetRequestID(r.Context())
	start := time.Now()

	var req TranslateTextRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_json", "Send valid JSON with text and targetLang.")
		return
	}

	req.Text = strings.TrimSpace(req.Text)
	if req.Text == "" {
		writeError(w, r, http.StatusBadRequest, "empty_text", "Text cannot be empty.")
		return
	}
	if len(req.Text) > 10000 {
		writeError(w, r, http.StatusBadRequest, "text_too_long", "Text exceeds maximum limit of 10,000 characters.")
		return
	}

	if req.TargetLang == "" {
		writeError(w, r, http.StatusBadRequest, "target_language_required", "Target language code is required.")
		return
	}

	if !IsSupportedLanguage(req.TargetLang) {
		writeError(w, r, http.StatusBadRequest, "unsupported_target_language", "Target language is not supported. Supported: ar, en, ur, hi, bn.")
		return
	}

	if req.SourceLang != "" && !IsSupportedLanguage(req.SourceLang) {
		writeError(w, r, http.StatusBadRequest, "unsupported_source_language", "Source language is not supported. Supported: ar, en, ur, hi, bn.")
		return
	}

	// Check if source and target languages are identical (e.g. English to English)
	isSameLang := req.SourceLang != "" && strings.EqualFold(req.SourceLang, req.TargetLang)

	// If source language is omitted/auto-detect and target is English, check if text is already English
	if !isSameLang && (req.SourceLang == "" || strings.EqualFold(req.SourceLang, "en")) && strings.EqualFold(req.TargetLang, "en") {
		hasArabic := false
		for _, r := range req.Text {
			if (r >= 0x0600 && r <= 0x06FF) || (r >= 0x0750 && r <= 0x077F) || (r >= 0xFB50 && r <= 0xFDFF) {
				hasArabic = true
				break
			}
		}
		if !hasArabic {
			isSameLang = true
			req.SourceLang = "en"
		}
	}

	if isSameLang {
		writeJSON(w, http.StatusOK, TranslateTextResponse{
			RequestID:      reqID,
			SourceLang:     req.SourceLang,
			TargetLang:     req.TargetLang,
			TranslatedText: req.Text,
			Provider:       "same-language",
			Status:         "completed",
		})
		return
	}

	translator := app.Translator
	if translator == nil {
		translator = providers.Unconfigured{}
	}

	result, err := translator.Translate(r.Context(), providers.Request{
		Text:       req.Text,
		SourceLang: req.SourceLang,
		TargetLang: req.TargetLang,
	})

	duration := time.Since(start)

	if err != nil {
		// As required by Section 7: never echo source text as a successful translation
		if errors.Is(err, providers.ErrProviderNotConfigured) {
			writeError(w, r, http.StatusServiceUnavailable, "provider_not_configured", "Translation provider is not configured.")
			return
		}
		writeError(w, r, http.StatusServiceUnavailable, "translation_unavailable", "Translation service is currently unavailable.")
		return
	}

	// Record translation request in PostgreSQL if available (recording metrics without storing private text)
	if app.DB != nil {
		charCount := len([]rune(req.Text))
		providerName := result.Provider
		if providerName == "" {
			providerName = translator.Name()
		}
		_, _ = app.DB.Exec(r.Context(), `
			INSERT INTO translation_requests (
				request_id, provider, source_language, target_language, status, character_count, duration_ms
			) VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, reqID, providerName, req.SourceLang, req.TargetLang, "completed", charCount, int(duration.Milliseconds()))
	}

	providerName := result.Provider
	if providerName == "" {
		providerName = translator.Name()
	}

	resp := TranslateTextResponse{
		RequestID:      reqID,
		SourceLang:     req.SourceLang,
		TargetLang:     req.TargetLang,
		TranslatedText: result.TranslatedText,
		Provider:       providerName,
		Status:         "completed",
	}

	writeJSON(w, http.StatusOK, resp)
}
