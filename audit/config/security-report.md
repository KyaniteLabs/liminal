# Configuration Security Analysis

**Audit Date:** 2026-04-02  
**Auditor:** Task 2.4 - Configuration Security Analysis  
**Scope:** Environment variable access, secret handling, config exposure  

---

## Secret Handling

### Secrets Found in Environment Variables

| Secret | Variable | Locations Used | Risk |
|--------|----------|----------------|------|
| OpenAI API Key | OPENAI_API_KEY | 8 files (LLMClient.ts, ConfigLoader.ts, MultiProviderConfig.ts) | HIGH - No LIMINAL_ prefix |
| MiniMax API Key | MINIMAX_API_KEY | 5 files (MultiProviderConfig.ts, ConfigLoader.ts) | MEDIUM |
| GLM API Key | GLM_API_KEY | 3 files (MultiProviderConfig.ts) | MEDIUM |
| OpenRouter Key | OPENROUTER_API_KEY | 3 files (MultiProviderConfig.ts) | MEDIUM |
| Liminal LLM Key | LIMINAL_LLM_API_KEY | 6 files | LOW (prefixed) |
| Liminal Harness Key | LIMINAL_HARNESS_API_KEY | 1 file | LOW (prefixed) |

**Issue:** Mixed naming conventions - some secrets use `LIMINAL_` prefix, others use raw provider names
**Risk:** Environment variable collision with other tools using same env vars (e.g., another CLI tool using OPENAI_API_KEY)
**Evidence:**
```typescript
// src/llm/LLMClient.ts:121
apiKey: config?.apiKey ?? env('LLM_API_KEY') ?? process.env.OPENAI_API_KEY,

// src/config/ConfigLoader.ts:289
const apiKey = env('LLM_API_KEY') || config.apiKey || fileConfigApiKey || process.env.OPENAI_API_KEY || process.env.MINIMAX_API_KEY;
```

### Secret Storage Patterns

| Pattern | Count | Files | Risk |
|---------|-------|-------|------|
| `process.env.OPENAI_API_KEY` | 8 | LLMClient.ts, ConfigLoader.ts, MultiProviderConfig.ts | HIGH |
| `process.env.MINIMAX_API_KEY` | 5 | MultiProviderConfig.ts, ConfigLoader.ts | MEDIUM |
| `process.env.GLM_API_KEY` | 3 | MultiProviderConfig.ts | MEDIUM |
| `process.env.OPENROUTER_API_KEY` | 3 | MultiProviderConfig.ts | MEDIUM |
| `process.env.LIMINAL_LLM_API_KEY` | 6 | MultiProviderConfig.ts | LOW |
| `process.env.LIMINAL_HARNESS_API_KEY` | 1 | MultiProviderConfig.ts | LOW |

---

## Config Exposure Analysis

### What's Logged/Displayed

#### MetaHarnessIntegration.ts (GOOD - No secret exposure)
```typescript
// Line 74: Only logs model and baseUrl, NOT apiKey
console.log(`[MetaHarness] LLM client configured: ${config.model} @ ${config.baseUrl} (temp: ${config.temperature})`);
```
**Status:** ✅ SAFE - API key is NOT logged

#### LLMClient.ts getConfig() (RISK)
```typescript
// Line 187-189: Returns full config including apiKey
getConfig(): LLMConfig {
  return { ...this.config };  // Includes apiKey!
}
```
**Status:** ⚠️ RISK - Caller could log the API key

#### Potential Exposure Points

| Location | Risk | Evidence |
|----------|------|----------|
| LLMClient.getConfig() | HIGH | Returns full config object with apiKey |
| TierBasedGenerator.ts:37-38 | MEDIUM | Calls `llm.getConfig()` |
| tui/NaturalInterface.ts:518 | MEDIUM | Calls `llm.getConfig()` |
| Any future caller | HIGH | Unknown usage patterns |

### Secret Exposure Risks Summary

| Risk | Evidence | Severity |
|------|----------|----------|
| API keys in error messages | None found | LOW |
| Config logged to console | None found currently | LOW |
| Secrets accessible via getConfig() | LLMClient.ts:187-189 | HIGH |
| No secret validation | Any string accepted | MEDIUM |
| Secrets in memory | Config stored in LLMClient | MEDIUM |

---

## April 2026 Security Best Practices Gap Analysis

| Practice | Status | Gap |
|----------|--------|-----|
| Secrets manager integration | ❌ None | HIGH - All secrets in env vars |
| Secret validation | ❌ None | MEDIUM - No format checking |
| Secret rotation support | ❌ None | MEDIUM - Manual only |
| Audit logging for secret access | ❌ None | MEDIUM - No access logs |
| Least privilege | ❌ None | MEDIUM - No scoped keys |
| Encryption at rest | ❌ N/A | N/A - Not applicable for CLI tool |
| Config sanitization before logging | ❌ None | HIGH - getConfig() exposes secrets |
| Standardized env var naming | ⚠️ Partial | MEDIUM - Mixed LIMINAL_ prefix usage |
| Secret masking in debug output | ❌ None | MEDIUM - No sanitization utility |

### Compliance Standards Mapping

| Standard | Requirement | Status |
|----------|-------------|--------|
| OWASP Top 10 (2021) | A07:2021 – Identification and Authentication Failures | ⚠️ Partial |
| CWE-798 | Use of Hard-coded Credentials | ✅ Pass (no hard-coded) |
| CWE-200 | Exposure of Sensitive Information | ⚠️ Risk via getConfig() |
| CWE-532 | Insertion of Sensitive Information into Log File | ✅ Pass (not logged) |
| NIST 800-53 | IA-5: Authenticator Management | ❌ Fail |

---

## Attack Scenarios

### Scenario 1: Log Injection Attack
**Risk:** LOW  
**Description:** Malicious code could call `llm.getConfig()` and exfiltrate the API key  
**Mitigation:** Add sanitization before returning config

### Scenario 2: Environment Variable Collision
**Risk:** MEDIUM  
**Description:** Another tool sets OPENAI_API_KEY, Liminal unintentionally uses it  
**Mitigation:** Migrate to LIMINAL_OPENAI_API_KEY with backward compatibility

### Scenario 3: Memory Dump Exposure
**Risk:** LOW  
**Description:** Core dumps or memory inspection could reveal API keys  
**Mitigation:** Use secrets manager with runtime retrieval

### Scenario 4: CI/CD Log Leakage
**Risk:** MEDIUM  
**Description:** If debug logging is added that logs getConfig() output  
**Mitigation:** Implement sanitizeConfig() utility and use consistently

---

## Recommendations

### HIGH Priority

#### 1. Add Config Sanitization Utility
Create a utility to redact sensitive fields before logging or returning:

```typescript
// src/utils/secrets.ts
export const SENSITIVE_FIELDS = [
  'apiKey',
  'apiSecret', 
  'password',
  'token',
  'secret',
  'key',
  'credential'
];

export function sanitizeConfig<T extends Record<string, unknown>>(
  config: T,
  options?: {
    fields?: string[];
    mask?: string;
  }
): T {
  const fieldsToSanitize = options?.fields ?? SENSITIVE_FIELDS;
  const mask = options?.mask ?? '[REDACTED]';
  
  const sanitized = { ...config };
  
  for (const key of Object.keys(sanitized)) {
    if (fieldsToSanitize.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
      sanitized[key] = mask as T[Extract<keyof T, string>];
    }
  }
  
  return sanitized;
}

// Helper to check if config contains sensitive data
export function containsSecrets(config: Record<string, unknown>): boolean {
  return Object.keys(config).some(key => 
    SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f.toLowerCase()))
  );
}
```

#### 2. Add getSafeConfig() Method to LLMClient
```typescript
// src/llm/LLMClient.ts
import { sanitizeConfig } from '../utils/secrets.js';

export class LLMClient {
  // ... existing code ...

  /** Get current config (includes sensitive data) */
  getConfig(): LLMConfig {
    return { ...this.config };
  }

  /** Get sanitized config (safe for logging/display) */
  getSafeConfig(): LLMConfig {
    return sanitizeConfig(this.config);
  }
}
```

#### 3. Update MetaHarnessIntegration to Use Safe Config
```typescript
// Already safe - only logs model and baseUrl
// No changes needed here (good example)
```

### MEDIUM Priority

#### 4. Standardize Secret Naming Convention
Migrate to consistent `LIMINAL_` prefix with backward compatibility:

```typescript
// src/utils/env.ts
export function getSecret(name: string, legacyNames?: string[]): string | undefined {
  // Check new name first
  const newName = `LIMINAL_${name}`;
  if (process.env[newName]) {
    return process.env[newName];
  }
  
  // Check legacy names with warning
  if (legacyNames) {
    for (const legacy of legacyNames) {
      if (process.env[legacy]) {
        console.warn(`[Deprecation] ${legacy} is deprecated. Use ${newName} instead.`);
        return process.env[legacy];
      }
    }
  }
  
  return undefined;
}

// Usage:
const apiKey = getSecret('OPENAI_API_KEY', ['OPENAI_API_KEY']);
// Checks: LIMINAL_OPENAI_API_KEY → OPENAI_API_KEY (with warning)
```

#### 5. Add Secret Validation
```typescript
// src/utils/secrets.ts
export function validateSecretFormat(provider: string, key: string): boolean {
  const patterns: Record<string, RegExp> = {
    openai: /^sk-[a-zA-Z0-9]{48}$/,
    minimax: /^minimax-[a-zA-Z0-9]{32,}$/,
    openrouter: /^sk-or-[a-zA-Z0-9-]+$/,
    glm: /^[a-zA-Z0-9]{32,}$/,
  };
  
  const pattern = patterns[provider.toLowerCase()];
  if (!pattern) return true; // Unknown provider, skip validation
  
  return pattern.test(key);
}
```

#### 6. Document Secret Handling
Add SECURITY.md section:

```markdown
## Secret Handling

### What We Log
- ✅ Model names, base URLs, temperature settings
- ❌ API keys, secrets, credentials

### Environment Variables
| Variable | Purpose | Required |
|----------|---------|----------|
| LIMINAL_LLM_API_KEY | Primary LLM API key | Optional* |
| LIMINAL_OPENAI_API_KEY | OpenAI-specific key | Optional* |
| LIMINAL_MINIMAX_API_KEY | MiniMax-specific key | Optional* |

*At least one API key or local LLM URL required

### Key Rotation
1. Set new key in environment
2. Restart Liminal
3. Old key can be revoked after restart
```

### LOW Priority

#### 7. Support External Secrets Managers
```typescript
// src/utils/secrets.ts
export async function getSecretFromManager(
  manager: '1password' | 'aws' | 'vault',
  key: string
): Promise<string | undefined> {
  switch (manager) {
    case '1password':
      // Integration with 1Password CLI
      return getFrom1Password(key);
    case 'aws':
      // AWS Secrets Manager
      return getFromAWS(key);
    case 'vault':
      // HashiCorp Vault
      return getFromVault(key);
  }
}
```

#### 8. Add Secret Access Audit Logging
```typescript
// src/utils/secrets.ts
export function auditSecretAccess(
  secretName: string,
  context: string,
  success: boolean
): void {
  if (process.env.LIMINAL_AUDIT_SECRETS === 'true') {
    console.log(`[AUDIT] Secret access: ${secretName} from ${context} - ${success ? 'success' : 'denied'}`);
  }
}
```

---

## Implementation Plan for Wave 3

### Phase 1: Immediate Fixes (Week 1)
1. Create `src/utils/secrets.ts` with sanitizeConfig()
2. Add getSafeConfig() to LLMClient
3. Search and replace any getConfig() calls that might log
4. Add deprecation warnings for non-LIMINAL_ prefixed vars

### Phase 2: Validation & Documentation (Week 2)
1. Add secret format validation
2. Create SECURITY.md
3. Update .env.example with new naming convention
4. Add tests for secret handling

### Phase 3: Advanced Features (Week 3-4)
1. Secrets manager integration (1Password CLI)
2. Audit logging
3. Secret rotation utilities

---

## Files to Modify

| File | Change | Priority |
|------|--------|----------|
| `src/utils/secrets.ts` | Create new file with sanitization utilities | HIGH |
| `src/llm/LLMClient.ts` | Add getSafeConfig() method | HIGH |
| `src/utils/env.ts` | Add getSecret() with legacy support | MEDIUM |
| `SECURITY.md` | Document secret handling | MEDIUM |
| `.env.example` | Update with new naming convention | MEDIUM |
| `src/tui/NaturalInterface.ts` | Verify getConfig() usage | LOW |
| `src/generators/TierBasedGenerator.ts` | Verify getConfig() usage | LOW |

---

## Verification Checklist

- [ ] sanitizeConfig() redacts all sensitive fields
- [ ] getSafeConfig() returns config without apiKey
- [ ] No console.log statements output apiKey
- [ ] Deprecation warnings shown for legacy env vars
- [ ] SECURITY.md documents what is/isn't logged
- [ ] Tests verify secret handling

---

## Summary

**Overall Risk Level:** MEDIUM-HIGH

**Key Findings:**
1. ✅ Secrets are NOT currently logged (good)
2. ⚠️ Secrets accessible via getConfig() (risk)
3. ⚠️ Mixed naming conventions (maintenance burden)
4. ❌ No secret validation (security gap)
5. ❌ No secrets manager integration (feature gap)

**Immediate Actions Required:**
1. Implement sanitizeConfig() utility
2. Add getSafeConfig() to LLMClient
3. Audit all getConfig() call sites

**Estimated Effort:** 2-3 days for Phase 1, 1 week for full implementation
