/**
 * Domain-aware code-completeness check.
 *
 * Replaces two naive brace-counting copies (RalphLoop.isCodeComplete and
 * LLMClient.isCodeComplete) with a single shared, domain-aware helper.
 *
 * The naive check only counted balanced braces/parens. That is domain-blind:
 *   - A balanced-but-truncated sketch (e.g. a p5 file with no draw()) passed.
 *   - Non-brace domains (svg/html/ascii/textgen) were judged by a heuristic
 *     that does not apply to them.
 *
 * This helper keeps a universal structural balance check and layers a minimal,
 * domain-appropriate terminal-marker check on top. It is intentionally NOT a
 * parser — just enough structure to catch "balanced but obviously truncated".
 */

/** Domains whose completion is judged by the same strategy. */
type CompletionFamily = 'brace' | 'glsl' | 'audio' | 'markup' | 'text' | 'structural';

function classifyDomain(domain?: string): CompletionFamily {
  const d = String(domain ?? '').toLowerCase().trim();
  switch (d) {
    case 'p5':
    case 'three':
    case 'hydra':
    case 'revideo':
    case 'hyperframes':
      return 'brace';
    case 'glsl':
    case 'shader':
    case 'webgl':
    case 'fragment':
      return 'glsl';
    case 'tone':
    case 'strudel':
    case 'music':
      return 'audio';
    case 'svg':
    case 'html':
      return 'markup';
    case 'ascii':
    case 'textgen':
    case 'kinetic':
      return 'text';
    default:
      // unknown / generic / code / empty / anything else
      return 'structural';
  }
}

/** Balanced braces, parens, and brackets — the universal base check. */
function bracketsBalanced(code: string): boolean {
  const count = (ch: string): number =>
    (code.match(new RegExp(`\\${ch}`, 'g')) || []).length;
  return (
    count('{') === count('}') &&
    count('(') === count(')') &&
    count('[') === count(']')
  );
}

/** Common mid-definition cutoff patterns (an open function/class body at EOF). */
function endsMidDefinition(code: string): boolean {
  const tail = code.trimEnd().slice(-200);
  const endsMidFunction = /function\s+\w+\s*\([^)]*\)\s*\{[^}]*$/.test(tail);
  const endsMidClass = /class\s+\w+.*\{[^}]*$/.test(tail);
  return endsMidFunction || endsMidClass;
}

/**
 * Decide whether `code` is structurally complete for the given `domain`.
 * When `domain` is omitted/unknown, falls back to the universal structural
 * (brace/paren/bracket balance + cutoff-pattern) check.
 */
export function isCodeComplete(code: string, domain?: string): boolean {
  const trimmed = code.trim();
  if (trimmed.length === 0) return false;

  const family = classifyDomain(domain);

  switch (family) {
    case 'brace': {
      // Balanced braces are necessary but not sufficient: a truncated sketch can
      // still be balanced. Require a recognizable runtime entry point.
      if (!bracketsBalanced(code) || endsMidDefinition(code)) return false;
      const hasEntryPoint =
        /\bsetup\s*\(/.test(code) || // p5
        /\bdraw\s*\(/.test(code) || // p5 / generic loop
        /\banimate\s*\(/.test(code) || // three / raf loop
        /requestAnimationFrame\s*\(/.test(code) ||
        /\.out\s*\(/.test(code); // hydra terminal
      return hasEntryPoint;
    }

    case 'glsl': {
      // A fragment shader is complete only with a main() entry and balanced braces.
      if (!bracketsBalanced(code)) return false;
      return /\bvoid\s+main\s*\(/.test(code) || /\bmainImage\s*\(/.test(code);
    }

    case 'audio': {
      // Strudel/Tone patterns terminate at an output/pattern sink. Parens must
      // balance, but braces are not required (most patterns use no blocks).
      const parensBalanced =
        (code.match(/\(/g) || []).length === (code.match(/\)/g) || []).length;
      if (!parensBalanced) return false;
      const hasTerminal =
        /\.out\s*\(/.test(code) || // strudel/hydra-style sink
        /\$:\s*/.test(code) || // strudel pattern slot
        /\.start\s*\(/.test(code) || // tone transport
        /\bplay\s*\(/.test(code); // generic playback
      return hasTerminal;
    }

    case 'markup': {
      // SVG/HTML are not brace-structured. Require a recognizable closing tag so a
      // truncated document (open tag with no close) is judged incomplete.
      const hasSvg = /<svg[\s>]/i.test(code) && /<\/svg>/i.test(code);
      const hasHtmlClose = /<\/(?:html|body|svg|div|g|canvas|path)>/i.test(code);
      const selfContainedSvg = /<svg[\s\S]*\/>/i.test(code);
      return hasSvg || hasHtmlClose || selfContainedSvg;
    }

    case 'text': {
      // ASCII/textgen/kinetic output is free-form text. The only real failure mode
      // is empty output; anything non-trivial is "complete".
      return trimmed.length > 0;
    }

    case 'structural':
    default: {
      // Unknown domain: fall back to the universal structural check.
      return bracketsBalanced(code) && !endsMidDefinition(code);
    }
  }
}
