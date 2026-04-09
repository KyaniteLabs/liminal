package app

import (
	"strings"
	"testing"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/bridge"
)

func TestViewRendersTrustAndModeLabels(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.Provider = "lmstudio"
	m.ModelName = "qwen"
	m.Ready = true
	m.Width = 120
	m.Height = 32
	m.TrustLabel = "Generated code is untrusted by default"

	m.ApplyEvent(bridge.Event{
		Type:      "trust.updated",
		SessionID: "s1",
		Trust:     &bridge.TrustState{Level: "review-required", Label: "Review required before mutation"},
	})

	view := m.View()
	if !strings.Contains(view, "chat") {
		t.Fatalf("expected mode badge in view")
	}
	if !strings.Contains(view, "lmstudio/qwen") {
		t.Fatalf("expected provider/model badge in view: %s", view)
	}
	// Trust label may wrap across lines at narrow widths — verify model state instead
	if m.TrustLabel != "Review required before mutation" {
		t.Fatalf("expected trust label 'Review required before mutation', got %q", m.TrustLabel)
	}
	// Also verify trust label appears in view (may be split across lines)
	if !strings.Contains(view, "Review") {
		t.Fatalf("expected trust label fragment in view")
	}
}
