export interface DecodedImagePixels {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface PixelVisibilityAnalysis {
  hasVisibleContent: boolean;
  reason?: string;
  width: number;
  height: number;
  sampledPixels: number;
  opaquePixels: number;
  visibleRatio: number;
  uniqueColors: number;
  brightnessStd: number;
}

type SharpPipeline = {
  ensureAlpha(): SharpPipeline;
  raw(): SharpPipeline;
  toBuffer(options: { resolveWithObject: true }): Promise<{
    data: Buffer;
    info: {
      width?: number;
      height?: number;
      channels?: number;
    };
  }>;
};

type SharpFactory = (input: Buffer | Uint8Array) => SharpPipeline;

let sharpFactoryPromise: Promise<SharpFactory | null> | null = null;

async function getSharpFactory(): Promise<SharpFactory | null> {
  if (!sharpFactoryPromise) {
    sharpFactoryPromise = import('sharp')
      .then((mod) => {
        const candidate = (mod as { default?: unknown }).default ?? mod;
        return typeof candidate === 'function' ? candidate as SharpFactory : null;
      })
      .catch(() => null);
  }
  return sharpFactoryPromise;
}

export async function decodeImagePixels(buffer: Buffer): Promise<DecodedImagePixels> {
  const sharp = await getSharpFactory();
  if (!sharp) {
    throw new Error('sharp decoder unavailable');
  }

  const decoded = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = decoded.info.width ?? 0;
  const height = decoded.info.height ?? 0;

  if (width <= 0 || height <= 0 || decoded.data.length === 0) {
    throw new Error('decoded image data unavailable');
  }

  return {
    width,
    height,
    data: decoded.data,
  };
}

export async function analyzeScreenshotBuffer(buffer: Buffer): Promise<PixelVisibilityAnalysis> {
  try {
    const decoded = await decodeImagePixels(buffer);
    return analyzeDecodedPixels(decoded);
  } catch (error) {
    return emptyAnalysis(`decoded image data unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

export async function analyzeScreenshotBase64(dataBase64: string | undefined): Promise<PixelVisibilityAnalysis> {
  if (!dataBase64 || !dataBase64.trim()) {
    return emptyAnalysis('screenshot image data is missing');
  }
  return analyzeScreenshotBuffer(Buffer.from(dataBase64, 'base64'));
}

export function analyzeDecodedPixels(decoded: DecodedImagePixels): PixelVisibilityAnalysis {
  const pixelCount = decoded.width * decoded.height;
  if (pixelCount <= 0 || decoded.data.length < pixelCount * 4) {
    return emptyAnalysis('decoded image data unavailable', decoded.width, decoded.height);
  }

  const maxSamples = 10_000;
  const step = Math.max(1, Math.floor(pixelCount / maxSamples));
  const colors = new Set<number>();
  let sampledPixels = 0;
  let opaquePixels = 0;
  let brightnessSum = 0;
  let brightnessSumSq = 0;

  for (let pixel = 0; pixel < pixelCount; pixel += step) {
    const idx = pixel * 4;
    sampledPixels++;

    const alpha = decoded.data[idx + 3] ?? 255;
    if (alpha <= 8) {
      continue;
    }

    opaquePixels++;
    const r = decoded.data[idx] ?? 0;
    const g = decoded.data[idx + 1] ?? 0;
    const b = decoded.data[idx + 2] ?? 0;
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    brightnessSum += brightness;
    brightnessSumSq += brightness * brightness;
    colors.add((r << 16) | (g << 8) | b);
  }

  const visibleRatio = sampledPixels > 0 ? opaquePixels / sampledPixels : 0;
  const brightnessMean = opaquePixels > 0 ? brightnessSum / opaquePixels : 0;
  const brightnessVariance = opaquePixels > 0 ? Math.max(0, brightnessSumSq / opaquePixels - brightnessMean * brightnessMean) : 0;
  const brightnessStd = Math.sqrt(brightnessVariance);

  if (opaquePixels === 0 || visibleRatio < 0.01) {
    return {
      ...baseAnalysis(decoded.width, decoded.height, sampledPixels, opaquePixels, visibleRatio, colors.size, brightnessStd),
      hasVisibleContent: false,
      reason: 'decoded screenshot is transparent',
    };
  }

  if (colors.size <= 1 || brightnessStd < 0.5) {
    return {
      ...baseAnalysis(decoded.width, decoded.height, sampledPixels, opaquePixels, visibleRatio, colors.size, brightnessStd),
      hasVisibleContent: false,
      reason: 'decoded screenshot is blank or solid',
    };
  }

  return {
    ...baseAnalysis(decoded.width, decoded.height, sampledPixels, opaquePixels, visibleRatio, colors.size, brightnessStd),
    hasVisibleContent: true,
  };
}

function emptyAnalysis(reason: string, width = 0, height = 0): PixelVisibilityAnalysis {
  return {
    hasVisibleContent: false,
    reason,
    width,
    height,
    sampledPixels: 0,
    opaquePixels: 0,
    visibleRatio: 0,
    uniqueColors: 0,
    brightnessStd: 0,
  };
}

function baseAnalysis(
  width: number,
  height: number,
  sampledPixels: number,
  opaquePixels: number,
  visibleRatio: number,
  uniqueColors: number,
  brightnessStd: number,
): Omit<PixelVisibilityAnalysis, 'hasVisibleContent' | 'reason'> {
  return {
    width,
    height,
    sampledPixels,
    opaquePixels,
    visibleRatio,
    uniqueColors,
    brightnessStd,
  };
}
