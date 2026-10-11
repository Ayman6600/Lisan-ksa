package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var (
	ErrProviderNotConfigured   = errors.New("provider_not_configured")
	ErrTranslationUnavailable  = errors.New("translation_unavailable")
	ErrUnsupportedLanguagePair = errors.New("unsupported_language_pair")
)

type Request struct {
	Text       string
	SourceLang string
	TargetLang string
}

type Result struct {
	TranslatedText string
	Provider       string
}

type Translator interface {
	Name() string
	Translate(ctx context.Context, request Request) (Result, error)
}

// Unconfigured is used when no third-party translation provider is set.
type Unconfigured struct{}

func (Unconfigured) Name() string {
	return "unconfigured"
}

func (Unconfigured) Translate(ctx context.Context, request Request) (Result, error) {
	return Result{}, ErrProviderNotConfigured
}

// MyMemoryTranslator connects to MyMemory translation API.
type MyMemoryTranslator struct {
	HTTPClient *http.Client
}

func NewMyMemoryTranslator() *MyMemoryTranslator {
	return &MyMemoryTranslator{
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (m *MyMemoryTranslator) Name() string {
	return "mymemory-neural"
}

func (m *MyMemoryTranslator) Translate(ctx context.Context, req Request) (Result, error) {
	src := req.SourceLang
	if src == "" {
		src = "en"
	}

	// Never call external API for identical language pairs (e.g. English to English)
	if strings.EqualFold(src, req.TargetLang) {
		return Result{
			TranslatedText: req.Text,
			Provider:       "same-language",
		}, nil
	}

	langPair := fmt.Sprintf("%s|%s", src, req.TargetLang)
	endpoint := fmt.Sprintf("https://api.mymemory.translated.net/get?q=%s&langpair=%s",
		url.QueryEscape(req.Text), url.QueryEscape(langPair))

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return Result{}, err
	}

	resp, err := m.HTTPClient.Do(httpReq)
	if err != nil {
		return Result{}, ErrTranslationUnavailable
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return Result{}, fmt.Errorf("%w: status %d", ErrTranslationUnavailable, resp.StatusCode)
	}

	var data struct {
		ResponseData struct {
			TranslatedText string `json:"translatedText"`
		} `json:"responseData"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return Result{}, ErrTranslationUnavailable
	}

	if data.ResponseData.TranslatedText == "" ||
		strings.Contains(data.ResponseData.TranslatedText, "PLEASE SELECT TWO DISTINCT LANGUAGES") {
		// Safe fallback for identical languages or empty response
		if strings.EqualFold(src, req.TargetLang) {
			return Result{TranslatedText: req.Text, Provider: "same-language"}, nil
		}
		return Result{}, ErrTranslationUnavailable
	}

	return Result{
		TranslatedText: data.ResponseData.TranslatedText,
		Provider:       m.Name(),
	}, nil
}

// GoogleTranslator connects to the Google Cloud Translation REST API (v2).
type GoogleTranslator struct {
	APIKey     string
	HTTPClient *http.Client
}

func NewGoogleTranslator(apiKey string) *GoogleTranslator {
	return &GoogleTranslator{
		APIKey: apiKey,
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (g *GoogleTranslator) Name() string {
	return "google-cloud-translate"
}

func (g *GoogleTranslator) Translate(ctx context.Context, req Request) (Result, error) {
	if g.APIKey == "" {
		return Result{}, ErrProviderNotConfigured
	}

	endpoint := "https://translation.googleapis.com/language/translate/v2"
	values := url.Values{}
	values.Set("key", g.APIKey)
	values.Set("q", req.Text)
	values.Set("target", req.TargetLang)
	if req.SourceLang != "" {
		values.Set("source", req.SourceLang)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewBufferString(values.Encode()))
	if err != nil {
		return Result{}, err
	}
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := g.HTTPClient.Do(httpReq)
	if err != nil {
		return Result{}, ErrTranslationUnavailable
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return Result{}, fmt.Errorf("%w: status %d", ErrTranslationUnavailable, resp.StatusCode)
	}

	var data struct {
		Data struct {
			Translations []struct {
				TranslatedText string `json:"translatedText"`
			} `json:"translations"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return Result{}, ErrTranslationUnavailable
	}

	if len(data.Data.Translations) == 0 {
		return Result{}, ErrTranslationUnavailable
	}

	return Result{
		TranslatedText: data.Data.Translations[0].TranslatedText,
		Provider:       g.Name(),
	}, nil
}

// OpenAITranslator connects to OpenAI-compatible LLM endpoints for nuance-aware translation.
type OpenAITranslator struct {
	APIKey     string
	BaseURL    string
	Model      string
	HTTPClient *http.Client
}

func NewOpenAITranslator(apiKey, baseURL, model string) *OpenAITranslator {
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	if model == "" {
		model = "gpt-4o-mini"
	}
	return &OpenAITranslator{
		APIKey:     apiKey,
		BaseURL:    baseURL,
		Model:      model,
		HTTPClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (o *OpenAITranslator) Name() string {
	return "openai-translate"
}

func (o *OpenAITranslator) Translate(ctx context.Context, req Request) (Result, error) {
	if o.APIKey == "" {
		return Result{}, ErrProviderNotConfigured
	}

	prompt := fmt.Sprintf(
		"Translate the following text accurately from %s to %s for a user living in Saudi Arabia. Preserve tone and workplace terms. Output ONLY the raw translated text:\n\n%s",
		req.SourceLang, req.TargetLang, req.Text,
	)

	payload := map[string]any{
		"model": o.Model,
		"messages": []map[string]string{
			{"role": "system", "content": "You are a professional legal and workplace translator for Saudi Arabia."},
			{"role": "user", "content": prompt},
		},
		"temperature": 0.1,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return Result{}, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, o.BaseURL+"/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return Result{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+o.APIKey)

	resp, err := o.HTTPClient.Do(httpReq)
	if err != nil {
		return Result{}, ErrTranslationUnavailable
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return Result{}, fmt.Errorf("%w: status %d", ErrTranslationUnavailable, resp.StatusCode)
	}

	var chatResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil || len(chatResp.Choices) == 0 {
		return Result{}, ErrTranslationUnavailable
	}

	return Result{
		TranslatedText: chatResp.Choices[0].Message.Content,
		Provider:       o.Name(),
	}, nil
}

// MockTranslator is used strictly in tests or mock development mode.
type MockTranslator struct {
	MockResults map[string]string
	Err         error
}

func (m MockTranslator) Name() string {
	return "mock-translator"
}

func (m MockTranslator) Translate(ctx context.Context, request Request) (Result, error) {
	if m.Err != nil {
		return Result{}, m.Err
	}
	if text, ok := m.MockResults[request.Text]; ok {
		return Result{TranslatedText: text, Provider: "mock-translator"}, nil
	}
	return Result{
		TranslatedText: fmt.Sprintf("[%s]: %s", request.TargetLang, request.Text),
		Provider:       "mock-translator",
	}, nil
}

// GeminiTranslator connects to Google Gemini Generative Language API
type GeminiTranslator struct {
	APIKey     string
	HTTPClient *http.Client
}

func NewGeminiTranslator(apiKey string) *GeminiTranslator {
	return &GeminiTranslator{
		APIKey:     apiKey,
		HTTPClient: &http.Client{Timeout: 45 * time.Second},
	}
}

func (g *GeminiTranslator) Name() string {
	return "google-gemini-translate"
}

func (g *GeminiTranslator) Translate(ctx context.Context, req Request) (Result, error) {
	if g.APIKey == "" {
		return Result{}, ErrProviderNotConfigured
	}
	if req.SourceLang != "" && strings.EqualFold(req.SourceLang, req.TargetLang) {
		return Result{TranslatedText: req.Text, Provider: "same-language"}, nil
	}

	prompt := fmt.Sprintf(
		"Translate the following text accurately from %s to %s for a user living in Saudi Arabia. Preserve workplace, administrative, and legal nuances. Output ONLY the raw translated text, with no explanations, notes, or markdown formatting:\n\n%s",
		req.SourceLang, req.TargetLang, req.Text,
	)

	payload := map[string]any{
		"contents": []map[string]any{
			{
				"parts": []map[string]string{
					{"text": prompt},
				},
			},
		},
		"generationConfig": map[string]any{
			"thinkingConfig": map[string]any{
				"thinkingBudget": 0,
			},
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return Result{}, err
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=%s", g.APIKey)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return Result{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-goog-api-key", g.APIKey)

	resp, err := g.HTTPClient.Do(httpReq)
	if err != nil || resp.StatusCode != http.StatusOK {
		// If Gemini is unreachable or hits daily rate quota (429), seamlessly fallback to MyMemory
		return NewMyMemoryTranslator().Translate(ctx, req)
	}
	defer resp.Body.Close()

	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil || len(geminiResp.Candidates) == 0 {
		return NewMyMemoryTranslator().Translate(ctx, req)
	}

	var translated string
	for _, p := range geminiResp.Candidates[0].Content.Parts {
		translated += p.Text
	}
	translated = strings.TrimSpace(translated)
	if translated == "" {
		return NewMyMemoryTranslator().Translate(ctx, req)
	}

	return Result{
		TranslatedText: translated,
		Provider:       g.Name(),
	}, nil
}

// Factory to create the configured translator from environment settings
func CreateTranslator(providerName, apiKey string) Translator {
	if apiKey != "" && (providerName == "gemini" || strings.HasPrefix(apiKey, "AQ.") || strings.HasPrefix(apiKey, "AIza")) {
		return NewGeminiTranslator(apiKey)
	}
	switch providerName {
	case "gemini":
		return NewGeminiTranslator(apiKey)
	case "mymemory", "free", "public":
		return NewMyMemoryTranslator()
	case "google", "google-cloud-translate":
		return NewGoogleTranslator(apiKey)
	case "openai", "openai-translate":
		return NewOpenAITranslator(apiKey, "", "")
	case "mock":
		return MockTranslator{
			MockResults: map[string]string{
				"Please submit your application before the deadline.": "يُرجى تقديم طلبك قبل الموعد النهائي.",
				"Welcome to Riyadh!": "أهلاً وسهلاً بك في الرياض!",
			},
		}
	default:
		if apiKey != "" {
			return NewGeminiTranslator(apiKey)
		}
		return NewMyMemoryTranslator()
	}
}
