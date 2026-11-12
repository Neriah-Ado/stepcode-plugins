package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func validProfile() storedProfile {
	return storedProfile{Name: "demo", Provider: "openai", APIKey: "sk-" + strings.Repeat("a", 40)}
}

func TestUpsertFieldValidation(t *testing.T) {
	store := newProfileStore(t.TempDir())
	cases := []struct {
		name   string
		mutate func(*storedProfile)
	}{
		{"empty name", func(p *storedProfile) { p.Name = "  " }},
		{"empty provider", func(p *storedProfile) { p.Provider = "" }},
		{"name too long", func(p *storedProfile) { p.Name = strings.Repeat("x", maxProfileNameBytes+1) }},
		{"key too long", func(p *storedProfile) { p.APIKey = strings.Repeat("k", maxProfileKeyBytes+1) }},
		{"baseurl too long", func(p *storedProfile) { p.BaseURL = "http://" + strings.Repeat("a", maxProfileBaseURLBytes) }},
		{"baseurl bad scheme", func(p *storedProfile) { p.BaseURL = "file:///etc/passwd" }},
		{"baseurl no host", func(p *storedProfile) { p.BaseURL = "http://" }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p := validProfile()
			tc.mutate(&p)
			_, err := store.Upsert(p)
			if !errors.Is(err, errProfileInvalid) {
				t.Fatalf("expected errProfileInvalid, got %v", err)
			}
		})
	}
	// Empty BaseURL and localhost are legitimate.
	for _, base := range []string{"", "http://localhost:8080/v1", "https://api.example.com"} {
		p := validProfile()
		p.BaseURL = base
		if _, err := store.Upsert(p); err != nil {
			t.Fatalf("baseUrl %q should be accepted: %v", base, err)
		}
	}
}

func TestUpsertCountCapExemptsEdits(t *testing.T) {
	store := newProfileStore(t.TempDir())
	var firstID string
	for i := 0; i < maxProfiles; i++ {
		p := validProfile()
		p.Name = "p" + itoa(i)
		saved, err := store.Upsert(p)
		if err != nil {
			t.Fatalf("insert %d failed: %v", i, err)
		}
		if i == 0 {
			firstID = saved.ID
		}
	}
	if _, err := store.Upsert(validProfile()); !errors.Is(err, errProfileInvalid) {
		t.Fatalf("insert past cap should fail, got %v", err)
	}
	// Editing an existing record at the cap must still succeed.
	edit := validProfile()
	edit.ID = firstID
	edit.Name = "renamed"
	if _, err := store.Upsert(edit); err != nil {
		t.Fatalf("edit at cap should succeed: %v", err)
	}
}

func TestKeylessEditPreservesSecretAndBaseURL(t *testing.T) {
	store := newProfileStore(t.TempDir())
	original := validProfile()
	original.BaseURL = "https://proxy.example.com/v1"
	saved, err := store.Upsert(original)
	if err != nil {
		t.Fatal(err)
	}

	rename := storedProfile{ID: saved.ID, Name: "renamed", Provider: "openai"}
	updated, err := store.Upsert(rename)
	if err != nil {
		t.Fatal(err)
	}
	if updated.APIKey != original.APIKey {
		t.Fatal("keyless edit dropped the stored key")
	}
	if updated.BaseURL != original.BaseURL {
		t.Fatal("keyless edit dropped the BaseURL override")
	}
	if updated.AddedAt != saved.AddedAt {
		t.Fatal("keyless edit reset AddedAt")
	}
}

func TestPersistFailureRollsBack(t *testing.T) {
	// dir=="" makes persistLocked fail; memory must not retain a phantom record.
	store := newProfileStore("")
	if _, err := store.Upsert(validProfile()); err == nil {
		t.Fatal("expected persist failure with no directory")
	}
	if views, _ := store.Views(); len(views) != 0 {
		t.Fatalf("phantom profile retained after failed persist: %d", len(views))
	}
}

func TestCorruptFileIsPreserved(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, profilesFileName)
	if err := os.WriteFile(path, []byte("{not json"), 0o600); err != nil {
		t.Fatal(err)
	}
	store := newProfileStore(dir)
	if views, _ := store.Views(); len(views) != 0 {
		t.Fatal("corrupt file should start empty")
	}
	if _, err := os.Stat(path + ".corrupt"); err != nil {
		t.Fatalf("corrupt original should be preserved: %v", err)
	}
}

func TestMaskKeyAndClassifyBoundaries(t *testing.T) {
	if maskKey("") != "" || maskKey("   ") != "" {
		t.Fatal("empty key should mask to empty")
	}
	if maskKey("short") != "…" {
		t.Fatal("<=8 char key should fully mask")
	}
	if got := maskKey("sk-" + strings.Repeat("a", 40)); got != "sk-a…aaaa" {
		t.Fatalf("long key mask unexpected: %q", got)
	}
	if classifyProfile(storedProfile{}) != "missing" {
		t.Fatal("empty key should classify missing")
	}
	if classifyProfile(storedProfile{APIKey: "short"}) != "suspicious" {
		t.Fatal("short key should classify suspicious")
	}
	if classifyProfile(validProfile()) != "ok" {
		t.Fatal("valid key should classify ok")
	}
}

func TestViewsNeverExposeAPIKey(t *testing.T) {
	store := newProfileStore(t.TempDir())
	if _, err := store.Upsert(validProfile()); err != nil {
		t.Fatal(err)
	}
	views, _ := store.Views()
	raw, err := json.Marshal(views)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "apiKey") || strings.Contains(string(raw), strings.Repeat("a", 40)) {
		t.Fatal("masked views leaked the plaintext key")
	}
}