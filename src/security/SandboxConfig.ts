/**
 * Secure sandbox configuration for Puppeteer
 * 
 * SECURITY WARNING: Disabling the sandbox (--no-sandbox) should ONLY be done
 * in containerized environments with proper seccomp/apparmor profiles.
 * In production, always use the sandbox.
 */

import { Logger } from '../utils/Logger.js';

export interface SandboxConfig {
  /** When true, disables Chrome sandbox (USE WITH CAUTION) */
  disableSandbox: boolean;
  /** Additional Chrome arguments */
  extraArgs: string[];
}

/**
 * Default secure Chrome arguments (sandbox enabled)
 *
 * NOTE: --no-zygote and --single-process are intentionally excluded here.
 * Those flags are only valid when --no-sandbox is also set (Docker containers).
 * Using --no-zygote without --no-sandbox produces a fatal error:
 * "Zygote cannot be disabled if sandbox is enabled."
 */
export const SECURE_CHROME_ARGS = [
  '--disable-dev-shm-usage',     // Required for Docker
  '--no-first-run',              // Skip first run wizards
  '--disable-gpu',               // Disable GPU acceleration
  '--disable-web-security=false', // Keep web security enabled
  '--disable-features=IsolateOrigins,site-per-process', // Performance
];

/**
 * Dangerous arguments that disable security (use only when absolutely necessary)
 */
export const DANGEROUS_CHROME_ARGS = [
  '--no-sandbox',              // Disables Chrome sandbox
  '--disable-setuid-sandbox',  // Disables setuid sandbox
];

/**
 * Get Chrome arguments based on configuration
 * 
 * By default, uses secure configuration with sandbox enabled.
 * Sandbox is ONLY disabled when LIMINAL_DISABLE_SANDBOX=true AND explicitly requested.
 */
export function getChromeArgs(options?: { forceDisableSandbox?: boolean }): string[] {
  const disableSandboxEnv = process.env.LIMINAL_DISABLE_SANDBOX === 'true';
  const shouldDisableSandbox = options?.forceDisableSandbox && disableSandboxEnv;
  
  const args = [...SECURE_CHROME_ARGS];
  
  if (shouldDisableSandbox) {
    Logger.warn('SandboxConfig', 'Chrome sandbox is disabled. This should only be used in containerized environments with seccomp/AppArmor profiles.');
    args.push(...DANGEROUS_CHROME_ARGS);
  }
  
  return args;
}

/**
 * Check if sandbox is properly configured
 */
export function isSandboxEnabled(args: string[]): boolean {
  return !args.includes('--no-sandbox');
}
