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
	m.TrustLabel = "Generated code is untrusted by default"

	m.ApplyEvent(bridge.Event{
		Type:      "trust.updated",
		SessionID: "s1",
		Trust:     &bridge.TrustState{Level: "review-required", Label: "Review required before mutation"},
	})

	view := m.View()
	if !strings.Contains(view, "CHAT") {
		t.Fatalf("expected mode badge in view")
	}
	if !strings.Contains(view, "lmstudio/qwen") {
		t.Fatalf("expected provider/model badge in view: %s", view)
	}
	if !strings.Contains(view, "Review required before mutation") {
		t.Fatalf("expected trust label in view: %s", view)
	}
}
