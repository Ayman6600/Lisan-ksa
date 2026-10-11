package handlers

import (
	"encoding/json"
	"net/http"
)

type UserPreferences struct {
	SourceLanguage     string         `json:"sourceLanguage"`
	TargetLanguage     string         `json:"targetLanguage"`
	HistoryEnabled     bool           `json:"historyEnabled"`
	ConsentPreferences map[string]any `json:"consentPreferences"`
}

// GetPreferences reads preferences for the authenticated user (P0).
func (app *AppState) GetPreferences(w http.ResponseWriter, r *http.Request) {
	pref := UserPreferences{
		SourceLanguage:     "en",
		TargetLanguage:     "ar",
		HistoryEnabled:     false,
		ConsentPreferences: map[string]any{"telemetry": false, "screenProcessing": true},
	}

	if app.DB != nil {
		var consentJSON []byte
		err := app.DB.QueryRow(r.Context(), `
			SELECT source_language, target_language, history_enabled, consent_preferences
			FROM user_preferences
			LIMIT 1
		`).Scan(&pref.SourceLanguage, &pref.TargetLanguage, &pref.HistoryEnabled, &consentJSON)
		if err == nil && len(consentJSON) > 0 {
			var cp map[string]any
			if json.Unmarshal(consentJSON, &cp) == nil {
				pref.ConsentPreferences = cp
			}
		}
	}

	writeJSON(w, http.StatusOK, Response{"preferences": pref})
}

// UpdatePreferences updates preferences for the authenticated user (P0).
func (app *AppState) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	var pref UserPreferences
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&pref); err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_json", "Send valid JSON with user preferences.")
		return
	}

	if pref.SourceLanguage != "" && !IsSupportedLanguage(pref.SourceLanguage) {
		writeError(w, r, http.StatusBadRequest, "invalid_source_language", "Unsupported source language.")
		return
	}
	if pref.TargetLanguage != "" && !IsSupportedLanguage(pref.TargetLanguage) {
		writeError(w, r, http.StatusBadRequest, "invalid_target_language", "Unsupported target language.")
		return
	}

	if app.DB != nil {
		consentBytes, _ := json.Marshal(pref.ConsentPreferences)
		// Ensure a default user exists, then upsert preferences
		var userID string
		err := app.DB.QueryRow(r.Context(), `
			INSERT INTO users (email, preferred_language)
			VALUES ('user@lisan-ksa.sa', $1)
			ON CONFLICT (email) DO UPDATE SET preferred_language = EXCLUDED.preferred_language
			RETURNING id::text
		`, pref.TargetLanguage).Scan(&userID)
		if err == nil {
			_, _ = app.DB.Exec(r.Context(), `
				INSERT INTO user_preferences (user_id, source_language, target_language, history_enabled, consent_preferences, updated_at)
				VALUES ($1, $2, $3, $4, $5, now())
				ON CONFLICT (user_id) DO UPDATE SET
					source_language = EXCLUDED.source_language,
					target_language = EXCLUDED.target_language,
					history_enabled = EXCLUDED.history_enabled,
					consent_preferences = EXCLUDED.consent_preferences,
					updated_at = now()
			`, userID, pref.SourceLanguage, pref.TargetLanguage, pref.HistoryEnabled, consentBytes)
		}
	}

	writeJSON(w, http.StatusOK, Response{
		"message":     "preferences_updated",
		"preferences": pref,
	})
}
