/**
 * CompostShredder — chops extracted material into fragments.
 * Dispatches by layer (semantic, structured, raw).
 */

import crypto from 'node:crypto';
import type { CompostFragment, ExtractionResult, FragmentMetadata, RawByteData } from './types.js';
import type { LIRToken, LIRCodeToken, LIRDocToken, LIRTextToken } from '../core/lir/types.js';

/** Minimum file size in bytes for multi-fragment splitting. */
const SMALL_FILE_THRESHOLD = 1024;

export class CompostShredder {
  /** Generate a deterministic fragment ID from content + source. */
  private static fragmentId(source: string, content: string, index: number): string {
    const hash = crypto.createHash('sha256')
      .update(`${source}:${index}:${content.slice(0, 200)}`)
      .digest('hex')
      .slice(0, 12);
    return `frag-${hash}`;
  }

  /** Detect domain from file path and content. */
  private static detectDomain(source: string, _content: string): string {
    const ext = source.split('.').pop()?.toLowerCase() ?? '';
    const domainMap: Record<string, string> = {
      ts: 'code', tsx: 'code', js: 'code', jsx: 'code',
      py: 'code', go: 'code', rs: 'code', java: 'code',
      glsl: 'shader', frag: 'shader', vert: 'shader',
      jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', gif: 'image',
      mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio', flac: 'audio',
      mp4: 'video', mov: 'video', avi: 'video', mkv: 'video',
      stl: '3d', obj: '3d', glb: '3d', gltf: '3d',
      md: 'text', txt: 'text', json: 'text', yaml: 'text', yml: 'text',
    };
    return domainMap[ext] ?? 'unknown';
  }

  /** Shred semantic text content by paragraph or heading. */
  static shredSemantic(text: string, source: string, domain: string): CompostFragment[] {
    if (!text.trim()) return [];

    // Split by double newlines (paragraphs) or markdown headings
    const sections = text.split(/\n(?=##?\s)/).length > 1
      ? text.split(/\n(?=##?\s)/)
      : text.split(/\n\s*\n/);

    const fragments: CompostFragment[] = [];
    for (let i = 0; i < sections.length; i++) {
      const content = sections[i].trim();
      if (!content) continue;

      fragments.push({
        id: this.fragmentId(source, content, i),
        source,
        domain,
        layer: 'semantic',
        content,
        metadata: {
          fileType: source.split('.').pop() ?? '',
          timestamp: new Date().toISOString(),
          hash: crypto.createHash('sha256').update(content).digest('hex'),
          size: content.length,
          extractedAt: new Date().toISOString(),
        },
        tags: [domain, 'semantic'],
      });
    }
    return fragments;
  }

  /** Shred code by function/class boundaries. */
  static shredCode(code: string, source: string, language: string): CompostFragment[] {
    if (code.length < SMALL_FILE_THRESHOLD) {
      return [{
        id: this.fragmentId(source, code, 0),
        source,
        domain: 'code',
        layer: 'semantic',
        content: code,
        metadata: {
          fileType: source.split('.').pop() ?? '',
          timestamp: new Date().toISOString(),
          hash: crypto.createHash('sha256').update(code).digest('hex'),
          size: code.length,
          extractedAt: new Date().toISOString(),
          language,
        },
        tags: ['code', language, 'semantic'],
      }];
    }

    // Split by function/class declarations
    const pattern = /(?=(?:export\s+)?(?:async\s+)?(?:function|class)\s+\w+)/g;
    const splits = code.split(pattern).filter(s => s.trim());
    const fragments: CompostFragment[] = [];

    for (let i = 0; i < splits.length; i++) {
      const content = splits[i].trim();
      if (!content) continue;
      fragments.push({
        id: this.fragmentId(source, content, i),
        source,
        domain: 'code',
        layer: 'semantic',
        content,
        metadata: {
          fileType: source.split('.').pop() ?? '',
          timestamp: new Date().toISOString(),
          hash: crypto.createHash('sha256').update(content).digest('hex'),
          size: content.length,
          extractedAt: new Date().toISOString(),
          language,
        },
        tags: ['code', language, 'semantic'],
      });
    }
    return fragments;
  }

  /** Shred structured metadata — each field becomes a fragment. */
  static shredMetadata(metadata: FragmentMetadata, source: string): CompostFragment[] {
    const fragments: CompostFragment[] = [];
    const entries = Object.entries(metadata).filter(([key]) => key !== 'extractedAt' && key !== 'timestamp');

    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      const content = typeof value === 'object' ? JSON.stringify(value) : String(value);
      fragments.push({
        id: this.fragmentId(source, `${key}:${content}`, i),
        source,
        domain: 'metadata',
        layer: 'structured',
        content: `${key}: ${content}`,
        metadata: {
          fileType: metadata.fileType,
          timestamp: metadata.timestamp,
          hash: metadata.hash,
          size: metadata.size,
          extractedAt: metadata.extractedAt,
        },
        tags: ['metadata', key],
      });
    }
    return fragments;
  }

  /** Shred raw bytes — each hex chunk becomes a fragment. */
  static shredRawBytes(raw: RawByteData, source: string): CompostFragment[] {
    return raw.hexChunks.map((chunk, i) => ({
      id: this.fragmentId(source, chunk, i),
      source,
      domain: 'raw',
      layer: 'raw',
      content: chunk,
      metadata: {
        fileType: source.split('.').pop() ?? '',
        timestamp: new Date().toISOString(),
        hash: raw.sha256,
        size: raw.size,
        extractedAt: new Date().toISOString(),
      },
      tags: ['raw', `chunk-${i}`],
    }));
  }

  /** Build a base metadata object for LIR-derived fragments. */
  private static lirMeta(source: string, extra?: Record<string, unknown>): FragmentMetadata {
    return {
      fileType: source.split('.').pop() ?? '',
      timestamp: new Date().toISOString(),
      hash: '',
      size: 0,
      extractedAt: new Date().toISOString(),
      ...extra,
    };
  }

  /** Shred an LIR code token into one fragment per symbol. */
  private static shredCodeToken(token: LIRCodeToken, source: string): CompostFragment[] {
    const domain = 'code';
    const content = [
      `// Symbol: ${token.kind} ${token.name}`,
      token.signature,
      '',
      token.summary,
      '',
      token.source,
    ].join('\n');

    return [{
      id: this.fragmentId(source, content, 0),
      source,
      domain,
      layer: 'structured',
      content,
      metadata: this.lirMeta(source, {
        language: token.language,
        symbolKind: token.kind,
        loc: token.metrics.loc,
        cyclomaticComplexity: token.metrics.cyclomaticComplexity,
        startLine: token.location.startLine,
        endLine: token.location.endLine,
      }),
      tags: [domain, token.kind, 'structured'],
    }];
  }

  /** Shred an LIR doc token into one fragment per section. */
  private static shredDocToken(token: LIRDocToken, source: string): CompostFragment[] {
    const domain = 'doc';
    const content = [
      `# ${token.heading}`,
      '',
      token.content,
    ].join('\n');

    return [{
      id: this.fragmentId(source, content, 0),
      source,
      domain,
      layer: 'structured',
      content,
      metadata: this.lirMeta(source, {
        heading: token.heading,
        level: token.level,
        wordCount: token.metrics.wordCount,
        depth: token.metrics.depth,
      }),
      tags: [domain, `h${token.level}`, 'structured'],
    }];
  }

  /** Shred an LIR text token into one fragment per paragraph/heading. */
  private static shredTextToken(token: LIRTextToken, source: string): CompostFragment[] {
    const domain = 'text';
    const fragments: CompostFragment[] = [];
    const sections = token.content.split(/\n\s*\n+/).filter(s => s.trim());

    for (let i = 0; i < sections.length; i++) {
      const content = sections[i].trim();
      if (!content) continue;
      fragments.push({
        id: this.fragmentId(source, content, i),
        source,
        domain,
        layer: 'structured',
        content,
        metadata: this.lirMeta(source, {
          wordCount: content.split(/\s+/).filter(Boolean).length,
        }),
        tags: [domain, 'structured'],
      });
    }
    return fragments;
  }

  /** Shred an LIR token into structured fragments based on token type. */
  static shredLIR(lir: LIRToken, source: string): CompostFragment[] {
    switch (lir.type) {
      case 'code':
        return this.shredCodeToken(lir, source);
      case 'doc':
        return this.shredDocToken(lir, source);
      case 'text':
        return this.shredTextToken(lir, source);
    }
  }

  /** Auto-detect layer and shred an extraction result. */
  static shredFile(result: ExtractionResult): CompostFragment[] {
    // If LIR token is available, use LIR-aware shredding
    if (result.lir) {
      return this.shredLIR(result.lir, result.filePath);
    }

    const fragments: CompostFragment[] = [];
    const domain = this.detectDomain(result.filePath, result.semantic ?? '');

    // Semantic layer
    if (result.semantic) {
      const ext = result.filePath.split('.').pop()?.toLowerCase() ?? '';
      const codeExts = ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'kt', 'rb', 'php', 'swift', 'c', 'cpp'];
      if (codeExts.includes(ext)) {
        fragments.push(...this.shredCode(result.semantic, result.filePath, result.metadata.language ?? ext));
      } else {
        fragments.push(...this.shredSemantic(result.semantic, result.filePath, domain));
      }
    }

    return fragments;
  }

  /** Process a batch of extraction results into a flat fragment array. Caps at maxFragments. */
  static shredAll(results: ExtractionResult[], maxFragments = 2000): CompostFragment[] {
    const all = results.flatMap(r => this.shredFile(r));
    return all.length > maxFragments ? all.slice(0, maxFragments) : all;
  }
}
