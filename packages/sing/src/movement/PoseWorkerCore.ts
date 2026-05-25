import { extractMovementFeatures, type MovementFeatureFrame } from './MovementFeatures';

export interface PoseWorkerFramePayload {
  imageData: Pick<ImageData, 'width' | 'height' | 'data'>;
  capturedAt: number;
}

export interface PoseWorkerFrameResult {
  frame: MovementFeatureFrame;
  nextPreviousData: Uint8ClampedArray;
}

export function processPoseWorkerFrame(
  payload: PoseWorkerFramePayload,
  previousData: Uint8ClampedArray | null,
): PoseWorkerFrameResult {
  return {
    frame: extractMovementFeatures({
      width: payload.imageData.width,
      height: payload.imageData.height,
      data: payload.imageData.data,
      previousData,
      capturedAt: payload.capturedAt,
    }),
    nextPreviousData: new Uint8ClampedArray(payload.imageData.data),
  };
}
