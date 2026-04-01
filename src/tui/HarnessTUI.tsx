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

interface ActivityState {
  phase: 'idle' | 'thinking' | 'generating' | 'executing' | 'validating' | 'retrying';
  step?: number;
  totalSteps?: number;
  currentTool?: string;
  thinkingChars?: number;
  lastActivity: number;
}

const StatusBar = ({ status, message, activity }: { status: any; message: string; activity: ActivityState }) => {
  const phaseEmoji = {
    idle: '⏸️',
    thinking: '🤔',
    generating: '✨',
    executing: '🔧',
    validating: '✅',
    retrying: '🔄',
  }[activity.phase];
  
  const progress = activity.step && activity.totalSteps 
    ? `[${activity.step}/${activity.totalSteps}]` 
    : '';
  
  const tool = activity.currentTool ? `→ ${activity.currentTool}` : '';
  const thinking = activity.thinkingChars ? `(💭 ${activity.thinkingChars})` : '';
  
  return (
    <Box borderStyle="single" borderColor={activity.phase === 'idle' ? C.muted : C.primary} paddingX={1}>
      <Text color={activity.phase === 'idle' ? C.muted : C.primary}>
        {status?.initialized ? '🟢' : '🔴'} {status?.activeProvider || 'offline'} | 
        {phaseEmoji} {message} {progress} {tool} {thinking}
      </Text>
    </Box>
  );
};

interface HistoryLine {
  type: 'user' | 'assistant' | 'output' | 'error' | 'system' | 'code' | 'audio';
  content: string;
  streaming?: boolean;
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
            <Text>{line.content}{line.streaming && <Text color={C.primary}>▌</Text>}</Text>
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

const DebugPanel = ({ logs, activity }: { logs: string[]; activity: ActivityState }) => (
  <Box 
    flexDirection="column" 
    borderStyle="single" 
    borderColor={C.muted}
    paddingX={1}
    width={60}
  >
    <Text bold color={C.primary}>🔍 DEBUG</Text>
    <Text color={C.muted}>Phase: {activity.phase}</Text>
    <Text color={C.muted}>Last Activity: {Math.floor((Date.now() - activity.lastActivity) / 1000)}s ago</Text>
    {activity.currentTool && <Text color={C.warning}>Tool: {activity.currentTool}</Text>}
    {activity.step && <Text color={C.muted}>Step: {activity.step}/{activity.totalSteps}</Text>}
    <Box marginY={1}>
      <Text color={C.muted}>--- Recent Logs ---</Text>
    </Box>
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      {logs.slice(-15).map((log, i) => (
        <Text key={i} color={C.muted} wrap="truncate-end">{log}</Text>
      ))}
    </Box>
  </Box>
);

const Input = ({ value, onChange, onSubmit, onCopy, onToggleDebug }: { 
  value: string; 
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCopy?: () => void;
  onToggleDebug?: () => void;
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
    } else if (key.ctrl && char === 'd') {
      // Toggle debug panel
      if (onToggleDebug) onToggleDebug();
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
    { type: 'assistant', content: 'Hi! I\'m Liminal, your creative coding partner.\n\nJust talk to me naturally:\n  • "Fix the Tone.js validation"\n  • "What\'s the status?"\n  • "Tell me about p5.js noise()"\n\nShortcuts: Ctrl+V=paste, Ctrl+C=copy last response, Ctrl+D=toggle debug\nType "/help" for explicit commands.' },
  ]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState('Ready');
  const [activity, setActivity] = useState<ActivityState>({ phase: 'idle', lastActivity: Date.now() });
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [, setNaturalInterface] = useState<NaturalInterface | null>(null);
  const [shouldExit, setShouldExit] = useState(false);
  
  // Use ref for latest state in callbacks
  const interfaceRef = useRef<NaturalInterface | null>(null);
  const debugLogRef = useRef<string[]>([]);
  
  // Helper to update activity with timestamp
  const updateActivity = useCallback((update: Partial<ActivityState>) => {
    setActivity(prev => ({ ...prev, ...update, lastActivity: Date.now() }));
  }, []);
  
  // Add to debug log (ref + state for performance)
  const addDebug = useCallback((msg: string) => {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    debugLogRef.current = [...debugLogRef.current.slice(-50), line];
    setDebugLog(debugLogRef.current);
  }, []);

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
    addDebug(`USER INPUT: ${userInput.slice(0, 50)}${userInput.length > 50 ? '...' : ''}`);

    const ni = interfaceRef.current;
    if (!ni) {
      setHistory(h => [...h, { 
        type: 'error', 
        content: 'System not initialized. Check LLM configuration.' 
      }]);
      return;
    }

    // Process through natural interface with streaming for chat
    try {
      let streamingContent = '';
      updateActivity({ phase: 'thinking', thinkingChars: 0 });
      setStatusMsg('Processing...');
      addDebug('LLM: Starting stream request');
      
      const startTime = Date.now();
      const result = await ni.processInput(userInput, (chunk, meta) => {
        // Stream handler - updates UI incrementally
        if (meta?.type === 'thinking') {
          updateActivity({ phase: 'thinking', thinkingChars: meta.length });
          if (meta.length && meta.length % 100 === 0) {
            addDebug(`LLM: Thinking... ${meta.length} chars`);
          }
          return;
        }
        
        if (meta?.type === 'content') {
          updateActivity({ phase: 'generating' });
          streamingContent += chunk;
          
          // Log every 100 chars of content
          if (streamingContent.length % 100 === 0) {
            addDebug(`LLM: Generated ${streamingContent.length} chars (${Date.now() - startTime}ms)`);
          }
          
          // Update the last assistant message or add a new streaming one
          setHistory(h => {
            const lastMsg = h[h.length - 1];
            if (lastMsg && lastMsg.type === 'assistant' && lastMsg.streaming) {
              return [...h.slice(0, -1), { 
                type: 'assistant', 
                content: streamingContent,
                streaming: true,
              }];
            } else {
              return [...h, { 
                type: 'assistant', 
                content: streamingContent,
                streaming: true,
              }];
            }
          });
        }
      });
      
      addDebug(`LLM: Stream complete in ${Date.now() - startTime}ms, ${streamingContent.length} chars`);
      addDebug(`RESULT: type=${result.type}, responseLen=${result.response?.length || 0}`);
      
      // Finalize the message - mark as not streaming
      // Use streamingContent if result.response is empty (streaming mode)
      const finalContent = streamingContent || result.response || '(no response)';
      const displayType = result.type === 'chat' ? 'assistant' : 'output';
      setHistory(h => {
        const lastMsg = h[h.length - 1];
        if (lastMsg && lastMsg.streaming) {
          return [...h.slice(0, -1), { 
            type: displayType, 
            content: finalContent,
          }];
        }
        return [...h, { type: displayType, content: finalContent }];
      });
      
      if (!result.shouldContinue) {
        setShouldExit(true);
      }
      updateActivity({ phase: 'idle', thinkingChars: 0, currentTool: undefined });
      setStatusMsg('Ready');
      addDebug(`RESULT: type=${result.type}, shouldContinue=${result.shouldContinue}`);
    } catch (err) {
      updateActivity({ phase: 'idle' });
      setStatusMsg('Error');
      const errorMsg = err instanceof Error ? err.message : String(err);
      addDebug(`ERROR: ${errorMsg}`);
      setHistory(h => [...h, { 
        type: 'error', 
        content: errorMsg 
      }]);
    }
  }, [input, updateActivity, addDebug]);

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

  // Toggle debug panel
  const handleToggleDebug = useCallback(() => {
    setShowDebug(prev => !prev);
  }, []);

  return (
    <Box flexDirection="column" height="100%">
      <Header />
      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" flexGrow={1} paddingY={1}>
          <History lines={history.slice(-50)} />
        </Box>
        {showDebug && (
          <DebugPanel logs={debugLog} activity={activity} />
        )}
      </Box>
      <Input 
        value={input} 
        onChange={setInput} 
        onSubmit={handleSubmit} 
        onCopy={handleCopy}
        onToggleDebug={handleToggleDebug}
      />
      <StatusBar status={status} message={statusMsg} activity={activity} />
    </Box>
  );
}

export function startHarnessTUI() {
  render(<App />);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startHarnessTUI();
}
