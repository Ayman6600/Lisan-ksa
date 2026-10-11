package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrInvalidToken = errors.New("invalid token format or signature")
	ErrExpiredToken = errors.New("token has expired")
)

type UserClaims struct {
	UserID         string `json:"sub"`
	Email          string `json:"email"`
	Name           string `json:"name"`
	NationalID     string `json:"nationalId,omitempty"`
	NafathVerified bool   `json:"nafathVerified"`
	Role           string `json:"role"`
	ExpiresAt      int64  `json:"exp"`
}

type tokenHeader struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
}

func defaultSecret(secret string) []byte {
	if secret == "" {
		secret = "lisan-ksa-production-secure-signing-key-2026"
	}
	return []byte(secret)
}

// GenerateToken creates an HMAC-SHA256 signed JWT token valid for 7 days.
func GenerateToken(claims UserClaims, secret string) (string, error) {
	if claims.ExpiresAt == 0 {
		claims.ExpiresAt = time.Now().Add(7 * 24 * time.Hour).Unix()
	}

	header := tokenHeader{Alg: "HS256", Typ: "JWT"}
	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", err
	}

	payloadJSON, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)
	payloadB64 := base64.RawURLEncoding.EncodeToString(payloadJSON)
	signingInput := headerB64 + "." + payloadB64

	mac := hmac.New(sha256.New, defaultSecret(secret))
	mac.Write([]byte(signingInput))
	sigB64 := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	return signingInput + "." + sigB64, nil
}

// ValidateToken parses and verifies the HMAC-SHA256 token.
func ValidateToken(tokenString, secret string) (*UserClaims, error) {
	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		return nil, ErrInvalidToken
	}

	signingInput := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, defaultSecret(secret))
	mac.Write([]byte(signingInput))
	expectedSig := mac.Sum(nil)

	actualSig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !hmac.Equal(expectedSig, actualSig) {
		return nil, ErrInvalidToken
	}

	payloadJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, ErrInvalidToken
	}

	var claims UserClaims
	if err := json.Unmarshal(payloadJSON, &claims); err != nil {
		return nil, ErrInvalidToken
	}

	if claims.ExpiresAt > 0 && time.Now().Unix() > claims.ExpiresAt {
		return nil, ErrExpiredToken
	}

	return &claims, nil
}

// HashPassword creates a SHA-256 salt+hash for passwords.
func HashPassword(password string) string {
	salt := "lisan_saudi_salt_"
	sum := sha256.Sum256([]byte(salt + password))
	return hex.EncodeToString(sum[:])
}

// VerifyPassword checks if a plain text password matches the hash.
func VerifyPassword(password, hash string) bool {
	return HashPassword(password) == hash
}

// FormatMaskedID masks a Saudi National ID / Iqama for safe UI display (e.g. 248****912).
func FormatMaskedID(id string) string {
	if len(id) < 6 {
		return id
	}
	return fmt.Sprintf("%s****%s", id[:3], id[len(id)-3:])
}
