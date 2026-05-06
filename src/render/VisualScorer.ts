/**
 * VisualScorer - Analyze screenshot for visual quality
 *
 * Provides metrics for:
 * - Color variety (color histogram entropy)
 * - Edge complexity (Sobel edge detection)
 * - Composition balance
 * - Brightness/contrast
 */

import { analyzeDecodedPixels, decodeImagePixels } from './DecodedImageVisibility.js';

export interface VisualScoreResult {
  /** Overall visual quality score (0-1) */
  score: number;
  /** Color variety score (0-1) */
  colorVariety: number;
  /** Edge complexity score (0-1) */
  edgeComplexity: number;
  /** Composition balance score (0-1) */
  composition: number;
  /** Brightness/contrast score (0-1) */
  contrast: number;
  /** Detailed metrics */
  metrics: {
    uniqueColors: number;
    edgeDensity: number;
    brightnessMean: number;
    brightnessStd: number;
  };
  /** Non-fatal warnings explaining degraded or skipped visual scoring */
  warnings?: string[];
}

export interface VisualScorerOptions {
  /** Weight for color variety in final score */
  colorWeight?: number;
  /** Weight for edge complexity in final score */
  edgeWeight?: number;
  /** Weight for composition in final score */
  compositionWeight?: number;
  /** Weight for contrast in final score */
  contrastWeight?: number;
}

const DEFAULT_OPTIONS: Required<VisualScorerOptions> = {
  colorWeight: 0.25,
  edgeWeight: 0.25,
  compositionWeight: 0.25,
  contrastWeight: 0.25,
};

/**
 * Visual quality scorer for rendered outputs
 */
export class VisualScorer {
  private options: Required<VisualScorerOptions>;

  constructor(options: VisualScorerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Score a screenshot buffer for visual quality
   */
  async score(screenshotBuffer: Buffer): Promise<VisualScoreResult> {
    try {
      // Validate buffer
      if (!screenshotBuffer || screenshotBuffer.length < 16) {
        return this.getEmptyResult('Visual scoring skipped: screenshot buffer too small');
      }

      // Decode actual image pixels. Fail closed if the screenshot cannot be decoded.
      const { width, height, data } = await decodeImagePixels(screenshotBuffer);

      // Validate parsed data
      if (!data || data.length === 0 || width === 0 || height === 0) {
        return this.getEmptyResult('Visual scoring skipped: decoded image data unavailable');
      }

      const visibility = analyzeDecodedPixels({ width, height, data });
      if (!visibility.hasVisibleContent) {
        return this.getEmptyResult(`Visual scoring skipped: ${visibility.reason ?? 'decoded screenshot lacks visible content'}`);
      }

      // Calculate metrics
      const colorVariety = this.clamp(this.calculateColorVariety(data));
      const edgeComplexity = this.clamp(this.calculateEdgeComplexity(data, width, height));
      const composition = this.clamp(this.calculateComposition(data, width, height));
      const contrast = this.clamp(this.calculateContrast(data));

      // Calculate weighted final score
      const rawScore = 
        this.options.colorWeight * colorVariety +
        this.options.edgeWeight * edgeComplexity +
        this.options.compositionWeight * composition +
        this.options.contrastWeight * contrast;

      const score = this.clamp(rawScore);

      return {
        score,
        colorVariety,
        edgeComplexity,
        composition,
        contrast,
        metrics: {
          uniqueColors: this.countUniqueColors(data),
          edgeDensity: edgeComplexity,
          brightnessMean: this.calculateBrightnessMean(data),
          brightnessStd: this.calculateBrightnessStd(data),
        },
      };
    } catch (error) {
      // Return low score on error
      return this.getEmptyResult(`Visual scoring failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Get empty/default result
   */
  private getEmptyResult(warning?: string): VisualScoreResult {
    return {
      score: 0,
      colorVariety: 0,
      edgeComplexity: 0,
      composition: 0,
      contrast: 0,
      metrics: {
        uniqueColors: 0,
        edgeDensity: 0,
        brightnessMean: 0,
        brightnessStd: 0,
      },
      warnings: warning ? [warning] : undefined,
    };
  }

  /**
   * Clamp value to 0-1 range, handling NaN
   */
  private clamp(value: number): number {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  }

  /**
   * Calculate color variety based on unique colors
   */
  private calculateColorVariety(data: Uint8Array): number {
    const uniqueColors = this.countUniqueColors(data);
    // Normalize: more unique colors = higher variety
    // Cap at 1000 unique colors for maximum score
    return Math.min(uniqueColors / 1000, 1);
  }

  /**
   * Count unique colors in the image
   */
  private countUniqueColors(data: Uint8Array): number {
    const colorSet = new Set<number>();
    
    for (let i = 0; i < data.length; i += 4) {
      // Create a simple hash from RGB values
      const r = data[i] || 0;
      const g = data[i + 1] || 0;
      const b = data[i + 2] || 0;
      const colorHash = (r << 16) | (g << 8) | b;
      colorSet.add(colorHash);
      
      // Limit set size for performance
      if (colorSet.size > 10000) break;
    }
    
    return colorSet.size;
  }

  /**
   * Calculate edge complexity using simplified gradient detection
   */
  private calculateEdgeComplexity(data: Uint8Array, width: number, height: number): number {
    if (width < 2 || height < 2) return 0;
    
    let edgeCount = 0;
    let totalSamples = 0;
    
    // Sample pixels and detect edges
    const samplesPerRow = Math.min(width, 100);
    const samplesPerCol = Math.min(height, 100);
    const stepX = Math.floor(width / samplesPerRow);
    const stepY = Math.floor(height / samplesPerCol);
    
    for (let y = 1; y < height - 1; y += stepY) {
      for (let x = 1; x < width - 1; x += stepX) {
        const idx = (y * width + x) * 4;
        const rightIdx = (y * width + (x + 1)) * 4;
        const downIdx = ((y + 1) * width + x) * 4;
        
        // Calculate grayscale values
        const gray = this.toGrayscale(data[idx], data[idx + 1], data[idx + 2]);
        const grayRight = this.toGrayscale(data[rightIdx], data[rightIdx + 1], data[rightIdx + 2]);
        const grayDown = this.toGrayscale(data[downIdx], data[downIdx + 1], data[downIdx + 2]);
        
        // Simple gradient magnitude
        const dx = Math.abs(gray - grayRight);
        const dy = Math.abs(gray - grayDown);
        const gradient = Math.sqrt(dx * dx + dy * dy);
        
        // Threshold for edge detection
        if (gradient > 30) {
          edgeCount++;
        }
        totalSamples++;
      }
    }
    
    // Normalize edge density
    const edgeDensity = totalSamples > 0 ? edgeCount / totalSamples : 0;
    
    // Ideal edge density is around 10-20%
    if (edgeDensity < 0.05) return edgeDensity * 10; // Too few edges
    if (edgeDensity > 0.3) return Math.max(0, 1 - (edgeDensity - 0.3) * 2); // Too many edges
    return 1; // Good edge density
  }

  /**
   * Calculate composition balance (symmetry and distribution)
   */
  private calculateComposition(data: Uint8Array, width: number, height: number): number {
    if (width < 2 || height < 2) return 0;
    
    // Divide image into quadrants and compare
    const halfW = Math.floor(width / 2);
    const halfH = Math.floor(height / 2);
    
    const quadrantSums = [0, 0, 0, 0];
    const quadrantCounts = [0, 0, 0, 0];
    
    // Sample pixels
    const step = Math.max(1, Math.floor(width / 50));
    
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const gray = this.toGrayscale(data[idx], data[idx + 1], data[idx + 2]);
        
        const qx = x < halfW ? 0 : 1;
        const qy = y < halfH ? 0 : 1;
        const q = qx + qy * 2;
        
        quadrantSums[q] += gray;
        quadrantCounts[q]++;
      }
    }
    
    // Calculate quadrant averages
    const quadrantAvgs = quadrantSums.map((sum, i) => 
      quadrantCounts[i] > 0 ? sum / quadrantCounts[i] : 0
    );
    
    // Calculate balance (lower variance = more balanced)
    const mean = quadrantAvgs.reduce((a, b) => a + b, 0) / 4;
    const variance = quadrantAvgs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / 4;
    
    // Normalize: perfect balance = 1, high variance = lower score
    const balance = Math.max(0, 1 - variance / 65025); // 255^2 = 65025
    
    // Also check if image has content (not all black/white)
    const hasContent = mean > 10 && mean < 245;
    
    return hasContent ? balance : balance * 0.5;
  }

  /**
   * Calculate contrast (standard deviation of brightness)
   */
  private calculateContrast(data: Uint8Array): number {
    const std = this.calculateBrightnessStd(data);
    
    // Normalize std to 0-1 range (255 is max possible std)
    
    // Ideal contrast has some variation but not extreme
    // Prefer std between 20 and 100
    if (std < 10) return std / 10 * 0.3; // Too low contrast
    if (std > 100) return Math.max(0.5, 1 - (std - 100) / 155); // Too high contrast
    return 0.7 + (std - 20) / 80 * 0.3; // Good contrast range
  }

  /**
   * Calculate mean brightness
   */
  private calculateBrightnessMean(data: Uint8Array): number {
    if (data.length === 0) return 0;
    
    let sum = 0;
    const samples = Math.max(1, Math.min(Math.floor(data.length / 4), 10000));
    const step = Math.max(1, Math.floor(data.length / 4 / samples));
    
    for (let i = 0; i < data.length; i += 4 * step) {
      sum += this.toGrayscale(data[i] || 0, data[i + 1] || 0, data[i + 2] || 0);
    }
    
    return samples > 0 ? sum / samples : 0;
  }

  /**
   * Calculate brightness standard deviation
   */
  private calculateBrightnessStd(data: Uint8Array): number {
    if (data.length === 0) return 0;
    
    const mean = this.calculateBrightnessMean(data);
    let sumSq = 0;
    const samples = Math.max(1, Math.min(Math.floor(data.length / 4), 10000));
    const step = Math.max(1, Math.floor(data.length / 4 / samples));
    let count = 0;
    
    for (let i = 0; i < data.length; i += 4 * step) {
      const gray = this.toGrayscale(data[i] || 0, data[i + 1] || 0, data[i + 2] || 0);
      const diff = gray - mean;
      sumSq += diff * diff;
      count++;
    }
    
    return count > 0 ? Math.sqrt(sumSq / count) : 0;
  }

  /**
   * Convert RGB to grayscale
   */
  private toGrayscale(r: number, g: number, b: number): number {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }
}

export default VisualScorer;
