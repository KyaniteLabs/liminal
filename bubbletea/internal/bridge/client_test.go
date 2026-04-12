package bridge

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestClientConfirmAndCancelAction(t *testing.T) {
	sessionID := "s2"
	actionID := "a1"
	confirmCalled := false
	cancelCalled := false

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/api/tui/session/"+sessionID+"/actions/"+actionID+"/confirm" && r.Method == http.MethodPost:
			confirmCalled = true
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprint(w, `{"ok":true}`)
		case r.URL.Path == "/api/tui/session/"+sessionID+"/actions/"+actionID+"/cancel" && r.Method == http.MethodPost:
			cancelCalled = true
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprint(w, `{"ok":true}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := NewClient(server.URL)
	ctx := context.Background()

	if err := client.ConfirmAction(ctx, sessionID, actionID); err != nil {
		t.Fatal(err)
	}
	if !confirmCalled {
		t.Fatal("expected confirm endpoint to be called")
	}

	if err := client.CancelAction(ctx, sessionID, actionID); err != nil {
		t.Fatal(err)
	}
	if !cancelCalled {
		t.Fatal("expected cancel endpoint to be called")
	}
}

func TestClientConfirmActionReturnsErrorOnBadStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprint(w, `{"error":"not found"}`)
	}))
	defer server.Close()

	client := NewClient(server.URL)
	err := client.ConfirmAction(context.Background(), "s1", "a1")
	if err == nil {
		t.Fatal("expected error for bad status")
	}
}

func TestClientSessionStatusAndSSE(t *testing.T) {
	sessionID := "s1"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/tui/session":
			w.WriteHeader(http.StatusCreated)
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprint(w, `{"sessionId":"s1","mode":"chat","trust":{"level":"untrusted","label":"u"}}`)
		case "/api/tui/session/s1/status":
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprint(w, `{"sessionId":"s1","mode":"chat","trust":{"level":"untrusted","label":"u"}}`)
		case "/api/tui/session/s1/input":
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprint(w, `{"reviewRequired":false}`)
		case "/api/tui/session/s1/events":
			w.Header().Set("Content-Type", "text/event-stream")
			fmt.Fprint(w, "data: {\"type\":\"response.delta\",\"sessionId\":\"s1\",\"delta\":\"hello\"}\n\n")
			fmt.Fprint(w, "data: {\"type\":\"response.committed\",\"sessionId\":\"s1\",\"content\":\"hello\"}\n\n")
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := NewClient(server.URL)
	ctx := context.Background()
	status, err := client.CreateSession(ctx)
	if err != nil { t.Fatal(err) }
	if status.SessionID != sessionID { t.Fatalf("expected session id %s, got %s", sessionID, status.SessionID) }

	status, err = client.GetStatus(ctx, sessionID)
	if err != nil { t.Fatal(err) }
	if status.Mode != "chat" { t.Fatalf("expected chat mode, got %s", status.Mode) }

	if err := client.SubmitInput(ctx, sessionID, "chat", "hello", "chat"); err != nil { t.Fatal(err) }

	events := make([]Event, 0, 2)
	streamCtx, cancel := context.WithTimeout(ctx, 200*time.Millisecond)
	defer cancel()
	if err := client.StreamEvents(streamCtx, sessionID, func(e Event) { events = append(events, e) }); err != nil { t.Fatal(err) }
	if len(events) != 2 { t.Fatalf("expected 2 events, got %d", len(events)) }
	if events[0].Delta != "hello" { t.Fatalf("expected delta hello, got %q", events[0].Delta) }
	if events[1].Content != "hello" { t.Fatalf("expected committed hello, got %q", events[1].Content) }
}

func TestClientStreamEventsResumesFromLastEventID(t *testing.T) {
	sessionID := "s1"
	lastEventIDSeen := ""
	requestCount := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/tui/session/s1/events" {
			http.NotFound(w, r)
			return
		}
		requestCount++
		lastEventIDSeen = r.Header.Get("Last-Event-ID")
		w.Header().Set("Content-Type", "text/event-stream")
		if requestCount == 1 {
			fmt.Fprint(w, "id: 1\n")
			fmt.Fprint(w, "data: {\"type\":\"response.delta\",\"sessionId\":\"s1\",\"delta\":\"hello\"}\n\n")
			return
		}
		fmt.Fprint(w, "id: 2\n")
		fmt.Fprint(w, "data: {\"type\":\"response.committed\",\"sessionId\":\"s1\",\"content\":\"world\"}\n\n")
	}))
	defer server.Close()

	client := NewClient(server.URL)
	ctx := context.Background()

	var events []Event
	if err := client.StreamEvents(ctx, sessionID, func(e Event) { events = append(events, e) }); err != nil {
		t.Fatal(err)
	}
	if len(events) != 1 || events[0].Delta != "hello" {
		t.Fatalf("expected first stream to receive hello delta, got %#v", events)
	}

	events = nil
	if err := client.StreamEvents(ctx, sessionID, func(e Event) { events = append(events, e) }); err != nil {
		t.Fatal(err)
	}
	if lastEventIDSeen != "1" {
		t.Fatalf("expected Last-Event-ID=1 on reconnect, got %q", lastEventIDSeen)
	}
	if len(events) != 1 || events[0].Content != "world" {
		t.Fatalf("expected resumed stream to receive world committed event, got %#v", events)
	}
}
