import { processPoseWorkerFrame } from './PoseWorkerCore';

type PoseWorkerMessage =
  | { type: 'frame'; imageData: ImageData; capturedAt: number }
  | { type: 'reset' };

let previousData: Uint8ClampedArray | null = null;

self.onmessage = (event: MessageEvent<PoseWorkerMessage>) => {
  if (event.data.type === 'reset') {
    previousData = null;
    return;
  }

  const result = processPoseWorkerFrame(event.data, previousData);
  previousData = result.nextPreviousData;
  self.postMessage({ type: 'movement-frame', frame: result.frame });
};
