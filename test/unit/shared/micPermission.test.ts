import { describe, it, expect } from 'vitest';
import { formatMicCaptureError } from '../../../src/shared/micPermission.js';

describe('formatMicCaptureError', () => {
  it('handles NotAllowedError by name', () => {
    const err = new DOMException('Permission denied', 'NotAllowedError');
    const msg = formatMicCaptureError(err);
    expect(msg).toContain('permission was denied');
    expect(msg).toContain('try again');
  });

  it('handles permission denied by message text', () => {
    const msg = formatMicCaptureError(new Error('microphone access denied'));
    expect(msg).toContain('permission was denied');
  });

  it('handles "not allowed" in message', () => {
    const msg = formatMicCaptureError(new Error('Not allowed to access microphone'));
    expect(msg).toContain('permission was denied');
  });

  it('handles NotFoundError by name', () => {
    const err = { name: 'NotFoundError', message: 'Requested device not found' };
    const msg = formatMicCaptureError(err);
    expect(msg).toContain('No microphone was found');
  });

  it('handles "not found" in message', () => {
    const msg = formatMicCaptureError(new Error('No device found'));
    expect(msg).toContain('No microphone was found');
  });

  it('handles "no device" in message', () => {
    const msg = formatMicCaptureError(new Error('no device available'));
    expect(msg).toContain('No microphone was found');
  });

  it('handles NotReadableError by name', () => {
    const err = { name: 'NotReadableError', message: 'Could not start audio' };
    const msg = formatMicCaptureError(err);
    expect(msg).toContain('already in use');
  });

  it('handles "in use" in message', () => {
    const msg = formatMicCaptureError(new Error('Microphone in use by another app'));
    expect(msg).toContain('already in use');
  });

  it('handles "could not start" in message', () => {
    const msg = formatMicCaptureError(new Error('Could not start audio capture'));
    expect(msg).toContain('already in use');
  });

  it('falls back to generic message for unknown errors', () => {
    const msg = formatMicCaptureError(new Error('Something unexpected'));
    expect(msg).toContain('Microphone could not start');
    expect(msg).toContain('Something unexpected');
  });

  it('handles null error', () => {
    const msg = formatMicCaptureError(null);
    expect(msg).toContain('Microphone unavailable');
  });

  it('handles undefined error', () => {
    const msg = formatMicCaptureError(undefined);
    expect(msg).toContain('Microphone unavailable');
  });

  it('handles string error', () => {
    const msg = formatMicCaptureError('audio failure');
    expect(msg).toContain('audio failure');
  });

  it('handles number error', () => {
    const msg = formatMicCaptureError(42);
    expect(msg).toContain('42');
  });

  it('uses custom retry action', () => {
    const msg = formatMicCaptureError(new Error('permission denied'), 'restart the app');
    expect(msg).toContain('restart the app');
  });

  it('handles empty object error', () => {
    const msg = formatMicCaptureError({});
    expect(msg).toContain('Microphone could not start');
  });

  it('handles object with non-string name', () => {
    const msg = formatMicCaptureError({ name: 123, message: 'test error' });
    expect(msg).toContain('test error');
  });

  it('handles object with non-string message', () => {
    const msg = formatMicCaptureError({ name: 'Error', message: 456 });
    expect(msg).toContain('Microphone could not start');
  });
});
