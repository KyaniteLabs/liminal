export class AbortError extends Error {
  constructor(message = 'Operation aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && (
    error.name === 'AbortError' ||
    error.message === 'Generation aborted' ||
    error.message === 'Operation aborted'
  );
}

export function abortError(signal?: AbortSignal): AbortError {
  const reason = signal?.reason;
  if (reason instanceof Error) {
    const error = new AbortError(reason.message || 'Operation aborted');
    error.stack = reason.stack;
    return error;
  }
  return new AbortError(typeof reason === 'string' && reason ? reason : 'Operation aborted');
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw abortError(signal);
  }
}

export async function abortable<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  if (!signal) return operation;

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(abortError(signal));
    };
    const cleanup = () => {
      signal.removeEventListener('abort', onAbort);
    };

    signal.addEventListener('abort', onAbort, { once: true });
    operation.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}
