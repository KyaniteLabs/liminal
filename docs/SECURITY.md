# Liminal Security Guide

## Table of Contents
1. [Overview](#overview)
2. [Deployment Security](#deployment-security)
3. [Environment Variables](#environment-variables)
4. [SSRF Protection](#ssrf-protection)
5. [Rate Limiting](#rate-limiting)
6. [Sandbox Security](#sandbox-security)
7. [Security Headers](#security-headers)
8. [Incident Response](#incident-response)

## Overview

Liminal implements multiple security layers to protect against common web application vulnerabilities.

## Deployment Security

### Production Checklist

Before deploying to production, ensure:

- [ ] `NODE_ENV=production` is set
- [ ] `LIMINAL_DISABLE_SANDBOX` is `false` (or unset)
- [ ] Rate limiting is configured appropriately
- [ ] HTTPS is enabled
- [ ] Security headers are active (verify with `curl -I`)
- [ ] CSRF tokens are required for state-changing operations

### Docker Security

```bash
docker run \
  --security-opt seccomp=docker/seccomp-chrome.json \
  --cap-drop=ALL \
  --cap-add=SYS_ADMIN \
  --read-only \
  --tmpfs /tmp \
  liminal
```

## Environment Variables

### Security-Related Variables

| Variable | Description | Default | Security Impact |
|----------|-------------|---------|-----------------|
| `LIMINAL_DISABLE_SANDBOX` | Disable Chrome sandbox | `false` | 🔴 High - Only in containers |
| `LIMINAL_LLM_BASE_URL` | LLM API endpoint | (provider) | 🟡 Medium - Validated against whitelist |
| `LIMINAL_ALLOWED_HOSTS` | Additional allowed hosts | (none) | 🟢 Low - Extends whitelist |
| `LIMINAL_ALLOW_LOCALHOST_LLM` | Allow localhost LLM | `true` | 🟡 Medium |
| `LIMINAL_ALLOW_PRIVATE_IP_LLM` | Allow private IPs | `false` | 🔴 High |
| `LIMINAL_RATE_LIMIT_GENERAL` | API rate limit | `100` | 🟢 Low |
| `LIMINAL_RATE_LIMIT_EXPORT` | Export rate limit | `10` | 🟢 Low |
| `LIMINAL_RATE_LIMIT_SANDBOX` | Sandbox rate limit | `30` | 🟢 Low |

## SSRF Protection

Liminal validates all LLM URLs to prevent Server-Side Request Forgery:

### Blocked by Default
- Cloud metadata endpoints (169.254.169.254)
- Private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
- Link-local addresses

### Whitelist
Allowed hosts include:
- api.openai.com
- api.minimax.io
- localhost (configurable)

## Rate Limiting

Default limits per IP:
- General API: 100 requests per 15 minutes
- Export operations: 10 requests per hour
- Sandbox operations: 30 requests per 15 minutes

## Sandbox Security

Chrome sandbox is enabled by default. Only disable when:
- Running in a Docker container
- With proper seccomp/AppArmor profile
- After understanding the risks

## Security Headers

All HTTP responses include:
- Content-Security-Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security
- Referrer-Policy

## Incident Response

If you discover a security vulnerability:

1. Do NOT open a public issue
2. Email security@liminal-ai.dev with details
3. Include reproduction steps
4. Allow 90 days for disclosure

## Security Updates

Subscribe to security advisories:
- Watch the GitHub repository
- Join the security mailing list
