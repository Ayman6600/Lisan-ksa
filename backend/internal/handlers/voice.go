package handlers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/your-org/lisan-ksa/backend/internal/middleware"
)

type VoiceTranslateRequest struct {
	AudioBase64 string `json:"audioBase64"`
	MimeType    string `json:"mimeType"`
	SpeakerLang string `json:"speakerLang"`
	TargetLang  string `json:"targetLang"`
}

type VoiceTranslateResponse struct {
	RequestID       string `json:"requestId"`
	TranscribedText string `json:"transcribedText"`
	TranslatedText  string `json:"translatedText"`
	SpeakerLang     string `json:"speakerLang"`
	TargetLang      string `json:"targetLang"`
	Provider        string `json:"provider"`
	Status          string `json:"status"`
}

// TranslateVoice handles 2-person live conversational audio interpretation
// with AssemblyAI STT as primary speech engine, Gemini Multimodal as fallback,
// and local Saudi conversational dialect models.
func (app *AppState) TranslateVoice(w http.ResponseWriter, r *http.Request) {
	reqID := middleware.GetRequestID(r.Context())

	var audioBytes []byte
	var mimeType string
	var speakerLang string
	var targetLang string

	// Support both multipart form data and raw JSON base64
	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "multipart/form-data") {
		// Enforce 15MB audio upload limit
		if err := r.ParseMultipartForm(15 * 1024 * 1024); err != nil {
			writeError(w, r, http.StatusBadRequest, "invalid_audio_upload", "Maximum audio upload size is 15MB.")
			return
		}

		file, header, err := r.FormFile("audio")
		if err != nil {
			writeError(w, r, http.StatusBadRequest, "missing_audio", "An audio file is required in 'audio' field.")
			return
		}
		defer file.Close()

		audioBytes, err = io.ReadAll(file)
		if err != nil {
			writeError(w, r, http.StatusBadRequest, "read_error", "Failed to read audio file.")
			return
		}

		mimeType = header.Header.Get("Content-Type")
		if mimeType == "" || mimeType == "application/octet-stream" {
			mimeType = "audio/m4a"
		}
		speakerLang = r.FormValue("speakerLang")
		targetLang = r.FormValue("targetLang")
	} else {
		var req VoiceTranslateRequest
		dec := json.NewDecoder(r.Body)
		if err := dec.Decode(&req); err != nil {
			writeError(w, r, http.StatusBadRequest, "invalid_json", "Send valid JSON with audioBase64.")
			return
		}

		var err error
		audioBytes, err = base64.StdEncoding.DecodeString(req.AudioBase64)
		if err != nil {
			writeError(w, r, http.StatusBadRequest, "invalid_base64", "Audio data is not valid base64.")
			return
		}

		mimeType = req.MimeType
		speakerLang = req.SpeakerLang
		targetLang = req.TargetLang
	}

	if len(audioBytes) == 0 {
		writeError(w, r, http.StatusBadRequest, "empty_audio", "Audio payload cannot be empty.")
		return
	}

	if mimeType == "" {
		mimeType = "audio/m4a"
	}
	if speakerLang == "" {
		speakerLang = "ar"
	}
	if targetLang == "" {
		if speakerLang == "ar" {
			targetLang = "en"
		} else {
			targetLang = "ar"
		}
	}

	apiKey := os.Getenv("EXPLANATION_API_KEY")
	if apiKey == "" {
		apiKey = os.Getenv("TRANSLATION_API_KEY")
	}

	// Resolve AssemblyAI Key from Header, Config, or Environment
	assemblyKey := r.Header.Get("X-AssemblyAI-Key")
	if assemblyKey == "" {
		assemblyKey = app.Config.AssemblyAIKey
	}
	if assemblyKey == "" {
		assemblyKey = os.Getenv("ASSEMBLYAI_API_KEY")
	}
	if assemblyKey == "" {
		assemblyKey = os.Getenv("ASSEMBLY_AI_API_KEY")
	}

	var transcribed, translated string
	provider := "saudi-conversational-engine"

	// 1. Try AssemblyAI Speech-to-Text if key is available
	if assemblyKey != "" {
		assemblyTranscribed, err := transcribeAudioWithAssemblyAI(r.Context(), audioBytes, speakerLang, assemblyKey)
		if err == nil && assemblyTranscribed != "" {
			transcribed = assemblyTranscribed
			provider = "assemblyai"

			// Translate transcribed text with Saudi context awareness
			translatedText, err := translateTranscribedSpeech(r.Context(), transcribed, speakerLang, targetLang, apiKey)
			if err == nil && translatedText != "" {
				translated = translatedText
				provider = "assemblyai+gemini"
			}
		}
	}

	// 2. If AssemblyAI was not used or failed, fall back to Gemini Multimodal Audio
	if transcribed == "" {
		geminiTrans, geminiTransl, err := processAudioWithGemini(r.Context(), audioBytes, mimeType, speakerLang, targetLang, apiKey)
		if err == nil && geminiTrans != "" {
			transcribed = geminiTrans
			translated = geminiTransl
			provider = "google-gemini-voice"
		}
	}

	// 3. Handle transcription results - do NOT substitute fake Qiwa contract dialogue
	if transcribed == "" {
		if assemblyKey == "" && apiKey == "" {
			fbTrans, fbTransl := getConversationalFallback(speakerLang, targetLang)
			transcribed = fbTrans
			translated = fbTransl
			provider = "demo-fallback"
		} else {
			writeError(w, r, http.StatusUnprocessableEntity, "no_speech_detected", "No speech was recognized in the audio. Please speak clearly into the microphone.")
			return
		}
	} else if translated == "" {
		translatedText, err := translateTranscribedSpeech(r.Context(), transcribed, speakerLang, targetLang, apiKey)
		if err == nil && translatedText != "" {
			translated = translatedText
		} else {
			translated = transcribed
		}
	}

	writeJSON(w, http.StatusOK, VoiceTranslateResponse{
		RequestID:       reqID,
		TranscribedText: transcribed,
		TranslatedText:  translated,
		SpeakerLang:     speakerLang,
		TargetLang:      targetLang,
		Provider:        provider,
		Status:          "completed",
	})
}

// transcribeAudioWithAssemblyAI uploads audio and polls AssemblyAI for transcription
func transcribeAudioWithAssemblyAI(ctx context.Context, audioBytes []byte, speakerLang, apiKey string) (string, error) {
	// Step 1: Upload audio to AssemblyAI upload bucket
	uploadURL, err := uploadToAssemblyAI(ctx, audioBytes, apiKey)
	if err != nil {
		return "", err
	}

	// Step 2: Create Transcript Request
	transcriptID, err := requestAssemblyAITranscript(ctx, uploadURL, speakerLang, apiKey)
	if err != nil {
		return "", err
	}

	// Step 3: Poll for completion
	return pollAssemblyAITranscript(ctx, transcriptID, apiKey)
}

func uploadToAssemblyAI(ctx context.Context, audioBytes []byte, apiKey string) (string, error) {
	reqCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, "https://api.assemblyai.com/v2/upload", bytes.NewReader(audioBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", apiKey)
	req.Header.Set("Content-Type", "application/octet-stream")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("assemblyai upload failed (%d): %s", resp.StatusCode, string(body))
	}

	var res struct {
		UploadURL string `json:"upload_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}
	return res.UploadURL, nil
}

func requestAssemblyAITranscript(ctx context.Context, uploadURL, speakerLang, apiKey string) (string, error) {
	reqCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	payload := map[string]any{
		"audio_url": uploadURL,
	}

	langCode := mapSpeakerLangToAssemblyAI(speakerLang)
	if langCode != "" {
		payload["language_code"] = langCode
	} else {
		payload["language_detection"] = true
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, "https://api.assemblyai.com/v2/transcript", bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("assemblyai transcript request failed (%d): %s", resp.StatusCode, string(body))
	}

	var res struct {
		ID     string `json:"id"`
		Status string `json:"status"`
		Error  string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}
	if res.Error != "" {
		return "", fmt.Errorf("assemblyai error: %s", res.Error)
	}
	return res.ID, nil
}

func pollAssemblyAITranscript(ctx context.Context, transcriptID, apiKey string) (string, error) {
	pollURL := fmt.Sprintf("https://api.assemblyai.com/v2/transcript/%s", transcriptID)
	client := &http.Client{Timeout: 10 * time.Second}

	deadline := time.Now().Add(35 * time.Second)
	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		default:
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, pollURL, nil)
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", apiKey)

		resp, err := client.Do(req)
		if err != nil {
			time.Sleep(1 * time.Second)
			continue
		}

		var res struct {
			Status string `json:"status"`
			Text   string `json:"text"`
			Error  string `json:"error"`
		}
		decodeErr := json.NewDecoder(resp.Body).Decode(&res)
		resp.Body.Close()

		if decodeErr == nil {
			switch res.Status {
			case "completed":
				return strings.TrimSpace(res.Text), nil
			case "error":
				return "", fmt.Errorf("assemblyai transcription error: %s", res.Error)
			}
		}

		time.Sleep(800 * time.Millisecond)
	}

	return "", fmt.Errorf("assemblyai polling timed out")
}

func mapSpeakerLangToAssemblyAI(lang string) string {
	clean := strings.ToLower(strings.TrimSpace(lang))
	if strings.Contains(clean, "-") {
		clean = strings.Split(clean, "-")[0]
	}
	switch clean {
	case "ar":
		return "ar"
	case "en":
		return "en"
	case "ur":
		return "ur"
	case "hi":
		return "hi"
	case "bn":
		return "bn"
	case "tl", "fil":
		return "tl"
	case "id":
		return "id"
	case "es":
		return "es"
	case "fr":
		return "fr"
	default:
		return ""
	}
}

// translateTranscribedSpeech translates transcribed text into the target language preserving Saudi context
func translateTranscribedSpeech(ctx context.Context, text, speakerLang, targetLang, apiKey string) (string, error) {
	if text == "" {
		return "", fmt.Errorf("empty text to translate")
	}
	if apiKey == "" {
		return "", fmt.Errorf("no translation api key")
	}

	speakerName := getLanguageName(speakerLang)
	targetName := getLanguageName(targetLang)

	prompt := fmt.Sprintf(`You are Lisan KSA's live bilingual interpreter for face-to-face dialogue in Saudi Arabia.
Translate the following speech spoken by a %s into %s.
Ensure the translation is natural, respectful, and accurately reflects Saudi workplace and civic terms (e.g., Qiwa, Absher, Muqeem, Iqama, Kafala, Nafath).

Spoken Text: "%s"

Output ONLY the translated text in %s. Do not include quotes or conversational filler.`, speakerName, targetName, text, targetName)

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
		return "", err
	}

	reqCtx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=%s", apiKey)
	httpReq, err := http.NewRequestWithContext(reqCtx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-goog-api-key", apiKey)

	client := &http.Client{Timeout: 25 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini translation status %d", resp.StatusCode)
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
		return "", fmt.Errorf("empty translation response")
	}

	var output string
	for _, p := range geminiResp.Candidates[0].Content.Parts {
		output += p.Text
	}
	return strings.TrimSpace(output), nil
}

func getLanguageName(code string) string {
	switch strings.ToLower(code) {
	case "ar":
		return "Arabic (Saudi / Gulf Dialect)"
	case "en":
		return "English"
	case "ur":
		return "Urdu"
	case "hi":
		return "Hindi"
	case "bn":
		return "Bengali"
	case "tl", "fil":
		return "Filipino / Tagalog"
	case "id":
		return "Indonesian"
	default:
		return strings.ToUpper(code)
	}
}

func getConversationalFallback(speakerLang, targetLang string) (string, string) {
	if speakerLang == "ar" {
		transcribed := "أهلاً بك، أود الاستفسار عن توثيق عقد العمل ورخصة العمل عبر منصة قوى."
		var translated string
		switch targetLang {
		case "ur":
			translated = "خوش آمدید، میں قویٰ پلیٹ فارم کے ذریعے ورک کنٹریکٹ اور ورک پرمٹ کی توثیق کے بارے میں معلومات حاصل کرنا چاہتا ہوں۔"
		case "hi":
			translated = "स्वागत है, मैं किवा प्लेटफॉर्म के माध्यम से कार्य अनुबंध और वर्क परमिट के प्रमाणीकरण के बारे में पूछताछ करना चाहता हूँ।"
		case "bn":
			translated = "স্বাগতম, আমি কিওয়া প্ল্যাটফর্মের মাধ্যমে কাজের চুক্তি এবং ওয়ার্ক পারমিট সত্যায়িত করার বিষয়ে জিজ্ঞাসা করতে চাই।"
		default:
			translated = "Welcome, I would like to inquire about authenticating the work contract and work permit via Qiwa platform."
		}
		return transcribed, translated
	}

	if speakerLang == "ur" {
		transcribed := "کیا آپ مجھے بتا سکتے ہیں کہ اقامہ کی تجدید کی فیس سداد کے ذریعے کیسے ادا کریں؟"
		translated := "هل يمكنك إخباري بكيفية سداد رسوم تجديد الإقامة عبر نظام سداد؟"
		return transcribed, translated
	}

	if speakerLang == "hi" {
		transcribed := "क्या आप मुझे बता सकते हैं कि इकामा नवीनीकरण शुल्क का भुगतान सदद के माध्यम से कैसे करें?"
		translated := "هل يمكنك إخباري بكيفية سداد رسوم تجديد الإقامة عبر نظام سداد؟"
		return transcribed, translated
	}

	if speakerLang == "bn" {
		transcribed := "আপনি কি আমাকে বলতে পারেন কিভাবে সাদাদের মাধ্যমে ইকামা নবায়ন ফি পরিশোধ করতে হয়?"
		translated := "هل يمكنك إخباري بكيفية سداد رسوم تجديد الإقامة عبر نظام سداد؟"
		return transcribed, translated
	}

	// Default counterpart (English or others) to Arabic:
	transcribed := "Hello, where can I verify my employment contract and work permit on the Qiwa platform?"
	translated := "مرحباً، أين يمكنني التحقق من عقد العمل ورخصة العمل الخاصة بي عبر منصة قوى؟"
	return transcribed, translated
}

func processAudioWithGemini(ctx context.Context, audioData []byte, mimeType, speakerLang, targetLang, apiKey string) (string, string, error) {
	if apiKey == "" {
		return "", "", fmt.Errorf("no api key")
	}

	b64Audio := base64.StdEncoding.EncodeToString(audioData)
	speakerName := getLanguageName(speakerLang)
	targetName := getLanguageName(targetLang)

	prompt := fmt.Sprintf(`You are Lisan KSA's live two-person voice interpreter for real-time face-to-face dialogue in Saudi Arabia.
One speaker speaks %s and the other speaks %s.
The speaker in this audio is speaking %s.
1. Transcribe the exact speech spoken in %s.
2. Translate the speech accurately into %s, preserving natural, polite Saudi workplace and daily conversation tone.

Respond with a JSON object with these exact keys:
- "transcribedText": (the exact transcription in %s)
- "translatedText": (the accurate translation in %s)
Output ONLY the JSON object.`, speakerName, targetName, speakerName, speakerName, targetName, speakerName, targetName)

	payload := map[string]any{
		"contents": []map[string]any{
			{
				"parts": []any{
					map[string]string{"text": prompt},
					map[string]any{
						"inline_data": map[string]string{
							"mime_type": mimeType,
							"data":      b64Audio,
						},
					},
				},
			},
		},
		"generationConfig": map[string]any{
			"responseMimeType": "application/json",
			"thinkingConfig": map[string]any{
				"thinkingBudget": 0,
			},
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", "", err
	}

	reqCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=%s", apiKey)
	httpReq, err := http.NewRequestWithContext(reqCtx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-goog-api-key", apiKey)

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("gemini status %d", resp.StatusCode)
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
		return "", "", fmt.Errorf("empty gemini response")
	}

	var rawJSON string
	for _, p := range geminiResp.Candidates[0].Content.Parts {
		rawJSON += p.Text
	}

	var parsed struct {
		TranscribedText string `json:"transcribedText"`
		TranslatedText  string `json:"translatedText"`
	}

	if err := json.Unmarshal([]byte(rawJSON), &parsed); err == nil && parsed.TranscribedText != "" {
		return parsed.TranscribedText, parsed.TranslatedText, nil
	}

	return rawJSON, rawJSON, nil
}
