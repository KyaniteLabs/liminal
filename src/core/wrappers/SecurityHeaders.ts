/**
 * Shared security headers for HTML wrappers
 * Provides CSP and other security meta tags
 */

export const SECURITY_HEADERS = `
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data: blob:; media-src 'self';">
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
`;

export default SECURITY_HEADERS;
