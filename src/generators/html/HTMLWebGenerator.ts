/**
 * HTMLWebGenerator - Generates complete HTML/CSS/JS web pages
 * 
 * Creates modern, responsive web pages with:
 * - Semantic HTML5 structure
 * - CSS (flexbox/grid, animations, responsive)
 * - Vanilla JS (interactivity, DOM manipulation)
 * - No external dependencies (pure HTML file)
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
    this.llmClient = llmClient || new LLMClient({
      provider: 'ollama',
      model: 'qwen2.5-coder:7b',
    });
  }

  async generate(prompt: string, options: HTMLGeneratorOptions = {}): Promise<string> {
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

    try {
      const response = await this.llmClient.generate(systemPrompt, userPrompt);
      const code = typeof response === 'string' ? response : (response.code || '');
      return this.extractHTML(code);
    } catch (error) {
      console.error('HTML generation failed:', error);
      return this.getFallbackTemplate(prompt, options);
    }
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
    return this.getFallbackTemplate(code, {});
  }

  private getFallbackTemplate(prompt: string, options: HTMLGeneratorOptions): string {
    const title = options.title || 'Generated Page';
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: system-ui, sans-serif;
            background: ${options.darkMode ? '#0a0a12' : '#f5f5f5'};
            color: ${options.darkMode ? '#fff' : '#333'};
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <p>${prompt}</p>
</body>
</html>`;
  }

  /**
   * Quick template-based generation
   */
  static generateQuick(variant: 'portfolio' | 'landing' | 'dashboard' | 'gallery'): string {
    const templates = {
      portfolio: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Portfolio</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, sans-serif; background: #0a0a12; color: #fff; }
        .hero { text-align: center; padding: 4rem 2rem; }
        h1 { font-size: 3rem; background: linear-gradient(90deg, #00d4ff, #7b2cbf); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; padding: 2rem; max-width: 1200px; margin: 0 auto; }
        .card { background: rgba(255,255,255,0.05); border-radius: 16px; padding: 2rem; }
    </style>
</head>
<body>
    <div class="hero">
        <h1>Portfolio</h1>
        <p>Creative Developer</p>
    </div>
    <div class="grid">
        <div class="card"><h3>Project 1</h3></div>
        <div class="card"><h3>Project 2</h3></div>
        <div class="card"><h3>Project 3</h3></div>
    </div>
</body>
</html>`,

      landing: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, sans-serif; background: #0a0a12; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .hero { text-align: center; }
        h1 { font-size: 4rem; background: linear-gradient(135deg, #8b5cf6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .cta { display: inline-block; margin-top: 2rem; padding: 1rem 2rem; background: linear-gradient(135deg, #8b5cf6, #ec4899); color: #fff; text-decoration: none; border-radius: 50px; }
    </style>
</head>
<body>
    <div class="hero">
        <h1>Welcome</h1>
        <p>Experience the future</p>
        <a href="#" class="cta">Get Started</a>
    </div>
</body>
</html>`,

      dashboard: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
        .sidebar { position: fixed; left: 0; top: 0; width: 250px; height: 100vh; background: #1e293b; padding: 2rem; }
        .main { margin-left: 250px; padding: 2rem; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
        .stat-card { background: #1e293b; padding: 1.5rem; border-radius: 12px; }
        .stat-value { font-size: 2rem; font-weight: 700; color: #60a5fa; }
    </style>
</head>
<body>
    <div class="sidebar"><h2>Dashboard</h2></div>
    <div class="main">
        <div class="stats">
            <div class="stat-card"><div class="stat-value">1,234</div><div>Users</div></div>
            <div class="stat-card"><div class="stat-value">$12K</div><div>Revenue</div></div>
        </div>
    </div>
</body>
</html>`,

      gallery: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gallery</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, sans-serif; background: #0a0a0f; color: #fff; }
        .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; padding: 2rem; }
        .item { aspect-ratio: 1; background: linear-gradient(135deg, #1a1a2e, #16213e); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 3rem; }
    </style>
</head>
<body>
    <div class="gallery">
        <div class="item">🎨</div>
        <div class="item">🖼️</div>
        <div class="item">📸</div>
    </div>
</body>
</html>`
    };
    
    return templates[variant] || templates.landing;
  }
}
