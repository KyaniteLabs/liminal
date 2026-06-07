import { CodeValidator } from '../core/CodeValidator.js';
import { PostGenerationCognitiveWriter } from '../tui-bridge/PostGenerationCognitiveWriter.js';

interface CliGenerationResult {
  code: string;
  finalScore: number;
  iterations: number;
  model?: string;
  reason: string;
}

interface CognitiveWriterLike {
  writeBackGeneration(context: {
    sessionId: string;
    userText: string;
    domain: string;
    code: string;
    finalScore: number;
    iterations: number;
    model: string;
    reason: string;
    executionMode: 'draft' | 'prove';
  }): Promise<{
    artifactPath: string;
    episodeId?: string;
    receipts: Array<{ organ: string; status: 'observed' | 'pending' | 'unavailable'; detail: string }>;
  }>;
}

export async function writeCliCognitiveReceipt(options: {
  prompt: string;
  result: CliGenerationResult;
  writer?: CognitiveWriterLike;
  sessionId?: string;
}): Promise<string[]> {
  const writer = options.writer ?? new PostGenerationCognitiveWriter();
  const domain = CodeValidator.detectDomain(options.result.code);
  const writeBack = await writer.writeBackGeneration({
    sessionId: options.sessionId ?? `cli-${Date.now()}`,
    userText: options.prompt,
    domain,
    code: options.result.code,
    finalScore: options.result.finalScore,
    iterations: options.result.iterations,
    model: options.result.model || 'unknown',
    reason: options.result.reason,
    executionMode: 'prove',
  });

  return [
    '🧠 What Sinter learned:',
    ...writeBack.receipts.map((receipt) => `  ${receipt.organ}: ${receipt.status} — ${receipt.detail}`),
    `  artifact: ${writeBack.artifactPath}`,
  ];
}
