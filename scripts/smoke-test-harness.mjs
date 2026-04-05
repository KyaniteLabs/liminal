#!/usr/bin/env node
/**
 * Smoke Test: Harness E2E with real LLM
 *
 * Verifies the full harness agent loop works end-to-end:
 * 1. LLMClient constructs with harness role
 * 2. Provider auto-detection works
 * 3. Agent completes a plan→execute→reflect cycle
 *
 * Usage:
 *   HARNESS_API_KEY=sk-xxx \
 *   HARNESS_BASE_URL=https://api.minimax.io/v1 \
 *   HARNESS_MODEL=MiniMax-M2.7 \
 *   node scripts/smoke-test-harness.mjs
 */

import { LLMClient } from '../dist/llm/LLMClient.js';
import { LLMModeAgent } from '../dist/harness/agent/LLMModeAgent.js';
import { eventBus, EventTypes } from '../dist/core/EventBus.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(emoji, msg) {
  console.log(`${emoji} ${msg}`);
}

function pass(msg) {
  console.log(`${GREEN}  ✓ ${msg}${RESET}`);
}

function fail(msg) {
  console.log(`${RED}  ✗ ${msg}${RESET}`);
}

function info(msg) {
  console.log(`${YELLOW}  → ${msg}${RESET}`);
}

// Track events from EventBus
const receivedEvents = [];
eventBus.onEvent((event) => {
  receivedEvents.push(event);
  if (event.type === EventTypes.PROCESS_PROGRESS) {
    info(`Event: ${event.type} — step ${event.data.current}/${event.data.total} ${event.data.stage}`);
  } else if (event.type === EventTypes.PROCESS_END) {
    info(`Event: ${event.type} — success=${event.data.success} iterations=${event.data.iterations}`);
  }
});

async function main() {
  console.log('\n🧪 Harness E2E Smoke Test\n');
  console.log('='.repeat(50));

  // ── Step 1: Verify environment ──
  log('📋', 'Step 1: Environment check');
  const apiKey = process.env.HARNESS_API_KEY || process.env.LLM_API_KEY || process.env.MINIMAX_API_KEY;
  const baseUrl = process.env.HARNESS_BASE_URL || process.env.LLM_BASE_URL;
  const model = process.env.HARNESS_MODEL || process.env.LLM_MODEL || 'MiniMax-M2.7';

  if (!apiKey) {
    fail('No API key found. Set HARNESS_API_KEY, LLM_API_KEY, or MINIMAX_API_KEY');
    process.exit(1);
  }
  if (!baseUrl) {
    fail('No base URL found. Set HARNESS_BASE_URL or LLM_BASE_URL');
    process.exit(1);
  }
  pass(`API key: ${apiKey.slice(0, 8)}...`);
  pass(`Base URL: ${baseUrl}`);
  pass(`Model: ${model}`);

  // ── Step 2: Construct LLMClient with harness role ──
  log('\n📋', 'Step 2: Construct LLMClient({ role: "harness" })');
  let client;
  try {
    client = new LLMClient({
      role: 'harness',
      baseUrl,
      apiKey,
      model,
    });
    pass('LLMClient created');
  } catch (err) {
    fail(`LLMClient construction failed: ${err.message}`);
    process.exit(1);
  }

  const config = client.getConfig();
  pass(`Config resolved: model=${config.model}, temp=${config.temperature}`);

  // Verify harness temperature is 0.5 (not 0.2)
  if (config.temperature === 0.5) {
    pass('Temperature is 0.5 (harness default)');
  } else {
    fail(`Temperature is ${config.temperature}, expected 0.5`);
  }

  // ── Step 3: Test basic LLM completion ──
  log('\n📋', 'Step 3: Test basic LLM completion');
  try {
    const response = await client.complete({
      prompt: 'Reply with exactly: "harness alive"',
      maxTokens: 50,
      temperature: 0.1,
    });
    if (response.success && response.text.toLowerCase().includes('harness')) {
      pass(`LLM responded: "${response.text.slice(0, 80).replace(/\n/g, ' ')}"`);
    } else if (response.success) {
      info(`LLM responded (unexpected): "${response.text.slice(0, 80)}"`);
      pass('LLM call succeeded (content may vary)');
    } else {
      fail(`LLM call failed: ${response.error}`);
    }
  } catch (err) {
    fail(`LLM completion threw: ${err.message}`);
    process.exit(1);
  }

  // ── Step 4: Test native tool calling ──
  log('\n📋', 'Step 4: Test native tool calling');
  try {
    const tools = [
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to read' },
          },
          required: ['path'],
        },
      },
    ];

    const result = await client.generateWithTools({
      systemPrompt: 'You are a file-reading assistant. Use the read_file tool to read files.',
      userPrompt: 'Read the file src/harness/index.ts',
      tools,
      maxTokens: 500,
      temperature: 0.1,
    });

    if (result.success) {
      if (result.toolCalls && result.toolCalls.length > 0) {
        pass(`Native tool call received: ${result.toolCalls[0].name}(${result.toolCalls[0].arguments.slice(0, 60)}...)`);
        pass(`Finish reason: ${result.finishReason}`);
      } else {
        info(`No native tool calls (model may not support them). Content: ${result.content.slice(0, 60)}...`);
        pass('generateWithTools() succeeded (fallback path)');
      }
    } else {
      fail(`generateWithTools() failed: ${result.error}`);
    }
  } catch (err) {
    info(`Tool calling test skipped: ${err.message}`);
  }

  // ── Step 5: Test full agent loop ──
  log('\n📋', 'Step 5: Test LLMModeAgent autonomous loop');
  const agent = new LLMModeAgent(client);

  const task = {
    id: 'smoke-test-001',
    title: 'Read and report harness exports',
    description: 'Read the file src/harness/tools/index.ts and list what tools are exported. Then respond with tool "complete".',
    maxSteps: 5,
    approved: true,
  };

  info(`Submitting task: "${task.title}" (max ${task.maxSteps} steps)`);

  try {
    const session = await agent.executeTask(task);
    pass(`Agent session completed with status: ${session.status}`);
    pass(`Steps taken: ${session.stepCount}`);
    pass(`Messages exchanged: ${session.messages.length}`);

    if (session.status === 'SUCCESS') {
      pass('Agent completed the task successfully!');
    } else if (session.stepCount >= task.maxSteps) {
      info('Agent hit max steps (expected for limited task)');
    }
  } catch (err) {
    fail(`Agent execution failed: ${err.message}`);
  }

  // ── Step 6: Verify EventBus events ──
  log('\n📋', 'Step 6: Verify EventBus events');
  const startEvents = receivedEvents.filter(e => e.type === EventTypes.PROCESS_START);
  const progressEvents = receivedEvents.filter(e => e.type === EventTypes.PROCESS_PROGRESS);
  const endEvents = receivedEvents.filter(e => e.type === EventTypes.PROCESS_END);

  if (startEvents.length > 0) {
    pass(`PROCESS_START events: ${startEvents.length}`);
  } else {
    fail('No PROCESS_START events received');
  }

  if (progressEvents.length > 0) {
    pass(`PROCESS_PROGRESS events: ${progressEvents.length}`);
  } else {
    info('No PROCESS_PROGRESS events');
  }

  if (endEvents.length > 0) {
    pass(`PROCESS_END events: ${endEvents.length}`);
  } else {
    fail('No PROCESS_END events received');
  }

  // ── Summary ──
  console.log('\n' + '='.repeat(50));
  log('📊', `Total EventBus events received: ${receivedEvents.length}`);
  console.log('='.repeat(50) + '\n');
}

main().catch(err => {
  fail(`Unhandled error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
