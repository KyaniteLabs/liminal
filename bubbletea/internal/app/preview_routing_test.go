package app

import (
	"testing"
)

func TestPreviewPlayRouteAsAction(t *testing.T) {
	tests := []struct {
		input    string
		wantMode string
	}{
		{"/preview file.html", "action"},
		{"/play audio.wav", "action"},
		{"/browser", "action"},
	}
	for _, tt := range tests {
		mode, intent := parseInputIntent(tt.input)
		if mode != tt.wantMode {
			t.Errorf("parseInputIntent(%q) mode = %q, want %q", tt.input, mode, tt.wantMode)
		}
		if intent != "command" {
			t.Errorf("parseInputIntent(%q) intent = %q, want command", tt.input, intent)
		}
	}
}

func TestStopRoutesAsChat(t *testing.T) {
	mode, intent := parseInputIntent("/stop")
	if mode != "chat" {
		t.Fatalf("expected /stop to route as chat mode, got %q", mode)
	}
	if intent != "command" {
		t.Fatalf("expected /stop to route with command intent, got %q", intent)
	}
}

func TestPreviewRequiresConfirmation(t *testing.T) {
	// /preview is routed as action mode, which triggers action.review_required
	// from the TS bridge. This means preview launches require explicit confirmation.
	mode, _ := parseInputIntent("/preview output.html")
	if mode != "action" {
		t.Fatal("preview must route as action mode to require confirmation")
	}
}
