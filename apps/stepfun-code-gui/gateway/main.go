// Command step-orchestra-gateway is the Go half of the step-orchestra plugin.
//
// It reads newline-delimited JSON from stdin (fed by the Step Code extension),
// reconstructs the orchestration tree, and serves a liquid-glass browser panel
// over loopback HTTP with a server-sent event stream.
//
// Security posture: the listener is bound to 127.0.0.1 only, every data
// endpoint requires a per-run bearer token, mutations additionally require a
// same-origin request with the token in a header (never the URL), and the
// working directory is never exposed beyond what the extension explicitly
// forwards.
package main

import (
	"bufio"
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	defaultPort  = 47810
	portAttempts = 12
	// Generous ceiling for a single JSONL line after extension-side redaction.
	maxLineBytes = 4 << 20
	heartbeat    = 15 * time.Second
	// A leaked read token must not fan out to unlimited SSE connections.
	maxEventClients = 32
	// Stalled readers are dropped after this long without a successful write;
	// comfortably above the heartbeat so healthy streams never hit it.
	eventWriteDeadline = 30 * time.Second
)

func main() {
	log.SetFlags(0)
	log.SetPrefix("[step-orchestra] ")

	hub := NewHub()
	store := NewStore(hub, os.Getenv("STEP_ORCHESTRA_HOME"))

	go readStdin(store)

	token := randomToken()
	webDir := resolveWebDir()

	listener, port, err := listen()
	if err != nil {
		log.Fatalf("cannot bind loopback listener: %v", err)
	}

	// The panel URL is scraped from stdout by the extension and surfaced through
	// the /orchestra command, so the token never lands in a log file. The token
	// travels in the URL fragment: it is never sent to a server, never leaks
	// through Referer, and is stripped from the address bar on load.
	fmt.Printf("[step-orchestra] panel http://127.0.0.1:%d/#t=%s\n", port, token)
	fmt.Printf("[step-orchestra] assets %s\n", webDir)
	_ = os.Stdout.Sync()

	// ReadHeaderTimeout bounds slow-header attacks; IdleTimeout reaps abandoned
	// keep-alive connections. WriteTimeout stays zero: it would kill the
	// long-lived SSE stream and its 15s heartbeat.
	server := &http.Server{
		Handler:           newRouter(store, hub, newActionWriter(os.Stdout), token, webDir),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	if err := server.Serve(listener); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}

// BridgeActionProfile carries one credential to the extension. This is the only
// message that ever contains a plaintext key, and it never leaves the host.
type BridgeActionProfile struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Provider string `json:"provider"`
	APIKey   string `json:"apiKey"`
	BaseURL  string `json:"baseUrl,omitempty"`
}

// BridgeAction mirrors the extension-side contract for the reverse channel.
type BridgeAction struct {
	Type      string               `json:"type"`
	Action    string               `json:"action"`
	RequestID string               `json:"requestId"`
	Text      string               `json:"text,omitempty"`
	DeliverAs string               `json:"deliverAs,omitempty"`
	Profile   *BridgeActionProfile `json:"profile,omitempty"`
}

// actionWriter serialises reverse-channel actions onto gateway stdout, where
// the extension picks them up line by line. This is the only path from the
// browser back into the host — stdin carries everything else.
type actionWriter struct {
	mu  sync.Mutex
	out io.Writer
}

func newActionWriter(out io.Writer) *actionWriter {
	return &actionWriter{out: out}
}

func (w *actionWriter) send(action BridgeAction) error {
	payload, err := json.Marshal(action)
	if err != nil {
		return err
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	_, err = w.out.Write(append(payload, '\n'))
	return err
}

// readStdin consumes the extension's JSONL stream until the pipe closes.
func readStdin(store *Store) {
	// One malformed frame must not take down the whole gateway: the panel can
	// survive a dropped update, but not a dead process. A panic, however, means
	// an unexpected bug — exit so the host can restart us rather than leaving a
	// zombie panel that never receives another update.
	defer func() {
		if recovered := recover(); recovered != nil {
			log.Printf("stdin reader panicked: %v", recovered)
			os.Exit(1)
		}
	}()

	// A hand-rolled reader instead of bufio.Scanner: once Scanner hits a line
	// longer than its buffer it is permanently dead, and the only recovery is
	// exiting. Here an oversized line is drained chunk by chunk and skipped.
	reader := bufio.NewReaderSize(os.Stdin, 256*1024)
	var line []byte

	handle := func(raw []byte) {
		trimmed := bytes.TrimSpace(raw)
		if len(trimmed) == 0 {
			return
		}

		var message incoming
		// Decode straight from the reused line buffer: json.Unmarshal copies
		// every string field, so nothing aliases raw after this returns.
		if err := json.Unmarshal(trimmed, &message); err != nil {
			log.Printf("dropping malformed line: %v", err)
			return
		}

		if message.Kind == "shutdown" {
			log.Printf("extension host shut down; exiting")
			os.Exit(0)
		}

		store.Apply(message)
	}

	for {
		chunk, err := reader.ReadSlice('\n')
		if err == bufio.ErrBufferFull {
			line = append(line, chunk...)
			if len(line) > maxLineBytes {
				discarded := len(line)
				line = line[:0]
				for err == bufio.ErrBufferFull {
					chunk, err = reader.ReadSlice('\n')
					discarded += len(chunk)
				}
				log.Printf("dropping oversized line (%d bytes)", discarded)
			}
			if err != nil {
				break
			}
			continue
		}

		line = append(line, chunk...)
		// handle copies out of the buffer before returning, so it is safe to reuse.
		handle(line)
		line = line[:0]

		if err != nil {
			if err != io.EOF {
				log.Printf("stdin read error: %v", err)
			}
			break
		}
	}

	log.Printf("stdin closed; exiting")
	os.Exit(0)
}

// listen binds the first available loopback port at or after the configured base.
func listen() (net.Listener, int, error) {
	base := defaultPort
	if raw := os.Getenv("STEP_ORCHESTRA_PORT"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed < 65536 {
			base = parsed
		}
	}

	var lastErr error
	for offset := 0; offset < portAttempts; offset++ {
		port := base + offset
		if port > 65535 {
			break
		}

		listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err == nil {
			return listener, port, nil
		}
		lastErr = err
	}

	return nil, 0, lastErr
}

func newRouter(store *Store, hub *Hub, actions *actionWriter, token, webDir string) http.Handler {
	mux := http.NewServeMux()

	// Reverse channel: the browser asks, the extension sends.
	mux.HandleFunc("/api/send", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		// A write can inject a message into an agent with shell access, so it
		// must be a same-origin browser request (or a local CLI with the token
		// header) — see sameOriginAllowed.
		if !sameOriginAllowed(r) {
			http.Error(w, "cross-site request refused", http.StatusForbidden)
			return
		}
		if !authorized(r, token) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var body struct {
			Text      string `json:"text"`
			DeliverAs string `json:"deliverAs"`
		}
		// 64 KiB is far above any realistic prompt; anything larger is abuse.
		if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&body); err != nil {
			http.Error(w, "invalid json body", http.StatusBadRequest)
			return
		}

		text := strings.TrimSpace(body.Text)
		if text == "" {
			http.Error(w, "text is required", http.StatusBadRequest)
			return
		}

		requestID := newRequestID()
		if err := actions.send(BridgeAction{
			Type:      "action",
			Action:    "send",
			RequestID: requestID,
			Text:      text,
			DeliverAs: body.DeliverAs,
		}); err != nil {
			http.Error(w, "reverse channel unavailable", http.StatusServiceUnavailable)
			return
		}

		writeJSON(w, map[string]any{"requestId": requestID, "accepted": true})
	})

	// Credential roster. GET returns masked views only; the plaintext key is
	// written here but never read back out over HTTP.
	mux.HandleFunc("/api/profiles", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost || r.Method == http.MethodDelete {
			if !sameOriginAllowed(r) {
				http.Error(w, "cross-site request refused", http.StatusForbidden)
				return
			}
		}
		if !authorized(r, token) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		profiles := store.Profiles()

		switch r.Method {
		case http.MethodGet:
			views, activeID := profiles.Views()
			writeJSON(w, map[string]any{
				"profiles":  views,
				"activeId":  activeID,
				"lastError": profiles.LastError(),
			})

		case http.MethodPost:
			var body struct {
				ID       string `json:"id"`
				Name     string `json:"name"`
				Provider string `json:"provider"`
				APIKey   string `json:"apiKey"`
				BaseURL  string `json:"baseUrl"`
			}
			if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&body); err != nil {
				http.Error(w, "invalid json body", http.StatusBadRequest)
				return
			}

			saved, err := profiles.Upsert(storedProfile{
				ID:       strings.TrimSpace(body.ID),
				Name:     strings.TrimSpace(body.Name),
				Provider: strings.TrimSpace(body.Provider),
				APIKey:   strings.TrimSpace(body.APIKey),
				BaseURL:  strings.TrimSpace(body.BaseURL),
			})
			if err != nil {
				status := http.StatusInternalServerError
				if errors.Is(err, errProfileInvalid) {
					status = http.StatusBadRequest
				}
				http.Error(w, err.Error(), status)
				return
			}

			store.BroadcastProfiles()
			writeJSON(w, map[string]any{"id": saved.ID})

		case http.MethodDelete:
			id := strings.TrimSpace(r.URL.Query().Get("id"))
			if id == "" {
				http.Error(w, "id is required", http.StatusBadRequest)
				return
			}
			if err := profiles.Remove(id); err != nil {
				http.Error(w, "could not persist profile", http.StatusInternalServerError)
				return
			}

			store.BroadcastProfiles()
			writeJSON(w, map[string]any{"removed": id})

		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Activation: persist the choice, then push the credential to the host.
	mux.HandleFunc("/api/profiles/activate", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if !sameOriginAllowed(r) {
			http.Error(w, "cross-site request refused", http.StatusForbidden)
			return
		}
		if !authorized(r, token) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var body struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 8<<10)).Decode(&body); err != nil {
			http.Error(w, "invalid json body", http.StatusBadRequest)
			return
		}

		profile, found := store.Profiles().Find(strings.TrimSpace(body.ID))
		if !found {
			http.Error(w, "unknown profile", http.StatusNotFound)
			return
		}
		if strings.TrimSpace(profile.APIKey) == "" {
			http.Error(w, "profile has no api key", http.StatusBadRequest)
			return
		}
		// Legacy on-disk records predate BaseURL validation; refuse to push a
		// credential at a non-http(s) endpoint.
		if err := validateBaseURL(profile.BaseURL); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Deliver first, persist second. The other order would leave the file
		// claiming a switch the host never applied whenever the channel is down.
		//
		// registerProvider applied after the load phase takes effect on the next
		// request, so the host needs neither a reload nor a restart.
		requestID := newRequestID()
		if err := actions.send(BridgeAction{
			Type:      "action",
			Action:    "apply_profile",
			RequestID: requestID,
			Profile: &BridgeActionProfile{
				ID:       profile.ID,
				Name:     profile.Name,
				Provider: profile.Provider,
				APIKey:   profile.APIKey,
				BaseURL:  profile.BaseURL,
			},
		}); err != nil {
			http.Error(w, "reverse channel unavailable", http.StatusServiceUnavailable)
			return
		}

		if _, _, err := store.Profiles().Activate(profile.ID); err != nil {
			http.Error(w, "credential delivered but activation not persisted", http.StatusInternalServerError)
			return
		}

		store.BroadcastProfiles()
		writeJSON(w, map[string]any{"activated": profile.ID, "requestId": requestID})
	})

	mux.HandleFunc("/events", func(w http.ResponseWriter, r *http.Request) {
		if !authorized(r, token) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		serveEvents(w, r, store, hub)
	})

	mux.HandleFunc("/api/snapshot", func(w http.ResponseWriter, r *http.Request) {
		if !authorized(r, token) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(store.Snapshot())
	})

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if !authorized(r, token) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		fmt.Fprintf(w, "ok clients=%d\n", hub.Count())
	})

	mux.Handle("/", staticHandler(webDir))

	// The bind address is loopback, but the Host header is caller-controlled;
	// checking it defeats DNS rebinding against the loopback listener.
	return guardHost(mux)
}

// guardHost rejects requests whose Host header is not a loopback name.
func guardHost(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !isLoopbackHost(r.Host) {
			http.Error(w, "unexpected host", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// isLoopbackHost reports whether a Host/Host:port header names this machine's
// loopback interface. Anything else is either a proxy or a rebinding attempt.
func isLoopbackHost(hostport string) bool {
	host := strings.TrimSpace(hostport)
	if host == "" {
		return false
	}
	if parsed, _, err := net.SplitHostPort(host); err == nil {
		host = parsed
	}
	host = strings.Trim(host, "[]")
	return host == "127.0.0.1" || host == "::1" || strings.EqualFold(host, "localhost")
}

// sameOriginAllowed rejects cross-site writes. A browser POST/DELETE carries an
// Origin header for the page that issued it; accepting only an Origin whose
// authority equals the request Host lets the panel write while any other web
// page cannot, even though it could otherwise reach 127.0.0.1. A missing Origin
// is a local CLI client — the token header is still required in that case.
func sameOriginAllowed(r *http.Request) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return true
	}

	parsed, err := url.Parse(origin)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return false
	}
	return strings.EqualFold(parsed.Host, r.Host) && isLoopbackHost(parsed.Host)
}

// serveEvents streams state deltas. A full snapshot is sent first so a
// reconnecting tab renders immediately without a separate fetch.
func serveEvents(w http.ResponseWriter, r *http.Request, store *Store, hub *Hub) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-store")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	setSecurityHeaders(w)

	// Subscribe BEFORE building the snapshot: frames broadcast in between land
	// in the channel buffer and are replayed after the initial frame. Any that
	// the snapshot already covers are dropped client-side as stale (their seq
	// is <= the snapshot's), so the ordering is safe in both directions.
	channel, ok := hub.SubscribeWithin(maxEventClients)
	if !ok {
		http.Error(w, "too many event streams", http.StatusServiceUnavailable)
		return
	}
	defer hub.Unsubscribe(channel)

	// A stalled reader must not pin a goroutine, ticker, and subscription
	// forever: bound every write so a dead connection is reaped promptly.
	controller := http.NewResponseController(w)
	write := func(payload []byte) bool {
		_ = controller.SetWriteDeadline(time.Now().Add(eventWriteDeadline))
		if _, err := w.Write(payload); err != nil {
			return false
		}
		flusher.Flush()
		return true
	}

	if payload, err := json.Marshal(store.SnapshotFrame()); err == nil {
		if !write(sseFrame(payload)) {
			return
		}
	}
	// Tell EventSource to reconnect after 2s instead of its ~3s default.
	if !write([]byte("retry: 2000\n\n")) {
		return
	}

	ticker := time.NewTicker(heartbeat)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			if !write([]byte(": ping\n\n")) {
				return
			}
		case frame, open := <-channel:
			if !open {
				return
			}
			if !write(frame) {
				return
			}
		}
	}
}

func staticHandler(webDir string) http.Handler {
	if webDir == "" {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "web assets not found; set STEP_ORCHESTRA_WEB", http.StatusNotFound)
		})
	}

	files := http.FileServer(http.Dir(webDir))
	base := filepath.Clean(webDir)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		setSecurityHeaders(w)
		// The panel is all external scripts/styles (no inline), so a strict CSP
		// is pure defence-in-depth against any future stored-XSS sink.
		w.Header().Set("Content-Security-Policy", "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
		// Assets are served without a token; never expose a directory listing.
		// The root still resolves to index.html via the FileServer. Clean the
		// URL with path (always slash-based) so the root check is portable.
		rel := path.Clean("/" + r.URL.Path)
		clean := filepath.Join(base, filepath.FromSlash(rel))
		// Defence in depth: confirm the resolved path stays inside webDir even
		// though Clean already strips traversal segments.
		if resolved, err := filepath.Rel(base, clean); err != nil || resolved == ".." || strings.HasPrefix(resolved, ".."+string(filepath.Separator)) {
			http.NotFound(w, r)
			return
		}
		if info, err := os.Stat(clean); err == nil && info.IsDir() && rel != "/" {
			http.NotFound(w, r)
			return
		}
		files.ServeHTTP(w, r)
	})
}

// setSecurityHeaders adds low-cost, zero-regression hardening to JSON, static
// and SSE responses: nosniff blocks MIME sniffing, no-referrer keeps the query
// token out of Referer, and DENY prevents the panel being framed (clickjacking).
func setSecurityHeaders(w http.ResponseWriter) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("X-Frame-Options", "DENY")
}

// writeJSON emits a no-store JSON response.
func writeJSON(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	setSecurityHeaders(w)
	_ = json.NewEncoder(w).Encode(payload)
}

// authorized accepts the token from the X-Orchestra-Token header on any method,
// and from the query string on read-only GET/HEAD requests only. The initial
// page load and EventSource cannot set headers, so they need the query form;
// mutations must use the header. The query form is read-only, but a leaked token
// VALUE can still be replayed in the header for writes — which is why the token
// travels in the URL fragment (never sent to a server, never in Referer) and is
// stripped from the address bar on load. Comparison is always constant-time.
func authorized(r *http.Request, token string) bool {
	if token == "" {
		return true
	}
	if header := r.Header.Get("X-Orchestra-Token"); header != "" && constantTimeEqual(header, token) {
		return true
	}
	if r.Method == http.MethodGet || r.Method == http.MethodHead {
		if provided := r.URL.Query().Get("t"); provided != "" && constantTimeEqual(provided, token) {
			return true
		}
	}
	return false
}

func constantTimeEqual(a, b string) bool {
	if len(a) != len(b) {
		return false
	}

	var diff byte
	for i := 0; i < len(a); i++ {
		diff |= a[i] ^ b[i]
	}
	return diff == 0
}

// resolveWebDir finds the bundled assets. Assets are served without a token so
// the first paint stays one request, which makes the directory itself part of
// the trust boundary: STEP_ORCHESTRA_WEB may only select the repository's own
// web/ directory, never an arbitrary path whose contents would then be readable
// over loopback (including directory listings).
func resolveWebDir() string {
	var bundled []string

	if executable, err := os.Executable(); err == nil {
		base := filepath.Dir(executable)
		bundled = append(bundled,
			filepath.Join(base, "web"),
			filepath.Join(base, "..", "web"),
		)
	}
	if cwd, err := os.Getwd(); err == nil {
		bundled = append(bundled, filepath.Join(cwd, "web"))
	}

	if fromEnv := strings.TrimSpace(os.Getenv("STEP_ORCHESTRA_WEB")); fromEnv != "" {
		if selected, ok := matchBundledWebDir(fromEnv, bundled); ok {
			return selected
		}
		log.Printf("ignoring STEP_ORCHESTRA_WEB=%s: it must point at the bundled web/ directory", fromEnv)
	}

	for _, candidate := range bundled {
		if isDirectory(candidate) {
			return filepath.Clean(candidate)
		}
	}
	return ""
}

// matchBundledWebDir returns the canonical bundled directory that `wanted`
// resolves to, or false when it would serve something else.
func matchBundledWebDir(wanted string, bundled []string) (string, bool) {
	absolute, err := filepath.Abs(wanted)
	if err != nil {
		return "", false
	}
	absolute = filepath.Clean(absolute)
	if !isDirectory(absolute) {
		return "", false
	}

	for _, candidate := range bundled {
		resolved, err := filepath.Abs(candidate)
		if err != nil {
			continue
		}
		if filepath.Clean(resolved) == absolute {
			return absolute, true
		}
	}
	return "", false
}

func isDirectory(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

// newRequestID identifies one reverse-channel round trip.
func newRequestID() string {
	buffer := make([]byte, 8)
	if _, err := rand.Read(buffer); err != nil {
		// Fail closed: a predictable id is worse than no panel at all.
		log.Fatalf("cannot generate request id: %v", err)
	}
	return hex.EncodeToString(buffer)
}

func randomToken() string {
	buffer := make([]byte, 24)
	if _, err := rand.Read(buffer); err != nil {
		// Fail closed: never fall back to a guessable timestamp token.
		log.Fatalf("cannot generate auth token: %v", err)
	}
	return hex.EncodeToString(buffer)
}
