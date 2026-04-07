/**
 * NODEPROMPT — Spatial Prompt Engineering through Interactive Concept Graphs
 * Copyright (c) 2025-2026 Taewoo Park
 * Licensed under the MIT License — see THIRD_PARTY_NOTICES.md
 */

// ── Gesture tracking state for webcam hand tracking ──

export interface GestureState {
  active: boolean;
  handDetected: boolean;
  gestureName: string | null;         // MediaPipe gesture label
  gestureConfidence: number;          // 0-1

  // Pinch detection (with hysteresis)
  isPinching: boolean;
  pinchStrength: number;              // 0=open, 1=closed

  // Index finger tip position (NDC -1~1, webcam mirrored)
  indexTipNdcX: number;
  indexTipNdcY: number;

  // Palm size (for zoom)
  palmSize: number;
  palmSizeSmoothed: number;
  palmSizeBaseline: number;

  // Previous frame (for interpolation)
  prevIndexTipNdcX: number;
  prevIndexTipNdcY: number;
  prevPalmSizeSmoothed: number;

  lastUpdateMs: number;
  error: string | null;
}

export function createDefaultGestureState(): GestureState {
  return {
    active: false,
    handDetected: false,
    gestureName: null,
    gestureConfidence: 0,

    isPinching: false,
    pinchStrength: 0,

    indexTipNdcX: 0,
    indexTipNdcY: 0,

    palmSize: 0,
    palmSizeSmoothed: 0,
    palmSizeBaseline: 0,

    prevIndexTipNdcX: 0,
    prevIndexTipNdcY: 0,
    prevPalmSizeSmoothed: 0,

    lastUpdateMs: 0,
    error: null,
  };
}
