/**
 * Shared types and constants for validators
 */

export interface ValidationResult {
  valid: boolean;
  cleanedCode: string;
  errors: string[];
}

export interface DomainValidationResult {
  valid: boolean;
  errors: string[];
}

export type Domain = 
  | 'p5' 
  | 'shader' 
  | 'glsl' 
  | 'three' 
  | 'remotion'
  | 'revideo' 
  | 'music' 
  | 'hydra' 
  | 'strudel' 
  | 'tone'
  | 'svg'
  | 'kinetic'
  | 'html'
  | 'ascii'
  | 'unknown';

// -----------------------------------------------------------------------------
// Reasoning-text patterns (lines to strip from LLM output)
// -----------------------------------------------------------------------------
export const REASONING_PATTERNS: RegExp[] = [
  /^(The user wants?|I'll create|I need to|Based on|Let me|Here's a|Here is a|Key elements|Creating a|Generating a|I'm going to|I will|I've created|I have created)/i,
  /^As an AI/i,
  /^(Note:|Disclaimer:|Important:)/i,
  /^(Sure!?|Below is|This will|This creates?|This generates?)/i,
  /^(This code|The code|This sketch|This shader|This scene|This composition)/i,
  /^\d+\.\s+\S/i,
  /^-\s+[A-Za-z]/,
  /^(\*\*|__).*?(\*\*|__)\s*[:-]/,
  /^#{1,3}\s/,
  /^I'll\s+(use|make|add|create|ensure|include|apply|build|implement|draw|generate)/i,
  /^I need to/i,
  /^We need\b/i,
  /^Let's\b/i,
];

// -----------------------------------------------------------------------------
// LLM contamination patterns
// -----------------------------------------------------------------------------
export const CONTAMINATION_PATTERNS: RegExp[] = [
  /<think>[\s\S]*?<\/think>/gi,
  /<thinking>[\s\S]*?<\/thinking>/gi,
];

// -----------------------------------------------------------------------------
// Code-start patterns (lines that indicate actual code begins)
// -----------------------------------------------------------------------------
export const CODE_START_PATTERNS: RegExp[] = [
  /^(let|const|var|function|class|if|for|while|switch|try|return|import|export|async|await|throw|new)\b/,
  /^(precision|void|vec[234]|float|int|bool|uniform|attribute|varying|in\s+|out\s+)\b/,
  /^<!DOCTYPE\s/i,
  /^<html/i,
  /^<head/i,
  /^<body/i,
  /^<svg\b/i,
  /^<script/i,
  /^<style/i,
  /^<canvas/i,
  /^<div/i,
  /^\$/,
  /^\{/,
  /^\[/,
  /^\(/,
  /^['"`]/,
  /^\/\//,
  /^\/\*/,
];

// -----------------------------------------------------------------------------
// Preprocessing functions
// -----------------------------------------------------------------------------
export function stripContamination(code: string): string {
  let cleaned = code;
  for (const pattern of CONTAMINATION_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.trim();
}

export function stripReasoningText(code: string): string {
  const lines = code.split('\n');
  const kept: string[] = [];
  let insideFence = false;
  let foundCodeStart = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      insideFence = !insideFence;
      continue;
    }
    if (insideFence) {
      kept.push(line);
      foundCodeStart = true;
      continue;
    }

    if (foundCodeStart) {
      kept.push(line);
      continue;
    }

    if (!trimmed) continue;
    if (REASONING_PATTERNS.some(p => p.test(trimmed))) continue;
    if (/^-\s+[A-Z]/.test(trimmed) && !/^-\s+(\d|--?)/.test(trimmed)) continue;

    if (CODE_START_PATTERNS.some(p => p.test(trimmed))) {
      foundCodeStart = true;
      kept.push(line);
      continue;
    }

    if (/^[\w$]+\s*[=([{:]/.test(trimmed)) {
      foundCodeStart = true;
      kept.push(line);
      continue;
    }

    if (/[;{}]/.test(trimmed) || /\w+\(.*\)/.test(trimmed)) {
      foundCodeStart = true;
      kept.push(line);
      continue;
    }
  }

  return kept.join('\n').trim();
}

export function isAlreadyWrapped(code: string): boolean {
  const trimmed = code.trim();
  return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
}

export function detectContamination(code: string): string[] {
  const errors: string[] = [];
  if (/<think>/i.test(code) || /<thinking>/i.test(code)) {
    errors.push('LLM contamination detected: <think> or <thinking> tags found in output');
  }
  return errors;
}
