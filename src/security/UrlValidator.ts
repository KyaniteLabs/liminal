/**
 * URL Validator for SSRF protection
 * Prevents requests to internal infrastructure and DNS rebinding attacks
 */

import { lookup } from 'dns/promises';
import { logSSRFAttempt } from './SecurityLogger.js';

export class SSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SSRFError';
  }
}

export interface UrlValidationOptions {
  allowedHosts?: string[];
  allowPrivateIPs?: boolean;
  allowLocalhost?: boolean;
}

// Default allowed hosts for LLM providers
const DEFAULT_ALLOWED_HOSTS = [
  'api.openai.com',
  'api.minimaxi.com',    // MiniMax Chinese domestic
  'api.minimaxi.chat',   // MiniMax alternative
  'api.minimax.io',       // MiniMax International Token Plan
  'localhost',
  '127.0.0.1',
];

// Cloud metadata endpoints that should NEVER be accessible
const BLOCKED_HOSTS = [
  '169.254.169.254',  // AWS, GCP, Azure metadata
  '169.254.170.2',    // AWS ECS metadata
  'metadata.google.internal',
  'metadata.oraclecloud.com',
];

// Private IP ranges
const PRIVATE_IP_PATTERNS = [
  /^10\./,                          // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
  /^192\.168\./,                    // 192.168.0.0/16
  /^127\./,                         // 127.0.0.0/8 (loopback)
  /^0\./,                           // 0.0.0.0/8
  /^::1$/,                          // IPv6 loopback
  /^fc00:/i,                        // IPv6 private
  /^fe80:/i,                        // IPv6 link-local
];

/**
 * Check if an IP address is private/internal
 */
function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(ip));
}

export async function validateUrl(
  urlString: string,
  options: UrlValidationOptions = {}
): Promise<void> {
  const { allowedHosts = [], allowPrivateIPs = false, allowLocalhost = true } = options;
  
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new SSRFError(`Invalid URL: ${urlString}`);
  }
  
  const hostname = parsed.hostname.toLowerCase();
  
  // Check blocked hosts (cloud metadata)
  if (BLOCKED_HOSTS.includes(hostname)) {
    logSSRFAttempt(urlString, { 
      details: { blockedHost: hostname, reason: 'cloud_metadata' } 
    });
    throw new SSRFError(`Access to ${hostname} is blocked (cloud metadata endpoint)`);
  }
  
  // SECURITY: Resolve hostname to IP and validate (prevents DNS rebinding)
  let resolvedIP: string | undefined;
  try {
    const lookupResult = await lookup(hostname);
    resolvedIP = lookupResult.address;
    
    if (isPrivateIP(resolvedIP) && !allowPrivateIPs) {
      logSSRFAttempt(urlString, { 
        details: { blockedHost: hostname, resolvedIP, reason: 'private_ip' } 
      });
      throw new SSRFError(`Access to private IP ${resolvedIP} (resolved from ${hostname}) is blocked`);
    }
  } catch (err) {
    // If lookup fails, continue with hostname checks (may be a non-DNS hostname)
    if (err instanceof SSRFError) throw err;
  }
  
  // Check if hostname is localhost
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  
  // Block localhost if explicitly disabled
  if (isLocalhost && !allowLocalhost) {
    logSSRFAttempt(urlString, { 
      details: { blockedHost: hostname, reason: 'localhost_blocked' } 
    });
    throw new SSRFError(`Access to localhost ${hostname} is blocked`);
  }
  
  // Check if hostname is a private IP (excluding localhost which is handled above)
  const hostnameIsPrivateIP = isPrivateIP(hostname);
  if (hostnameIsPrivateIP && !isLocalhost && !allowPrivateIPs) {
    logSSRFAttempt(urlString, { 
      details: { blockedHost: hostname, reason: 'private_ip' } 
    });
    throw new SSRFError(`Access to private IP ${hostname} is blocked`);
  }
  
  // Check whitelist (if any custom allowed hosts are specified)
  if (allowedHosts.length > 0) {
    const allAllowedHosts = [...DEFAULT_ALLOWED_HOSTS, ...allowedHosts];
    const isAllowed = allAllowedHosts.some(allowed => {
      if (allowed === hostname) return true;
      if (hostname.endsWith(`.${allowed}`)) return true;
      return false;
    });
    
    // If we have a whitelist and this host isn't on it, block it
    if (!isAllowed) {
      logSSRFAttempt(urlString, { 
        details: { blockedHost: hostname, reason: 'not_in_allowlist' } 
      });
      throw new SSRFError(`Host ${hostname} is not in the allowed list`);
    }
  }
}

/**
 * Synchronous version for backward compatibility
 * Note: This cannot prevent DNS rebinding - prefer validateUrl() when possible
 */
export function validateUrlSync(
  urlString: string,
  options: UrlValidationOptions = {}
): void {
  const { allowedHosts = [], allowPrivateIPs = false, allowLocalhost = true } = options;
  
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new SSRFError(`Invalid URL: ${urlString}`);
  }
  
  const hostname = parsed.hostname.toLowerCase();
  
  // Check blocked hosts (cloud metadata)
  if (BLOCKED_HOSTS.includes(hostname)) {
    logSSRFAttempt(urlString, { 
      details: { blockedHost: hostname, reason: 'cloud_metadata' } 
    });
    throw new SSRFError(`Access to ${hostname} is blocked (cloud metadata endpoint)`);
  }
  
  // Check if hostname is localhost
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  
  // Block localhost if explicitly disabled
  if (isLocalhost && !allowLocalhost) {
    logSSRFAttempt(urlString, { 
      details: { blockedHost: hostname, reason: 'localhost_blocked' } 
    });
    throw new SSRFError(`Access to localhost ${hostname} is blocked`);
  }
  
  // Check if hostname is a private IP (excluding localhost which is handled above)
  const hostnameIsPrivateIP = isPrivateIP(hostname);
  if (hostnameIsPrivateIP && !isLocalhost && !allowPrivateIPs) {
    logSSRFAttempt(urlString, { 
      details: { blockedHost: hostname, reason: 'private_ip' } 
    });
    throw new SSRFError(`Access to private IP ${hostname} is blocked`);
  }
  
  // Check whitelist (if any custom allowed hosts are specified)
  if (allowedHosts.length > 0) {
    const allAllowedHosts = [...DEFAULT_ALLOWED_HOSTS, ...allowedHosts];
    const isAllowed = allAllowedHosts.some(allowed => {
      if (allowed === hostname) return true;
      if (hostname.endsWith(`.${allowed}`)) return true;
      return false;
    });
    
    // If we have a whitelist and this host isn't on it, block it
    if (!isAllowed) {
      logSSRFAttempt(urlString, { 
        details: { blockedHost: hostname, reason: 'not_in_allowlist' } 
      });
      throw new SSRFError(`Host ${hostname} is not in the allowed list`);
    }
  }
}

export function getAllowedHostsFromEnv(): string[] {
  const envHosts = process.env.LIMINAL_ALLOWED_HOSTS;
  if (!envHosts) return [];
  return envHosts.split(',').map(h => h.trim()).filter(Boolean);
}
