/**
 * Secure sandbox configuration for Puppeteer
 * 
 * SECURITY WARNING: Disabling the sandbox (--no-sandbox) should ONLY be done
 * in containerized environments with proper seccomp/apparmor profiles.
 * In production, always use the sandbox.
 */

export interface SandboxConfig {
  /** When true, disables Chrome sandbox (USE WITH CAUTION) */
  disableSandbox: boolean;
  /** Additional Chrome arguments */
  extraArgs: string[];
}

/**
 * Default secure Chrome arguments (sandbox enabled)
 */
export const SECURE_CHROME_ARGS = [
  '--disable-dev-shm-usage',     // Required for Docker
  '--no-first-run',              // Skip first run wizards
  '--no-zygote',                 // Disable zygote process
  '--single-process',            // Required for some Docker environments
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
    console.warn('[SECURITY WARNING] Chrome sandbox is disabled. This should only be used in containerized environments with seccomp/AppArmor profiles.');
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
