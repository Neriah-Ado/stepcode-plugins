package main

import (
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
)

// Package-level sinks defeat dead-store elimination so the measured work is
// not optimized away.
var (
	benchSnapshotSink Snapshot
	benchIntSink      int
	benchBytesSink    []byte
)

func newBenchStore(b *testing.B) *Store {
	b.Helper()
	return NewStore(NewHub(), b.TempDir())
}

// fillTerminalNodes preloads n completed tool lifecycles through the real Apply
// path so every node is evictable. Variety keeps statsLocked/value-copy realistic.
func fillTerminalNodes(b *testing.B, store *Store, prefix string, n int) {
	b.Helper()
	for i := 0; i < n; i++ {
		id := prefix + strconv.Itoa(i)
		toolName := "read"
		if i%10 == 0 {
			toolName = "workflow"
		}
		store.Apply(incoming{
			Kind: "tool_call", TS: int64(1000 + i),
			ToolCallID: id, ToolName: toolName,
			Label: "seed", Summary: "preloaded terminal node",
		})
		result := incoming{
			Kind: "tool_result", TS: int64(2000 + i),
			ToolCallID: id, ToolName: toolName, DurationMs: 5,
		}
		if i%2 == 0 {
			result.Tokens = &TokenUsage{Input: 100, Output: 40}
		}
		if i%25 == 0 {
			result.IsError = true
		}
		store.Apply(result)
	}
}

// BenchmarkApplyToolCallLifecycle measures the Apply hot path (unique ids so the
// replay guard never short-circuits). Non-zero TS avoids the orNow syscall.
func BenchmarkApplyToolCallLifecycle(b *testing.B) {
	store := newBenchStore(b)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		id := "life-" + strconv.Itoa(i)
		store.Apply(incoming{Kind: "tool_call", TS: int64(i + 1), ToolCallID: id, ToolName: "read", Label: "read file"})
		store.Apply(incoming{Kind: "tool_result", TS: int64(i + 2), ToolCallID: id, ToolName: "read", DurationMs: 1})
	}
	b.StopTimer()
	benchIntSink = store.Snapshot().Stats.Total
}

// BenchmarkApplyWithEviction preloads maxNodes terminal nodes so every measured
// iteration runs retainLocked at the cap: victim scan, order shift, map delete,
// node_evicted emit. Isolates steady-state eviction overhead.
func BenchmarkApplyWithEviction(b *testing.B) {
	store := newBenchStore(b)
	fillTerminalNodes(b, store, "seed-", maxNodes)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		id := "ev-" + strconv.Itoa(i)
		store.Apply(incoming{Kind: "tool_call", TS: int64(10000 + i), ToolCallID: id, ToolName: "read", Label: "evicting call"})
		store.Apply(incoming{Kind: "tool_result", TS: int64(10001 + i), ToolCallID: id, ToolName: "read", DurationMs: 1})
	}
	b.StopTimer()
	benchIntSink = store.Snapshot().Stats.Total
}

// BenchmarkHubBroadcast measures fan-out to 8/32 subscribers. Channels must be
// drained: clientBuffer is 128 and Broadcast drops frames for a full buffer, so
// without a live reader this would benchmark the drop path, not delivery.
func BenchmarkHubBroadcast(b *testing.B) {
	for _, subscribers := range []int{8, 32} {
		b.Run(strconv.Itoa(subscribers), func(b *testing.B) {
			hub := NewHub()
			channels := make([]chan []byte, 0, subscribers)
			var wg sync.WaitGroup
			for i := 0; i < subscribers; i++ {
				ch := hub.Subscribe()
				channels = append(channels, ch)
				wg.Add(1)
				go func() {
					defer wg.Done()
					for range ch {
					}
				}()
			}
			b.Cleanup(func() {
				for _, ch := range channels {
					hub.Unsubscribe(ch)
				}
				wg.Wait()
			})
			frame := sseFrame([]byte(`{"type":"node","payload":{"id":"bench"},"ts":1,"seq":1}`))
			b.ReportAllocs()
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				hub.Broadcast(frame)
			}
			b.StopTimer()
			benchBytesSink = frame
			benchIntSink = hub.Count()
		})
	}
}

// BenchmarkSnapshot measures a full-tree Snapshot at the retention cap: value
// copy of every Node under s.mu plus statsLocked aggregation.
func BenchmarkSnapshot(b *testing.B) {
	store := newBenchStore(b)
	fillTerminalNodes(b, store, "snap-", maxNodes)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		benchSnapshotSink = store.Snapshot()
	}
}

// BenchmarkApplyParallel measures emitMu contention under concurrent writers
// (atomic id offset avoids the replay guard). Run with -cpu 1,4,8 to see scaling.
func BenchmarkApplyParallel(b *testing.B) {
	store := newBenchStore(b)
	fillTerminalNodes(b, store, "par-", maxNodes)
	var ctr atomic.Int64
	b.ReportAllocs()
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			id := "p-" + strconv.FormatInt(ctr.Add(1)+maxNodes, 10)
			store.Apply(incoming{Kind: "tool_call", TS: 1, ToolCallID: id, ToolName: "read"})
			store.Apply(incoming{Kind: "tool_result", TS: 2, ToolCallID: id, ToolName: "read", DurationMs: 1})
		}
	})
}