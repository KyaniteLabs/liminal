/**
 * M11: Accessibility Guardrails
 * 
 * Validates creative output for accessibility:
 * - Photosensitivity: No flashing > 3Hz (seizure risk)
 * - Color blindness: Avoid problematic color combinations
 * - Contrast: Sufficient for low vision
 * - Motion: Respects prefers-reduced-motion
 * - Audio: No sudden loud noises
 */

import puppeteer from 'puppeteer';
import { getChromeArgs } from '../security/SandboxConfig.js';
import { generateHTML } from '../utils/generateHTML.js';

export interface AccessibilityResult {
  accessible: boolean;
  checks: {
    photosensitivity: boolean;  // No flashing > 3Hz
    colorBlindnessSafe: boolean;  // Not relying solely on red/green
    sufficientContrast: boolean;  // WCAG AA minimum
    motionSafe: boolean;  // Respects reduced motion
    audioSafe: boolean;  // No sudden loud sounds
  };
  issues: string[];
  warnings: string[];  // Non-blocking suggestions
}

export interface AccessibilityOptions {
  checkDurationMs?: number;  // How long to analyze (default: 2000ms)
  disableSandbox?: boolean;
}

const DEFAULT_OPTIONS: Required<AccessibilityOptions> = {
  checkDurationMs: 2000,
  disableSandbox: false,
};

export class AccessibilityGuardrails {
  private options: Required<AccessibilityOptions>;

  constructor(options?: AccessibilityOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Run full accessibility check
   */
  async check(code: string, _domain: string): Promise<AccessibilityResult> {
    const browser = await puppeteer.launch({
      headless: true,
      args: getChromeArgs({ forceDisableSandbox: this.options.disableSandbox }),
    });

    const issues: string[] = [];
    const warnings: string[] = [];

    try {
      const page = await browser.newPage();

      // Inject accessibility tracker
      await page.evaluateOnNewDocument(() => {
        // @ts-expect-error
        window.__accessibilityMetrics = {
          luminanceSamples: [] as number[],
          flashCount: 0,
          lastLuminance: 0,
          hasAudio: false,
          audioPeakLevel: 0,
        };

        // Track luminance changes for photosensitivity
        const canvas = document.querySelector('canvas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          setInterval(() => {
            if (!ctx) return;
            // Sample center pixel luminance
            const imageData = ctx.getImageData(canvas.width/2, canvas.height/2, 1, 1);
            const [r, g, b] = imageData.data;
            // Relative luminance formula
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            
            // @ts-expect-error
            const metrics = window.__accessibilityMetrics;
            const change = Math.abs(luminance - metrics.lastLuminance);
            if (change > 0.5) { // Significant change
              metrics.flashCount++;
            }
            metrics.lastLuminance = luminance;
            metrics.luminanceSamples.push(luminance);
          }, 100); // Sample at 10Hz
        }
      });

      // Generate and load HTML
      const html = generateHTML({
        code,
        title: 'Accessibility Check',
        bodyStyle: 'margin: 0; padding: 0; overflow: hidden;',
        fullscreen: true,
      });

      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.waitForSelector('canvas', { timeout: 10000 });

      // Let it run
      await new Promise(r => setTimeout(r, this.options.checkDurationMs));

      // Get metrics
      const metrics = await page.evaluate(() => {
        // @ts-expect-error
        return window.__accessibilityMetrics || {};
      });

      // Analyze code for static checks
      const codeAnalysis = this.analyzeCode(code);

      // Check photosensitivity (flashing > 3Hz is dangerous)
      const checkDurationSeconds = this.options.checkDurationMs / 1000;
      const flashRate = (metrics.flashCount || 0) / checkDurationSeconds;
      const photosensitivityPass = flashRate <= 3; // Max 3 flashes per second

      if (!photosensitivityPass) {
        issues.push(`Photosensitivity risk: ${flashRate.toFixed(1)} flashes/sec (max safe: 3)`);
      }

      // Check color blindness safety
      const colorBlindnessPass = codeAnalysis.protanopiaSafe && codeAnalysis.deuteranopiaSafe;
      if (!colorBlindnessPass) {
        warnings.push('Code may have color accessibility issues for red/green color blindness');
      }

      // Check contrast (simplified - look for very low contrast combinations)
      const contrastPass = !codeAnalysis.lowContrastPatterns.some((p: string) => 
        code.toLowerCase().includes(p)
      );
      if (!contrastPass) {
        warnings.push('Potential low contrast detected - consider accessibility');
      }

      // Check motion (look for rapid animations without media query support)
      const hasRapidMotion = /\bspeed\s*[=:]\s*[5-9]|\bfast\b|\brapid\b/.test(code.toLowerCase());
      const hasReducedMotionCheck = code.includes('prefers-reduced-motion') || 
                                     code.includes('matchMedia');
      const motionPass = !hasRapidMotion || hasReducedMotionCheck;

      if (hasRapidMotion && !hasReducedMotionCheck) {
        warnings.push('Rapid motion detected without prefers-reduced-motion support');
      }

      // Check audio safety
      const hasAudio = /\baudio\b|\bsound\b|\bTone\b|\bosc\(/.test(code);
      const hasVolumeControl = code.includes('volume') || code.includes('gain');
      const audioPass = !hasAudio || hasVolumeControl;

      if (hasAudio && !hasVolumeControl) {
        warnings.push('Audio present without explicit volume control');
      }

      return {
        accessible: photosensitivityPass, // Hard fail only on photosensitivity
        checks: {
          photosensitivity: photosensitivityPass,
          colorBlindnessSafe: colorBlindnessPass,
          sufficientContrast: contrastPass,
          motionSafe: motionPass,
          audioSafe: audioPass,
        },
        issues,
        warnings,
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push(`Accessibility check error: ${message}`);
      
      return {
        accessible: false,
        checks: {
          photosensitivity: false,
          colorBlindnessSafe: false,
          sufficientContrast: false,
          motionSafe: false,
          audioSafe: false,
        },
        issues,
        warnings,
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Static code analysis for accessibility patterns
   */
  private analyzeCode(code: string): {
    protanopiaSafe: boolean;
    deuteranopiaSafe: boolean;
    lowContrastPatterns: string[];
  } {
    const codeLower = code.toLowerCase();
    
    // Check for red-green dependent patterns
    const hasRedGreenCombo = 
      (/\bred\b/.test(codeLower) && /\bgreen\b/.test(codeLower)) ||
      (/#ff0000|rgb\(255,\s*0,\s*0\)/.test(code) && /#00ff00|rgb\(0,\s*255,\s*0\)/.test(code));
    
    const usesPatternsOrShapes = 
      /\bshape\b|\bpattern\b|\bstroke\b|\bstrokeweight\b|\bline\b/.test(codeLower);

    return {
      // Safe if not relying solely on red/green distinction
      protanopiaSafe: !hasRedGreenCombo || usesPatternsOrShapes,
      deuteranopiaSafe: !hasRedGreenCombo || usesPatternsOrShapes,
      lowContrastPatterns: [
        'lightgray', 'lightgrey',
        'rgba(255,255,255,0.1)',
        'rgba(0,0,0,0.1)',
      ],
    };
  }

  /**
   * Quick static check (no browser needed)
   */
  static quickCheck(code: string): { issues: string[]; warnings: string[] } {
    const issues: string[] = [];
    const warnings: string[] = [];
    const codeLower = code.toLowerCase();

    // Check for obvious photosensitivity risks in code
    const flashingPatterns = [
      /framecount.*%\s*\d+\s*[=<>]/,  // Rapid modulo-based changes
      /random\(\).*255/,  // Random flashing colors
      /background\(\s*random/i,  // Random background changes
    ];

    for (const pattern of flashingPatterns) {
      if (pattern.test(code)) {
        warnings.push('Code contains patterns that may cause rapid flashing');
        break;
      }
    }

    // Check for missing accessibility features
    if (/\banimation\b|\bmoving\b|\brotating\b/.test(codeLower) && 
        !code.includes('prefers-reduced-motion')) {
      warnings.push('Animation without prefers-reduced-motion check');
    }

    return { issues, warnings };
  }
}
