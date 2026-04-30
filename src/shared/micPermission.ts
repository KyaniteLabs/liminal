export function formatMicCaptureError(err: unknown, retryAction = 'try again'): string {
  let name = '';
  let message = '';
  if (typeof err === 'object' && err !== null) {
    if ('name' in err) {
      const value = Reflect.get(err, 'name');
      if (typeof value === 'string') name = value;
    }
    if ('message' in err) {
      const value = Reflect.get(err, 'message');
      if (typeof value === 'string') message = value;
    }
  }
  if (!message) message = String(err || 'Microphone unavailable');
  if (name === 'NotAllowedError' || /permission|denied|not allowed/i.test(message)) {
    return 'Microphone permission was denied. Allow microphone access in the browser, then ' + retryAction + '.';
  }
  if (name === 'NotFoundError' || /not found|no device/i.test(message)) {
    return 'No microphone was found. Connect or enable a microphone, then ' + retryAction + '.';
  }
  if (name === 'NotReadableError' || /in use|could not start/i.test(message)) {
    return 'The microphone is already in use or unavailable. Close other audio apps and try again.';
  }
  return 'Microphone could not start: ' + message;
}
