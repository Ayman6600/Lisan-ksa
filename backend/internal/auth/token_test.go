package auth

import (
	"testing"
	"time"
)

func TestTokenGenerationAndValidation(t *testing.T) {
	secret := "test-secret-key-12345"
	claims := UserClaims{
		UserID:         "11111111-2222-3333-4444-555555555555",
		Email:          "ahmed@example.sa",
		Name:           "Ahmed Al-Ghamdi",
		NationalID:     "1092837465",
		NafathVerified: true,
		Role:           "citizen",
	}

	token, err := GenerateToken(claims, secret)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}

	parsed, err := ValidateToken(token, secret)
	if err != nil {
		t.Fatalf("ValidateToken failed: %v", err)
	}

	if parsed.UserID != claims.UserID {
		t.Errorf("expected UserID %s, got %s", claims.UserID, parsed.UserID)
	}
	if parsed.Email != claims.Email {
		t.Errorf("expected Email %s, got %s", claims.Email, parsed.Email)
	}
	if parsed.NafathVerified != true {
		t.Errorf("expected NafathVerified true, got false")
	}

	// Invalid secret test
	_, err = ValidateToken(token, "wrong-secret")
	if err == nil {
		t.Errorf("expected validation to fail with wrong secret")
	}

	// Expired token test
	expiredClaims := claims
	expiredClaims.ExpiresAt = time.Now().Add(-1 * time.Hour).Unix()
	expiredToken, err := GenerateToken(expiredClaims, secret)
	if err != nil {
		t.Fatalf("GenerateToken for expired token failed: %v", err)
	}
	_, err = ValidateToken(expiredToken, secret)
	if err != ErrExpiredToken {
		t.Errorf("expected ErrExpiredToken, got %v", err)
	}
}

func TestPasswordHashing(t *testing.T) {
	pwd := "MySecurePass123!"
	hash := HashPassword(pwd)
	if !VerifyPassword(pwd, hash) {
		t.Errorf("password verification failed")
	}
	if VerifyPassword("WrongPass", hash) {
		t.Errorf("password verification should have failed for wrong password")
	}
}

func TestMaskedID(t *testing.T) {
	masked := FormatMaskedID("2451928374")
	if masked != "245****374" {
		t.Errorf("expected 245****374, got %s", masked)
	}
}
