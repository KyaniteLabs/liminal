/**
 * Blend Mode Utilities
 *
 * Provides mapping from Sinter blend modes to platform-specific
 * blend mode implementations:
 * - CSS mix-blend-mode for DOM layers
 * - Canvas globalCompositeOperation for 2D canvas
 * - WebGL blend functions for WebGL/Three.js
 */

import type { BlendMode } from '../types.js';

/**
 * WebGL blend constants (matches WebGLRenderingContext values)
 * Using numeric values to avoid browser dependency in Node.js
 */
const WebGLConstants = {
  ONE: 1,
  ZERO: 0,
  SRC_ALPHA: 0x0302,
  ONE_MINUS_SRC_ALPHA: 0x0303,
  DST_COLOR: 0x0306,
  ONE_MINUS_DST_COLOR: 0x0307,
  SRC_COLOR: 0x0300,
  ONE_MINUS_SRC_COLOR: 0x0301,
  DST_ALPHA: 0x0304,
  ONE_MINUS_DST_ALPHA: 0x0305,
  BLEND: 0x0be2,
} as const;

/**
 * Get CSS mix-blend-mode value for a blend mode.
 */
export function getCSSBlendMode(blendMode: BlendMode): string {
  // CSS mix-blend-mode uses the same names as our BlendMode type
  return blendMode;
}

/**
 * Get Canvas globalCompositeOperation value for a blend mode.
 */
export function getCanvasCompositeOp(blendMode: BlendMode): GlobalCompositeOperation {
  const mapping: Record<BlendMode, GlobalCompositeOperation> = {
    normal: 'source-over',
    multiply: 'multiply',
    screen: 'screen',
    overlay: 'overlay',
    darken: 'darken',
    lighten: 'lighten',
    difference: 'difference',
    exclusion: 'exclusion',
  };

  return mapping[blendMode];
}

/**
 * Get WebGL blend function parameters for a blend mode.
 * Returns source and destination blend factors.
 */
export function getWebGLBlendFunc(blendMode: BlendMode): { src: number; dst: number } {
  const { ONE, ZERO, SRC_ALPHA, ONE_MINUS_SRC_ALPHA, DST_COLOR, ONE_MINUS_SRC_COLOR } = WebGLConstants;

  switch (blendMode) {
    case 'normal':
      // Standard alpha blending: src * src_alpha + dst * (1 - src_alpha)
      return { src: SRC_ALPHA, dst: ONE_MINUS_SRC_ALPHA };

    case 'multiply':
      // Multiply: src * dst + dst * 0
      return { src: DST_COLOR, dst: ZERO };

    case 'screen':
      // Screen: src * (1 - dst) + dst * 1 = src + dst - src * dst
      return { src: ONE, dst: ONE_MINUS_SRC_COLOR };

    case 'overlay':
      // Overlay is complex - use approximation with existing blend modes
      // For simplicity, use similar to multiply but with alpha
      return { src: DST_COLOR, dst: ONE_MINUS_SRC_ALPHA };

    case 'darken':
      // Darken uses min(src, dst) - approximated with multiply-like blending
      return { src: ONE, dst: ONE };

    case 'lighten':
      // Lighten uses max(src, dst)
      return { src: ONE, dst: ONE };

    case 'difference':
      // Difference: |src - dst|
      // WebGL doesn't have native difference blending, use approximation
      return { src: ONE, dst: ONE };

    case 'exclusion':
      // Exclusion: similar to difference but lower contrast
      return { src: ONE, dst: ONE };

    default:
      // Fallback to normal blending
      return { src: SRC_ALPHA, dst: ONE_MINUS_SRC_ALPHA };
  }
}

/**
 * Type guard for HTMLElement
 */
function isHTMLElement(element: unknown): element is HTMLElement {
  return typeof HTMLElement !== 'undefined' && element instanceof HTMLElement;
}

/**
 * Type guard for CanvasRenderingContext2D
 * Uses duck typing for compatibility with test mocks
 */
function isCanvasRenderingContext2D(element: unknown): element is CanvasRenderingContext2D {
  if (typeof CanvasRenderingContext2D !== 'undefined' && element instanceof CanvasRenderingContext2D) {
    return true;
  }
  // Duck typing for test mocks
  return (
    typeof element === 'object' &&
    element !== null &&
    'globalCompositeOperation' in element
  );
}

/**
 * Type guard for WebGLRenderingContext
 * Uses duck typing for compatibility with test mocks
 */
function isWebGLRenderingContext(element: unknown): element is WebGLRenderingContext {
  if (typeof WebGLRenderingContext !== 'undefined' && element instanceof WebGLRenderingContext) {
    return true;
  }
  // Duck typing for test mocks
  return (
    typeof element === 'object' &&
    element !== null &&
    'enable' in element &&
    'blendFunc' in element &&
    typeof (element as WebGLRenderingContext).enable === 'function'
  );
}

/**
 * Apply blend mode to an element based on its type.
 *
 * @param element - The element to apply blend mode to
 * @param blendMode - The blend mode to apply
 * @param type - The type of element ('css', 'canvas', or 'webgl')
 */
export function applyBlendMode(
  element: HTMLElement | CanvasRenderingContext2D | WebGLRenderingContext,
  blendMode: BlendMode,
  type: 'css' | 'canvas' | 'webgl'
): void {
  switch (type) {
    case 'css': {
      if (!isHTMLElement(element)) {
        throw new Error('Expected HTMLElement for CSS blend mode');
      }
      const cssMode = getCSSBlendMode(blendMode);
      element.style.mixBlendMode = cssMode;
      break;
    }

    case 'canvas': {
      if (!isCanvasRenderingContext2D(element)) {
        throw new Error('Expected CanvasRenderingContext2D for canvas blend mode');
      }
      const compositeOp = getCanvasCompositeOp(blendMode);
      element.globalCompositeOperation = compositeOp;
      break;
    }

    case 'webgl': {
      if (!isWebGLRenderingContext(element)) {
        throw new Error('Expected WebGLRenderingContext for WebGL blend mode');
      }
      const { src, dst } = getWebGLBlendFunc(blendMode);
      element.enable(element.BLEND);
      element.blendFunc(src, dst);
      break;
    }

    default:
      throw new Error(`Unknown blend mode type: ${type}`);
  }
}
