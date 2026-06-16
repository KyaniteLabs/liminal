/**
 * PreviewService — extracted from TuiBridgeService (F20 split)
 *
 * Handles preview artifact generation: HTML wrapping, inline preview detection,
 * screenshot rendering via Puppeteer, and SSE event emission for the TUI.
 *
 * The pure helpers (inlinePreviewType, toPreviewHtml, renderHtmlScreenshot) have
 * no external state. emitPreviewArtifacts receives a context with emit/callbacks.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Domain } from '../types/domains.js';
import type { TuiBridgeEvent, TuiRunLifecycle, TuiRunPhase } from './types.js';
import {
  detectPreviewDomainForCode,
  previewDomainForCode,
  type CreativeDomainRouteTruth,
} from './CreativeDomainRouting.js';
import { HTMLWrapper } from '../utils/htmlWrapper.js';
import type { Domain as WrapperDomain } from '../utils/htmlWrapper.js';

// ── Pure helpers (no state) ──

export function inlinePreviewType(previewDomain: WrapperDomain): 'html' | 'music' | null {
  if (previewDomain === 'tone' || previewDomain === 'strudel') return 'music';
  if (previewDomain === 'hydra' || previewDomain === 'html') return 'html';
  return null;
}

export function toPreviewHtml(code: string, previewDomain: WrapperDomain): string {
  const trimmed = code.trim();
  if (/^(?:<!DOCTYPE\s+html|<html\b)/i.test(trimmed)) {
    if (previewDomain === 'tone') {
      return HTMLWrapper.wrap(trimmed, { domain: previewDomain, title: `Sinter ${previewDomain} Preview` });
    }
    return trimmed;
  }
  return HTMLWrapper.wrap(trimmed, { domain: previewDomain, title: `Sinter ${previewDomain} Preview` });
}

export async function renderHtmlScreenshot(htmlPath: string, pngPath: string, previewDomain: string): Promise<void> {
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  let page: Awaited<ReturnType<typeof browser.newPage>> | null = null;
  try {
    page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (error: unknown) => {
      pageErrors.push(error instanceof Error ? error.message : String(error));
    });
    await page.setViewport({ width: 960, height: 640 });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'load', timeout: 30000 });
    if (['p5', 'three', 'shader', 'hydra'].includes(previewDomain)) {
      await page.waitForSelector('canvas', { timeout: 10000 });
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (pageErrors.length > 0) {
      throw new Error(`Preview runtime error: ${pageErrors.join(' | ')}`);
    }
    await page.screenshot({ path: pngPath, type: 'png' });
  } finally {
    if (page) await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

// ── Context interface ──

export interface PreviewContext {
  emit(sessionId: string, event: TuiBridgeEvent): void;
  emitDomainTruth(
    sessionId: string,
    route: CreativeDomainRouteTruth,
    patch: { generatedDomain?: string; previewDomain?: string; artifactPath?: string },
  ): void;
  transitionRun(
    sessionId: string,
    phase: TuiRunPhase,
    patch?: Partial<Omit<TuiRunLifecycle, 'runId' | 'kind' | 'startedAt'>>,
  ): TuiRunLifecycle | undefined;
}

// ── Preview emission ──

export async function emitPreviewArtifacts(
  ctx: PreviewContext,
  sessionId: string,
  code: string,
  requestedDomain: Domain,
  routeTruth?: CreativeDomainRouteTruth,
): Promise<void> {
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(process.cwd(), '.omx', 'proof', 'live-previews');
  const generatedDomain = detectPreviewDomainForCode(code);
  const previewDomain = previewDomainForCode(code, requestedDomain);
  const htmlPath = path.join(dir, `${previewDomain}-${safeSessionId}-${stamp}.html`);
  const pngPath = path.join(dir, `${previewDomain}-${safeSessionId}-${stamp}.png`);
  const truth = routeTruth ?? {
    requestedDomain,
    selectedDomain: requestedDomain,
    domains: [requestedDomain],
    promptDomainLocked: false,
    source: 'inferred' as const,
  };

  await fs.mkdir(dir, { recursive: true });
  const html = toPreviewHtml(code, previewDomain);
  await fs.writeFile(htmlPath, html, 'utf8');
  ctx.emitDomainTruth(sessionId, truth, {
    generatedDomain,
    previewDomain,
    artifactPath: htmlPath,
  });
  ctx.transitionRun(sessionId, 'rendering', {
    label: `Rendering ${previewDomain} preview`,
    artifactPath: htmlPath,
    previewType: inlinePreviewType(previewDomain) ?? 'image',
  });
  ctx.emit(sessionId, { type: 'artifact.found', sessionId, artifactLabel: `${previewDomain} HTML preview`, artifactPath: htmlPath });
  ctx.emit(sessionId, { type: 'activity.updated', sessionId, message: `Preview artifact: ${htmlPath}` });

  const inlineType = inlinePreviewType(previewDomain);
  if (inlineType) {
    ctx.emit(sessionId, { type: 'preview.started', sessionId, previewType: inlineType });
    ctx.emit(sessionId, { type: 'preview.content', sessionId, content: html, previewType: inlineType });
    ctx.emit(sessionId, {
      type: 'preview.completed',
      sessionId,
      content: html,
      previewType: inlineType,
      artifactPath: htmlPath,
      requestedDomain,
      generatedDomain,
      previewDomain,
    });
    ctx.emit(sessionId, {
      type: 'preview.verified',
      sessionId,
      previewType: inlineType,
      artifactPath: htmlPath,
      checks: ['html artifact written', 'inline preview mounted without popup'],
      requestedDomain,
      generatedDomain,
      previewDomain,
    });
    ctx.transitionRun(sessionId, 'rendering', {
      label: `Rendered ${inlineType} preview`,
      artifactPath: htmlPath,
      previewType: inlineType,
    });
    ctx.emit(sessionId, { type: 'activity.updated', sessionId, message: `Inline ${inlineType} preview mounted: ${htmlPath}` });
    return;
  }

  try {
    await renderHtmlScreenshot(htmlPath, pngPath, previewDomain);
    const png = await fs.readFile(pngPath);
    const b64 = png.toString('base64');
    ctx.emit(sessionId, { type: 'artifact.found', sessionId, artifactLabel: `${previewDomain} preview image`, artifactPath: pngPath });
    ctx.emit(sessionId, { type: 'preview.started', sessionId, previewType: 'image' });
    ctx.emit(sessionId, { type: 'preview.content', sessionId, content: b64, previewType: 'image' });
    ctx.emit(sessionId, {
      type: 'preview.completed',
      sessionId,
      content: b64,
      previewType: 'image',
      imageUrl: pngPath,
      artifactPath: pngPath,
      requestedDomain,
      generatedDomain,
      previewDomain,
    });
    ctx.emit(sessionId, {
      type: 'preview.verified',
      sessionId,
      previewType: 'image',
      artifactPath: pngPath,
      imageUrl: pngPath,
      checks: ['html artifact written', 'screenshot rendered'],
      requestedDomain,
      generatedDomain,
      previewDomain,
    });
    ctx.transitionRun(sessionId, 'rendering', {
      label: 'Rendered image preview',
      artifactPath: pngPath,
      previewType: 'image',
    });
    ctx.emit(sessionId, { type: 'activity.updated', sessionId, message: `Inline preview image: ${pngPath}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.emit(sessionId, {
      type: 'preview.missing',
      sessionId,
      previewType: 'image',
      artifactPath: htmlPath,
      reason: message,
      requestedDomain,
      generatedDomain,
      previewDomain,
    });
    ctx.emit(sessionId, { type: 'activity.updated', sessionId, message: `Preview render failed: ${message}` });
    ctx.emit(sessionId, { type: 'error', sessionId, message: `Preview render failed: ${message}` });
  }
}
