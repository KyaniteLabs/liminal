#!/usr/bin/env node
/**
 * Landing Page Validator - RAW DATA REPORTER
 * 
 * This script validates all landing page examples and reports EXACTLY what it finds.
 * No filtering. No "acceptable" judgments. Just raw facts.
 * 
 * YOU decide what's acceptable.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Types
interface ValidationResult {
  file: string;
  domain: string;
  model: string;
  exists: boolean;
  size: number;
  issues: string[];
  containsLLMError: boolean;
  isEmpty: boolean;
  hasRequiredElements: Record<string, boolean>;
  rawPreview: string; // First 500 chars
}

interface DomainStatus {
  domain: string;
  total: number;
  exists: number;
  hasLLMErrors: number;
  empty: number;
  issues: string[];
  examples: ValidationResult[];
}

// Domain detection from filename
function detectDomainFromFilename(filename: string): string {
  const domains = ['p5', 'glsl', 'three', 'strudel', 'hydra', 'remotion', 'html', 'ascii'];
  for (const d of domains) {
    if (filename.startsWith(`${d}-`)) return d;
  }
  return 'unknown';
}

// Model detection from filename
function detectModelFromFilename(filename: string): string {
  const parts = filename.replace('.html', '').split('-');
  // e.g., "p5-minimax-m27" -> "minimax-m27"
  if (parts.length >= 2) {
    return parts.slice(1).join('-');
  }
  return 'unknown';
}

// Check for LLM error indicators
function containsLLMError(content: string): boolean {
  const errorPatterns = [
    /LLM generation failed/i,
    /LLM API error/i,
    /404 Not Found/i,
    /500 Internal Server Error/i,
    /connection refused/i,
    /timeout/i,
    /failed to generate/i,
    /error.*generate/i,
  ];
  return errorPatterns.some(p => p.test(content));
}

// Check if content is essentially empty
function isEssentiallyEmpty(content: string): boolean {
  const textContent = content.replace(/<[^>]+>/g, '').trim();
  return textContent.length < 50;
}

// Check for required elements per domain
function checkRequiredElements(domain: string, content: string): Record<string, boolean> {
  const checks: Record<string, boolean> = {};
  
  switch (domain) {
    case 'p5':
      checks.hasP5Script = /p5\.js|p5\.min\.js/.test(content);
      checks.hasSetupFunction = /function\s+setup\s*\(/.test(content);
      checks.hasDrawOrCanvas = /function\s+draw\s*\(|createCanvas/.test(content);
      break;
      
    case 'glsl':
      checks.hasCanvas = /<canvas/i.test(content);
      checks.hasWebGL = /getContext\s*\(\s*['"]webgl/.test(content);
      checks.hasFragmentShader = /gl_FragColor|fragment\s+shader/i.test(content);
      break;
      
    case 'three':
      checks.hasThreeImport = /three/.test(content);
      checks.hasScene = /scene|Scene/.test(content);
      checks.hasRenderLoop = /render|animate|requestAnimationFrame/.test(content);
      break;
      
    case 'strudel':
      checks.hasStrudelScript = /strudel|@strudel/.test(content);
      // Strudel v2 uses pipe syntax: sound("bd") |> gain(1.2)
      // Also supports: stack(), s(), note(), sound(), struct()
      checks.hasPattern = /stack|s\(|note|sound\(|\|>|struct\(/.test(content);
      checks.hasPlayButton = /<button|play|click/i.test(content);
      break;
      
    case 'hydra':
      checks.hasHydraScript = /hydra-synth|Hydra/.test(content);
      checks.hasCanvas = /<canvas/i.test(content);
      checks.hasHydraCode = /\.out\s*\(|render\s*\(|osc\s*\(|shape\s*\(/.test(content);
      break;
      
    case 'remotion':
      checks.hasRemotionRef = /remotion|useCurrentFrame|AbsoluteFill/.test(content);
      checks.hasCodeDisplay = /<pre|<code/.test(content);
      break;
      
    case 'html':
      checks.hasHTMLStructure = /<html/i.test(content) && /<body/i.test(content);
      checks.hasContent = content.replace(/<[^>]+>/g, '').trim().length > 20;
      break;
      
    case 'ascii':
      checks.hasPreTag = /<pre/i.test(content);
      checks.hasMonospaceFont = /monospace|Courier/.test(content);
      break;
  }
  
  return checks;
}

// Validate a single file
function validateFile(filepath: string, filename: string): ValidationResult {
  const domain = detectDomainFromFilename(filename);
  const model = detectModelFromFilename(filename);
  
  let exists = false;
  let size = 0;
  let content = '';
  
  try {
    const stats = fs.statSync(filepath);
    exists = true;
    size = stats.size;
    content = fs.readFileSync(filepath, 'utf-8');
  } catch (e) {
    // File doesn't exist
  }
  
  const issues: string[] = [];
  const containsError = exists ? containsLLMError(content) : false;
  const empty = exists ? isEssentiallyEmpty(content) : true;
  
  if (!exists) {
    issues.push('FILE_MISSING');
  }
  
  if (containsError) {
    // Extract the error message
    const errorMatch = content.match(/LLM generation failed:[^<]*/i) || 
                       content.match(/LLM API error:[^<]*/i);
    if (errorMatch) {
      issues.push(`LLM_ERROR: ${errorMatch[0].trim()}`);
    } else {
      issues.push('LLM_ERROR');
    }
  }
  
  if (empty && exists && !containsError) {
    issues.push('ESSENTIALLY_EMPTY');
  }
  
  const requiredElements = exists ? checkRequiredElements(domain, content) : {};
  
  // Check for missing required elements
  for (const [key, present] of Object.entries(requiredElements)) {
    if (!present) {
      issues.push(`MISSING: ${key}`);
    }
  }
  
  // Extract preview (first 500 chars of body content)
  let rawPreview = '';
  if (exists) {
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      rawPreview = bodyMatch[1].trim().substring(0, 500).replace(/\s+/g, ' ');
    } else {
      rawPreview = content.substring(0, 500).replace(/\s+/g, ' ');
    }
  }
  
  return {
    file: filename,
    domain,
    model,
    exists,
    size,
    issues,
    containsLLMError: containsError,
    isEmpty: empty,
    hasRequiredElements: requiredElements,
    rawPreview,
  };
}

// Main validation
function runValidation(): void {
  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  
  console.log('='.repeat(80));
  console.log('LANDING PAGE VALIDATION - RAW DATA REPORT');
  console.log('='.repeat(80));
  console.log(`\nScanning directory: ${landingDir}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('\n⚠️  NOTE: This report shows RAW FINDINGS. YOU decide what is acceptable.\n');
  
  // Get all expected files from landing.html
  const landingHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'landing.html'), 'utf-8');
  const iframeMatches = landingHtml.matchAll(/iframe src="landing-live\/([^"]+)"/g);
  const expectedFiles = [...iframeMatches].map(m => m[1]);
  
  console.log(`Expected files from landing.html: ${expectedFiles.length}`);
  
  // Validate each file
  const results: ValidationResult[] = [];
  for (const filename of expectedFiles) {
    const filepath = path.join(landingDir, filename);
    results.push(validateFile(filepath, filename));
  }
  
  // Group by domain
  const domains: Record<string, DomainStatus> = {};
  for (const r of results) {
    if (!domains[r.domain]) {
      domains[r.domain] = {
        domain: r.domain,
        total: 0,
        exists: 0,
        hasLLMErrors: 0,
        empty: 0,
        issues: [],
        examples: [],
      };
    }
    domains[r.domain].total++;
    if (r.exists) domains[r.domain].exists++;
    if (r.containsLLMError) domains[r.domain].hasLLMErrors++;
    if (r.isEmpty) domains[r.domain].empty++;
    domains[r.domain].issues.push(...r.issues);
    domains[r.domain].examples.push(r);
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY BY DOMAIN');
  console.log('='.repeat(80));
  
  const sortedDomains = Object.values(domains).sort((a, b) => a.domain.localeCompare(b.domain));
  
  for (const d of sortedDomains) {
    const issueCounts: Record<string, number> = {};
    for (const issue of d.issues) {
      // Group similar issues
      const key = issue.includes(':') ? issue.split(':')[0] : issue;
      issueCounts[key] = (issueCounts[key] || 0) + 1;
    }
    
    const uniqueIssues = Object.entries(issueCounts)
      .map(([k, v]) => v > 1 ? `${k}(${v}x)` : k)
      .join(', ');
    
    console.log(`\n${d.domain.toUpperCase()}:`);
    console.log(`  Files: ${d.exists}/${d.total} exist`);
    console.log(`  LLM Errors: ${d.hasLLMErrors}`);
    console.log(`  Empty: ${d.empty}`);
    if (uniqueIssues) {
      console.log(`  Issues: ${uniqueIssues}`);
    }
  }
  
  // Detailed findings
  console.log('\n' + '='.repeat(80));
  console.log('DETAILED FINDINGS (ALL)');
  console.log('='.repeat(80));
  
  const problematicResults = results.filter(r => r.issues.length > 0);
  const cleanResults = results.filter(r => r.issues.length === 0);
  
  if (problematicResults.length > 0) {
    console.log(`\n--- FILES WITH ISSUES (${problematicResults.length}) ---\n`);
    
    for (const r of problematicResults) {
      console.log(`\n[${r.domain.toUpperCase()}] ${r.file}`);
      console.log(`  Model: ${r.model}`);
      console.log(`  Size: ${r.size} bytes`);
      console.log(`  Issues:`);
      for (const issue of r.issues) {
        if (issue.includes(':')) {
          console.log(`    - ${issue}`);
        } else {
          console.log(`    - ${issue}`);
        }
      }
      if (r.rawPreview) {
        console.log(`  Preview: ${r.rawPreview.substring(0, 200)}...`);
      }
    }
  }
  
  // All files breakdown
  console.log('\n' + '='.repeat(80));
  console.log('COMPLETE FILE LIST');
  console.log('='.repeat(80));
  
  console.log('\n✓ Clean files (no detected issues):');
  for (const r of cleanResults) {
    console.log(`  ✓ ${r.domain}/${r.model} (${r.size} bytes)`);
  }
  
  console.log('\n✗ Files with detected issues:');
  for (const r of problematicResults) {
    const issueSummary = r.issues.length > 0 ? `[${r.issues[0]}${r.issues.length > 1 ? `+${r.issues.length-1}` : ''}]` : '';
    console.log(`  ✗ ${r.domain}/${r.model} ${issueSummary}`);
  }
  
  // Export raw data
  const reportPath = path.join(PROJECT_ROOT, 'landing-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalFiles: results.length,
    filesWithIssues: problematicResults.length,
    cleanFiles: cleanResults.length,
    domains: sortedDomains,
    allResults: results,
  }, null, 2));
  
  console.log(`\n\nFull report saved to: ${reportPath}`);
  
  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION COMPLETE');
  console.log('='.repeat(80));
  console.log(`\nTotal files checked: ${results.length}`);
  console.log(`Files with detected issues: ${problematicResults.length}`);
  console.log(`Files appearing clean: ${cleanResults.length}`);
  console.log('\n👉 Review the findings above and decide what is acceptable.');
}

// Run
runValidation();
