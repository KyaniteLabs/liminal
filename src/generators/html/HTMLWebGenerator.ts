/**
 * HTMLWebGenerator - Generates complete HTML/CSS/JS web pages via LLM
 * 
 * NO TEMPLATES - Everything goes through the LLM
 */

import { LLMClient } from '../../llm/LLMClient.js';

export interface HTMLGeneratorOptions {
  title?: string;
  includeAnimations?: boolean;
  responsive?: boolean;
  darkMode?: boolean;
}

export class HTMLWebGenerator {
  private llmClient: LLMClient;

  constructor(llmClient?: LLMClient) {
    this.llmClient = llmClient || new LLMClient();
  }

  async generate(prompt: string, options: HTMLGeneratorOptions = {}): Promise<string> {
    if (!LLMClient.isConfigured()) {
      throw new Error('HTMLWebGenerator: No LLM configured. Set LIMINAL_LLM_BASE_URL and LIMINAL_LLM_MODEL.');
    }
    
    const systemPrompt = this.buildSystemPrompt(options);
    
    const userPrompt = `Create a complete HTML web page for: ${prompt}

Requirements:
- Single HTML file with embedded CSS and JS
- Modern, semantic HTML5 structure
- Beautiful, responsive design
- Interactive elements with vanilla JS
- No external dependencies (CDN ok)
- Include proper meta tags and viewport

Generate ONLY the HTML code, no explanations.`;

    const response = await this.llmClient.generate(systemPrompt, userPrompt);
    const code = typeof response === 'string' ? response : (response.code || '');
    
    if (!code || code.trim() === '') {
      throw new Error('HTMLWebGenerator: LLM returned empty code');
    }
    
    return this.extractHTML(code);
  }

  private buildSystemPrompt(options: HTMLGeneratorOptions): string {
    return `You are an expert web developer specializing in modern HTML5, CSS3, and vanilla JavaScript.

RULES:
1. Output MUST be a complete, valid HTML5 document
2. Use semantic HTML elements (header, nav, main, section, article, footer)
3. CSS should be in a <style> tag in the head
4. JavaScript should be in a <script> tag at the end of body
5. Use CSS custom properties (variables) for colors
6. Include smooth transitions and hover effects
7. Make it responsive with flexbox/grid
${options.darkMode ? '8. Use dark mode color scheme' : ''}
${options.includeAnimations ? '9. Include CSS animations or JS interactions' : ''}

TEMPLATE:
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page Title</title>
    <style>
        /* CSS here */
    </style>
</head>
<body>
    <!-- HTML structure -->
    <script>
        // JS here
    </script>
</body>
</html>
\`\`\``;
  }

  private extractHTML(code: string): string {
    const htmlMatch = code.match(/```html\s*([\s\S]*?)```/);
    if (htmlMatch) return htmlMatch[1].trim();
    if (code.includes('<!DOCTYPE html>') || code.includes('<html')) {
      return code.trim();
    }
    throw new Error('HTMLWebGenerator: LLM output is not valid HTML');
  }
}
