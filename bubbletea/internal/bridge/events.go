package bridge

type TrustState struct {
	Level string `json:"level"`
	Label string `json:"label"`
}

type PendingAction struct {
	ID                  string `json:"id"`
	Title               string `json:"title"`
	Description         string `json:"description"`
	Kind                string `json:"kind"`
	RequiresConfirmation bool   `json:"requiresConfirmation"`
	CreatedAt           string `json:"createdAt"`
}

type SessionStatus struct {
	SessionID     string         `json:"sessionId"`
	Mode          string         `json:"mode"`
	Provider      string         `json:"provider,omitempty"`
	Model         string         `json:"model,omitempty"`
	Trust         TrustState     `json:"trust"`
	ActiveTask    string         `json:"activeTask,omitempty"`
	PendingAction *PendingAction `json:"pendingAction,omitempty"`
}

// FileChange represents a single changed file from an agent mutation.
type FileChange struct {
	Path     string `json:"path"`
	Status   string `json:"status"`   // "modified" | "created" | "deleted"
	IsLatest bool   `json:"isLatest"` // true for the most recent change
}

// Event is the universal SSE event envelope for TUI → Bubble Tea communication.
type Event struct {
	Type      string         `json:"type"`
	SessionID string         `json:"sessionId"`
	Delta     string         `json:"delta,omitempty"`
	Content   string         `json:"content,omitempty"`
	Mode      string         `json:"mode,omitempty"`
	ActionID  string         `json:"actionId,omitempty"`
	Action    *PendingAction `json:"action,omitempty"`
	Status    *SessionStatus `json:"status,omitempty"`
	Message     string         `json:"message,omitempty"`
	Trust       *TrustState    `json:"trust,omitempty"`
	PreviewType string         `json:"previewType,omitempty"`
	ImageUrl    string         `json:"imageUrl,omitempty"`

	// Event fields for generation.iteration
	Iteration int     `json:"iteration,omitempty"`
	Score     float64 `json:"score,omitempty"`

	// Event fields for generation.complete
	Iterations int     `json:"iterations,omitempty"`
	FinalScore float64 `json:"finalScore,omitempty"`
	Duration   int64   `json:"duration,omitempty"`
	Model      string  `json:"model,omitempty"`
	Reason     string  `json:"reason,omitempty"`

	// Event fields for swarm.round
	Round          int    `json:"round,omitempty"`
	TotalRounds    int    `json:"totalRounds,omitempty"`
	VocabularySize int    `json:"vocabularySize,omitempty"`
	Winner         string `json:"winner,omitempty"`
	Converged      bool   `json:"converged,omitempty"`
	Outputs        map[string]any `json:"outputs,omitempty"`
	Votes          map[string]any `json:"votes,omitempty"`
	Timestamp      int64  `json:"timestamp,omitempty"`

	// Operator surface event fields
	ToolName     string       `json:"toolName,omitempty"`
	Thought      string       `json:"thought,omitempty"`
	ArgsSummary  string       `json:"argsSummary,omitempty"`
	StepNum      int          `json:"stepNum,omitempty"`
	ResultSummary string      `json:"resultSummary,omitempty"`
	Success      bool         `json:"success,omitempty"`
	Phase        string       `json:"phase,omitempty"`
	StepCurrent  int          `json:"stepCurrent,omitempty"`
	StepTotal    int          `json:"stepTotal,omitempty"`
	ActiveFile   string       `json:"activeFile,omitempty"`
	Objective    string       `json:"objective,omitempty"`
	Files        []FileChange `json:"files,omitempty"`
	Command      string       `json:"command,omitempty"`
	OutputTail   string       `json:"outputTail,omitempty"`
	JobID        string       `json:"jobId,omitempty"`
	ArtifactLabel string      `json:"artifactLabel,omitempty"`
	ArtifactPath  string      `json:"artifactPath,omitempty"`

	// Session turn event fields
	TurnID      string   `json:"turnId,omitempty"`
	Intent      string   `json:"intent,omitempty"`
	DelegatedTo string   `json:"delegatedTo,omitempty"`
	TaskRefs    []string `json:"taskRefs,omitempty"`

	// Task lifecycle event fields
	TaskID      string `json:"taskId,omitempty"`
	Description string `json:"description,omitempty"`
	DurationMs  int64  `json:"durationMs,omitempty"`
}
