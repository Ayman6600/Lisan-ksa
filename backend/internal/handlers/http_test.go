package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/your-org/lisan-ksa/backend/internal/config"
	"github.com/your-org/lisan-ksa/backend/internal/providers"
)

func setupTestRouter(translator providers.Translator) (*chi.Mux, *AppState) {
	if translator == nil {
		translator = providers.Unconfigured{}
	}
	app := &AppState{
		Config: config.Config{
			RateLimitRPM:     100,
			MaxBodySizeBytes: 64 * 1024,
		},
		Translator: translator,
		OCR:        providers.MockOCR{},
		Explainer:  providers.MockExplanationProvider{},
	}
	r := chi.NewRouter()
	RegisterRoutes(r, app)
	return r, app
}

func TestHealth(t *testing.T) {
	r, _ := setupTestRouter(nil)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected %d, got %d", http.StatusOK, rec.Code)
	}
	var res map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to parse json: %v", err)
	}
	if res["status"] != "ok" || res["service"] != "lisan-ksa-api" {
		t.Fatalf("unexpected body: %+v", res)
	}
}

func TestReady(t *testing.T) {
	r, _ := setupTestRouter(nil)
	req := httptest.NewRequest(http.MethodGet, "/ready", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected %d, got %d", http.StatusOK, rec.Code)
	}
	var res map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to parse json: %v", err)
	}
	if res["status"] != "ready" {
		t.Fatalf("expected ready, got %+v", res)
	}
}

func TestLanguages(t *testing.T) {
	r, _ := setupTestRouter(nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/languages", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected %d, got %d", http.StatusOK, rec.Code)
	}
	var res struct {
		Languages []Language `json:"languages"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to parse json: %v", err)
	}
	if len(res.Languages) != 5 {
		t.Fatalf("expected 5 languages, got %d", len(res.Languages))
	}
}

func TestTranslateText_Unconfigured(t *testing.T) {
	r, _ := setupTestRouter(providers.Unconfigured{})
	body := `{"text": "Hello world", "sourceLang": "en", "targetLang": "ar"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/translations/text", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rec.Code, rec.Body.String())
	}
	var res map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to parse json: %v", err)
	}
	if res["error"] != "provider_not_configured" {
		t.Fatalf("expected provider_not_configured, got %v", res["error"])
	}
}

func TestTranslateText_Validation(t *testing.T) {
	r, _ := setupTestRouter(providers.Unconfigured{})

	cases := []struct {
		name       string
		body       string
		wantStatus int
		wantError  string
	}{
		{
			name:       "empty text",
			body:       `{"text": "   ", "targetLang": "ar"}`,
			wantStatus: http.StatusBadRequest,
			wantError:  "empty_text",
		},
		{
			name:       "missing targetLang",
			body:       `{"text": "Hello"}`,
			wantStatus: http.StatusBadRequest,
			wantError:  "target_language_required",
		},
		{
			name:       "unsupported targetLang",
			body:       `{"text": "Hello", "targetLang": "de"}`,
			wantStatus: http.StatusBadRequest,
			wantError:  "unsupported_target_language",
		},
		{
			name:       "invalid JSON",
			body:       `{not json}`,
			wantStatus: http.StatusBadRequest,
			wantError:  "invalid_json",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/translations/text", strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("expected status %d, got %d: %s", tc.wantStatus, rec.Code, rec.Body.String())
			}
			var res map[string]any
			_ = json.Unmarshal(rec.Body.Bytes(), &res)
			if res["error"] != tc.wantError {
				t.Fatalf("expected error code %s, got %v", tc.wantError, res["error"])
			}
		})
	}
}

func TestTranslateText_MockSuccess(t *testing.T) {
	mock := providers.MockTranslator{
		MockResults: map[string]string{
			"Please submit your application before the deadline.": "يُرجى تقديم طلبك قبل الموعد النهائي.",
		},
	}
	r, _ := setupTestRouter(mock)

	body := `{"text": "Please submit your application before the deadline.", "sourceLang": "en", "targetLang": "ar"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/translations/text", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var res TranslateTextResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if res.RequestID == "" {
		t.Fatalf("expected non-empty requestId")
	}
	if res.SourceLang != "en" || res.TargetLang != "ar" {
		t.Fatalf("unexpected languages: src=%s target=%s", res.SourceLang, res.TargetLang)
	}
	if res.TranslatedText != "يُرجى تقديم طلبك قبل الموعد النهائي." {
		t.Fatalf("unexpected translatedText: %s", res.TranslatedText)
	}
	if res.Provider != "mock-translator" || res.Status != "completed" {
		t.Fatalf("unexpected provider or status: provider=%s status=%s", res.Provider, res.Status)
	}
}

func TestPreferences(t *testing.T) {
	r, _ := setupTestRouter(nil)

	// GET
	reqGet := httptest.NewRequest(http.MethodGet, "/api/v1/me/preferences", nil)
	recGet := httptest.NewRecorder()
	r.ServeHTTP(recGet, reqGet)
	if recGet.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recGet.Code)
	}

	// PUT valid
	validPut := `{"sourceLanguage": "en", "targetLanguage": "ur", "historyEnabled": false}`
	reqPut := httptest.NewRequest(http.MethodPut, "/api/v1/me/preferences", bytes.NewBufferString(validPut))
	reqPut.Header.Set("Content-Type", "application/json")
	recPut := httptest.NewRecorder()
	r.ServeHTTP(recPut, reqPut)
	if recPut.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recPut.Code, recPut.Body.String())
	}

	// PUT invalid language
	invalidPut := `{"sourceLanguage": "xyz", "targetLanguage": "ar"}`
	reqPutBad := httptest.NewRequest(http.MethodPut, "/api/v1/me/preferences", bytes.NewBufferString(invalidPut))
	reqPutBad.Header.Set("Content-Type", "application/json")
	recPutBad := httptest.NewRecorder()
	r.ServeHTTP(recPutBad, reqPutBad)
	if recPutBad.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recPutBad.Code)
	}
}

func TestOpenAPI(t *testing.T) {
	r, _ := setupTestRouter(nil)
	req := httptest.NewRequest(http.MethodGet, "/openapi.yaml", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "openapi: 3.0.3") {
		t.Fatalf("expected OpenAPI yaml content")
	}
}

func TestExplanation(t *testing.T) {
	r, _ := setupTestRouter(nil)
	body := `{"text": "مطلوب تصديق العقد", "userLanguage": "en"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/explanations", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestKnowledgeSearch(t *testing.T) {
	r, _ := setupTestRouter(nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/knowledge/search?q=qiwa", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestGlossary(t *testing.T) {
	r, _ := setupTestRouter(nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/glossary", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestHistory(t *testing.T) {
	r, _ := setupTestRouter(nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/history", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	reqDel := httptest.NewRequest(http.MethodDelete, "/api/v1/history", nil)
	recDel := httptest.NewRecorder()
	r.ServeHTTP(recDel, reqDel)

	if recDel.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recDel.Code)
	}
}

func TestUsage(t *testing.T) {
	r, _ := setupTestRouter(nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/usage", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestAuth_Endpoints(t *testing.T) {
	r, _ := setupTestRouter(nil)

	// 1. Register test
	regBody := `{"name":"Tariq Mansoor","email":"tariq@lisan.sa","password":"password123","nationalId":"2394857162","preferredLanguage":"ar"}`
	reqReg := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", strings.NewReader(regBody))
	reqReg.Header.Set("Content-Type", "application/json")
	recReg := httptest.NewRecorder()
	r.ServeHTTP(recReg, reqReg)

	if recReg.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for register, got %d: %s", recReg.Code, recReg.Body.String())
	}

	var regResp AuthResponse
	if err := json.Unmarshal(recReg.Body.Bytes(), &regResp); err != nil || regResp.Token == "" {
		t.Fatalf("expected token in register response: %v", err)
	}

	// 2. Login test
	loginBody := `{"email":"tariq@lisan.sa","password":"password123"}`
	reqLogin := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(loginBody))
	reqLogin.Header.Set("Content-Type", "application/json")
	recLogin := httptest.NewRecorder()
	r.ServeHTTP(recLogin, reqLogin)

	if recLogin.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for login, got %d: %s", recLogin.Code, recLogin.Body.String())
	}

	var loginResp AuthResponse
	_ = json.Unmarshal(recLogin.Body.Bytes(), &loginResp)
	token := loginResp.Token

	// 3. Authenticated GetMe test
	reqMe := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	reqMe.Header.Set("Authorization", "Bearer "+token)
	recMe := httptest.NewRecorder()
	r.ServeHTTP(recMe, reqMe)

	if recMe.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /auth/me, got %d", recMe.Code)
	}

	// 4. Nafath SSO Challenge & Verify test
	nafathChallengeBody := `{"nationalId":"1029384756","stage":"challenge"}`
	reqNafath := httptest.NewRequest(http.MethodPost, "/api/v1/auth/nafath", strings.NewReader(nafathChallengeBody))
	reqNafath.Header.Set("Content-Type", "application/json")
	recNafath := httptest.NewRecorder()
	r.ServeHTTP(recNafath, reqNafath)

	if recNafath.Code != http.StatusOK {
		t.Fatalf("expected 200 for Nafath challenge, got %d", recNafath.Code)
	}

	nafathVerifyBody := `{"nationalId":"1029384756","stage":"verify"}`
	reqNafathV := httptest.NewRequest(http.MethodPost, "/api/v1/auth/nafath", strings.NewReader(nafathVerifyBody))
	reqNafathV.Header.Set("Content-Type", "application/json")
	recNafathV := httptest.NewRecorder()
	r.ServeHTTP(recNafathV, reqNafathV)

	if recNafathV.Code != http.StatusOK {
		t.Fatalf("expected 200 for Nafath verify, got %d", recNafathV.Code)
	}
}

func TestVoiceTranslate(t *testing.T) {
	r, _ := setupTestRouter(nil)

	// 1. JSON Base64 audio translation test
	dummyAudioB64 := "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=" // Dummy WAV
	voiceBody := map[string]string{
		"audioBase64": dummyAudioB64,
		"mimeType":    "audio/wav",
		"speakerLang": "ar",
		"targetLang":  "en",
	}
	bodyBytes, _ := json.Marshal(voiceBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/voice/translate", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for voice translation, got %d: %s", rec.Code, rec.Body.String())
	}

	var res VoiceTranslateResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if res.Status != "completed" {
		t.Fatalf("expected status completed, got %s", res.Status)
	}
	if res.TranscribedText == "" || res.TranslatedText == "" {
		t.Fatalf("expected non-empty transcribed and translated text, got %+v", res)
	}
	if res.SpeakerLang != "ar" || res.TargetLang != "en" {
		t.Fatalf("unexpected languages in response: %s -> %s", res.SpeakerLang, res.TargetLang)
	}

	// 2. Empty audio validation error test
	emptyReq := httptest.NewRequest(http.MethodPost, "/api/v1/voice/translate", strings.NewReader(`{"audioBase64":""}`))
	emptyReq.Header.Set("Content-Type", "application/json")
	emptyRec := httptest.NewRecorder()
	r.ServeHTTP(emptyRec, emptyReq)

	if emptyRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for empty audio, got %d", emptyRec.Code)
	}
}

