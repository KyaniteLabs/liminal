#!/usr/bin/env node
/**
 * Harness TUI - Terminal UI with Hybrid Preview
 * 
 * Terminal for chat/commands + Browser for complex previews
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
import { audioPlayer } from './preview/index.js';

const C = {
  primary: 'cyan',
  success: 'green', 
  warning: 'yellow',
  error: 'red',
  muted: 'gray',
  code: 'green',
  audio: 'magenta',
};

const Header = () => (
  <Box borderStyle="double" borderColor={C.primary} paddingX={2}>
    <Text bold color={C.primary}>🎨 LIMINAL</Text>
    <Spacer />
    <Text color={C.muted}>Hybrid TUI</Text>
  </Box>
);

const StatusBar = ({ status, message }: { status: any; message: string }) => (
  <Box borderStyle="single" borderColor={C.muted} paddingX={1}>
    <Text color={C.muted}>
      {status?.initialized ? '🟢' : '🔴'} {status?.activeProvider || 'offline'} | 
      🔊 {audioPlayer.isPlaying() ? 'Playing' : 'Stopped'} |
      {message}
    </Text>
  </Box>
);

// History with type support
interface HistoryLine {
  type: 'user' | 'output' | 'error' | 'system' | 'code' | 'audio';
  content: string;
}

const History = ({ lines }: { lines: HistoryLine[] }) => (
  <Box flexDirection="column" flexGrow={1} overflow="hidden">
    {lines.map((line, i) => (
      <Box key={i} flexDirection="column">
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
        {line.type === 'code' && (
          <Box borderStyle="single" borderColor={C.code} marginY={1}>
            <Text color={C.code}>{line.content}</Text>
          </Box>
        )}
        {line.type === 'audio' && (
          <Box borderStyle="single" borderColor={C.audio} marginY={1}>
            <Text color={C.audio}>{line.content}</Text>
          </Box>
        )}
      </Box>
    ))}
  </Box>
);

const Input = ({ value, onChange, onSubmit }: { 
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

function App() {
  const [history, setHistory] = useState<HistoryLine[]>([
    { type: 'system', content: 'Hybrid TUI initialized.' },
    { type: 'system', content: 'Type /help for commands. /preview <file> to view content.' },
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

    // Cleanup on exit
    return () => {
      clearInterval(interval);
      audioPlayer.stop();
    };
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

  const addOutput = useCallback((type: string, content: string) => {
    setHistory(h => [...h, { type: type as any, content }]);
  }, []);

  const executeCommand = useCallback(async () => {
    const cmdStr = input.trim();
    if (!cmdStr) return;

    setHistory(h => [...h, { type: 'user', content: cmdStr }]);
    setInput('');

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
            addOutput,
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
          content: `Unknown command: ${cmdName}. Type /help.` 
        }]);
      }
    } else {
      setHistory(h => [...h, { 
        type: 'system', 
        content: 'Use /preview <file> or /run <task-id>' 
      }]);
    }
  }, [input, agent, tasks, addLog, addOutput]);

  return (
    <Box flexDirection="column" height="100%">
      <Header />
      <Box flexDirection="column" flexGrow={1} paddingY={1}>
        <History lines={history.slice(-30)} />
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

export function startHarnessTUI() {
  render(<App />);
}

if (require.main === module) {
  startHarnessTUI();
}
