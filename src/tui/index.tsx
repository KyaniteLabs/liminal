#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput, useStdout, Spacer } from "ink";
import fs from "fs/promises";
import path from "path";
import { Logger } from "../utils/Logger.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");

// Import v2.0 components
import { PlayerPiano } from "./components/PlayerPiano";
import { XRayPanel } from "./components/XRayPanel";
import { IterationTimeline } from "./components/IterationTimeline";
import { TransparencyPanel } from "./components/TransparencyPanel";
import { TransparencyViewer, type ProcessEvent } from "../ui/TransparencyViewer.js";
import { SERVICE_DEFAULTS } from '../constants.js';
import { validateImportPath } from '../security/ImportValidator.js';

interface GalleryEntry {
  projectName: string;
  path: string;
  iterations: string[];
}

interface LogEntry {
  type: "info" | "code" | "success" | "error" | "iteration" | "system" | "llm";
  message: string;
  timestamp: number;
}

interface Iteration {
  id: number;
  code: string;
  timestamp: number;
  quality?: number;
  reason?: string;
}

const COLORS = {
  // Design system — matches Bubble Tea 256-color + GUI Atelier dark OLED palette
  primary: "#22C55E",      // Accent green (CTA, active)
  success: "#22C55E",      // Same green for pass/success
  warning: "#EAB308",      // Amber for caution
  error:   "#EF4444",      // Red for failures
  muted:   "#94A3B8",      // Slate gray for secondary text
  dim:     "#475569",      // Dimmer slate for borders/hints
  border:  "#334155",      // Slate border
  code:    "#22C55E",      // Green for code text
  info:    "#93C5FD",      // Soft blue for info
  highlight: "#C084FC",    // Purple for system events
  llm:     "#EAB308",      // Amber for LLM activity
  bg:      "#020617",      // Deep navy background
  surface: "#1E293B",      // Slate surface
};

async function loadGallery(): Promise<GalleryEntry[]> {
  try {
    const galleryDir = path.join(PROJECT_ROOT, "gallery");
    const entries = await fs.readdir(galleryDir, { withFileTypes: true });
    const projects: GalleryEntry[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = path.join(galleryDir, entry.name);
        const files = await fs.readdir(projectPath);
        const iterations = files.filter(f => f.endsWith(".js")).sort();
        projects.push({ projectName: entry.name, path: projectPath, iterations });
      }
    }
    return projects.sort((a, b) => b.projectName.localeCompare(a.projectName));
  } catch (err) {
    Logger.debug('TUI', 'Failed to list projects:', err);
    return [];
  }
}

function useTerminalSize() {
  const { stdout } = useStdout();
  const [size, setSize] = useState({ rows: 40, columns: 120 });
  useEffect(() => {
    const updateSize = () => setSize({ rows: stdout.rows || 40, columns: stdout.columns || 120 });
    updateSize();
    stdout.on("resize", updateSize);
    return () => { stdout.off("resize", updateSize); };
  }, [stdout]);
  return size;
}

const Banner = () => (
  <Box borderStyle="double" borderColor={COLORS.primary} paddingX={1} marginBottom={1}>
    <Text bold color={COLORS.primary}>LIMINAL TUI v2.0</Text>
    <Spacer />
    <Text color={COLORS.muted}>Creative Coding Agent</Text>
  </Box>
);

const LogsPanel = ({ logs, height }: { logs: LogEntry[]; height: number }) => {
  const displayLogs = logs.slice(-(height - 3));
  return (
    <Box flexDirection="column" borderStyle="single" borderColor={COLORS.border} width="20%" height={height} paddingX={1}>
      <Box marginBottom={1}><Text bold color={COLORS.info}>LOGS</Text><Text color={COLORS.muted}> (Streaming)</Text></Box>
      <Box flexDirection="column" flexGrow={1}>
        {displayLogs.map((log, i) => (
          <Box key={i}>
            <Text color={log.type === "error" ? COLORS.error : log.type === "success" ? COLORS.success : log.type === "code" ? COLORS.code : log.type === "llm" ? COLORS.llm : log.type === "iteration" ? COLORS.warning : log.type === "system" ? COLORS.highlight : COLORS.muted}>
              {log.type === "llm" ? "⚡ " : log.type === "iteration" ? "↻ " : log.type === "success" ? "✓ " : log.type === "error" ? "✗ " : "> "}
              {log.message.length > 25 ? log.message.slice(0, 25) + ".." : log.message}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const GalleryPanel = ({ projects, currentIndex, onSelect, height }: any) => {
  useInput((_input: string, key: any) => {
    if (key.upArrow) onSelect(Math.max(0, currentIndex - 1));
    else if (key.downArrow) onSelect(Math.min(projects.length - 1, currentIndex + 1));
  });
  return (
    <Box flexDirection="column" borderStyle="single" borderColor={COLORS.border} width="20%" height={height} paddingX={1}>
      <Box marginBottom={1}><Text bold color={COLORS.success}>GALLERY</Text><Text color={COLORS.muted}> ({projects.length})</Text></Box>
      <Box flexDirection="column" flexGrow={1}>
        {projects.slice(0, height - 6).map((project: GalleryEntry, index: number) => (
          <Box key={project.projectName}>
            <Text color={index === currentIndex ? COLORS.primary : COLORS.muted}>{index === currentIndex ? "> " : "  "}</Text>
            <Text color={index === currentIndex ? "white" : COLORS.muted} bold={index === currentIndex}>{project.projectName.slice(0, 10)}</Text>
            <Text color={COLORS.muted}>({project.iterations.length})</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const PromptBar = ({ value, onChange, onSubmit, disabled }: any) => {
  useInput((_input: string, key: any) => {
    if (disabled) return;
    if (key.return) onSubmit();
    else if (key.backspace || key.delete) onChange(value.slice(0, -1));
    else if (_input) onChange(value + _input);
  });
  return (
    <Box borderStyle="round" borderColor={disabled ? COLORS.muted : COLORS.primary} paddingX={1} marginBottom={1}>
      <Text bold color={disabled ? COLORS.muted : COLORS.primary}>Prompt:</Text>
      <Text color={disabled ? COLORS.muted : "white"}> {value || (disabled ? "[Generating...]" : "Type prompt...")}</Text>
      <Spacer />
      {disabled ? <Text color={COLORS.warning}>Working...</Text> : value ? <Text color={COLORS.success}>[ENTER]</Text> : <Text color={COLORS.muted}>[ESC]</Text>}
    </Box>
  );
};

const App = ({ initialGallery }: { initialGallery: GalleryEntry[] }) => {
  const { rows } = useTerminalSize();
  const contentHeight = Math.max(20, rows - 10);
  const [prompt, setPrompt] = useState("");
  const [seedCode, _setSeedCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([
    { type: "system", message: "Liminal TUI v2.0 initialized", timestamp: Date.now() },
    { type: "info", message: `Loaded ${initialGallery.length} projects`, timestamp: Date.now() },
    { type: "info", message: "v2.0: PlayerPiano + X-Ray + Voice ready", timestamp: Date.now() },
  ]);
  const [currentIterations, setCurrentIterations] = useState<Iteration[]>([]);
  const [gallery, setGallery] = useState<GalleryEntry[]>(initialGallery);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [playerPianoIndex, setPlayerPianoIndex] = useState(0);
  const [isPlayerPianoPlaying, setIsPlayerPianoPlaying] = useState(false);
  const rawLLMOutput = useState<string[]>([])[0];
  const [showTransparency, setShowTransparency] = useState(false);
  const [transparencyEvents, setTransparencyEvents] = useState<ProcessEvent[]>([]);
  const transparencyViewerRef = React.useRef<TransparencyViewer | null>(null);

  const addLog = (type: LogEntry["type"], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: Date.now() }].slice(-100));
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    setIsGenerating(true);
    setCurrentIterations([]);
    setPlayerPianoIndex(0);
    addLog("info", `Starting: "${prompt.slice(0, 30)}..."`);
    const model = process.env.LLM_MODEL || SERVICE_DEFAULTS.DEFAULT_MODEL;
    addLog("llm", `→ LLM Request: lmstudio/${model}`);
    addLog("llm", `  Prompt: ~${prompt.length + 2000} chars`);

    const projectName = `project-${Date.now()}`;

    // Initialize TransparencyViewer for this run
    const viewer = new TransparencyViewer('collab');
    transparencyViewerRef.current = viewer;
    setTransparencyEvents([]);

    const runOptions = {
      maxIterations: 10,
      timeoutMinutes: 5,
      galleryDir: "gallery",
      project: projectName,
      seedCode: seedCode.trim() || undefined,
      signal,
      useDeepCollab: true,
      collabConfig: {
        onProgress: (update: any) => {
          // Map PhaseUpdate from DeepCollaboration to ProcessEvent
          const eventType = update.action?.toLowerCase().includes('generating') ? 'prompt' :
                           update.action?.toLowerCase().includes('output') ? 'output' :
                           update.action?.toLowerCase().includes('analysis') ? 'analysis' :
                           update.action?.toLowerCase().includes('refining') ? 'refinement' : 'info';

          viewer.addEvent({
            phase: update.phaseName || 'general',
            model: update.model || 'unknown',
            eventType: eventType as import('../ui/TransparencyViewer.js').EventType,
            title: update.action || `${update.model} - ${update.phaseName}`,
            content: update.output || '',
            metadata: {},
          });

          // Update TUI state with new events
          setTransparencyEvents(viewer.getEvents());

          // Also add to logs for immediate feedback
          addLog("llm", `${update.phaseName}: ${update.model} - ${update.action}`);
        },
      },
      onProgress: (data: { iteration: number; score: number; promiseDetected: boolean; code: string; timestamp: string }) => {
        const ts = new Date(data.timestamp).getTime();
        setCurrentIterations((prev) => [
          ...prev,
          {
            id: data.iteration,
            code: data.code,
            timestamp: ts,
            score: data.score,
            promiseDetected: data.promiseDetected,
          },
        ]);
        setPlayerPianoIndex(data.iteration - 1);
        addLog("iteration", `v${data.iteration} score=${data.score.toFixed(2)} quality:${data.score >= 0.7 ? "pass" : "fail"} ${data.promiseDetected ? "promise:yes" : "promise:no"}`);
      },
    };

    try {
      const runPath = validateImportPath(
        path.join(PROJECT_ROOT, "dist/index.js"),
        PROJECT_ROOT
      );
      const { run } = await import(runPath);
      const startTime = Date.now();
      const result = await run(prompt, runOptions);
      const duration = Date.now() - startTime;

      addLog("llm", `← LLM Response: ${result.code.length} chars`);
      addLog("llm", `  Time: ${duration}ms`);
      if (result.reason?.toLowerCase().includes("aborted")) {
        addLog("info", "Run stopped by user");
      } else {
        addLog("success", `Complete: ${result.iterations} iters`);
      }
      setPlayerPianoIndex(Math.max(0, result.iterations - 1));

      const newGallery = await loadGallery();
      setGallery(newGallery);
    } catch (err: any) {
      if (err?.name === "AbortError" || signal?.aborted) {
        addLog("info", "Run stopped by user");
      } else {
        addLog("error", `Failed: ${err.message}`);
      }
    } finally {
      setIsGenerating(false);
      // eslint-disable-next-line require-atomic-updates
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleExport = async () => {
    const code = currentIterations.length
      ? currentIterations[playerPianoIndex]?.code ?? currentIterations[currentIterations.length - 1].code
      : "";
    if (!code.trim()) {
      addLog("error", "No iteration to export. Run a prompt or open a gallery project.");
      return;
    }
    try {
      const outDir = path.join(PROJECT_ROOT, "output");
      await fs.mkdir(outDir, { recursive: true });
      const exporterPath = validateImportPath(
        path.join(PROJECT_ROOT, "dist/export/Exporter.js"),
        PROJECT_ROOT
      );
      const { Exporter } = await import(exporterPath);
      const exporter = new Exporter();
      const htmlPath = path.join(outDir, "tui-export.html");
      const jsPath = path.join(outDir, "tui-export.js");
      await exporter.exportHTML(code, htmlPath);
      await exporter.exportJS(code, jsPath);
      addLog("success", `Exported to ${htmlPath} and ${jsPath}`);
    } catch (e: any) {
      addLog("error", `Export failed: ${e?.message || "unknown"}`);
    }
  };

  const handleGallerySelect = async (index: number) => {
    setGalleryIndex(index);
    const project = gallery[index];
    if (project) {
      addLog("info", `Selected: ${project.projectName}`);
      try {
        const iters: Iteration[] = [];
        for (const f of project.iterations) {
          const match = f.match(/^v(\d+)\.js$/);
          if (!match) continue;
          const version = parseInt(match[1], 10);
          const fullPath = path.join(project.path, f);
          const code = await fs.readFile(fullPath, "utf-8");
          iters.push({ id: version, code, timestamp: Date.now() - (project.iterations.length - iters.length) * 1000 });
        }
        iters.sort((a, b) => a.id - b.id);
        setCurrentIterations(iters);
        setPlayerPianoIndex(0);
        if (iters.length) addLog("info", `Loaded ${iters.length} iterations into timeline`);
      } catch (e: any) {
        addLog("error", `Failed to load project: ${e?.message || "unknown"}`);
      }
    }
  };

  useInput((input: string, key: any) => {
    if (input === "q") process.exit(0);
    if (input === "1") setIsPlayerPianoPlaying(prev => !prev);
    if (input === "t") setShowTransparency(prev => !prev);
    if (input === "e" || input === "E") void handleExport();
    if (isGenerating && (input === "s" || key.escape)) handleStop();
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Banner />
      <PromptBar value={prompt} onChange={setPrompt} onSubmit={handleGenerate} disabled={isGenerating} />
      <Box marginBottom={1}>
        <Text color={COLORS.muted}>Seed (optional): </Text>
        <Text color="#F8FAFC">{seedCode || "(none)"}</Text>
        <Text color={COLORS.muted}> — type in prompt bar then [Enter] to Run</Text>
      </Box>
      <Box flexDirection="row" gap={1}>
        <LogsPanel logs={logs} height={contentHeight} />
        <IterationTimeline
          iterations={currentIterations}
          selectedIndex={playerPianoIndex}
          onSelectIndex={(idx) => setPlayerPianoIndex(Math.max(0, Math.min(idx, currentIterations.length - 1)))}
          height={contentHeight}
        />
        <PlayerPiano
          iterations={currentIterations}
          currentIndex={playerPianoIndex}
          isPlaying={isPlayerPianoPlaying}
          speed={200}
          onIndexChange={setPlayerPianoIndex}
          onTogglePlay={() => setIsPlayerPianoPlaying(prev => !prev)}
        />
        <XRayPanel
          iterations={currentIterations}
          currentIndex={playerPianoIndex}
          rawOutput={rawLLMOutput}
          isStreaming={isGenerating}
        />
        {showTransparency && (
          <TransparencyPanel
            events={transparencyEvents}
            height={contentHeight}
          />
        )}
        <GalleryPanel projects={gallery} currentIndex={galleryIndex} onSelect={handleGallerySelect} height={contentHeight} />
      </Box>
      <Box borderStyle="single" borderColor={COLORS.border} paddingX={1} marginTop={1}>
        <Text color={COLORS.muted}>Status: {isGenerating ? "Generating... [Esc/S] Stop" : "Ready"} | [Enter] Run | [E] Export | [1] PlayerPiano | [T]ransparency | [Q]uit</Text>
      </Box>
    </Box>
  );
};

const main = async () => {
  const initialGallery = await loadGallery();
  render(<App initialGallery={initialGallery} />);
};

main().catch((err) => {
  Logger.error('TUI', 'Fatal error:', err);
  process.exit(1);
});
