import { describe, expect, it } from 'vitest';
import { formatMicCaptureError } from '../../src/shared/micPermission';

describe('formatMicCaptureError', () => {
  it('turns permission denials into user-actionable copy', () => {
    expect(formatMicCaptureError(new DOMException('Permission denied', 'NotAllowedError')))
      .toContain('Allow microphone access');
  });

  it('explains missing and busy devices without raw browser errors', () => {
    expect(formatMicCaptureError(new DOMException('Requested device not found', 'NotFoundError')))
      .toContain('No microphone was found');
    expect(formatMicCaptureError(new DOMException('Could not start audio source', 'NotReadableError')))
      .toContain('already in use');
  });
});
