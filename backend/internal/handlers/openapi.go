package handlers

import (
	"net/http"

	"github.com/your-org/lisan-ksa/backend/openapi"
)

// OpenAPI serves the embedded OpenAPI 3.0 specification.
func (app *AppState) OpenAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(openapi.SpecYAML)
}
