#!/usr/bin/env node
/**
 * Harness TUI - Terminal UI with Natural Language Interface
 * 
 * Claude Code style: No prefixes, just type naturally
 * "Fix the validation" → Agent mode
 * "What's the status?" → Command mode  
 * "Tell me about p5.js" → Chat mode
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { render, Box, Text, useInput, Spacer } from 'ink';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import clipboard from 'clipboardy';
import { 
  metaHarness, 
  createHarnessAgent,
  createLLMModeAgent,
  type AgentTask,
} from '../harness/index.js';
import { NaturalInterface } from './NaturalInterface.js';
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
    <Text color={C.muted}>Natural Interface</Text>
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

interface HistoryLine {
  type: 'user' | 'assistant' | 'output' | 'error' | 'system' | 'code' | 'audio';
  content: string;
}

const History = ({ lines }: { lines: HistoryLine[] }) => (
  <Box flexDirection="column" flexGrow={1} overflow="hidden">
    {lines.map((line, i) => (
      <Box key={i} flexDirection="column">
        {line.type === 'user' && (
          <Text color={C.primary}>❯ {line.content}</Text>
        )}
        {line.type === 'assistant' && (
          <Box marginLeft={2} marginY={1}>
            <Text>{line.content}</Text>
          </Box>
        )}
        {line.type === 'output' && (
          <Box marginLeft={2}>
            <Text>{line.content}</Text>
          </Box>
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

const Input = ({ value, onChange, onSubmit, onCopy }: { 
  value: string; 
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCopy?: () => void;
}) => {
  useInput(async (char, key) => {
    if (key.return) {
      onSubmit();
    } else if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
    } else if (key.ctrl && char === 'v') {
      // Paste from clipboard - strip newlines for single-line input
      try {
        const pasted = await clipboard.read();
        const cleaned = pasted.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        onChange(value + cleaned);
      } catch {
        // Ignore paste errors
      }
    } else if (key.ctrl && char === 'c') {
      // Copy current input or last response
      if (onCopy) onCopy();
    } else if (char === '\n' || char === '\r') {
      // Ignore raw newlines from paste - require Enter key
      return;
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
    { type: 'system', content: 'Liminal initialized.' },
    { type: 'assistant', content: 'Hi! I\'m Liminal, your creative coding partner.\n\nJust talk to me naturally:\n  • "Fix the Tone.js validation"\n  • "What\'s the status?"\n  • "Tell me about p5.js noise()"\n\nShortcuts: Ctrl+V=paste, Ctrl+C=copy last response\nType "/help" for explicit commands.' },
  ]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState('Ready');
  const [, setNaturalInterface] = useState<NaturalInterface | null>(null);
  const [shouldExit, setShouldExit] = useState(false);
  
  // Use ref for latest state in callbacks
  const interfaceRef = useRef<NaturalInterface | null>(null);

  // Init
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      try {
        await metaHarness.initialize();
        if (!mounted) return;
        
        setStatus(metaHarness.getStatus());
        
        // DEV MODE: Use harness LLM (MiniMax) for BOTH chat and harness
        // This gives better English grammar than local qwen models
        const harnessLLMClient = metaHarness.getLLMClient();
        
        console.log('[TUI] DEV MODE: Using harness LLM for chat');
        
        if (harnessLLMClient) {
          const harnessAgent = createHarnessAgent(harnessLLMClient);
          const llmAgent = createLLMModeAgent(harnessLLMClient);
          
          const ni = new NaturalInterface({
            harnessAgent,
            llmAgent,
            llmClient: harnessLLMClient,
            tasks: [],
            onStatus: setStatusMsg,
            onLog: (msg) => {
              setHistory(h => [...h, { type: 'system', content: msg }]);
            },
          });
          
          setNaturalInterface(ni);
          interfaceRef.current = ni;
          
          // Load tasks
          loadTasks(ni);
        } else {
          console.error('[TUI] Failed to initialize harness LLM');
          setHistory(h => [...h, { type: 'error', content: 'Failed to initialize harness LLM. Check LIMINAL_HARNESS_BASE_URL.' }]);
        }
      } catch (err) {
        console.error('[TUI] Init error:', err);
        setHistory(h => [...h, { type: 'error', content: `Initialization error: ${err instanceof Error ? err.message : String(err)}` }]);
      }
    };
    
    init();
    
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(metaHarness.getStatus());
    }, 2000);

    return () => {
      clearInterval(interval);
      audioPlayer.stop();
    };
  }, []);

  const loadTasks = async (ni: NaturalInterface) => {
    try {
      const dir = path.join(process.cwd(), 'harness-tasks');
      const files = await fs.readdir(dir);
      const loaded: AgentTask[] = [];
      for (const f of files.filter(f => f.endsWith('.json'))) {
        const content = await fs.readFile(path.join(dir, f), 'utf-8');
        loaded.push({ ...JSON.parse(content), approved: true });
      }
      // Update the interface's tasks
      ni.setTasks(loaded);
    } catch {
      // No tasks loaded
    }
  };

  const handleSubmit = useCallback(async () => {
    const userInput = input.trim();
    if (!userInput) return;

    // Add user message to history
    setHistory(h => [...h, { type: 'user', content: userInput }]);
    setInput('');

    const ni = interfaceRef.current;
    if (!ni) {
      setHistory(h => [...h, { 
        type: 'error', 
        content: 'System not initialized. Check LLM configuration.' 
      }]);
      return;
    }

    // Process through natural interface
    try {
      const result = await ni.processInput(userInput);
      
      // Map result type to display type
      const displayType = result.type === 'chat' ? 'assistant' : 'output';
      setHistory(h => [...h, { type: displayType, content: result.response }]);
      
      if (!result.shouldContinue) {
        setShouldExit(true);
      }
    } catch (err) {
      setHistory(h => [...h, { 
        type: 'error', 
        content: err instanceof Error ? err.message : String(err) 
      }]);
    }
  }, [input]);

  // Handle exit
  useEffect(() => {
    if (shouldExit) {
      setTimeout(() => {
        audioPlayer.stop();
        process.exit(0);
      }, 500);
    }
  }, [shouldExit]);

  // Copy last assistant message to clipboard
  const handleCopy = useCallback(async () => {
    const lastAssistant = [...history].reverse().find(h => h.type === 'assistant');
    if (lastAssistant) {
      try {
        await clipboard.write(lastAssistant.content);
        setStatusMsg('Copied to clipboard!');
        setTimeout(() => setStatusMsg('Ready'), 2000);
      } catch {
        setStatusMsg('Copy failed');
      }
    }
  }, [history]);

  return (
    <Box flexDirection="column" height="100%">
      <Header />
      <Box flexDirection="column" flexGrow={1} paddingY={1}>
        <History lines={history.slice(-50)} />
      </Box>
      <Input 
        value={input} 
        onChange={setInput} 
        onSubmit={handleSubmit} 
        onCopy={handleCopy}
      />
      <StatusBar status={status} message={statusMsg} />
    </Box>
  );
}

export function startHarnessTUI() {
  render(<App />);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startHarnessTUI();
}
