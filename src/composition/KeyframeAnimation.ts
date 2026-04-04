/**
 * Keyframe Animation System for Layer Properties
 *
 * Enables defining time-based animations for layer configurations
 * with interpolation and easing functions.
 */

import { LayerConfig } from './types.js';

/** Supported easing functions */
export type EasingFunction =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'bounce'
  | 'elastic'
  | 'back-in'
  | 'back-out';

/** A single keyframe defining properties at a specific time */
export interface Keyframe {
  /** Time position 0-1 (start to end) */
  time: number;

  /** Properties to apply at this time */
  properties: Partial<LayerConfig>;

  /** Easing function to use from this keyframe to the next */
  easing?: EasingFunction;
}

/** Animation configuration */
export interface Animation {
  /** Unique identifier */
  id: string;

  /** Target layer ID */
  layerId: string;

  /** Duration in milliseconds */
  duration: number;

  /** Keyframe definitions */
  keyframes: Keyframe[];

  /** Whether animation should loop */
  loop?: boolean;

  /** Whether animation should start automatically */
  autoplay?: boolean;
}

/** Options for creating an animation */
export interface AnimationOptions {
  loop?: boolean;
  autoplay?: boolean;
}

/** Internal state for playing animations */
interface AnimationState {
  animationId: string;
  startTime: number;
  pausedTime?: number;
  rafId?: number;
  isPlaying: boolean;
}

/**
 * Keyframe Animation System
 *
 * Manages creation, interpolation, and playback of keyframe animations
 * for layer properties.
 */
export class KeyframeAnimation {
  private animationStates = new Map<string, AnimationState>();
  private idCounter = 0;

  /**
   * Create a new animation for a layer.
   */
  createAnimation(
    layerId: string,
    duration: number,
    keyframes: Keyframe[],
    options?: AnimationOptions
  ): Animation {
    if (keyframes.length < 2) {
      throw new Error('At least 2 keyframes are required');
    }

    // Validate keyframe times
    for (const keyframe of keyframes) {
      if (keyframe.time < 0 || keyframe.time > 1) {
        throw new Error('Keyframe time must be between 0 and 1');
      }
    }

    // Sort keyframes by time
    const sortedKeyframes = [...keyframes].sort((a, b) => a.time - b.time);

    return {
      id: `anim_${++this.idCounter}_${Date.now()}`,
      layerId,
      duration,
      keyframes: sortedKeyframes,
      loop: options?.loop ?? false,
      autoplay: options?.autoplay ?? false,
    };
  }

  /**
   * Apply easing function to a time value.
   */
  applyEasing(t: number, easing: EasingFunction): number {
    switch (easing) {
      case 'linear':
        return t;

      case 'ease':
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      case 'ease-in':
        return t * t;

      case 'ease-out':
        return 1 - Math.pow(1 - t, 2);

      case 'bounce':
        return this.bounceEasing(t);

      case 'elastic':
        return this.elasticEasing(t);

      case 'back-in':
        return this.backInEasing(t);

      case 'back-out':
        return this.backOutEasing(t);

      default:
        throw new Error(`Unknown easing function: ${easing}`);
    }
  }

  /**
   * Interpolate properties at a given time position.
   */
  interpolate(animation: Animation, time: number): Partial<LayerConfig> {
    // Clamp time to 0-1 range
    const clampedTime = Math.max(0, Math.min(1, time));

    const { keyframes } = animation;

    // Handle duplicate times - use the last keyframe at each time
    const uniqueKeyframes: Keyframe[] = [];
    for (const kf of keyframes) {
      const existingIndex = uniqueKeyframes.findIndex(uk => uk.time === kf.time);
      if (existingIndex >= 0) {
        // Replace with newer keyframe at same time
        uniqueKeyframes[existingIndex] = kf;
      } else {
        uniqueKeyframes.push(kf);
      }
    }

    // Find the current segment
    let fromIndex = 0;
    for (let i = 0; i < uniqueKeyframes.length - 1; i++) {
      if (clampedTime >= uniqueKeyframes[i].time && clampedTime <= uniqueKeyframes[i + 1].time) {
        fromIndex = i;
        break;
      }
    }

    const fromKeyframe = uniqueKeyframes[fromIndex];
    const toKeyframe = uniqueKeyframes[fromIndex + 1] || uniqueKeyframes[uniqueKeyframes.length - 1];

    // Calculate local time within segment
    const segmentDuration = toKeyframe.time - fromKeyframe.time;
    const localTime = segmentDuration === 0 ? 0 : (clampedTime - fromKeyframe.time) / segmentDuration;

    // Apply easing
    const easing = fromKeyframe.easing || 'linear';
    const easedTime = this.applyEasing(localTime, easing);

    // Interpolate properties
    const result: Partial<LayerConfig> = {};
    const allProperties = new Set([
      ...Object.keys(fromKeyframe.properties),
      ...Object.keys(toKeyframe.properties),
    ]);

    for (const prop of allProperties) {
      const fromValue = fromKeyframe.properties[prop as keyof LayerConfig];
      const toValue = toKeyframe.properties[prop as keyof LayerConfig];

      if (fromValue !== undefined && toValue !== undefined) {
        (result as Record<string, unknown>)[prop] = this.interpolateValue(
          fromValue,
          toValue,
          easedTime
        );
      } else if (toValue !== undefined) {
        (result as Record<string, unknown>)[prop] = toValue;
      } else if (fromValue !== undefined) {
        (result as Record<string, unknown>)[prop] = fromValue;
      }
    }

    return result;
  }

  /**
   * Generate CSS @keyframes rule for the animation.
   */
  generateCSS(animation: Animation): string {
    const { id, duration, loop, keyframes } = animation;
    const animationName = `liminal-${id}`;

    // Generate keyframes
    let keyframesCSS = `@keyframes ${animationName} {\n`;

    for (const keyframe of keyframes) {
      const percentage = Math.round(keyframe.time * 100);
      const properties: string[] = [];

      // Convert properties to CSS
      if (keyframe.properties.opacity !== undefined) {
        properties.push(`    opacity: ${keyframe.properties.opacity};`);
      }

      // Handle position and scale as transform
      const transforms: string[] = [];
      if (keyframe.properties.position) {
        const { x, y } = keyframe.properties.position;
        transforms.push(`translate(${x}px, ${y}px)`);
      }
      if (keyframe.properties.scale !== undefined) {
        transforms.push(`scale(${keyframe.properties.scale})`);
      }
      if (transforms.length > 0) {
        properties.push(`    transform: ${transforms.join(' ')};`);
      }

      if (keyframe.properties.zIndex !== undefined) {
        properties.push(`    z-index: ${keyframe.properties.zIndex};`);
      }

      if (properties.length > 0) {
        keyframesCSS += `  ${percentage}% {\n${properties.join('\n')}\n  }\n`;
      }
    }

    keyframesCSS += '}';

    // Generate animation class
    const css = `${keyframesCSS}

.${animationName} {
  animation-name: ${animationName};
  animation-duration: ${duration}ms;
  animation-fill-mode: both;
  ${loop ? 'animation-iteration-count: infinite;' : ''}
}`;

    return css;
  }

  /**
   * Generate JavaScript code for the animation.
   */
  generateJS(animation: Animation): string {
    const { id, duration, keyframes, layerId } = animation;
    const loop = animation.loop ?? false;

    // Generate keyframe data
    const keyframesData = keyframes.map(k => ({
      time: k.time,
      properties: k.properties,
      easing: k.easing || 'linear',
    }));

    const js = `// Liminal Animation: ${id}
// Target layer: ${layerId}
// Duration: ${duration}ms

const keyframes = ${JSON.stringify(keyframesData, null, 2)};

function ease(t, easing) {
  switch (easing) {
    case 'linear': return t;
    case 'ease-in': return t * t;
    case 'ease-out': return 1 - Math.pow(1 - t, 2);
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'bounce':
      if (t < 1 / 2.75) return 7.5625 * t * t;
      if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
      if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    case 'elastic':
      if (t === 0) return 0;
      if (t === 1) return 1;
      return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
    case 'back-in':
      const c1 = 1.70158;
      return t * t * ((c1 + 1) * t - c1);
    case 'back-out':
      const c2 = 1.70158;
      return 1 + c2 * Math.pow(t - 1, 3) + c2 * Math.pow(t - 1, 2);
    default: return t;
  }
}

function interpolate(from, to, t, easing) {
  const easedT = ease(t, easing);
  
  if (typeof from === 'number' && typeof to === 'number') {
    return from + (to - from) * easedT;
  }
  
  if (typeof from === 'object' && typeof to === 'object') {
    const result = {};
    for (const key in from) {
      if (to[key] !== undefined) {
        result[key] = from[key] + (to[key] - from[key]) * easedT;
      }
    }
    return result;
  }
  
  return easedT < 0.5 ? from : to;
}

let startTime = null;
let rafId = null;
let isPlaying = false;
const shouldLoop = ${loop};

function animate(timestamp) {
  if (!startTime) startTime = timestamp;
  const elapsed = timestamp - startTime;
  const progress = Math.min(elapsed / ${duration}, 1);
  
  // Find current keyframe segment
  let fromIndex = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (progress >= keyframes[i].time && progress <= keyframes[i + 1].time) {
      fromIndex = i;
      break;
    }
  }
  
  const fromKeyframe = keyframes[fromIndex];
  const toKeyframe = keyframes[fromIndex + 1] || keyframes[keyframes.length - 1];
  
  const segmentDuration = toKeyframe.time - fromKeyframe.time;
  const localProgress = segmentDuration === 0 ? 0 : 
    (progress - fromKeyframe.time) / segmentDuration;
  
  // Apply properties
  const properties = {};
  for (const prop in fromKeyframe.properties) {
    if (toKeyframe.properties[prop] !== undefined) {
      properties[prop] = interpolate(
        fromKeyframe.properties[prop],
        toKeyframe.properties[prop],
        localProgress,
        fromKeyframe.easing || 'linear'
      );
    }
  }
  
  // Apply to layer (implement based on your layer system)
  // applyToLayer('${layerId}', properties);
  
  if (progress < 1) {
    rafId = requestAnimationFrame(animate);
  } else if (shouldLoop) {
    startTime = null;
    rafId = requestAnimationFrame(animate);
  } else {
    isPlaying = false;
  }
}

function play() {
  if (isPlaying) return;
  isPlaying = true;
  startTime = null;
  rafId = requestAnimationFrame(animate);
}

function pause() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  isPlaying = false;
}

function stop() {
  pause();
  startTime = null;
}

// Auto-play if enabled
${animation.autoplay ? 'play();' : '// play(); // Call to start animation'}
`;

    return js;
  }

  /**
   * Start playing an animation.
   */
  play(animation: Animation): void {
    // In a browser environment, use requestAnimationFrame
    if (typeof requestAnimationFrame !== 'undefined') {
      const existingState = this.animationStates.get(animation.id);
      
      if (existingState?.isPlaying) {
        return; // Already playing
      }

      const state: AnimationState = {
        animationId: animation.id,
        startTime: existingState?.pausedTime || Date.now(),
        isPlaying: true,
      };

      const animate = () => {
        if (!state.isPlaying) return;
        state.rafId = requestAnimationFrame(animate);
      };

      state.rafId = requestAnimationFrame(animate);
      this.animationStates.set(animation.id, state);
    }
  }

  /**
   * Pause an animation.
   */
  pause(animation: Animation): void {
    const state = this.animationStates.get(animation.id);
    if (state) {
      state.isPlaying = false;
      state.pausedTime = Date.now();
      if (state.rafId && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(state.rafId);
      }
      state.rafId = undefined;
    }
  }

  /**
   * Stop an animation and reset.
   */
  stop(animation: Animation): void {
    const state = this.animationStates.get(animation.id);
    if (state) {
      state.isPlaying = false;
      state.startTime = 0;
      state.pausedTime = undefined;
      if (state.rafId && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(state.rafId);
      }
      state.rafId = undefined;
    }
  }

  /**
   * Interpolate a single value based on type.
   */
  private interpolateValue<T>(from: T, to: T, t: number): T {
    // Handle position objects
    if (this.isPositionObject(from) && this.isPositionObject(to)) {
      return {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      } as T;
    }

    // Handle numbers
    if (typeof from === 'number' && typeof to === 'number') {
      return (from + (to - from) * t) as T;
    }

    // For other types (like blendMode), snap at midpoint
    return t < 0.5 ? from : to;
  }

  /**
   * Type guard for position objects.
   */
  private isPositionObject(value: unknown): value is { x: number; y: number } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'x' in value &&
      'y' in value &&
      typeof (value as { x: unknown }).x === 'number' &&
      typeof (value as { y: unknown }).y === 'number'
    );
  }

  /**
   * Bounce easing function.
   */
  private bounceEasing(t: number): number {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
  }

  /**
   * Elastic easing function.
   */
  private elasticEasing(t: number): number {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
  }

  /**
   * Back-in easing function (overshoot).
   */
  private backInEasing(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  }

  /**
   * Back-out easing function (overshoot).
   */
  private backOutEasing(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
}

export default KeyframeAnimation;
