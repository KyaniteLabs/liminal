#!/usr/bin/env node
/**
 * Harness TUI - Terminal UI for Meta-Harness
 * 
 * Pattern: Claw Code / Claude Code
 * - Command palette (/command)
 * - Tool inventory display
 * - Task queue management
 * - Live status panel
 */

import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useInput, Spacer } from 'ink';
import path from 'node:path';
import fs from 'node:fs/promises';
import { 
  metaHarness, 
  createHarnessAgent, 
  type AgentTask, 
  type HarnessAgent 
} from '../harness/index.js';
import { resolveCommand, type CommandContext } from './commands.js';

// Colors
const C = {
  primary: 'cyan',
  success: 'green', 
  warning: 'yellow',
  error: 'red',
  muted: 'gray',
};

// Header
const Header = () => (
  <Box borderStyle="double" borderColor={C.primary} paddingX={2}>
    <Text bold color={C.primary}>🎨 LIMINAL</Text>
    <Spacer />
    <Text color={C.muted}>Meta-Harness</Text>
  </Box>
);

// Status Bar
const StatusBar = ({ status, message }: { status: any; message: string }) => (
  <Box borderStyle="single" borderColor={C.muted} paddingX={1}>
    <Text color={C.muted}>
      {status?.initialized ? '🟢' : '🔴'} {status?.activeProvider || 'offline'} | 
      Failures: {status?.recentFailures || 0} | 
      {message}
    </Text>
  </Box>
);

// Command History
const History = ({ lines }: { lines: { type: string; content: string }[] }) => (
  <Box flexDirection="column" flexGrow={1} overflow="hidden">
    {lines.map((line, i) => (
      <Box key={i}>
        {line.type === 'user' && (
          <Text color={C.primary}>❯ {line.content}</Text>
        )}
        {line.type === 'output' && (
          <Text>{line.content}</Text>
        )}
        {line.type === 'error' && (
          <Text color={C.error}>{line.content}</Text>
        )}
        {line.type === 'system' && (
          <Text color={C.muted}>{line.content}</Text>
        )}
      </Box>
    ))}
  </Box>
);

// Command Input
const Input = ({ 
  value, 
  onChange, 
  onSubmit 
}: { 
  value: string; 
  onChange: (v: string) => void;
  onSubmit: () => void;
}) => {
  useInput((char, key) => {
    if (key.return) {
      onSubmit();
    } else if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
    } else if (char && !key.ctrl && !key.meta) {
      onChange(value + char);
    }
  });

  return (
    <Box>
      <Text bold color={C.primary}>❯ </Text>
      <Text>{value}</Text>
      <Text color={C.muted}>█</Text>
    </Box>
  );
};

// Main App
function App() {
  const [history, setHistory] = useState<{ type: string; content: string }[]>([
    { type: 'system', content: 'Meta-Harness initialized.' },
    { type: 'system', content: 'Type /help for commands' },
  ]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState('Ready');
  const [agent, setAgent] = useState<HarnessAgent | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);

  // Init
  useEffect(() => {
    metaHarness.initialize();
    setStatus(metaHarness.getStatus());
    
    const llmClient = metaHarness.getLLMClient();
    if (llmClient) {
      setAgent(createHarnessAgent(llmClient));
    }

    loadTasks();

    const interval = setInterval(() => {
      setStatus(metaHarness.getStatus());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const loadTasks = async () => {
    try {
      const dir = path.join(process.cwd(), 'harness-tasks');
      const files = await fs.readdir(dir);
      const loaded: AgentTask[] = [];
      for (const f of files.filter(f => f.endsWith('.json'))) {
        const content = await fs.readFile(path.join(dir, f), 'utf-8');
        loaded.push({ ...JSON.parse(content), approved: true });
      }
      setTasks(loaded);
    } catch {
      setTasks([]);
    }
  };

  const addLog = useCallback((msg: string) => {
    setHistory(h => [...h, { type: 'system', content: msg }]);
  }, []);

  const executeCommand = useCallback(async () => {
    const cmdStr = input.trim();
    if (!cmdStr) return;

    setHistory(h => [...h, { type: 'user', content: cmdStr }]);
    setInput('');

    // Handle commands
    if (cmdStr.startsWith('/')) {
      const parts = cmdStr.slice(1).split(' ');
      const cmdName = parts[0];
      const args = parts.slice(1);

      const cmd = resolveCommand(cmdName);
      if (cmd && agent) {
        try {
          const ctx: CommandContext = {
            agent,
            tasks,
            logs: [],
            addLog,
            setStatusMessage: setStatusMsg,
          };
          const output = await cmd.execute(args, ctx);
          setHistory(h => [...h, { type: 'output', content: output }]);
        } catch (err) {
          setHistory(h => [...h, { 
            type: 'error', 
            content: err instanceof Error ? err.message : String(err) 
          }]);
        }
      } else {
        setHistory(h => [...h, { 
          type: 'error', 
          content: `Unknown command: ${cmdName}. Type /help for available commands.` 
        }]);
      }
    } else {
      // Natural language - could route to LLM
      setHistory(h => [...h, { 
        type: 'system', 
        content: 'Use /run <task-id> to execute tasks, or /help for commands.' 
      }]);
    }
  }, [input, agent, tasks, addLog]);

  return (
    <Box flexDirection="column" height="100%">
      <Header />
      <Box flexDirection="column" flexGrow={1} paddingY={1}>
        <History lines={history.slice(-20)} />
      </Box>
      <Input 
        value={input} 
        onChange={setInput} 
        onSubmit={executeCommand} 
      />
      <StatusBar status={status} message={statusMsg} />
    </Box>
  );
}

// Entry point
export function startHarnessTUI() {
  render(<App />);
}

// CLI entry
if (require.main === module) {
  startHarnessTUI();
}
