package storage

import (
	"io/fs"
	"testing"

	"github.com/your-org/lisan-ksa/backend/migrations"
)

func TestEmbeddedMigrations(t *testing.T) {
	entries, err := fs.ReadDir(migrations.FS, ".")
	if err != nil {
		t.Fatalf("failed to read embedded migrations: %v", err)
	}

	if len(entries) < 2 {
		t.Fatalf("expected at least 2 migration files, got %d", len(entries))
	}

	foundInitial := false
	foundDataModel := false
	for _, entry := range entries {
		if entry.Name() == "000001_initial.sql" {
			foundInitial = true
		}
		if entry.Name() == "000002_data_model.sql" {
			foundDataModel = true
		}
	}

	if !foundInitial || !foundDataModel {
		t.Fatalf("missing expected migrations: initial=%v data_model=%v", foundInitial, foundDataModel)
	}
}
