/**
 * Compatibility stub for the removed Remotion renderer path.
 *
 * This keeps historical imports explicit and fails with a clear message instead
 * of a missing-module or missing-method error.
 */

function removedError(action: string): Error {
  return new Error(
    `Remotion rendering support has been removed from the active product surface. ` +
      `${action} is no longer available in mainline.`
  );
}

export class RemotionRenderer {
  constructor(_options?: unknown) {}

  writeEntryPoint(): Promise<never> {
    throw removedError('Entry point generation');
  }

  renderToVideo(): Promise<never> {
    throw removedError('Video rendering');
  }

  getCompositionConfig(): never {
    throw removedError('Composition config access');
  }
}
