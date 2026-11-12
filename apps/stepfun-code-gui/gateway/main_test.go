package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestAuthorizedTokenRules(t *testing.T) {
	const token = "secret-token"
	cases := []struct {
		name   string
		method string
		header string
		query  string
		want   bool
	}{
		{"header on POST", http.MethodPost, token, "", true},
		{"header on GET", http.MethodGet, token, "", true},
		{"query on GET", http.MethodGet, "", token, true},
		{"query on HEAD", http.MethodHead, "", token, true},
		{"query on POST refused", http.MethodPost, "", token, false},
		{"wrong header", http.MethodGet, "nope", "", false},
		{"wrong query", http.MethodGet, "", "nope", false},
		{"no credentials", http.MethodGet, "", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			url := "/api/snapshot"
			if tc.query != "" {
				url += "?t=" + tc.query
			}
			r := httptest.NewRequest(tc.method, url, nil)
			if tc.header != "" {
				r.Header.Set("X-Orchestra-Token", tc.header)
			}
			if got := authorized(r, token); got != tc.want {
				t.Fatalf("authorized=%v want %v", got, tc.want)
			}
		})
	}
}

func TestSameOriginAllowed(t *testing.T) {
	cases := []struct {
		name   string
		origin string
		host   string
		want   bool
	}{
		{"missing origin is local CLI", "", "127.0.0.1:47810", true},
		{"matching loopback", "http://127.0.0.1:47810", "127.0.0.1:47810", true},
		{"localhost match", "http://localhost:47810", "localhost:47810", true},
		{"evil origin", "http://evil.example", "127.0.0.1:47810", false},
		{"null origin", "null", "127.0.0.1:47810", false},
		{"non-http scheme", "file://127.0.0.1", "127.0.0.1:47810", false},
		{"port mismatch", "http://127.0.0.1:9999", "127.0.0.1:47810", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodPost, "/api/send", nil)
			r.Host = tc.host
			if tc.origin != "" {
				r.Header.Set("Origin", tc.origin)
			}
			if got := sameOriginAllowed(r); got != tc.want {
				t.Fatalf("sameOriginAllowed=%v want %v", got, tc.want)
			}
		})
	}
}

func TestIsLoopbackHost(t *testing.T) {
	allowed := []string{"127.0.0.1", "127.0.0.1:47810", "localhost", "localhost:47810", "[::1]:47810", "::1"}
	for _, host := range allowed {
		if !isLoopbackHost(host) {
			t.Fatalf("expected loopback: %q", host)
		}
	}
	rejected := []string{"", "evil.example", "127.0.0.1.evil.com", "10.0.0.1", "localhost.evil.com"}
	for _, host := range rejected {
		if isLoopbackHost(host) {
			t.Fatalf("expected rejection: %q", host)
		}
	}
}

func TestStaticHandlerNoDirectoryListing(t *testing.T) {
	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "sub"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>panel</html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "sub", "secret.txt"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	handler := staticHandler(dir)

	// Root serves index.html.
	root := httptest.NewRecorder()
	handler.ServeHTTP(root, httptest.NewRequest(http.MethodGet, "/", nil))
	if root.Code != http.StatusOK {
		t.Fatalf("root should serve index, got %d", root.Code)
	}

	// Subdirectory must not list.
	sub := httptest.NewRecorder()
	handler.ServeHTTP(sub, httptest.NewRequest(http.MethodGet, "/sub/", nil))
	if sub.Code != http.StatusNotFound {
		t.Fatalf("directory listing should be 404, got %d", sub.Code)
	}

	// Traversal must not escape the base.
	trav := httptest.NewRecorder()
	handler.ServeHTTP(trav, httptest.NewRequest(http.MethodGet, "/../secret.txt", nil))
	if trav.Code == http.StatusOK {
		t.Fatal("traversal escaped webDir")
	}
}

func TestHubSubscribeWithinCap(t *testing.T) {
	hub := NewHub()
	var channels []chan []byte
	for i := 0; i < 3; i++ {
		ch, ok := hub.SubscribeWithin(3)
		if !ok {
			t.Fatalf("subscribe %d should succeed under cap", i)
		}
		channels = append(channels, ch)
	}
	if _, ok := hub.SubscribeWithin(3); ok {
		t.Fatal("subscribe past cap should fail")
	}
	if hub.Count() != 3 {
		t.Fatalf("count=%d want 3", hub.Count())
	}
	hub.Unsubscribe(channels[0])
	if _, ok := hub.SubscribeWithin(3); !ok {
		t.Fatal("subscribe after a slot frees should succeed")
	}
}