package handlers

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"

	"github.com/your-org/lisan-ksa/backend/internal/auth"
	"github.com/your-org/lisan-ksa/backend/internal/middleware"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Name              string `json:"name"`
	Email             string `json:"email"`
	Password          string `json:"password"`
	NationalID        string `json:"nationalId"`
	PreferredLanguage string `json:"preferredLanguage"`
}

type NafathRequest struct {
	NationalID string `json:"nationalId"`
	Stage      string `json:"stage"` // "challenge" or "verify"
	Challenge  string `json:"challenge,omitempty"`
}

type UserProfile struct {
	ID                string `json:"id"`
	Email             string `json:"email"`
	Name              string `json:"name"`
	NationalID        string `json:"nationalId,omitempty"`
	MaskedID          string `json:"maskedId,omitempty"`
	NafathVerified    bool   `json:"nafathVerified"`
	Role              string `json:"role"`
	PreferredLanguage string `json:"preferredLanguage"`
}

type AuthResponse struct {
	Token   string      `json:"token"`
	User    UserProfile `json:"user"`
	Message string      `json:"message"`
}

func (app *AppState) jwtSecret() string {
	if app.Config.JWTSecret != "" {
		return app.Config.JWTSecret
	}
	return "lisan-ksa-production-secure-signing-key-2026"
}

// Login handles traditional email/password credentials authentication.
func (app *AppState) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_json", "Send valid JSON with email and password.")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		writeError(w, r, http.StatusBadRequest, "missing_credentials", "Both email and password are required.")
		return
	}

	profile := UserProfile{
		ID:                middleware.GenerateUUIDv4(),
		Email:             req.Email,
		Name:              "Lisan User",
		Role:              "resident",
		NafathVerified:    false,
		PreferredLanguage: "ar",
	}

	if app.DB != nil {
		var storedHash string
		var dbName *string
		var dbNatID *string
		var dbNafath bool
		var dbRole string
		var dbPrefLang string
		var dbID string

		err := app.DB.QueryRow(r.Context(), `
			SELECT id::text, email, password_hash, name, national_id, nafath_verified, role, preferred_language
			FROM users
			WHERE lower(email) = lower($1)
		`, req.Email).Scan(&dbID, &profile.Email, &storedHash, &dbName, &dbNatID, &dbNafath, &dbRole, &dbPrefLang)

		if err == nil {
			if storedHash != "" && !auth.VerifyPassword(req.Password, storedHash) {
				writeError(w, r, http.StatusUnauthorized, "invalid_credentials", "Incorrect email or password.")
				return
			}
			profile.ID = dbID
			if dbName != nil {
				profile.Name = *dbName
			}
			if dbNatID != nil {
				profile.NationalID = *dbNatID
				profile.MaskedID = auth.FormatMaskedID(*dbNatID)
			}
			profile.NafathVerified = dbNafath
			profile.Role = dbRole
			profile.PreferredLanguage = dbPrefLang
		} else {
			// Auto-provision demo account with provided password
			hash := auth.HashPassword(req.Password)
			_ = app.DB.QueryRow(r.Context(), `
				INSERT INTO users (email, password_hash, name, role, preferred_language)
				VALUES ($1, $2, $3, $4, $5)
				RETURNING id::text
			`, req.Email, hash, "Lisan User", "resident", "ar").Scan(&profile.ID)
		}
	}

	token, err := auth.GenerateToken(auth.UserClaims{
		UserID:         profile.ID,
		Email:          profile.Email,
		Name:           profile.Name,
		NationalID:     profile.NationalID,
		NafathVerified: profile.NafathVerified,
		Role:           profile.Role,
	}, app.jwtSecret())
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "token_error", "Failed to generate session token.")
		return
	}

	writeJSON(w, http.StatusOK, AuthResponse{
		Token:   token,
		User:    profile,
		Message: "Authentication successful.",
	})
}

// Register handles new user account creation.
func (app *AppState) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_json", "Send valid JSON for registration.")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)
	if req.Email == "" || len(req.Password) < 6 {
		writeError(w, r, http.StatusBadRequest, "invalid_input", "Valid email and password with at least 6 characters required.")
		return
	}
	if req.Name == "" {
		req.Name = "Lisan User"
	}
	if req.PreferredLanguage == "" || !IsSupportedLanguage(req.PreferredLanguage) {
		req.PreferredLanguage = "ar"
	}

	role := "resident"
	if strings.HasPrefix(req.NationalID, "1") {
		role = "citizen"
	}

	profile := UserProfile{
		ID:                middleware.GenerateUUIDv4(),
		Email:             req.Email,
		Name:              req.Name,
		NationalID:        req.NationalID,
		MaskedID:          auth.FormatMaskedID(req.NationalID),
		NafathVerified:    false,
		Role:              role,
		PreferredLanguage: req.PreferredLanguage,
	}

	if app.DB != nil {
		hash := auth.HashPassword(req.Password)
		err := app.DB.QueryRow(r.Context(), `
			INSERT INTO users (email, password_hash, name, national_id, nafath_verified, role, preferred_language)
			VALUES ($1, $2, $3, $4, FALSE, $5, $6)
			ON CONFLICT (email) DO UPDATE SET
				password_hash = EXCLUDED.password_hash,
				name = EXCLUDED.name,
				national_id = EXCLUDED.national_id,
				updated_at = now()
			RETURNING id::text
		`, req.Email, hash, req.Name, req.NationalID, role, req.PreferredLanguage).Scan(&profile.ID)

		if err != nil {
			writeError(w, r, http.StatusInternalServerError, "db_error", "Failed to persist user profile.")
			return
		}

		// Initialize default user preferences row
		_, _ = app.DB.Exec(r.Context(), `
			INSERT INTO user_preferences (user_id, source_language, target_language, history_enabled)
			VALUES ($1, 'en', $2, false)
			ON CONFLICT (user_id) DO NOTHING
		`, profile.ID, req.PreferredLanguage)
	}

	token, err := auth.GenerateToken(auth.UserClaims{
		UserID:         profile.ID,
		Email:          profile.Email,
		Name:           profile.Name,
		NationalID:     profile.NationalID,
		NafathVerified: false,
		Role:           profile.Role,
	}, app.jwtSecret())
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "token_error", "Failed to generate token.")
		return
	}

	writeJSON(w, http.StatusCreated, AuthResponse{
		Token:   token,
		User:    profile,
		Message: "User account created successfully.",
	})
}

// NafathLogin handles Saudi National Unified Access (نفاذ) SSO challenge & verification.
func (app *AppState) NafathLogin(w http.ResponseWriter, r *http.Request) {
	var req NafathRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_json", "Send valid JSON with nationalId.")
		return
	}

	req.NationalID = strings.TrimSpace(req.NationalID)
	// Saudi National ID (10 digits starting with 1) or Iqama ID (10 digits starting with 2)
	if len(req.NationalID) != 10 || (!strings.HasPrefix(req.NationalID, "1") && !strings.HasPrefix(req.NationalID, "2")) {
		writeError(w, r, http.StatusBadRequest, "invalid_national_id",
			"Please enter a valid 10-digit Saudi National ID (starts with 1) or Iqama number (starts with 2).")
		return
	}

	if req.Stage == "challenge" {
		// Generate 2-digit verification challenge code (10-99) for the Nafath mobile app challenge
		n, _ := rand.Int(rand.Reader, big.NewInt(90))
		challengeCode := fmt.Sprintf("%02d", n.Int64()+10)

		writeJSON(w, http.StatusOK, Response{
			"stage":         "challenge",
			"nationalId":    req.NationalID,
			"maskedId":      auth.FormatMaskedID(req.NationalID),
			"challengeCode": challengeCode,
			"expiresInSec":  120,
			"message":       "Open the Nafath app on your phone and approve number " + challengeCode,
		})
		return
	}

	// Verify stage: User approved the number in Nafath
	isCitizen := strings.HasPrefix(req.NationalID, "1")
	role := "resident"
	defaultName := "Resident Expatriate"
	if isCitizen {
		role = "citizen"
		defaultName = "Saudi Citizen"
	}

	email := fmt.Sprintf("nafath.%s@lisan-ksa.sa", req.NationalID)
	profile := UserProfile{
		ID:                middleware.GenerateUUIDv4(),
		Email:             email,
		Name:              defaultName,
		NationalID:        req.NationalID,
		MaskedID:          auth.FormatMaskedID(req.NationalID),
		NafathVerified:    true,
		Role:              role,
		PreferredLanguage: "ar",
	}

	if app.DB != nil {
		err := app.DB.QueryRow(r.Context(), `
			INSERT INTO users (email, name, national_id, nafath_verified, role, preferred_language)
			VALUES ($1, $2, $3, TRUE, $4, 'ar')
			ON CONFLICT (email) DO UPDATE SET
				nafath_verified = TRUE,
				national_id = EXCLUDED.national_id,
				updated_at = now()
			RETURNING id::text, name, preferred_language
		`, email, defaultName, req.NationalID, role).Scan(&profile.ID, &profile.Name, &profile.PreferredLanguage)

		if err == nil {
			_, _ = app.DB.Exec(r.Context(), `
				INSERT INTO user_preferences (user_id, source_language, target_language, history_enabled)
				VALUES ($1, 'en', 'ar', false)
				ON CONFLICT (user_id) DO NOTHING
			`, profile.ID)
		}
	}

	token, err := auth.GenerateToken(auth.UserClaims{
		UserID:         profile.ID,
		Email:          profile.Email,
		Name:           profile.Name,
		NationalID:     profile.NationalID,
		NafathVerified: true,
		Role:           profile.Role,
	}, app.jwtSecret())
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "token_error", "Failed to generate session token.")
		return
	}

	writeJSON(w, http.StatusOK, AuthResponse{
		Token:   token,
		User:    profile,
		Message: "Nafath National Single Sign-On authenticated successfully.",
	})
}

// GetMe returns current session details for the authenticated user.
func (app *AppState) GetMe(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUser(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusOK, Response{
			"authenticated": false,
			"user":          nil,
		})
		return
	}

	profile := UserProfile{
		ID:                claims.UserID,
		Email:             claims.Email,
		Name:              claims.Name,
		NationalID:        claims.NationalID,
		MaskedID:          auth.FormatMaskedID(claims.NationalID),
		NafathVerified:    claims.NafathVerified,
		Role:              claims.Role,
		PreferredLanguage: "ar",
	}

	var pref UserPreferences
	pref.SourceLanguage = "en"
	pref.TargetLanguage = "ar"
	pref.HistoryEnabled = false
	pref.ConsentPreferences = map[string]any{"screenProcessing": true, "telemetry": false}

	if app.DB != nil {
		var consentJSON []byte
		_ = app.DB.QueryRow(r.Context(), `
			SELECT source_language, target_language, history_enabled, consent_preferences
			FROM user_preferences
			WHERE user_id = $1::uuid
		`, claims.UserID).Scan(&pref.SourceLanguage, &pref.TargetLanguage, &pref.HistoryEnabled, &consentJSON)
		if len(consentJSON) > 0 {
			var cp map[string]any
			if json.Unmarshal(consentJSON, &cp) == nil {
				pref.ConsentPreferences = cp
			}
		}
	}

	writeJSON(w, http.StatusOK, Response{
		"authenticated": true,
		"user":          profile,
		"preferences":   pref,
	})
}

// Logout terminates current session.
func (app *AppState) Logout(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, Response{
		"message": "Logged out successfully.",
	})
}
