# TUI Issue Report — Complete

2026-04-06

2026

## Source
Debug log: `~/.liminal/debug/tui-2026-04-06T00-02-31-957Z.log`
 (5 sessions observed)
 TUI config: `~/.liminal/config.json` (debug.verbose=true, provider=minimax)

## Issue 1: LLM Latency Spikes (HIGH)
Simple inputs ("yes", "sup") trigger 7-42s responses. The LLM over-generates for trivial inputs.

- **Files:** `src/tui/NaturalInterface.ts:316-391` (`handleChat`)
- **Root cause:** System prompt at line 330-333 encourages verbose responses. `maxTokens` not scaled with input bre No intermediate feedback during generation.

 App appears frozen until status bar says "Running diagnostics..." the entire time.

- **Fix:** Stream intermediate results via `addHistory` after each test, or use `Promise.allSettled` to parallelize the 4 LLM calls.

- **Evidence:** Debug log shows "Running diagnostics..." at 00:10:38 with no new entries until 00:16:20 UTC

 taking ~4 minutes with no updates to the status bar.

- **Fix:** Either make the 4 tests parallel, emit intermediate results, or add a per-test progress indicator after each test completes.

- **Evidence:** Debug log shows all results are `type=chat` with no evidence of routing happened at the LLM level
 not at the application level
- **Root cause:** `handleChat` in `NaturalInterface` never calls `executeTask()`. It just wraps input in a system prompt telling MiniMax to respond as your personality." This giving MiniMax card blanch responses in `chat` mode instead of executing.- **Files:** `src/tui/NaturalInterface.ts:256-311` (`handleChat`), `src/tui/NaturalInterface.ts:60-72` (AGENT_PATTERNS)

- **Note:** `^` anchor on line 69 doesn't match "i want you to..." because `^` being "i want you to"
 is match `^(?:please\s+)?` prefix and `do`/`make`/`open` — but thematch before `^(?:please\s+)?` prefix on `open/launch/start/execute|do|make`), but actual pattern matches are But it `matchCommand` runs first and can steal valid agent requests before `isAgentRequest` is checked runs. but chat wins anyway:
 **Example:** "sup" falls through to chat. "do a beautiful composition" → chat. "yes" → chat. `rain` → chat. Everything is chat.

- **Evidence:** Debug log `RESULT: type=chat` on every single response
- **Root cause:** `handleChat` in `NaturalInterface` bypasses the agent entirely. It takes user input, wraps it in a system prompt that tells MiniMax to respond conversationally, which encourages verbose responses instead of executing code changes.

- **Fix:** Change `handleChat` to route through `handleAgentRequest` OR change routing priority so agent should be default, not chat

- **Alt fix:** `processInput()` should route to agent FIRST, with slash commands → commands → agent. Everything else → agent. Only fall back to chat for the trivial inputs ("sup", "status?"), "rain", "what's the status?") that don't justify agent routing before sending to agent.

- **Root cause:** `handleAgentRequest` at `NaturalInterface.ts:256-262` uses `isAgentRequest()` which returns `true` when bare imperative patterns SHOULD match, but doesn't because to "i want you to surprise me. do..." pattern never actually reaches `isAgentRequest` because the second sentence has a "^" prefix making `^(?:please\s+)?` optional
 which allows matching, but "i want you to surprise me" — the string starts with "do" so "^(?:please\s+)?` prefix doesn't match, and `do` alone with `^` works
 but "i want you to..." fails because `^` anchor,- **Second problem:** `matchCommand` on line 146-150 runs before `isAgentRequest`. So commands like "status" are "tasks" → "run task" etc. can steal agent-eligible inputs before agent mode even gets the chance to act. For "agent" but falls through to chat.- **Fix:** Change routing order to `processInput()` → agent first, commands → agent → default agent

- **Example priority order:** status → agent, tasks → agent, questions → agent, everything → agent

- **Fix:** Remove `matchCommand` entirely or or at least move agent routing to: **commands first, then agent, then everything else**. This would make the architecture much simpler: Every non-command should go to agent by default.

- **Theternative:** Default to chat mode if agent says "yes" or "handleAgentRequest` is sees the `type=chat` response, which contains no `toolCalls` field, MiniMax hallucinated `harness/invoke.js` code blocks with fake output. None of it executes.
- **Evidence:** User typed "yes" → got `type=chat` response with 7426 chars of hallucinated harness output. No tools were actually called.
 No files written, No server started
- **Fix:** After `executeTask()`, check `session.status`. If `rolled_back`, log and handle. accordingly. Otherwise just ask the user for explicit confirmation

- **Note:** `handleChat` prompt says "if the user asks you to modify code (fix, add, change, etc.) OR says 'Should I...?"` — MiniMax never calls `executeTask()`, it just hallucin what it would happen. This is the primary cause of Issues 1 and 2.

 Without fixing Issues 1+2, the TUI is chat mode is always a hallucination mode. even when agent patterns match.
- **Issue 7 is is the root issue** — if an agent patterns match perfectly, the LLM hallucinated file writes and server starts in chat responses. and the user never knows. difference.

- **Impact:** User trust is TUI can execute real actions but sees nothing happen. Every action request goes to chat, gets simulated instead of executed

- **Files:** `src/tui/NaturalInterface.ts:60-72` (AGENT_PATTERNS), `src/tui/NaturalInterface.ts:256-311` (`handleChat`)

- **Fix:** Remove `handleChat`. Make agent the default route. Add a confirmation check before executing.

- **Alt fix:** Change `processInput` routing to: slash commands → commands → agent, everything else → agent, only fall back to chat for trivial inputs ("sup", "status?") that don't justify agent routing before sending to agent)
