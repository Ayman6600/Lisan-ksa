package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/your-org/lisan-ksa/backend/internal/middleware"
	"github.com/your-org/lisan-ksa/backend/internal/providers"
)

// TranslateImage handles bounded image upload OCR & translation (Section 7 & 8 P0).
func (app *AppState) TranslateImage(w http.ResponseWriter, r *http.Request) {
	reqID := middleware.GetRequestID(r.Context())

	// Enforce 10MB maximum upload limit
	r.Body = http.MaxBytesReader(w, r.Body, 10*1024*1024)
	if err := r.ParseMultipartForm(10 * 1024 * 1024); err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_image_upload", "Maximum upload size is 10MB.")
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "missing_image", "An image file is required in 'image' form field.")
		return
	}
	defer file.Close()

	imgBytes, err := io.ReadAll(file)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "file_read_error", "Failed to read image content.")
		return
	}

	// Validate magic bytes and supported image formats (Section 7)
	contentType := http.DetectContentType(imgBytes)
	if !strings.HasPrefix(contentType, "image/jpeg") &&
		!strings.HasPrefix(contentType, "image/png") &&
		!strings.HasPrefix(contentType, "image/webp") {
		writeError(w, r, http.StatusBadRequest, "unsupported_image_format", "Only JPEG, PNG, and WebP images are supported.")
		return
	}

	// Validate decoded image dimensions (Section 7)
	cfg, _, err := image.DecodeConfig(bytes.NewReader(imgBytes))
	if err == nil {
		if cfg.Width < 10 || cfg.Height < 10 {
			writeError(w, r, http.StatusBadRequest, "image_too_small", "Image dimensions are too small for OCR.")
			return
		}
		if cfg.Width > 8000 || cfg.Height > 8000 {
			writeError(w, r, http.StatusBadRequest, "image_too_large", "Image dimensions exceed maximum allowed limits.")
			return
		}
	}

	sourceLang := r.FormValue("sourceLang")
	targetLang := r.FormValue("targetLang")
	if targetLang == "" {
		targetLang = "ar"
	}

	ocrProvider := app.OCR
	if ocrProvider == nil {
		ocrProvider = providers.UnconfiguredOCR{}
	}

	ocrRes, err := ocrProvider.ExtractText(r.Context(), imgBytes, contentType)
	if err != nil {
		if errors.Is(err, providers.ErrOCRProviderNotConfigured) {
			writeError(w, r, http.StatusServiceUnavailable, "ocr_provider_not_configured", "OCR provider is not configured.")
			return
		}
		writeError(w, r, http.StatusServiceUnavailable, "ocr_failed", "Failed to extract text from image.")
		return
	}

	// Translate extracted text
	var translatedText string
	var translationProvider string
	if ocrRes.FullText != "" && app.Translator != nil {
		tRes, tErr := app.Translator.Translate(r.Context(), providers.Request{
			Text:       ocrRes.FullText,
			SourceLang: sourceLang,
			TargetLang: targetLang,
		})
		if tErr == nil {
			translatedText = tRes.TranslatedText
			translationProvider = tRes.Provider
		}
	}

	_ = header

	writeJSON(w, http.StatusOK, Response{
		"requestId":           reqID,
		"extractedText":       ocrRes.FullText,
		"ocrBlocks":           ocrRes.Blocks,
		"confidence":          ocrRes.Confidence,
		"ocrProvider":         ocrRes.Provider,
		"translatedText":      translatedText,
		"translationProvider": translationProvider,
		"targetLang":          targetLang,
		"status":              "completed",
	})
}

// ExplainContent handles plain language explanations with knowledge retrieval (Section 7 & 8 P1).
func (app *AppState) ExplainContent(w http.ResponseWriter, r *http.Request) {
	reqID := middleware.GetRequestID(r.Context())

	var req struct {
		Text         string `json:"text"`
		UserLanguage string `json:"userLanguage"`
		Context      string `json:"context"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_json", "Send valid JSON with text and userLanguage.")
		return
	}

	if strings.TrimSpace(req.Text) == "" {
		writeError(w, r, http.StatusBadRequest, "empty_text", "Text cannot be empty.")
		return
	}
	if req.UserLanguage == "" {
		req.UserLanguage = "ar"
	}

	// Retrieve relevant approved knowledge chunks from Neon PostgreSQL
	var retrievedKnowledge []string
	if app.DB != nil {
		rows, err := app.DB.Query(r.Context(), `
			SELECT chunk_text 
			FROM knowledge_chunks 
			WHERE tsv @@ plainto_tsquery('simple', $1) 
			LIMIT 3
		`, req.Text)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var chunk string
				if err := rows.Scan(&chunk); err == nil {
					retrievedKnowledge = append(retrievedKnowledge, chunk)
				}
			}
		}
	}

	explainer := app.Explainer
	if explainer == nil {
		explainer = providers.UnconfiguredExplanation{}
	}

	res, err := explainer.Explain(r.Context(), providers.ExplanationRequest{
		Text:               req.Text,
		UserLanguage:       req.UserLanguage,
		Context:            req.Context,
		RetrievedKnowledge: retrievedKnowledge,
	})

	if err != nil {
		if errors.Is(err, providers.ErrExplanationProviderNotConfigured) {
			writeError(w, r, http.StatusServiceUnavailable, "explanation_provider_not_configured", "Explanation provider is not configured.")
			return
		}
		writeError(w, r, http.StatusServiceUnavailable, "explanation_failed", "Failed to generate explanation.")
		return
	}

	writeJSON(w, http.StatusOK, Response{
		"requestId":        reqID,
		"explanation":      res.Explanation,
		"suggestedActions": res.SuggestedActions,
		"citations":        res.Citations,
		"uncertaintyLabel": res.UncertaintyLabel,
		"provider":         res.Provider,
	})
}

// KnowledgeSearch searches approved instructions using Neon full-text search (Section 7 P1).
func (app *AppState) KnowledgeSearch(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeError(w, r, http.StatusBadRequest, "query_required", "Query parameter 'q' is required.")
		return
	}

	type searchResult struct {
		ID               string `json:"id"`
		Title            string `json:"title"`
		SourceReference  string `json:"sourceReference"`
		SectionReference string `json:"sectionReference"`
		ChunkText        string `json:"chunkText"`
	}

	var results []searchResult

	if app.DB != nil {
		rows, err := app.DB.Query(r.Context(), `
			SELECT c.id::text, d.title, COALESCE(d.source_reference, ''), COALESCE(c.section_reference, ''), c.chunk_text
			FROM knowledge_chunks c
			JOIN knowledge_documents d ON c.document_id = d.id
			WHERE c.tsv @@ plainto_tsquery('simple', $1)
			ORDER BY ts_rank(c.tsv, plainto_tsquery('simple', $1)) DESC
			LIMIT 10
		`, q)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var res searchResult
				if err := rows.Scan(&res.ID, &res.Title, &res.SourceReference, &res.SectionReference, &res.ChunkText); err == nil {
					results = append(results, res)
				}
			}
		}
	}

	if results == nil {
		results = []searchResult{}
	}

	writeJSON(w, http.StatusOK, Response{
		"query":   q,
		"count":   len(results),
		"results": results,
	})
}

// Glossary retrieves approved terminology from Neon PostgreSQL (Section 7 P1).
func (app *AppState) Glossary(w http.ResponseWriter, r *http.Request) {
	type termResult struct {
		ID                   string `json:"id"`
		SourceTerm           string `json:"sourceTerm"`
		SourceLanguage       string `json:"sourceLanguage"`
		ApprovedTranslations any    `json:"approvedTranslations"`
		Context              string `json:"context"`
	}

	var terms []termResult

	if app.DB != nil {
		rows, err := app.DB.Query(r.Context(), `
			SELECT id::text, source_term, source_language, approved_translations, COALESCE(context, '')
			FROM glossary_terms
			WHERE status = 'active'
			ORDER BY source_term ASC
			LIMIT 50
		`)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var t termResult
				if err := rows.Scan(&t.ID, &t.SourceTerm, &t.SourceLanguage, &t.ApprovedTranslations, &t.Context); err == nil {
					terms = append(terms, t)
				}
			}
		}
	}

	if terms == nil {
		terms = []termResult{}
	}

	writeJSON(w, http.StatusOK, Response{
		"count": len(terms),
		"terms": terms,
	})
}

// GetHistory retrieves opt-in translation history (Section 7 & 11 P1).
func (app *AppState) GetHistory(w http.ResponseWriter, r *http.Request) {
	type historyItem struct {
		ID             string    `json:"id"`
		SourceLanguage string    `json:"sourceLanguage"`
		TargetLanguage string    `json:"targetLanguage"`
		Content        string    `json:"content"`
		CreatedAt      time.Time `json:"createdAt"`
	}

	var history []historyItem

	if app.DB != nil {
		rows, err := app.DB.Query(r.Context(), `
			SELECT id::text, source_language, target_language, encrypted_content, created_at
			FROM translation_history
			ORDER BY created_at DESC
			LIMIT 20
		`)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var item historyItem
				if err := rows.Scan(&item.ID, &item.SourceLanguage, &item.TargetLanguage, &item.Content, &item.CreatedAt); err == nil {
					history = append(history, item)
				}
			}
		}
	}

	if history == nil {
		history = []historyItem{}
	}

	writeJSON(w, http.StatusOK, Response{
		"count":   len(history),
		"history": history,
	})
}

// DeleteHistory removes opt-in translation history honoring PDPL deletion rights (Section 7 & 11 P1).
func (app *AppState) DeleteHistory(w http.ResponseWriter, r *http.Request) {
	if app.DB != nil {
		_, _ = app.DB.Exec(r.Context(), "DELETE FROM translation_history")
	}

	writeJSON(w, http.StatusOK, Response{
		"status":  "deleted",
		"message": "Translation history has been deleted in accordance with data minimization policies.",
	})
}

// Usage returns current usage and remaining quota (Section 7 P1).
func (app *AppState) Usage(w http.ResponseWriter, r *http.Request) {
	charactersUsed := 0
	requestCount := 0

	if app.DB != nil {
		_ = app.DB.QueryRow(r.Context(), `
			SELECT COALESCE(SUM(input_characters), 0), COUNT(*) 
			FROM usage_events
		`).Scan(&charactersUsed, &requestCount)
	}

	const monthlyQuota = 100000
	quotaRemaining := monthlyQuota - charactersUsed
	if quotaRemaining < 0 {
		quotaRemaining = 0
	}

	writeJSON(w, http.StatusOK, Response{
		"charactersUsed": charactersUsed,
		"requestsCount":  requestCount,
		"quotaRemaining": quotaRemaining,
		"plan":           "starter",
		"quotaLimit":     monthlyQuota,
		"resetDate":      time.Now().AddDate(0, 1, 0).Format("2006-01-02T15:04:05Z"),
	})
}
