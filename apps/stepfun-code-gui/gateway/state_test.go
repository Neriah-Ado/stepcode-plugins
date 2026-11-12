package main

import (
	"encoding/json"
	"strings"
	"sync"
	"testing"
)

// newTestStore wires a Store against an empty hub so Apply/Broadcast paths run
// for real without any HTTP machinery.
func newTestStore(t *testing.T) *Store {
	return NewStore(NewHub(), t.TempDir())
}

func ingest(t *testing.T, store *Store, messages []incoming) {
	t.Helper()
	for _, message := range messages {
		store.Apply(message)
	}
}

func findNode(t *testing.T, store *Store, id string) *Node {
	t.Helper()
	for _, node := range store.Snapshot().Nodes {
		if node.ID == id {
			return &node
		}
	}
	return nil
}

func TestSessionAndToolLifecycle(t *testing.T) {
	store := newTestStore(t)

	ingest(t, store, []incoming{
		{Kind: "session", TS: 1000, SessionID: "s1", CWD: "/demo", Model: "step-3.7-flash"},
		{Kind: "agent_start", TS: 1100},
		{Kind: "tool_call", TS: 1200, ToolCallID: "call1", ToolName: "workflow", Label: "sweep", Mode: "parallel"},
		{Kind: "tool_update", TS: 1300, ToolCallID: "call1", ToolName: "workflow",
			Progress: &Progress{Running: 2, Completed: 1, Total: 6}},
		{Kind: "tool_result", TS: 1900, ToolCallID: "call1", ToolName: "workflow",
			Tokens: &TokenUsage{Input: 100, Output: 40}},
	})

	snapshot := store.Snapshot()

	if snapshot.Session.ID != "s1" || snapshot.Session.Model != "step-3.7-flash" {
		t.Fatalf("session not recorded: %+v", snapshot.Session)
	}
	if snapshot.Run.Status != "running" {
		t.Fatalf("agent_start should set run=running, got %q", snapshot.Run.Status)
	}

	node := findNode(t, store, "call1")
	if node == nil {
		t.Fatal("tool_call did not materialise a node")
	}
	if node.Status != StatusDone {
		t.Fatalf("terminal status should be done, got %q", node.Status)
	}
	if node.DurationMs != 700 {
		t.Fatalf("duration should be result.ts - call.ts = 700, got %d", node.DurationMs)
	}
	if node.Progress == nil || node.Progress.Total != 6 {
		t.Fatalf("progress frame not attached: %+v", node.Progress)
	}
	if node.Tokens == nil || node.Tokens.Input != 100 || node.Tokens.Output != 40 {
		t.Fatalf("token usage not recorded: %+v", node.Tokens)
	}
	if !node.Orchestration {
		t.Fatal("workflow must be flagged as orchestration")
	}

	store.Apply(incoming{Kind: "agent_settled", TS: 2000})
	if snapshot := store.Snapshot(); snapshot.Run.Status != "settled" {
		t.Fatalf("agent_settled should set run=settled, got %q", snapshot.Run.Status)
	}
}

func TestFailedToolResultMarksNodeFailed(t *testing.T) {
	store := newTestStore(t)

	ingest(t, store, []incoming{
		{Kind: "tool_call", TS: 100, ToolCallID: "bad", ToolName: "subagent"},
		{Kind: "tool_result", TS: 200, ToolCallID: "bad", ToolName: "subagent", IsError: true},
	})

	node := findNode(t, store, "bad")
	if node == nil || node.Status != StatusFailed {
		t.Fatalf("errored result should mark node failed, got %+v", node)
	}
	if !node.IsError {
		t.Fatal("isError flag lost")
	}
}

// A fan-out bursts far more nodes than the retention cap; eviction must keep
// the newest state under the ceiling and never drop live work.
func TestNodeEvictionKeepsRunningWork(t *testing.T) {
	store := newTestStore(t)

	for i := 0; i < maxNodes+50; i++ {
		id := string(rune('a'+i%26)) + "-" + itoa(i)
		store.Apply(incoming{Kind: "tool_call", TS: int64(1000 + i), ToolCallID: id, ToolName: "read"})
		store.Apply(incoming{Kind: "tool_result", TS: int64(1100 + i), ToolCallID: id, ToolName: "read"})
	}

	live := "still-running"
	store.Apply(incoming{Kind: "tool_call", TS: 999999, ToolCallID: live, ToolName: "workflow"})

	snapshot := store.Snapshot()
	if len(snapshot.Nodes) > maxNodes {
		t.Fatalf("nodes exceeded cap: %d > %d", len(snapshot.Nodes), maxNodes)
	}
	if findNode(t, store, live) == nil {
		t.Fatal("running node was evicted")
	}
}

// The gateway can attach mid-flight: an update for an unseen call must create
// a running placeholder rather than being dropped.
func TestToolUpdateCreatesPlaceholder(t *testing.T) {
	store := newTestStore(t)

	store.Apply(incoming{Kind: "tool_update", TS: 500, ToolCallID: "orphan", ToolName: "subagent",
		Progress: &Progress{Running: 1, Total: 3}})

	node := findNode(t, store, "orphan")
	if node == nil {
		t.Fatal("update for unknown call was dropped")
	}
	if node.Status != StatusRunning || !node.Orchestration {
		t.Fatalf("placeholder should be running+orchestration, got %q/%v", node.Status, node.Orchestration)
	}
	if node.ParentID != rootID {
		t.Fatalf("placeholder should attach to root, got %q", node.ParentID)
	}
}

// Sequence numbers must increase monotonically across every emitted frame; a
// client treats any gap as a lost frame and resynchronises.
func TestSnapshotFrameSeqIsMonotonic(t *testing.T) {
	store := newTestStore(t)

	first := store.SnapshotFrame()
	store.Apply(incoming{Kind: "tool_call", TS: 10, ToolCallID: "n1", ToolName: "read"})
	store.Apply(incoming{Kind: "agent_start", TS: 20})
	second := store.SnapshotFrame()

	if second.Seq <= first.Seq {
		t.Fatalf("seq must grow: first=%d second=%d", first.Seq, second.Seq)
	}
	snapshot, ok := second.Payload.(Snapshot)
	if !ok {
		t.Fatalf("snapshot frame payload type mismatch: %T", second.Payload)
	}
	if snapshot.Stats.Total != 1 {
		t.Fatalf("snapshot should carry one node, got %d", snapshot.Stats.Total)
	}
}

func TestStatsAggregation(t *testing.T) {
	store := newTestStore(t)

	ingest(t, store, []incoming{
		{Kind: "tool_call", TS: 1, ToolCallID: "a", ToolName: "workflow"},
		{Kind: "tool_result", TS: 2, ToolCallID: "a", ToolName: "workflow", Tokens: &TokenUsage{Input: 10, Output: 5}},
		{Kind: "tool_call", TS: 3, ToolCallID: "b", ToolName: "read"},
		{Kind: "tool_result", TS: 4, ToolCallID: "b", ToolName: "read", IsError: true},
		{Kind: "tool_call", TS: 5, ToolCallID: "c", ToolName: "grep"},
		// An update flips the pending call into running, which is what the
		// Running counter actually tracks.
		{Kind: "tool_update", TS: 6, ToolCallID: "c", ToolName: "grep"},
	})

	stats := store.Snapshot().Stats
	if stats.Total != 3 || stats.Orchestrations != 1 || stats.Completed != 1 || stats.Failed != 1 || stats.Running != 1 {
		t.Fatalf("unexpected stats: %+v", stats)
	}
	if stats.TokenSpend != 15 {
		t.Fatalf("token spend should sum input+output=15, got %d", stats.TokenSpend)
	}
}

// A replayed tool_call for an id that already carries a terminal result must
// not reset the node back to pending or wipe its tokens.
func TestDuplicateToolCallDoesNotResetNode(t *testing.T) {
	store := newTestStore(t)

	ingest(t, store, []incoming{
		{Kind: "tool_call", TS: 1, ToolCallID: "dup", ToolName: "read"},
		{Kind: "tool_result", TS: 2, ToolCallID: "dup", ToolName: "read",
			Tokens: &TokenUsage{Input: 7, Output: 3}},
		{Kind: "tool_call", TS: 3, ToolCallID: "dup", ToolName: "read", Label: "replayed"},
	})

	node := findNode(t, store, "dup")
	if node == nil || node.Status != StatusDone || node.Tokens == nil {
		t.Fatalf("replayed tool_call must not reset terminal node: %+v", node)
	}
	stats := store.Snapshot().Stats
	if stats.Total != 1 || stats.Completed != 1 || stats.TokenSpend != 10 {
		t.Fatalf("stats drifted after replay: %+v", stats)
	}
}

// A flood of live (never-terminated) nodes must stay bounded by the hard cap,
// and the order slice must stay consistent with the nodes map.
func TestAllLiveFloodStaysBoundedAndConsistent(t *testing.T) {
	store := newTestStore(t)

	for i := 0; i < hardNodeCap+20; i++ {
		store.Apply(incoming{Kind: "tool_call", TS: int64(i), ToolCallID: "live-" + itoa(i), ToolName: "read"})
	}

	store.mu.Lock()
	orderLen, nodeCount := len(store.order), len(store.nodes)
	store.mu.Unlock()
	if orderLen > hardNodeCap || nodeCount > hardNodeCap {
		t.Fatalf("live flood grew past hard cap: order=%d nodes=%d", orderLen, nodeCount)
	}
	if orderLen != nodeCount {
		t.Fatalf("order/nodes diverged: order=%d nodes=%d", orderLen, nodeCount)
	}

	snapshot := store.Snapshot()
	if snapshot.Stats.Total != len(snapshot.Nodes) {
		t.Fatalf("stats/snapshot mismatch: stats=%d nodes=%d", snapshot.Stats.Total, len(snapshot.Nodes))
	}
}

// Oversized inbound text/args are clamped at ingest so one frame cannot dominate
// retained memory or every future snapshot.
func TestOversizedPayloadsAreClamped(t *testing.T) {
	store := newTestStore(t)
	big := strings.Repeat("x", maxNodeTextBytes*2)

	store.Apply(incoming{Kind: "tool_update", TS: 1, ToolCallID: "big", ToolName: "read", Text: big})
	node := findNode(t, store, "big")
	if node == nil || len(node.Text) > maxNodeTextBytes+3 {
		t.Fatalf("node text not clamped: %d bytes", len(node.Text))
	}

	hugeArgs := map[string]any{"blob": strings.Repeat("y", maxNodeArgsJSONBytes*2)}
	store.Apply(incoming{Kind: "tool_call", TS: 2, ToolCallID: "args", ToolName: "read", Args: hugeArgs})
	argsNode := findNode(t, store, "args")
	if argsNode == nil || argsNode.Args["_truncated"] != true {
		t.Fatalf("oversized args not stubbed: %+v", argsNode.Args)
	}

	store.Apply(incoming{Kind: "conversation", Message: &ConversationMessage{ID: "m1", Role: "assistant", Text: big}})
	snapshot := store.Snapshot()
	if len(snapshot.Messages) != 1 || len(snapshot.Messages[0].Text) > maxMessageTextBytes+3 {
		t.Fatalf("conversation text not clamped: %d bytes", len(snapshot.Messages[0].Text))
	}
}

// Concurrent emitters must deliver frames to the hub in strictly increasing
// seq order: a client reads any inversion as a lost frame and resynchronises.
// (Dropped frames are fine — the hub sheds slow readers — only order matters.)
func TestConcurrentEmitsPreserveSeqOrder(t *testing.T) {
	store := newTestStore(t)
	channel := store.hub.Subscribe()

	var wg sync.WaitGroup
	for g := 0; g < 4; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			for i := 0; i < 200; i++ {
				store.Apply(incoming{Kind: "tool_call", TS: int64(i),
					ToolCallID: "g" + itoa(g) + "-" + itoa(i), ToolName: "read"})
			}
		}(g)
	}
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			store.Snapshot()
			store.SnapshotFrame()
		}
	}()
	wg.Wait()

	store.hub.Unsubscribe(channel)
	last := int64(0)
	count := 0
	for frame := range channel {
		var envelope struct {
			Seq int64 `json:"seq"`
		}
		if err := json.Unmarshal(frame[6:len(frame)-2], &envelope); err != nil {
			t.Fatalf("bad frame envelope: %v", err)
		}
		if envelope.Seq <= last {
			t.Fatalf("seq inversion: %d after %d", envelope.Seq, last)
		}
		last = envelope.Seq
		count++
	}
	if count == 0 {
		t.Fatal("no frames reached the hub")
	}
}

func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	var digits []byte
	for value > 0 {
		digits = append([]byte{byte('0' + value%10)}, digits...)
		value /= 10
	}
	return string(digits)
}
