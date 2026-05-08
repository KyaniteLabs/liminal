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

export function combineAbortSignals(...signals: (AbortSignal | undefined)[]): AbortSignal | undefined {
  const activeSignals = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (activeSignals.length === 0) return undefined;
  if (activeSignals.length === 1) return activeSignals[0];

  const abortSignal = AbortSignal as typeof AbortSignal & {
    any?: (signals: AbortSignal[]) => AbortSignal;
  };
  if (typeof abortSignal.any === 'function') {
    return abortSignal.any(activeSignals);
  }

  const controller = new AbortController();
  const listeners = new Map<AbortSignal, () => void>();
  const abortFrom = (signal: AbortSignal) => {
    for (const [activeSignal, listener] of listeners) {
      activeSignal.removeEventListener('abort', listener);
    }
    if (!controller.signal.aborted) {
      controller.abort(signal.reason);
    }
  };

  for (const signal of activeSignals) {
    if (signal.aborted) {
      abortFrom(signal);
      break;
    }

    const listener = () => abortFrom(signal);
    listeners.set(signal, listener);
    signal.addEventListener('abort', listener, { once: true });
  }

  return controller.signal;
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
