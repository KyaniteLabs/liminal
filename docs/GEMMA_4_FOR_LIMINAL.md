# Gemma 4 + Sinter: The Perfect Match

**Why Gemma 4 Changes Everything for the Meta-Harness**

## The Current Problem

Sinter's HarnessAgent uses 7 tools:
- `readFile` - Read file contents
- `writeFile` - Write entire file
- `applyEdit` - Targeted string replacement
- `runBuild` - Run `npm run build`
- `runTests` - Run test suite
- `createBackup` - Create file backup
- `restoreBackup` - Restore from backup

**Current approach:** Prompt engineering to coax the LLM to output tool calls in a specific format. Fragile, error-prone.

## The Gemma 4 Solution: Native Function Calling

Gemma 4 has **native function calling trained into the model** - not prompt-engineered. This means:

1. **Define tools as JSON schemas**
2. **Model natively understands** when to call which tool
3. **Structured JSON output** - reliable, parseable
4. **Multi-step agentic workflows** - the model plans and executes sequences

### Example: Harness Tool Schema

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "applyEdit",
        "description": "Apply a targeted edit to a file using search/replace",
        "parameters": {
          "type": "object",
          "properties": {
            "filePath": {"type": "string", "description": "Path to the file"},
            "search": {"type": "string", "description": "Text to search for"},
            "replace": {"type": "string", "description": "Replacement text"}
          },
          "required": ["filePath", "search", "replace"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "runBuild",
        "description": "Run npm build to verify changes compile",
        "parameters": {
          "type": "object",
          "properties": {}
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "runTests",
        "description": "Run test suite to verify correctness",
        "parameters": {
          "type": "object",
          "properties": {}
        }
      }
    }
  ]
}
```

### How It Works

```
User: Fix the bug in CodeValidator.ts where Tone.js validation fails

Gemma 4 thinks:
1. I need to read the file first → call readFile
2. Find the bug in the code
3. Apply the fix → call applyEdit
4. Verify with build → call runBuild
5. Run tests → call runTests

Output:
{
  "tool_calls": [{
    "id": "call_1",
    "type": "function",
    "function": {
      "name": "readFile",
      "arguments": "{\"filePath\": \"src/core/CodeValidator.ts\"}"
    }
  }]
}
```

## Why This Is Better

| Before (Prompt Engineering) | After (Gemma 4 Native) |
|-----------------------------|------------------------|
| Fragile text parsing | Structured JSON output |
| "Please use tools" prompting | Model *knows* tool semantics |
| Single-shot tool use | Multi-step planning |
| Error-prone | Reliable function calling |
| Limited to 7 tools | Can scale to many tools |

## The Full Picture: Gemma 4 + Sinter

### Generator Layer (Dumb)
- LFM 2.5 1.2B - Fast code generation
- Qwen 3.5 0.8B - Quick validation

### Harness Layer (Smart)
- **Gemma 4 26B A4B** - Agentic orchestration
  - Native function calling for 7+ tools
  - Multimodal: Can analyze screenshots of failures
  - 256K context: Can read entire codebase
  - Reasoning mode for complex fixes

### New Capabilities

#### 1. Screenshot-Driven Debugging
```
[Upload: error_screenshot.png]
Prompt: "This is the error I see. Fix the source code."
→ Gemma 4 analyzes image, finds file, applies fix
```

#### 2. Audio Descriptions
```
[Upload: voice_description.wav]
Prompt: "User describes the bug in this audio. Fix it."
→ Gemma 4 E4B transcribes + analyzes + fixes
```

#### 3. Multi-File Refactoring
```
With 256K context:
- Read 10 files at once
- Plan cross-file changes
- Execute with applyEdit on each
- Verify with runBuild
```

#### 4. Video-to-Code
```
[Upload: animation_demo.mp4]
Prompt: "Recreate this animation in p5.js"
→ Gemma 4 processes frames, generates code
```

## Model Selection for Sinter

| Component | Model | Why |
|-----------|-------|-----|
| **Fast generation** | LFM 2.5 1.2B | Speed, 8/10 generators |
| **Validation** | Qwen 3.5 0.8B | Reliable evaluator |
| **Harness agent** | **Gemma 4 26B A4B** | Native tools, reasoning, 256K context |
| **Audio features** | Gemma 4 E4B | Audio input for voice-driven coding |
| **Max quality** | Gemma 4 31B | When 26B isn't enough |

## Implementation Plan

### Phase 1: Basic Tool Calling
Update `HarnessAgent.ts` to use Gemma 4 with native function calling:
```typescript
const tools = [
  { name: 'readFile', schema: {...} },
  { name: 'applyEdit', schema: {...} },
  // ...
];

const response = await gemma4.chat.completions.create({
  model: 'gemma-4-26b-a4b-it',
  messages: [...],
  tools,
  tool_choice: 'auto', // Let model decide
});
```

### Phase 2: Multimodal Debugging
```typescript
// Screenshot of error
messages.push({
  role: 'user',
  content: [
    { type: 'image_url', image_url: errorScreenshot },
    { type: 'text', text: 'Fix this error in the codebase' }
  ]
});
```

### Phase 3: Audio Input
```typescript
// Voice description of desired effect
messages.push({
  role: 'user',
  content: [
    { type: 'audio_url', audio_url: voiceInput }, // E4B
    { type: 'text', text: 'Generate code for this' }
  ]
});
```

## The Vision

**Sinter becomes truly multimodal:**

1. **Upload a song** → Gemma E4B analyzes audio → Generates Strudel pattern
2. **Upload a video** → Gemma 26B processes frames → Generates p5.js animation
3. **Upload a screenshot of error** → Gemma 26B debugs → Applies fix
4. **Speak your request** → Gemma E4B transcribes → Generates code
5. **Complex refactor** → Gemma 26B with 256K context → Multi-file changes

**All with native tool calling. No prompt engineering. Reliable agentic workflows.**

## Immediate Next Steps

1. ✅ Confirm Gemma 4 26B works in LM Studio
2. 🔄 Test native function calling via OpenAI-compatible API
3. 🔄 Update HarnessAgent to use tool schemas
4. 🔄 Add multimodal input (screenshots → fixes)
5. 🔄 Test E4B for audio input capabilities

## Summary

| Feature | Status | Model |
|---------|--------|-------|
| Fast generation | ✅ | LFM 1.2B |
| Validation | ✅ | Qwen 0.8B |
| Tool calling | 🔄 | Gemma 26B |
| Vision debugging | 🔄 | Gemma 26B |
| Audio input | 🔄 | Gemma E4B |
| 256K context | 🔄 | Gemma 26B/31B |

**Gemma 4 isn't just another model. It's the agentic layer Sinter needs.**
