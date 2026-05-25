import { analyzeMovementPixels } from './features';
import type { MovementFeatures } from './features';

interface PoseWorkerInput {
  type: 'frame';
  tMs: number;
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

interface PoseWorkerOutput {
  type: 'pose_features';
  tMs: number;
  features: MovementFeatures;
  confidence: number;
}

let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;
let previousLuma: Uint8Array | undefined;

self.onmessage = (event: MessageEvent<PoseWorkerInput>) => {
  if (event.data.type !== 'frame') return;
  const width = Math.max(12, Math.min(64, Math.floor(event.data.width / 8) || 48));
  const height = Math.max(9, Math.min(48, Math.floor(event.data.height / 8) || 36));
  if (!canvas || canvas.width !== width || canvas.height !== height) {
    canvas = new OffscreenCanvas(width, height);
    context = canvas.getContext('2d', { willReadFrequently: true });
    previousLuma = undefined;
  }
  if (!context) {
    event.data.bitmap.close();
    return;
  }

  context.drawImage(event.data.bitmap, 0, 0, width, height);
  event.data.bitmap.close();
  const analysis = analyzeMovementPixels(context.getImageData(0, 0, width, height).data, width, height, previousLuma);
  previousLuma = analysis.luma;
  const output: PoseWorkerOutput = {
    type: 'pose_features',
    tMs: event.data.tMs,
    features: analysis.features,
    confidence: analysis.confidence,
  };
  self.postMessage(output);
};
