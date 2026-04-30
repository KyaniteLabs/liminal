import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
const runRoot = process.env.LIMINAL_GAUNTLET_RUNROOT || path.join(repoRoot, '.omx', 'proof', `studio-launch-gauntlet-${stamp}`);
const statusPath = path.join(runRoot, 'current-status.json');
const summaryPath = path.join(runRoot, 'summary.json');
const summaryMdPath = path.join(runRoot, 'summary.md');
const runOnce = process.env.LIMINAL_GAUNTLET_RUN_ONCE !== '0' && process.env.LIMINAL_GAUNTLET_RUN_ONCE !== 'false';
const deadline = new Date(process.env.LIMINAL_GAUNTLET_DEADLINE || (runOnce ? Date.now() + 1 : Date.now() + 60 * 60 * 1000));
const firstIntervalMs = Number(process.env.LIMINAL_GAUNTLET_INTERVAL_MS || 60 * 60 * 1000);
const maxCaseMs = Number(process.env.LIMINAL_GAUNTLET_CASE_TIMEOUT_MS || 4 * 60 * 1000);
const provider = process.env.LIMINAL_LLM_PROVIDER || 'glm';
const filteredCaseIds = new Set((process.env.LIMINAL_GAUNTLET_CASES || '').split(',').map(id => id.trim()).filter(Boolean));
const commandChecksEnabled = process.env.LIMINAL_GAUNTLET_COMMAND_CHECKS !== '0' && process.env.LIMINAL_GAUNTLET_COMMAND_CHECKS !== 'false';

fs.mkdirSync(runRoot, { recursive: true });

const cases = [
  {
    id: 'p5-explicit-particles',
    domain: 'p5',
    prompt: 'Create a p5.js sketch: luminous blue-green particles orbit a dark center with visible setup(), draw(), createCanvas(), and smooth trails. Do not use Three.js.',
    mustInclude: [/p5|createCanvas|setup\(\)|draw\(\)/i],
    mustNotInclude: [/three\.module|THREE\./i],
  },
  {
    id: 'three-explicit-override',
    domain: 'three',
    prompt: 'Create a Three.js scene, not p5: a slow rotating glass cube field with a camera, lights, mesh geometry, and orbiting tiny stars.',
    mustInclude: [/three|THREE\.|mesh|camera|geometry/i],
    mustNotInclude: [/createCanvas\(|function setup\(/i],
  },
  {
    id: 'glsl-fragment-nebula',
    domain: 'shader',
    prompt: 'Create a GLSL fragment shader: a human-readable violet nebula field with soft radial pulses, uv coordinates, time animation, and no p5 or Three.js.',
    mustInclude: [/glsl|fragment|shader|void\s+main|gl_FragColor|fragColor/i],
    mustNotInclude: [/createCanvas\(/i],
  },
  {
    id: 'hydra-video-synth',
    domain: 'hydra',
    prompt: 'Create a Hydra video synth sketch: slow kaleidoscopic ocean light, oscillator modulation, colorama, and human-comfortable motion.',
    mustInclude: [/hydra|osc\(|src\(|out\(/i],
    mustNotInclude: [/createCanvas\(|THREE\./i],
  },
  {
    id: 'strudel-music-pattern',
    domain: 'strudel',
    prompt: 'Create a Strudel live-coding music pattern: warm ambient pulse, gentle rhythm, tempo in human listening range, and playable musical structure.',
    mustInclude: [/strudel|sound\(|note\(|stack\(|slow\(|tempo|bpm/i],
    mustNotInclude: [/createCanvas\(|THREE\./i],
  },
  {
    id: 'tone-web-audio',
    domain: 'tone',
    prompt: 'Create a Tone.js Web Audio sketch: a gentle synth arpeggio with safe volume, clear start interaction, tempo around 90 BPM, and visible controls.',
    mustInclude: [/tone|Tone\.|Synth|Transport|BPM|start/i],
    mustNotInclude: [/createCanvas\(|THREE\./i],
  },
  {
    id: 'revideo-title-card',
    domain: 'revideo',
    prompt: 'Create a Revideo composition: a 4-second cinematic title card saying LIMINAL REVIDEO, with animated text, a moving rectangle accent, and a soft fade. Use @revideo/2d and @revideo/core.',
    mustInclude: [/revideo|@revideo|makeScene2D|timeline preview/i],
    mustNotInclude: [/Remotion|useCurrentFrame|React\.FC/i],
  },
  {
    id: 'hyperframes-product-shot',
    domain: 'hyperframes',
    prompt: 'Create a HyperFrames composition: an elegant 10-second product reveal with HTML/CSS, GSAP-like timeline clips, captions, and data-composition-id. Do not use Revideo.',
    mustInclude: [/hyperframes|data-composition-id|timeline|caption|gsap|html|css/i],
    mustNotInclude: [/@revideo|makeScene2D|createCanvas\(/i],
  },
  {
    id: 'kinetic-typography',
    domain: 'html',
    prompt: 'Create kinetic typography as complete HTML/CSS: the words HUMAN CREATIVE CODING breathe, slide, and settle with readable contrast. Do not use p5.',
    mustInclude: [/kinetic|typography|@keyframes|html|css|HUMAN|CREATIVE/i],
    mustNotInclude: [/createCanvas\(|THREE\./i],
  },
  {
    id: 'ambiguous-video-routing',
    domain: 'video',
    prompt: 'Make a short cinematic intro for a creative coding agent: readable title, subtitle, soft motion, and a preview I can inspect in the same Studio screen.',
    mustInclude: [/preview|title|subtitle|motion|video|hyperframes|revideo|html/i],
    mustNotInclude: [],
  },
  {
    id: 'stress-conflicting-request',
    domain: 'p5',
    prompt: 'Use p5.js only, despite words like 3D camera and mesh: make a flat 2D p5 sketch that imitates depth with circles, setup(), draw(), and createCanvas().',
    mustInclude: [/p5|createCanvas|setup\(\)|draw\(\)/i],
    mustNotInclude: [/THREE\.|three\.module|@revideo/i],
  },
  {
    id: 'long-natural-chat',
    domain: 'auto',
    prompt: 'I want something calming and not too flashy: maybe a visual poem about a lighthouse in fog, with slow movement, readable text, soft blue-grey colors, and no intense flashing.',
    mustInclude: [/lighthouse|fog|text|blue|grey|poem|slow|preview/i],
    mustNotInclude: [/error|Preview unavailable/i],
  },
];

const viewports = [
  { id: 'desktop', width: 1440, height: 1000 },
  { id: 'wide', width: 1728, height: 1080 },
  { id: 'tablet', width: 900, height: 1100 },
  { id: 'mobile', width: 390, height: 844 },
];

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function appendLog(line) {
  const text = `[${new Date().toISOString()}] ${line}\n`;
  fs.appendFileSync(path.join(runRoot, 'monitor.log'), text);
  process.stdout.write(text);
}

function runCommand(command, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: { ...process.env, LIMINAL_LLM_PROVIDER: provider, ...options.env },
    encoding: 'utf8',
    timeout: options.timeoutMs || 10 * 60 * 1000,
    shell: false,
  });
  return {
    command: [command, ...args].join(' '),
    status: result.status,
    signal: result.signal,
    durationMs: Date.now() - started,
    stdout: result.stdout?.slice(-8000) || '',
    stderr: result.stderr?.slice(-8000) || '',
    ok: result.status === 0,
  };
}

async function getPorts(count) {
  const servers = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const server = net.createServer();
      servers.push(server);
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
      });
    }
    return servers.map((server) => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Failed to allocate port');
      return address.port;
    });
  } finally {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(() => resolve()))));
  }
}

function waitFor(url, timeoutMs = 90_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) return resolve();
      } catch {}
      if (Date.now() - started > timeoutMs) return reject(new Error(`Timed out waiting for ${url}`));
      setTimeout(tick, 250);
    };
    void tick();
  });
}

function stop(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.signalCode) return resolve();
    const killTarget = child.pid ? -child.pid : undefined;
    const kill = (signal) => {
      try {
        if (killTarget) process.kill(killTarget, signal);
        else child.kill(signal);
      } catch {
        try { child.kill(signal); } catch {}
      }
    };
    const timeout = setTimeout(() => {
      kill('SIGKILL');
      resolve();
    }, 7000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    kill('SIGTERM');
  });
}

function cycleCases(cycleIndex) {
  if (filteredCaseIds.size > 0) {
    return cases.filter(testCase => filteredCaseIds.has(testCase.id));
  }
  const count = cycleIndex % 3 === 0 ? 5 : 4;
  const start = (cycleIndex * 3) % cases.length;
  return Array.from({ length: count }, (_, i) => cases[(start + i) % cases.length]);
}

function extractPreviewEvidence(state) {
  return [
    state.figcaption,
    state.iframeSrcdocPrefix,
    state.codePreviewPrefix,
    state.stageText,
    state.imageSrcPrefix,
  ].filter(Boolean).join('\n');
}

function extractDomainEvidence(state) {
  const previewEvidence = extractPreviewEvidence(state);
  return previewEvidence || (state.bodyExcerpt || '');
}

async function runCase(page, testCase, cycleDir, caseIndex, cycleIndex, popupUrls, viewport) {
  const caseDir = path.join(cycleDir, `${String(caseIndex + 1).padStart(2, '0')}-${testCase.id}-${viewport.id}`);
  fs.mkdirSync(caseDir, { recursive: true });
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text().slice(0, 2000) }));
  page.on('pageerror', err => consoleLogs.push({ type: 'pageerror', text: err.message }));

  const started = Date.now();
  const result = {
    id: testCase.id,
    expectedDomain: testCase.domain,
    viewport,
    prompt: testCase.prompt,
    startedAt: new Date().toISOString(),
    status: 'unknown',
    checks: {},
    errors: [],
    screenshots: {},
  };

  try {
    await page.waitForSelector('.liminal-workbench', { timeout: 45_000 });
    await page.screenshot({ path: path.join(caseDir, '01-home.png'), fullPage: true });
    result.screenshots.home = path.join(caseDir, '01-home.png');
    await page.fill('#workbench-prompt', testCase.prompt);
    await page.screenshot({ path: path.join(caseDir, '02-prompt-entered.png'), fullPage: true });
    result.screenshots.promptEntered = path.join(caseDir, '02-prompt-entered.png');
    await page.waitForFunction(() => {
      const btn = document.querySelector('.liminal-run-button');
      return btn && !btn.disabled;
    }, null, { timeout: 45_000 });
    await page.click('.liminal-run-button');

    const states = [];
    let terminalState;
    let status = 'timeout';
    while (Date.now() - started < maxCaseMs) {
      const state = await page.evaluate(() => {
        const stage = document.querySelector('.liminal-preview-panel__stage');
        const img = stage?.querySelector('img');
        const iframe = stage?.querySelector('iframe');
        const pre = stage?.querySelector('pre');
        const bodyText = document.body.innerText;
        return {
          panelVisible: Boolean(document.querySelector('.liminal-preview-panel')),
          imageCount: stage?.querySelectorAll('img').length || 0,
          iframeCount: stage?.querySelectorAll('iframe').length || 0,
          preCount: stage?.querySelectorAll('pre').length || 0,
          imageSrcPrefix: img?.getAttribute('src')?.slice(0, 80) || '',
          imageNaturalWidth: img?.naturalWidth || 0,
          imageNaturalHeight: img?.naturalHeight || 0,
          figcaption: stage?.querySelector('figcaption')?.textContent || '',
          iframeTitle: iframe?.getAttribute('title') || '',
          iframeSrc: iframe?.getAttribute('src') || '',
          iframeSrcdocPrefix: iframe?.getAttribute('srcdoc')?.slice(0, 2000) || '',
          codePreviewPrefix: pre?.textContent?.slice(0, 3000) || '',
          bodyExcerpt: bodyText.slice(0, 12000),
          stageText: stage?.textContent?.slice(0, 3000) || '',
          blockedOrError: /Preview unavailable|error|failed|disconnected|runtime error/i.test(bodyText),
          routeLine: (bodyText.match(/Route\n([^\n]+)/i) || [])[1] || '',
          previewLine: (bodyText.match(/Preview\n([^\n]+)/i) || [])[1] || '',
        };
      });
      states.push({ elapsedMs: Date.now() - started, ...state });
      fs.writeFileSync(path.join(caseDir, 'states.json'), JSON.stringify(states, null, 2));

      const inlineImage = state.imageCount > 0 && state.imageSrcPrefix.startsWith('data:image/png') && state.imageNaturalWidth > 0;
      const inlineFrame = state.iframeCount > 0 && !/^https?:\/\//.test(state.iframeSrc || '');
      const inlineCode = state.preCount > 0 && state.codePreviewPrefix.length > 50;
      if (inlineImage || inlineFrame || inlineCode) {
        terminalState = state;
        status = 'inline-preview-visible';
        break;
      }
      if (state.blockedOrError && Date.now() - started > 60_000) {
        terminalState = state;
        status = 'error-visible';
        break;
      }
      await page.waitForTimeout(2500);
    }

    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(caseDir, '03-result.png'), fullPage: true });
    result.screenshots.result = path.join(caseDir, '03-result.png');
    const final = terminalState ?? states[states.length - 1] ?? {};
    const evidence = extractDomainEvidence(final);
    const previewEvidence = extractPreviewEvidence(final);
    const mustIncludeOk = testCase.mustInclude.length === 0 || testCase.mustInclude.some(rx => rx.test(evidence));
    const mustNotOk = testCase.mustNotInclude.every(rx => !rx.test(previewEvidence));
    const popupsOk = popupUrls.length === 0;
    const inlineOk = status === 'inline-preview-visible';
    result.status = inlineOk && mustIncludeOk && mustNotOk && popupsOk ? 'pass' : 'fail';
    result.checks = {
      inlinePreview: inlineOk,
      previewPanelVisible: Boolean(final.panelVisible),
      domainEvidence: mustIncludeOk,
      contaminationAbsent: mustNotOk,
      noPopups: popupsOk,
      imageCount: final.imageCount || 0,
      imageNaturalWidth: final.imageNaturalWidth || 0,
      imageNaturalHeight: final.imageNaturalHeight || 0,
      iframeCount: final.iframeCount || 0,
      preCount: final.preCount || 0,
      figcaption: final.figcaption || '',
      routeLine: final.routeLine || '',
      previewLine: final.previewLine || '',
    };
    if (!inlineOk) result.errors.push(`No inline preview before timeout; terminal status ${status}`);
    if (!mustIncludeOk) result.errors.push('Expected domain evidence was not found in visible preview/body/code evidence');
    if (!mustNotOk) result.errors.push('Contamination evidence found for a forbidden framework/domain');
    if (!popupsOk) result.errors.push(`Unexpected popup/new page: ${popupUrls.join(', ')}`);
    result.finalExcerpt = evidence.slice(0, 5000);
    result.previewEvidenceExcerpt = previewEvidence.slice(0, 5000);
  } catch (error) {
    result.status = 'script-error';
    result.errors.push(error instanceof Error ? error.stack || error.message : String(error));
    try {
      await page.screenshot({ path: path.join(caseDir, 'error.png'), fullPage: true });
      result.screenshots.error = path.join(caseDir, 'error.png');
    } catch {}
  } finally {
    result.durationMs = Date.now() - started;
    result.consoleLogs = consoleLogs.slice(-80);
    writeJson(path.join(caseDir, 'result.json'), result);
  }
  return result;
}

async function runCycle(cycleIndex) {
  const cycleStartedAt = new Date();
  const cycleDir = path.join(runRoot, `cycle-${String(cycleIndex).padStart(2, '0')}-${cycleStartedAt.toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(cycleDir, { recursive: true });
  const [apiPort, guiPort] = await getPorts(2);
  const cycle = {
    cycleIndex,
    startedAt: cycleStartedAt.toISOString(),
    apiPort,
    guiPort,
    provider,
    git: {
      head: runCommand('git', ['rev-parse', 'HEAD']).stdout.trim(),
      originMain: runCommand('git', ['rev-parse', 'origin/main']).stdout.trim(),
      status: runCommand('git', ['status', '--short', '--branch']).stdout.trim(),
    },
    cases: [],
    commandChecks: [],
    status: 'running',
  };
  writeJson(statusPath, { runRoot, deadline: deadline.toISOString(), activeCycle: cycle, cycles: allCycles });
  appendLog(`cycle ${cycleIndex} starting on ports api=${apiPort} gui=${guiPort}`);

  let studio;
  let browser;
  const studioLogs = [];
  try {
    studio = spawn('pnpm', ['gui'], {
      cwd: repoRoot,
      detached: true,
      env: {
        ...process.env,
        PORT: String(apiPort),
        LIMINAL_STUDIO_GUI_PORT: String(guiPort),
        LIMINAL_LLM_PROVIDER: provider,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    studio.stdout.on('data', data => studioLogs.push({ stream: 'stdout', text: data.toString().slice(-4000) }));
    studio.stderr.on('data', data => studioLogs.push({ stream: 'stderr', text: data.toString().slice(-4000) }));

    await waitFor(`http://localhost:${apiPort}/api/health`);
    await waitFor(`http://localhost:${guiPort}/`);
    cycle.studioReadyAt = new Date().toISOString();
    cycle.studioUrl = `http://localhost:${guiPort}/`;

    browser = await chromium.launch({ headless: true });
    const selectedCases = cycleCases(cycleIndex);
    for (let i = 0; i < selectedCases.length; i += 1) {
      const testCase = selectedCases[i];
      const viewport = viewports[(cycleIndex + i) % viewports.length];
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
      const popupUrls = [];
      const page = await context.newPage();
      page.on('popup', popup => popupUrls.push(popup.url()));
      await page.goto(cycle.studioUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      appendLog(`cycle ${cycleIndex} case ${i + 1}/${selectedCases.length}: ${testCase.id} (${viewport.id})`);
      const caseResult = await runCase(page, testCase, cycleDir, i, cycleIndex, popupUrls, viewport);
      cycle.cases.push(caseResult);
      writeJson(path.join(cycleDir, 'cycle.json'), cycle);
      writeJson(statusPath, { runRoot, deadline: deadline.toISOString(), activeCycle: cycle, cycles: allCycles });
      await context.close().catch(() => undefined);
    }

    if (commandChecksEnabled && cycleIndex % 4 === 0) {
      const width = cycleIndex % 8 === 0 ? 640 : 854;
      const height = cycleIndex % 8 === 0 ? 360 : 480;
      const fps = cycleIndex % 8 === 0 ? 12 : 24;
      cycle.commandChecks.push(runCommand('pnpm', ['exec', 'tsx', 'scripts/proof/revideo-native-render-smoke.ts', '--out', path.join(cycleDir, 'native-revideo'), '--width', String(width), '--height', String(height), '--fps', String(fps)], { timeoutMs: 5 * 60 * 1000 }));
    }
    if (commandChecksEnabled && cycleIndex % 6 === 0) {
      cycle.commandChecks.push(runCommand('pnpm', ['--dir', 'gui', 'build'], { timeoutMs: 5 * 60 * 1000 }));
    }
    if (commandChecksEnabled && cycleIndex % 7 === 0) {
      cycle.commandChecks.push(runCommand('pnpm', ['run', 'proof:user-surface-controls'], { timeoutMs: 8 * 60 * 1000 }));
    }

    const failedCases = cycle.cases.filter(c => c.status !== 'pass');
    const failedCommands = cycle.commandChecks.filter(c => !c.ok);
    cycle.status = failedCases.length === 0 && failedCommands.length === 0 ? 'pass' : 'fail';
    cycle.failedCases = failedCases.map(c => c.id);
    cycle.failedCommands = failedCommands.map(c => c.command);
  } catch (error) {
    cycle.status = 'cycle-error';
    cycle.error = error instanceof Error ? error.stack || error.message : String(error);
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    await stop(studio);
    cycle.finishedAt = new Date().toISOString();
    cycle.durationMs = Date.now() - cycleStartedAt.getTime();
    cycle.studioLogs = studioLogs.slice(-120);
    writeJson(path.join(cycleDir, 'cycle.json'), cycle);
    allCycles.push(cycle);
    updateSummary();
    writeJson(statusPath, { runRoot, deadline: deadline.toISOString(), lastCycle: cycle, cycles: allCycles });
    appendLog(`cycle ${cycleIndex} finished: ${cycle.status}; cases=${cycle.cases.length}; failures=${cycle.cases.filter(c => c.status !== 'pass').length}`);
  }
}

function updateSummary(final = false) {
  const flatCases = allCycles.flatMap(c => c.cases.map(test => ({ ...test, cycleIndex: c.cycleIndex })));
  const failures = flatCases.filter(test => test.status !== 'pass');
  const commandChecks = allCycles.flatMap(c => (c.commandChecks || []).map(check => ({ ...check, cycleIndex: c.cycleIndex })));
  const commandFailures = commandChecks.filter(check => !check.ok);
  const summary = {
    contract: 'liminal-overnight-studio-gauntlet-v1',
    startedAt: startedAt.toISOString(),
    updatedAt: new Date().toISOString(),
    deadline: deadline.toISOString(),
    final,
    runRoot,
    provider,
    head: runCommand('git', ['rev-parse', 'HEAD']).stdout.trim(),
    originMain: runCommand('git', ['rev-parse', 'origin/main']).stdout.trim(),
    cyclesRun: allCycles.length,
    cycleStatusCounts: allCycles.reduce((acc, c) => ({ ...acc, [c.status]: (acc[c.status] || 0) + 1 }), {}),
    casesRun: flatCases.length,
    caseStatusCounts: flatCases.reduce((acc, c) => ({ ...acc, [c.status]: (acc[c.status] || 0) + 1 }), {}),
    commandChecksRun: commandChecks.length,
    commandFailures: commandFailures.map(c => ({ cycleIndex: c.cycleIndex, command: c.command, status: c.status, stderr: c.stderr.slice(-1000) })),
    failures: failures.map(f => ({ cycleIndex: f.cycleIndex, id: f.id, expectedDomain: f.expectedDomain, viewport: f.viewport?.id, status: f.status, checks: f.checks, errors: f.errors, screenshots: f.screenshots })),
    cycles: allCycles.map(c => ({ cycleIndex: c.cycleIndex, startedAt: c.startedAt, finishedAt: c.finishedAt, status: c.status, cases: c.cases.map(t => ({ id: t.id, status: t.status, viewport: t.viewport?.id, checks: t.checks, errors: t.errors })) })),
  };
  writeJson(summaryPath, summary);
  const md = [
    '# Studio Launch Gauntlet',
    '',
    `- Started: ${summary.startedAt}`,
    `- Updated: ${summary.updatedAt}`,
    `- Deadline: ${summary.deadline}`,
    `- Provider: ${provider}`,
    `- Head: ${summary.head}`,
    `- Cycles run: ${summary.cyclesRun}`,
    `- Cases run: ${summary.casesRun}`,
    `- Case status: ${JSON.stringify(summary.caseStatusCounts)}`,
    `- Command checks: ${summary.commandChecksRun}`,
    `- Failures: ${summary.failures.length}`,
    `- Command failures: ${summary.commandFailures.length}`,
    '',
    '## Failures',
    ...(summary.failures.length ? summary.failures.map(f => `- cycle ${f.cycleIndex} ${f.id} (${f.viewport}) ${f.status}: ${(f.errors || []).join('; ')} screenshot=${f.screenshots?.result || f.screenshots?.error || ''}`) : ['- none so far']),
    '',
    '## Cycles',
    ...summary.cycles.map(c => `- cycle ${c.cycleIndex}: ${c.status}; ${c.cases.map(t => `${t.id}:${t.status}`).join(', ')}`),
    '',
  ].join('\n');
  fs.writeFileSync(summaryMdPath, md);
}

const allCycles = [];

process.on('unhandledRejection', (error) => {
  appendLog(`unhandledRejection: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  updateSummary(true);
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  appendLog(`uncaughtException: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  updateSummary(true);
  process.exit(1);
});

process.on('SIGTERM', () => {
  appendLog('received SIGTERM; writing final partial summary');
  updateSummary(true);
  process.exit(0);
});
process.on('SIGINT', () => {
  appendLog('received SIGINT; writing final partial summary');
  updateSummary(true);
  process.exit(0);
});

appendLog(`studio launch gauntlet starting; runRoot=${runRoot}; deadline=${deadline.toISOString()}; provider=${provider}; runOnce=${runOnce}; cases=${filteredCaseIds.size ? [...filteredCaseIds].join(',') : 'cycle'}; commandChecks=${commandChecksEnabled}`);
let cycleIndex = 0;
let nextStart = Date.now();
while (runOnce ? cycleIndex < 1 : Date.now() < deadline.getTime()) {
  const now = Date.now();
  if (now < nextStart) {
    const sleepMs = Math.min(nextStart - now, 60_000);
    await new Promise(resolve => setTimeout(resolve, sleepMs));
    continue;
  }
  await runCycle(cycleIndex);
  cycleIndex += 1;
  nextStart += firstIntervalMs;
  if (Date.now() > nextStart) {
    nextStart = Date.now();
  }
}
appendLog('deadline reached; writing final summary');
updateSummary(true);
