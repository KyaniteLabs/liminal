# Meta-Harness Self-Evaluation & Self-Correction

**Reference:** Implements outer-loop harness engineering from  
"Building a Working Meta-Harness for AI Research" (arXiv:2603.28052)

---

## Overview

The Meta-Harness now has **self-awareness** - it can:
1. **Evaluate** its own performance after every task
2. **Detect** regressions automatically
3. **Correct** by switching strategies on retry
4. **Improve** by generating self-improvement tasks

---

## How It Works

### 1. Task Outcome Recording

Every task execution is recorded:
```typescript
selfEvaluation.recordOutcome({
  taskId: 'convert-p5-to-plugin',
  success: true/false,
  duration: 5000, // ms
  toolsUsed: ['readFile', 'writeFile', 'runBuild'],
  errors: ['TypeScript error in line 42'],
  strategy: 'verify-first', // or 'direct'
  timestamp: '2026-04-01T12:00:00Z',
});
```

Stored in: `HarnessMemory.episodes` for persistence

### 2. Automatic Self-Evaluation

After each task, the harness evaluates:
```typescript
const evaluation = selfEvaluation.evaluate();
// Returns:
{
  overallSuccessRate: 0.85,     // 85% lifetime success
  recentSuccessRate: 0.70,      // 70% last 10 tasks
  bestStrategy: 'verify-first', // Most successful
  worstStrategy: 'direct',      // Least successful
  commonErrors: ['timeout', 'validation failed'],
  recommendations: [
    'Use verify-first strategy more often',
    'Increase timeout thresholds',
  ],
  needsImprovement: true,
}
```

### 3. Regression Detection

Automatically detects performance declines:
```typescript
const regression = selfEvaluation.detectRegression();
// Returns:
{
  hasRegression: true,
  severity: 'severe', // or 'mild', 'none'
  details: 'Severe regression: success rate dropped 30% (90% → 60%)',
}
```

Triggers critical priority improvement tasks when severe.

### 4. Self-Correction (Retry Logic)

On failure, automatically decides whether to retry:
```typescript
const decision = selfEvaluation.shouldRetry(taskId, previousStrategy);
// Returns:
{
  shouldRetry: true,
  newStrategy: 'verify-first',
  reason: 'Switching from direct to verify-first (success rate: 85%)',
}
```

The harness then:
1. Rolls back changes
2. Retries with better strategy
3. Max 3 retry attempts

### 5. Error Remediation

Suggests fixes for specific errors:
```typescript
const fixes = selfEvaluation.getErrorRemediation('timeout');
// Returns:
[
  'Increase timeout threshold',
  'Break task into smaller subtasks',
  'Use streaming for long operations',
]
```

### 6. Self-Improvement Task Generation

When performance degrades, generates improvement tasks:
```typescript
const task = selfEvaluation.generateImprovementTask();
// Returns:
{
  shouldCreate: true,
  title: 'Improve direct strategy',
  description: 'Current success rate: 45%\nCommon errors: timeout, validation',
  priority: 'high', // 'critical' for severe regression
}
```

---

## Usage Examples

### In HarnessAgent (Automatic)

The harness automatically self-evaluates after every task:
```typescript
// After task completion
selfEvaluation.recordOutcome({...});

// On failure, check if retry is warranted
const retry = selfEvaluation.shouldRetry(taskId, strategy);
if (retry.shouldRetry) {
  await rollback();
  // Retry with newStrategy...
}
```

### In TUI (Manual Check)

Users can check harness health:
```
> /harness status

📊 Harness Self-Evaluation

Overall Success Rate: 85.3%
Recent Success Rate: 70.0%
Best Strategy: verify-first
Active Strategies: 3

Recommendations:
  • Use 'verify-first' strategy more often (success rate: 92%)
  • Deprecate 'direct' strategy (success rate: 45%)
  • Increase timeout thresholds - multiple timeout failures detected

⚠️  WARNING: Success rate declining. Review recent failures.
```

### In Code (Programmatic)

```typescript
import { selfEvaluation } from './harness/index.js';

// Get full evaluation
const report = selfEvaluation.evaluate();

// Check for regression
const regression = selfEvaluation.detectRegression();
if (regression.hasRegression) {
  console.error(regression.details);
}

// Get summary for display
console.log(selfEvaluation.getSummary());
```

---

## Metrics Tracked

| Metric | Description | Used For |
|--------|-------------|----------|
| Success Rate | % of tasks completed | Overall health |
| Recent Success Rate | Last 10 tasks | Trend detection |
| Strategy Success | Per-strategy rates | Strategy selection |
| Error Patterns | Frequency of error types | Remediation |
| Duration | Time per task | Performance |
| Tool Usage | Which tools are used | Optimization |

---

## Self-Correction Strategies

The harness can automatically:

1. **Switch Strategies**
   - From 'direct' to 'verify-first' if direct keeps failing
   - Based on historical success rates

2. **Adjust Parameters**
   - Increase timeout after timeout failures
   - Add validation after validation errors

3. **Request Human Help**
   - When success rate < 50%
   - When severe regression detected

4. **Generate Improvement Tasks**
   - Create tasks to fix weak strategies
   - Prioritize based on impact

---

## Integration with HarnessMemory

All self-evaluation data persists:
```typescript
// Recorded to HarnessMemory
harnessMemory.recordEpisode({
  type: 'task',
  domain: 'harness',
  prompt: taskId,
  code: JSON.stringify(outcome),
  metadata: {
    success: outcome.success,
    duration: outcome.duration,
    strategy: outcome.strategy,
  },
});
```

This means the harness **learns across restarts**.

---

## Configuration

```typescript
// Default configuration
const selfEvaluation = new SelfEvaluation();

// Custom configuration (future)
const selfEvaluation = new SelfEvaluation({
  maxHistory: 100,      // Keep last 100 tasks
  regressionWindow: 10, // Compare last 10 vs previous 10
  minSampleSize: 5,     // Need 5 tasks before evaluation
});
```

---

## Thresholds

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Overall Success | >80% | 60-80% | <60% |
| Recent Success | >70% | 50-70% | <50% |
| Regression | None | 15-30% drop | >30% drop |

---

## Example: Self-Correction in Action

**Scenario:** P5Generator plugin conversion task fails

**Attempt 1:**
- Strategy: 'direct'
- Result: FAILED (TypeScript error)
- Recorded: {success: false, errors: ['TS2345']}

**Self-Evaluation:**
- 'direct' strategy has 40% success rate
- 'verify-first' has 85% success rate

**Decision:**
```typescript
shouldRetry('task-1', 'direct');
// Returns: {
//   shouldRetry: true,
//   newStrategy: 'verify-first',
//   reason: "Switching from 'direct' to 'verify-first' (success rate: 85%)"
// }
```

**Attempt 2:**
- Strategy: 'verify-first' (type-check before write)
- Result: SUCCESS
- Recorded: {success: true}

**Outcome:**
- Task completed successfully
- Strategy preference updated
- Future tasks more likely to succeed

---

## Future Enhancements

1. **Automatic Strategy Tuning**
   - Adjust strategy parameters based on success
   - Evolve strategies over time

2. **Cross-Task Learning**
   - Apply learnings from one task to similar tasks
   - Pattern matching across task types

3. **Predictive Failure Detection**
   - Predict failure before it happens
   - Proactive correction

4. **Multi-Strategy Ensemble**
   - Try multiple strategies in parallel
   - Pick best result

---

## References

- Meta-Harness paper: arXiv:2603.28052
- `src/harness/SelfEvaluation.ts` - Implementation
- `src/harness/agent/HarnessAgent.ts` - Integration
- `harness-tasks/CONVERT_P5_TO_PLUGIN_EVAL.md` - Evaluation rubric example
