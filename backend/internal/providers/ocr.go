package providers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

var (
	ErrOCRProviderNotConfigured = errors.New("ocr_provider_not_configured")
	ErrOCRUnavailable           = errors.New("ocr_unavailable")
	ErrInvalidImageFormat       = errors.New("invalid_image_format")
)

type BoundingBox struct {
	X int `json:"x"`
	Y int `json:"y"`
	W int `json:"w"`
	H int `json:"h"`
}

type OCRBlock struct {
	Text       string      `json:"text"`
	Confidence float64     `json:"confidence,omitempty"`
	Box        BoundingBox `json:"box,omitempty"`
}

type OCRResult struct {
	FullText   string     `json:"fullText"`
	Blocks     []OCRBlock `json:"blocks"`
	Confidence float64    `json:"confidence,omitempty"`
	Provider   string     `json:"provider"`
}

type OCRProvider interface {
	Name() string
	ExtractText(ctx context.Context, imgData []byte, mimeType string) (OCRResult, error)
}

// UnconfiguredOCR is the default when no OCR provider is configured.
type UnconfiguredOCR struct{}

func (UnconfiguredOCR) Name() string {
	return "unconfigured"
}

func (UnconfiguredOCR) ExtractText(ctx context.Context, imgData []byte, mimeType string) (OCRResult, error) {
	return OCRResult{}, ErrOCRProviderNotConfigured
}

// GoogleVisionOCR connects to Google Cloud Vision API
type GoogleVisionOCR struct {
	APIKey     string
	HTTPClient *http.Client
}

func NewGoogleVisionOCR(apiKey string) *GoogleVisionOCR {
	return &GoogleVisionOCR{
		APIKey:     apiKey,
		HTTPClient: &http.Client{Timeout: 20 * time.Second},
	}
}

func (g *GoogleVisionOCR) Name() string {
	return "google-cloud-vision"
}

func (g *GoogleVisionOCR) ExtractText(ctx context.Context, imgData []byte, mimeType string) (OCRResult, error) {
	if g.APIKey == "" {
		return OCRResult{}, ErrOCRProviderNotConfigured
	}

	b64Image := base64.StdEncoding.EncodeToString(imgData)
	reqPayload := map[string]any{
		"requests": []map[string]any{
			{
				"image": map[string]string{"content": b64Image},
				"features": []map[string]any{
					{"type": "DOCUMENT_TEXT_DETECTION"},
				},
			},
		},
	}

	bodyBytes, err := json.Marshal(reqPayload)
	if err != nil {
		return OCRResult{}, err
	}

	url := fmt.Sprintf("https://vision.googleapis.com/v1/images:annotate?key=%s", g.APIKey)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return OCRResult{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := g.HTTPClient.Do(httpReq)
	if err != nil {
		return OCRResult{}, ErrOCRUnavailable
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return OCRResult{}, fmt.Errorf("%w: vision api returned status %d", ErrOCRUnavailable, resp.StatusCode)
	}

	var visionResp struct {
		Responses []struct {
			FullTextAnnotation struct {
				Text string `json:"text"`
			} `json:"fullTextAnnotation"`
			TextAnnotations []struct {
				Description string `json:"description"`
			} `json:"textAnnotations"`
		} `json:"responses"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&visionResp); err != nil || len(visionResp.Responses) == 0 {
		return OCRResult{}, ErrOCRUnavailable
	}

	fullText := visionResp.Responses[0].FullTextAnnotation.Text
	var blocks []OCRBlock
	for i, annot := range visionResp.Responses[0].TextAnnotations {
		if i == 0 {
			continue // first item is the full aggregated text in Vision API
		}
		blocks = append(blocks, OCRBlock{
			Text: annot.Description,
		})
	}

	return OCRResult{
		FullText: fullText,
		Blocks:   blocks,
		Provider: g.Name(),
	}, nil
}

// MockOCR for testing
type MockOCR struct {
	MockText string
	Err      error
}

func (m MockOCR) Name() string {
	return "mock-ocr"
}

func (m MockOCR) ExtractText(ctx context.Context, imgData []byte, mimeType string) (OCRResult, error) {
	if m.Err != nil {
		return OCRResult{}, m.Err
	}
	text := m.MockText
	if text == "" {
		text = "SAMPLE EXTRACTED TEXT FROM SCREENSHOT"
	}
	return OCRResult{
		FullText: text,
		Blocks: []OCRBlock{
			{Text: text, Confidence: 0.98},
		},
		Confidence: 0.98,
		Provider:   "mock-ocr",
	}, nil
}

// GeminiVisionOCR extracts text using Google Gemini 3.8 Flash Vision
type GeminiVisionOCR struct {
	APIKey     string
	HTTPClient *http.Client
}

func NewGeminiVisionOCR(apiKey string) *GeminiVisionOCR {
	return &GeminiVisionOCR{
		APIKey:     apiKey,
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (g *GeminiVisionOCR) Name() string {
	return "google-gemini-vision-ocr"
}

func (g *GeminiVisionOCR) ExtractText(ctx context.Context, imgData []byte, mimeType string) (OCRResult, error) {
	if g.APIKey == "" {
		return OCRResult{}, ErrOCRProviderNotConfigured
	}

	if mimeType == "" {
		mimeType = "image/jpeg"
	}

	b64Image := base64.StdEncoding.EncodeToString(imgData)
	prompt := "Extract all Arabic and English text in this image accurately, preserving reading order line by line. Output ONLY the extracted text with no introductory or concluding remarks."

	payload := map[string]any{
		"contents": []map[string]any{
			{
				"parts": []any{
					map[string]string{"text": prompt},
					map[string]any{
						"inline_data": map[string]string{
							"mime_type": mimeType,
							"data":      b64Image,
						},
					},
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
		return OCRResult{}, err
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=%s", g.APIKey)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return OCRResult{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-goog-api-key", g.APIKey)

	resp, err := g.HTTPClient.Do(httpReq)
	if err != nil {
		return OCRResult{}, ErrOCRUnavailable
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return OCRResult{}, fmt.Errorf("%w: gemini vision status %d", ErrOCRUnavailable, resp.StatusCode)
	}

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
		return OCRResult{}, ErrOCRUnavailable
	}

	var fullText string
	for _, p := range geminiResp.Candidates[0].Content.Parts {
		fullText += p.Text
	}
	fullText = strings.TrimSpace(fullText)

	lines := strings.Split(fullText, "\n")
	var blocks []OCRBlock
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			blocks = append(blocks, OCRBlock{
				Text:       trimmed,
				Confidence: 0.96,
			})
		}
	}

	return OCRResult{
		FullText:   fullText,
		Blocks:     blocks,
		Confidence: 0.96,
		Provider:   g.Name(),
	}, nil
}

func CreateOCRProvider(providerName, apiKey string) OCRProvider {
	if apiKey != "" && (providerName == "gemini" || strings.HasPrefix(apiKey, "AQ.") || strings.HasPrefix(apiKey, "AIza")) {
		return NewGeminiVisionOCR(apiKey)
	}
	switch providerName {
	case "gemini":
		return NewGeminiVisionOCR(apiKey)
	case "google", "google-cloud-vision":
		return NewGoogleVisionOCR(apiKey)
	case "mock":
		return MockOCR{}
	default:
		if apiKey != "" {
			return NewGeminiVisionOCR(apiKey)
		}
		return UnconfiguredOCR{}
	}
}
