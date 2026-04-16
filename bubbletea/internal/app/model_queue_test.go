package app

import (
	"strings"
	"testing"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/bridge"
)

func TestNewModel_HasEmptyQueue(t *testing.T) {
	m := NewModel("http://localhost:0")
	if len(m.TaskQueue) != 0 {
		t.Errorf("expected empty TaskQueue, got %d entries", len(m.TaskQueue))
	}
	if len(m.SessionTurns) != 0 {
		t.Errorf("expected empty SessionTurns, got %d entries", len(m.SessionTurns))
	}
	if m.QueueVisible {
		t.Error("expected QueueVisible to be false initially")
	}
}

func TestApplyEvent_TaskQueued(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.ApplyEvent(bridge.Event{
		Type:        "task.queued",
		TaskID:      "task-1",
		Description: "Fix auth middleware",
	})

	if len(m.TaskQueue) != 1 {
		t.Fatalf("expected 1 task, got %d", len(m.TaskQueue))
	}
	entry := m.TaskQueue[0]
	if entry.TaskID != "task-1" {
		t.Errorf("expected TaskID task-1, got %s", entry.TaskID)
	}
	if entry.Description != "Fix auth middleware" {
		t.Errorf("expected description 'Fix auth middleware', got %s", entry.Description)
	}
	if entry.Status != "queued" {
		t.Errorf("expected status 'queued', got %s", entry.Status)
	}
	if entry.QueuedAt.IsZero() {
		t.Error("expected QueuedAt to be set")
	}
	if !m.QueueVisible {
		t.Error("expected QueueVisible to be true after queueing a task")
	}
}

func TestApplyEvent_TaskStarted(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.ApplyEvent(bridge.Event{Type: "task.queued", TaskID: "t1", Description: "Task A"})
	m.ApplyEvent(bridge.Event{Type: "task.started", TaskID: "t1"})

	if m.TaskQueue[0].Status != "running" {
		t.Errorf("expected status 'running', got %s", m.TaskQueue[0].Status)
	}
	if m.TaskQueue[0].StartedAt.IsZero() {
		t.Error("expected StartedAt to be set")
	}
}

func TestApplyEvent_TaskCompleted(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.ApplyEvent(bridge.Event{Type: "task.queued", TaskID: "t1", Description: "Task A"})
	m.ApplyEvent(bridge.Event{Type: "task.started", TaskID: "t1"})
	m.ApplyEvent(bridge.Event{
		Type:     "task.completed",
		TaskID:   "t1",
		Success:  true,
		Duration: 3500,
	})

	if m.TaskQueue[0].Status != "completed" {
		t.Errorf("expected status 'completed', got %s", m.TaskQueue[0].Status)
	}
	if m.TaskQueue[0].DurationMs != 3500 {
		t.Errorf("expected DurationMs 3500, got %d", m.TaskQueue[0].DurationMs)
	}
	if m.TaskQueue[0].CompletedAt.IsZero() {
		t.Error("expected CompletedAt to be set")
	}
}

func TestApplyEvent_TaskCompletedFailed(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.ApplyEvent(bridge.Event{Type: "task.queued", TaskID: "t1", Description: "Task A"})
	m.ApplyEvent(bridge.Event{
		Type:     "task.completed",
		TaskID:   "t1",
		Success:  false,
		Duration: 1200,
	})

	if m.TaskQueue[0].Status != "failed" {
		t.Errorf("expected status 'failed', got %s", m.TaskQueue[0].Status)
	}
}

func TestApplyEvent_MultipleTasks(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.ApplyEvent(bridge.Event{Type: "task.queued", TaskID: "t1", Description: "First"})
	m.ApplyEvent(bridge.Event{Type: "task.queued", TaskID: "t2", Description: "Second"})
	m.ApplyEvent(bridge.Event{Type: "task.started", TaskID: "t1"})
	m.ApplyEvent(bridge.Event{Type: "task.completed", TaskID: "t1", Success: true, Duration: 1000})

	if len(m.TaskQueue) != 2 {
		t.Fatalf("expected 2 tasks, got %d", len(m.TaskQueue))
	}
	if m.TaskQueue[0].Status != "completed" {
		t.Errorf("task 1: expected 'completed', got %s", m.TaskQueue[0].Status)
	}
	if m.TaskQueue[1].Status != "queued" {
		t.Errorf("task 2: expected 'queued', got %s", m.TaskQueue[1].Status)
	}
}

func TestApplyEvent_SessionTurn(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.ApplyEvent(bridge.Event{
		Type:        "session.turn",
		TurnID:      "turn-1",
		Intent:      "creative",
		DelegatedTo: "RalphLoop",
		Duration:    450,
	})

	if len(m.SessionTurns) != 1 {
		t.Fatalf("expected 1 turn, got %d", len(m.SessionTurns))
	}
	turn := m.SessionTurns[0]
	if turn.TurnID != "turn-1" {
		t.Errorf("expected TurnID turn-1, got %s", turn.TurnID)
	}
	if turn.Intent != "creative" {
		t.Errorf("expected intent 'creative', got %s", turn.Intent)
	}
	if turn.DelegatedTo != "RalphLoop" {
		t.Errorf("expected DelegatedTo 'RalphLoop', got %s", turn.DelegatedTo)
	}
	if turn.DurationMs != 450 {
		t.Errorf("expected DurationMs 450, got %d", turn.DurationMs)
	}
}

func TestApplyEvent_QueueEventsAddActivityLog(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.ApplyEvent(bridge.Event{Type: "task.queued", TaskID: "t1", Description: "Fix bug"})
	m.ApplyEvent(bridge.Event{Type: "task.started", TaskID: "t1"})
	m.ApplyEvent(bridge.Event{Type: "task.completed", TaskID: "t1", Success: true})

	if len(m.ActivityLog) < 3 {
		t.Fatalf("expected at least 3 activity entries, got %d", len(m.ActivityLog))
	}

	found := false
	for _, entry := range m.ActivityLog {
		if strings.Contains(entry.Message, "Queued") {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected 'Queued' activity log entry")
	}
}

func TestRenderTaskQueue(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.Width = 80
	m.Height = 24
	m.ApplyEvent(bridge.Event{Type: "task.queued", TaskID: "t1", Description: "Fix auth"})
	m.ApplyEvent(bridge.Event{Type: "task.queued", TaskID: "t2", Description: "Add tests"})
	m.ApplyEvent(bridge.Event{Type: "task.started", TaskID: "t1"})
	m.ApplyEvent(bridge.Event{Type: "task.completed", TaskID: "t1", Success: true, Duration: 2500})

	result := m.renderTaskQueue(60)

	if !strings.Contains(result, "Tasks:") {
		t.Error("expected queue summary header")
	}
	if !strings.Contains(result, "1 queued") {
		t.Error("expected '1 queued' in summary")
	}
	if !strings.Contains(result, "1 done") {
		t.Error("expected '1 done' in summary")
	}
}

func TestRenderTaskQueue_Empty(t *testing.T) {
	m := NewModel("http://localhost:0")
	// renderTaskQueue should handle empty gracefully (not called when empty due to guard, but test anyway)
	result := m.renderTaskQueue(60)
	if !strings.Contains(result, "Tasks: 0 queued") {
		t.Error("expected empty queue summary")
	}
}

func TestQueueStatusToken(t *testing.T) {
	tests := []struct {
		status   string
		expected string
	}{
		{"completed", "Done"},
		{"running", "Run"},
		{"failed", "Fail"},
		{"queued", "Wait"},
	}
	for _, tt := range tests {
		got := queueStatusToken(tt.status)
		if got != tt.expected {
			t.Errorf("queueStatusToken(%q) = %q, want %q", tt.status, got, tt.expected)
		}
	}
}
