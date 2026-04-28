/**
 * PromptEnhancer for cross-layer integration.
 *
 * Extracts context from existing layers, formats it for LLM consumption,
 * and generates integration instructions for combining different domains.
 *
 * @example
 * ```typescript
 * const enhancer = new PromptEnhancer();
 * const result = enhancer.enhance({
 *   existingLayers: [p5Layer, toneLayer],
 *   targetDomain: 'shader',
 *   integrationHints: ['Sync visuals to audio BPM']
 * });
 * // result.prompt - formatted prompt for LLM
 * // result.context - extracted context from existing layers
 * // result.instructions - integration instructions
 * ```
 */

import type { Layer, DomainType } from './types.js';

/**
 * Context for enhancing a prompt with cross-layer integration.
 */
export interface EnhancementContext {
  /** Existing layers to extract context from */
  existingLayers: Layer[];
  /** Target domain for the new layer */
  targetDomain: DomainType;
  /** Optional hints for how to integrate layers */
  integrationHints?: string[];
}

/**
 * Result of prompt enhancement with context and instructions.
 */
export interface EnhancedPrompt {
  /** The complete formatted prompt for LLM consumption */
  prompt: string;
  /** Extracted context from existing layers */
  context: string;
  /** Integration instructions for combining domains */
  instructions: string;
}

/**
 * Domain-specific integration patterns and suggestions.
 */
const DOMAIN_INTEGRATION_PATTERNS: Partial<Record<
  DomainType,
  Partial<Record<DomainType, string[]>>
>> = {
  p5: {
    tone: [
      'The audio should react to the mouse position from the p5 sketch',
      'Map visual elements to audio parameters like frequency and amplitude',
      'Use p5 drawing state to modulate sound synthesis',
    ],
    three: [
      'Use p5 for 2D UI overlay on top of the 3D scene',
      'Share mouse interaction between p5 and Three.js canvases',
      'Coordinate animation timing between both renderers',
    ],
    shader: [
      'Pass p5 canvas as a texture input to the shader',
      'Use p5 mouse coordinates to control shader uniforms',
      'Combine p5 generative art with post-processing effects',
    ],
    strudel: [
      'Sync the visual animation to the music pattern from Strudel',
      'Map Strudel pattern events to visual triggers in p5',
      'Use p5 to visualize the live coding music structure',
    ],
    hydra: [
      'Blend p5 output with Hydra video synthesis',
      'Use p5 as a source for Hydra feedback effects',
      'Coordinate timing between p5 animation and Hydra oscillators',
    ],
    ascii: [
      'Convert p5 canvas output to ASCII art representation',
      'Use p5 graphics as input for ASCII character mapping',
      'Create ASCII overlays on p5 generated visuals',
    ],
    html: [
      'Embed p5 canvas within HTML layout structure',
      'Use HTML elements to control p5 sketch parameters',
      'Coordinate DOM events with p5 interaction',
    ],
    textgen: [
      'Use p5 visuals to inspire text generation themes',
      'Display generated text as p5 typography elements',
      'Coordinate narrative flow with visual progression',
    ],
    music: [
      'Use p5 visuals to inspire music composition',
      'Map visual elements to musical parameters',
      'Coordinate visual and musical timing',
    ],
    video: [
      'Use p5 animation for video content generation',
      'Export p5 frames as video sequences',
      'Coordinate p5 timing with video playback',
    ],
    p5: [
      'Combine multiple p5 sketches with different visual styles',
      'Layer p5 canvases with blend modes for composite effects',
      'Share state between related p5 animations',
    ],
  },
  three: {
    p5: [
      'Use Three.js for 3D scene and p5 for 2D UI overlay',
      'Project p5 2D elements onto 3D surfaces as textures',
      'Coordinate camera movement between both systems',
    ],
    tone: [
      'Use audio analysis to drive 3D object transformations',
      'Map frequency data to geometry morphing',
      'Sync 3D animations to musical timing and beats',
    ],
    shader: [
      'Use the 3D scene as input texture for post-processing shader',
      'Apply shader effects to Three.js render target',
      'Combine 3D geometry with procedural shader materials',
    ],
    strudel: [
      'Sync 3D animations to Strudel pattern rhythms',
      'Map musical patterns to 3D object movements',
      'Use Strudel events to trigger 3D scene changes',
    ],
    hydra: [
      'Use Three.js render output as Hydra video source',
      'Apply Hydra feedback effects to 3D scene',
      'Coordinate 3D animation with video synthesis timing',
    ],
    ascii: [
      'Render 3D scene to texture for ASCII conversion',
      'Use ASCII art to represent 3D depth information',
      'Create stylized 3D-to-text rendering effects',
    ],
    html: [
      'Embed Three.js canvas within HTML page structure',
      'Use HTML UI controls for 3D scene parameters',
      'Coordinate DOM and WebGL rendering contexts',
    ],
    textgen: [
      'Display generated text as 3D typography in scene',
      'Use text content to inspire 3D geometry forms',
      'Map narrative structure to 3D spatial progression',
    ],
    three: [
      'Compose multiple Three.js scenes with different lighting',
      'Layer 3D objects with depth-based transparency',
      'Share geometries and materials across scenes',
    ],
  },
  shader: {
    p5: [
      'Apply shader post-processing to p5 canvas output',
      'Use p5 as input texture for shader effects',
      'Coordinate shader uniforms with p5 animation state',
    ],
    three: [
      'Use shader for advanced post-processing on 3D render',
      'Apply procedural shader materials to 3D geometry',
      'Combine raymarching shaders with polygonal 3D',
    ],
    tone: [
      'Use audio FFT data to drive shader parameters',
      'Map frequency bands to shader color and distortion',
      'Create audio-reactive visual effects in shaders',
    ],
    strudel: [
      'Sync shader uniforms to Strudel pattern timing',
      'Use shader effects to visualize musical structure',
      'Map pattern changes to shader parameter modulation',
    ],
    hydra: [
      'Combine GLSL shaders with Hydra video synthesis',
      'Use shader output as Hydra source texture',
      'Coordinate shader and Hydra effect chains',
    ],
    ascii: [
      'Use shader to generate ASCII art effects',
      'Apply character-based post-processing in shaders',
      'Create stylized text-rendering shader effects',
    ],
    html: [
      'Render shader output to HTML canvas element',
      'Use HTML controls to adjust shader parameters',
      'Coordinate shader timing with DOM events',
    ],
    textgen: [
      'Use generated text as shader input data',
      'Create text-based shader art effects',
      'Map narrative themes to shader visual styles',
    ],
    shader: [
      'Chain multiple shaders for complex effects',
      'Layer shader passes with blend operations',
      'Share uniforms and textures between shaders',
    ],
  },
  tone: {
    p5: [
      'Generate audio that responds to p5 visual elements',
      'Use mouse interaction to control sound synthesis',
      'Map visual colors and shapes to audio parameters',
    ],
    three: [
      'Create spatial audio tied to 3D object positions',
      'Use 3D distance to control audio volume and pan',
      'Sync sound events to 3D animation triggers',
    ],
    shader: [
      'Use shader visuals to modulate audio parameters',
      'Create audio-visual feedback loops',
      'Map shader colors to frequency content',
    ],
    strudel: [
      'Layer Tone.js synthesis with Strudel patterns',
      'Use Strudel patterns to trigger Tone.js events',
      'Coordinate timing between both music systems',
    ],
    hydra: [
      'Use video synthesis to drive audio parameters',
      'Create audio-reactive video effects',
      'Sync Hydra oscillators to audio LFOs',
    ],
    ascii: [
      'Convert ASCII patterns to musical patterns',
      'Use text density to control sound density',
      'Map character values to frequency data',
    ],
    html: [
      'Control Tone.js parameters with HTML UI elements',
      'Use DOM events to trigger audio events',
      'Coordinate audio playback with page interactions',
    ],
    textgen: [
      'Generate music based on text sentiment analysis',
      'Use text rhythm to inspire musical rhythm',
      'Map narrative structure to musical form',
    ],
    tone: [
      'Layer multiple Tone.js instruments and effects',
      'Coordinate polyphonic voices and harmonies',
      'Chain audio effects for complex sound design',
    ],
  },
  strudel: {
    p5: [
      'Sync p5 visuals to Strudel pattern timing',
      'Use Strudel events to trigger visual animations',
      'Map musical patterns to visual patterns',
    ],
    three: [
      'Sync 3D animations to Strudel rhythmic patterns',
      'Use pattern changes to trigger scene transitions',
      'Map Strudel note values to 3D transformations',
    ],
    shader: [
      'Sync shader uniforms to Strudel pattern data',
      'Use live coding patterns to drive visual effects',
      'Map rhythmic structures to shader parameters',
    ],
    tone: [
      'Combine Strudel patterns with Tone.js synthesis',
      'Use Tone.js effects on Strudel-generated audio',
      'Coordinate timing between pattern and synthesis',
    ],
    hydra: [
      'Sync Hydra video to Strudel musical patterns',
      'Use pattern events to trigger video effects',
      'Coordinate live coding across audio and video',
    ],
    ascii: [
      'Convert Strudel patterns to ASCII animations',
      'Use musical density to control text complexity',
      'Map pattern structure to character layouts',
    ],
    html: [
      'Display Strudel pattern visualizations in HTML',
      'Use DOM controls to modify pattern parameters',
      'Coordinate pattern playback with page state',
    ],
    textgen: [
      'Generate text based on musical pattern structure',
      'Use Strudel patterns to rhythmize text display',
      'Map musical themes to narrative content',
    ],
    strudel: [
      'Layer multiple Strudel patterns for polyrhythms',
      'Coordinate pattern changes across sequences',
      'Share pattern state between musical sections',
    ],
  },
  hydra: {
    p5: [
      'Use p5 output as source for Hydra video synthesis',
      'Blend generative art with video feedback effects',
      'Coordinate p5 animation with Hydra modulation',
    ],
    three: [
      'Use Three.js render as Hydra video source',
      'Apply video synthesis effects to 3D output',
      'Coordinate 3D and video animation timing',
    ],
    shader: [
      'Combine Hydra operators with GLSL shader effects',
      'Use shader output as Hydra source texture',
      'Chain shader and Hydra effect processing',
    ],
    tone: [
      'Use audio to modulate Hydra video parameters',
      'Create audio-reactive video synthesis',
      'Sync video oscillators to audio frequencies',
    ],
    strudel: [
      'Sync Hydra video to Strudel musical patterns',
      'Use pattern events to trigger video transformations',
      'Coordinate live coding across systems',
    ],
    ascii: [
      'Convert Hydra video output to ASCII art',
      'Use video brightness for character selection',
      'Create animated ASCII from video synthesis',
    ],
    html: [
      'Embed Hydra canvas within HTML page structure',
      'Use DOM events to control video synthesis',
      'Coordinate video with page layout changes',
    ],
    textgen: [
      'Use text content to inspire video synthesis',
      'Display generated text over video effects',
      'Map narrative to video transformation sequences',
    ],
    hydra: [
      'Chain multiple Hydra operators for complex effects',
      'Layer video sources with blend modes',
      'Share modulation signals between operators',
    ],
  },
  ascii: {
    p5: [
      'Convert p5 canvas to ASCII art representation',
      'Use p5 graphics as source for character mapping',
      'Create ASCII overlays on generative visuals',
    ],
    three: [
      'Render 3D scenes as ASCII art',
      'Use depth information for character selection',
      'Create 3D-to-text visualization effects',
    ],
    shader: [
      'Use shaders to generate ASCII art effects',
      'Apply character-based post-processing',
      'Create GPU-accelerated text rendering',
    ],
    tone: [
      'Convert audio to ASCII pattern visualization',
      'Use frequency data to generate text patterns',
      'Map sound events to character animations',
    ],
    strudel: [
      'Visualize Strudel patterns as ASCII animations',
      'Use musical patterns to generate text layouts',
      'Map rhythm to character timing',
    ],
    hydra: [
      'Convert video synthesis to ASCII output',
      'Use video brightness for character density',
      'Create animated ASCII from video sources',
    ],
    html: [
      'Display ASCII art within HTML page layout',
      'Use DOM elements for character rendering',
      'Coordinate ASCII animation with page state',
    ],
    textgen: [
      'Display generated text as ASCII art',
      'Use ASCII styling for text presentation',
      'Create typographic art from text content',
    ],
    ascii: [
      'Layer multiple ASCII art layers with blend modes',
      'Combine different character sets and styles',
      'Create composite ASCII from multiple sources',
    ],
  },
  html: {
    p5: [
      'Embed p5 canvas in HTML page layout',
      'Use HTML UI to control p5 parameters',
      'Coordinate DOM and canvas rendering',
    ],
    three: [
      'Integrate Three.js with HTML page structure',
      'Use HTML controls for 3D scene settings',
      'Combine WebGL with DOM elements',
    ],
    shader: [
      'Render shader output to HTML canvas',
      'Use HTML controls for shader parameters',
      'Coordinate shader with page interactions',
    ],
    tone: [
      'Control audio with HTML UI elements',
      'Use DOM events to trigger sounds',
      'Coordinate audio with page state',
    ],
    strudel: [
      'Display Strudel patterns in HTML interface',
      'Use DOM controls for pattern parameters',
      'Coordinate UI with live coding session',
    ],
    hydra: [
      'Embed video synthesis in HTML page',
      'Use HTML controls for video parameters',
      'Coordinate video with page layout',
    ],
    ascii: [
      'Display ASCII art in HTML elements',
      'Use DOM for character-based rendering',
      'Coordinate ASCII with page styling',
    ],
    textgen: [
      'Display generated text in HTML layout',
      'Use HTML typography for text styling',
      'Coordinate text with page structure',
    ],
    html: [
      'Compose multiple HTML components',
      'Coordinate interactions between elements',
      'Share state across component hierarchy',
    ],
  },
  textgen: {
    p5: [
      'Use generated text as content for p5 typography',
      'Inspire visuals based on text themes',
      'Display narrative alongside generative art',
    ],
    three: [
      'Render generated text as 3D typography',
      'Use text content to inspire 3D forms',
      'Create text-driven 3D environments',
    ],
    shader: [
      'Use text data as shader input',
      'Generate text-based shader art',
      'Map text sentiment to visual effects',
    ],
    tone: [
      'Generate music inspired by text themes',
      'Use text rhythm to inform musical rhythm',
      'Create audio narratives from text',
    ],
    strudel: [
      'Convert text patterns to musical patterns',
      'Use text structure to organize music',
      'Generate lyrics from text generation',
    ],
    hydra: [
      'Use text to inspire video synthesis',
      'Display text over video effects',
      'Map text themes to visual transformations',
    ],
    ascii: [
      'Display generated text as ASCII art',
      'Use text content for typographic effects',
      'Create stylized text presentations',
    ],
    html: [
      'Display generated text in web pages',
      'Use HTML for text layout and styling',
      'Coordinate text with page content',
    ],
    textgen: [
      'Combine multiple text generation sources',
      'Layer narrative styles and voices',
      'Create composite text from multiple prompts',
    ],
  },
  music: {
    p5: [
      'Generate music that responds to p5 visual elements',
      'Use visual interaction to control musical parameters',
      'Map colors and shapes to audio characteristics',
    ],
    three: [
      'Create spatial audio tied to 3D object positions',
      'Use 3D distance to control audio volume and pan',
      'Sync sound events to 3D animation triggers',
    ],
    shader: [
      'Use shader visuals to modulate audio parameters',
      'Create audio-visual feedback loops',
      'Map shader colors to frequency content',
    ],
    tone: [
      'Layer Tone.js instruments for complex compositions',
      'Use Tone.js effects for sound design',
      'Coordinate polyphonic voices with Tone.js',
    ],
    strudel: [
      'Combine Strudel patterns with musical arrangements',
      'Use patterns to trigger musical events',
      'Coordinate pattern timing with musical phrasing',
    ],
    hydra: [
      'Use video synthesis to drive musical parameters',
      'Create audio-reactive video synthesis',
      'Sync video modulation to audio frequencies',
    ],
    ascii: [
      'Convert ASCII patterns to musical patterns',
      'Use text density to control sound density',
      'Map character values to musical notes',
    ],
    html: [
      'Control music with HTML UI elements',
      'Use DOM events to trigger musical changes',
      'Coordinate music playback with page state',
    ],
    textgen: [
      'Generate music inspired by text themes',
      'Use text rhythm to inform musical rhythm',
      'Create musical narratives from text content',
    ],
    music: [
      'Layer multiple musical voices and instruments',
      'Coordinate harmonies and arrangements',
      'Share musical themes across compositions',
    ],
    video: [
      'Generate music for video soundtracks',
      'Sync musical events to video timing',
      'Create audio-visual compositions',
    ],
  },
  video: {
    p5: [
      'Use p5 animations for video content',
      'Export p5 frames as video sequences',
      'Coordinate p5 timing with video playback',
    ],
    three: [
      'Use 3D scenes for video generation',
      'Export 3D animations as video',
      'Apply video effects to 3D renders',
    ],
    shader: [
      'Apply shader effects to video content',
      'Use shaders for video transitions',
      'Export shader animations as video',
    ],
    tone: [
      'Generate audio tracks for video',
      'Sync sound effects to video events',
      'Use procedural audio for video',
    ],
    strudel: [
      'Sync video to Strudel pattern timing',
      'Use pattern events for video transitions',
      'Generate video from musical patterns',
    ],
    hydra: [
      'Use Hydra for live video processing',
      'Apply video synthesis to video input',
      'Coordinate video synthesis with playback',
    ],
    ascii: [
      'Convert video to ASCII art',
      'Use video frames for character animation',
      'Create ASCII video effects',
    ],
    html: [
      'Embed video in HTML pages',
      'Use HTML controls for video playback',
      'Coordinate video with page layout',
    ],
    textgen: [
      'Generate video narration and titles',
      'Use AI text for video content',
      'Create text-driven video sequences',
    ],
    music: [
      'Create music videos from audio',
      'Visualize music as video content',
      'Sync video to musical structure',
    ],
    video: [
      'Layer multiple video sources',
      'Coordinate video transitions',
      'Share video effects across layers',
    ],
  },
};



/**
 * Maximum number of lines to include from code context.
 */
const MAX_CODE_LINES = 50;

/**
 * Enhances prompts for cross-layer integration by extracting context
 * from existing layers and generating integration instructions.
 */
export class PromptEnhancer {
  /**
   * Enhance a prompt with context from existing layers and integration instructions.
   *
   * @param options - Enhancement context with existing layers and target domain
   * @returns Enhanced prompt with context and instructions
   */
  enhance(options: EnhancementContext): EnhancedPrompt {
    const { existingLayers, targetDomain, integrationHints } = options;

    // Extract context from existing layers
    const context = this.buildContext(existingLayers);

    // Generate integration instructions
    const instructions = this.buildInstructions(
      targetDomain,
      existingLayers,
      integrationHints
    );

    // Build the complete formatted prompt
    const prompt = this.buildFormattedPrompt(
      context,
      targetDomain,
      instructions,
      existingLayers
    );

    return {
      prompt,
      context,
      instructions,
    };
  }

  /**
   * Extract context from a single layer.
   *
   * @param layer - The layer to extract context from
   * @returns Formatted context string describing the layer
   */
  extractContext(layer: Layer): string {
    const parts: string[] = [];

    // Add layer type and status
    const status = layer.enabled ? 'enabled' : 'disabled';
    parts.push(`[${layer.type.toUpperCase()}] (${status})`);

    // Add prompt if available
    if (layer.metadata.prompt) {
      parts.push(`Purpose: ${layer.metadata.prompt}`);
    }

    // Extract key code elements
    const codeContext = this.extractCodeContext(layer.code, layer.type);
    if (codeContext) {
      parts.push(`Key elements: ${codeContext}`);
    }

    // Add configuration info
    if (layer.config.opacity !== 1) {
      parts.push(`Opacity: ${layer.config.opacity}`);
    }
    if (layer.config.blendMode !== 'normal') {
      parts.push(`Blend: ${layer.config.blendMode}`);
    }

    // Add export information if available
    const exports = this.detectExports(layer.code);
    if (exports.length > 0) {
      parts.push(`Exports: ${exports.join(', ')}`);
    }

    return parts.join('\n  ');
  }

  /**
   * Generate integration instructions for combining domains.
   *
   * @param targetDomain - The target domain for the new layer
   * @param sourceDomains - Array of source domain types from existing layers
   * @returns Integration instructions string
   */
  generateInstructions(
    targetDomain: DomainType,
    sourceDomains: DomainType[]
  ): string {
    if (sourceDomains.length === 0) {
      return `Create a new ${targetDomain} layer from scratch.`;
    }

    const instructions: string[] = [];

    // Get patterns for each source domain
    for (const sourceDomain of sourceDomains) {
      const patterns = DOMAIN_INTEGRATION_PATTERNS[sourceDomain]?.[targetDomain];
      if (patterns && patterns.length > 0) {
        instructions.push(`From ${sourceDomain} to ${targetDomain}:`);
        instructions.push(...patterns.slice(0, 2).map((p) => `  - ${p}`));
      }
    }

    // Add general integration guidance
    instructions.push(`\nGeneral integration principles for ${targetDomain}:`);
    instructions.push(`  - Ensure proper timing synchronization between layers`);
    instructions.push(`  - Share relevant state through exports/imports`);
    instructions.push(`  - Consider visual/audio coherence across domains`);

    return instructions.join('\n');
  }

  /**
   * Build the complete context string from all layers.
   */
  private buildContext(layers: Layer[]): string {
    if (layers.length === 0) {
      return 'No existing layers. Creating from scratch.';
    }

    const contexts = layers.map((layer) => this.extractContext(layer));
    return contexts.join('\n\n');
  }

  /**
   * Build integration instructions with hints.
   */
  private buildInstructions(
    targetDomain: DomainType,
    existingLayers: Layer[],
    hints?: string[]
  ): string {
    const sourceDomains = existingLayers
      .filter((l) => l.enabled)
      .map((l) => l.type);

    let instructions = this.generateInstructions(targetDomain, sourceDomains);

    // Add custom hints if provided
    if (hints && hints.length > 0) {
      instructions += '\n\nUser-specified integration hints:\n';
      for (const hint of hints) {
        instructions += `  - ${hint}\n`;
      }
    }

    return instructions;
  }

  /**
   * Build the final formatted prompt for LLM consumption.
   */
  private buildFormattedPrompt(
    context: string,
    targetDomain: DomainType,
    instructions: string,
    existingLayers: Layer[]
  ): string {
    const parts: string[] = [];

    // Header
    parts.push('--- CROSS-LAYER INTEGRATION PROMPT ---\n');

    // Existing layers summary
    parts.push('EXISTING LAYERS:\n');
    if (existingLayers.length === 0) {
      parts.push('  (none - creating first layer)\n');
    } else {
      for (const layer of existingLayers) {
        const status = layer.enabled ? '✓' : '○';
        parts.push(`  ${status} [${layer.type}] ${layer.metadata.prompt || '(no description)'}\n`);
      }
    }

    // Target domain
    parts.push(`\nTARGET DOMAIN: ${targetDomain.toUpperCase()}\n`);

    // Extracted context
    parts.push('\n--- EXTRACTED CONTEXT ---\n');
    parts.push(context);
    parts.push('\n');

    // Integration instructions
    parts.push('\n--- INTEGRATION INSTRUCTIONS ---\n');
    parts.push(instructions);
    parts.push('\n');

    // Generation guidance
    parts.push('\n--- GENERATION GUIDANCE ---\n');
    parts.push(`Create ${targetDomain} code that:\n`);
    parts.push('  1. Implements the desired functionality\n');
    if (existingLayers.length > 0) {
      parts.push('  2. Integrates appropriately with existing layers\n');
      parts.push('  3. Exports relevant values for other layers to consume\n');
      parts.push('  4. Uses existing layer exports where applicable\n');
    }
    parts.push('\n');

    return parts.join('');
  }

  /**
   * Extract key elements from code based on domain type.
   */
  private extractCodeContext(code: string, domain: DomainType): string {
    const lines = code.split('\n');
    const elements: string[] = [];

    // Domain-specific patterns to look for
    const patterns: Partial<Record<DomainType, RegExp[]>> = {
      p5: [
        /function\s+(setup|draw|mousePressed|keyPressed)/,
        /createCanvas\s*\(/,
        /mouseX|mouseY/,
        /frameCount/,
      ],
      three: [
        /new\s+THREE\.[A-Z][a-zA-Z]+/,
        /scene|camera|renderer/,
        /Geometry|Material|Mesh/,
        /position|rotation|scale/,
      ],
      shader: [
        /void\s+(mainImage|main)/,
        /uniform\s+\w+/,
        /iResolution|iTime|iMouse/,
        /texture\s*\(/,
      ],
      tone: [
        /new\s+Tone\.[A-Z][a-zA-Z]+/,
        /Synth|Sampler|Player/,
        /toDestination\s*\(/,
        /triggerAttackRelease/,
      ],
      strudel: [
        /note\s*\(/,
        /stack|seq|cat/,
        /\.[a-z]+\s*\(/, // Pattern methods
      ],
      hydra: [
        /\.[a-z]+\s*\(/, // Hydra operators
        /src\s*\(/,
        /osc|noise|voronoi/,
      ],
      ascii: [
        /char|pixel/,
        /density|brightness/,
      ],
      html: [
        /<[a-z]+/,
        /addEventListener/,
        /querySelector/,
      ],
      textgen: [
        /generate|create/,
        /model|prompt/,
      ],
    };

    const domainPatterns = patterns[domain] || [];

    for (const line of lines.slice(0, MAX_CODE_LINES)) {
      for (const pattern of domainPatterns) {
        const match = line.match(pattern);
        if (match) {
          const element = match[0].trim();
          if (!elements.includes(element) && elements.length < 5) {
            elements.push(element);
          }
        }
      }
    }

    return elements.join(', ');
  }

  /**
   * Detect exported functions/values in code.
   */
  private detectExports(code: string): string[] {
    const exports: string[] = [];

    // Look for common export patterns
    const patterns = [
      /function\s+(get[A-Z]\w+)/g,
      /export\s+(?:function|const|let|var)\s+(\w+)/g,
      /window\.(\w+)\s*=/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const exportName = match[1];
        if (!exports.includes(exportName)) {
          exports.push(exportName);
        }
      }
    }

    return exports.slice(0, 5); // Limit to 5 exports
  }
}
