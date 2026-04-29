/**
 * Shared security headers for HTML wrappers
 * Provides CSP and other security meta tags
 */

export const SECURITY_HEADERS = `
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data: blob:; media-src 'self';">
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
`;

export const P5_SENSOR_POLICY_SCRIPT = `
    <script>
    (function liminalSensorPolicy() {
      const nativeAddEventListener = window.addEventListener.bind(window);
      window.addEventListener = function(type, listener, options) {
        const eventName = String(type).toLowerCase();
        if (eventName === 'devicemotion' || eventName === 'deviceorientation' || eventName === 'deviceorientationabsolute') return;
        return nativeAddEventListener(type, listener, options);
      };
      try { Object.defineProperty(window, 'DeviceMotionEvent', { value: undefined, configurable: true }); } catch {}
      try { Object.defineProperty(window, 'DeviceOrientationEvent', { value: undefined, configurable: true }); } catch {}
    })();
    </script>
`;

export default SECURITY_HEADERS;
