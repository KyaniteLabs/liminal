/**
 * Three.js-specific HTML wrapper
 * Wraps Three.js scene code in a complete HTML document with ES module support
 */

import { SECURITY_HEADERS } from './SecurityHeaders.js';

const THREE_CDN = 'https://unpkg.com/three@0.160.0/build/three.module.js';
const THREE_EXAMPLES_CDN = 'https://unpkg.com/three@0.160.0/examples/jsm/';

export interface ThreeWrapOptions {
  title?: string;
}

export class ThreeWrapper {
  /**
   * Detect if code is Three.js code
   */
  static detect(code: string): boolean {
    const hasDoctype = code.trim().startsWith('<!DOCTYPE html>');
    const hasHTMLTag = /<html[^>]*>/i.test(code);
    const hasThreeImport = /import.*\bfrom\s+['"]three['"]|from\s+['"]@three\/foundation['"]/.test(code);
    const hasImportMap = /<script\s+type="importmap">/.test(code);
    const hasTHREE = /\bTHREE\./.test(code);
    const hasThreeClasses = /\bnew\s+THREE\.(Scene|Camera|PerspectiveCamera|WebGLRenderer)\b/.test(code);

    return (hasDoctype && hasHTMLTag && (hasThreeImport || hasImportMap)) ||
           (hasTHREE && (hasThreeClasses || code.includes('Scene'))) ||
           hasThreeImport;
  }

  /**
   * Wrap Three.js code in HTML
   */
  static wrap(code: string, options: ThreeWrapOptions = {}): string {
    const { title = 'Three.js Scene' } = options;
    
    // If it's already complete HTML, return as-is
    if (code.includes('<!DOCTYPE html>') && code.includes('</html>')) {
      return code;
    }

    const hasThreeImport = /\bimport\b[\s\S]*?\bfrom\s+['"](?:three|https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net)\/(?:npm\/)?three)/m.test(code);
    const moduleCode = hasThreeImport ? code : `import * as THREE from 'three';\n${code}`;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${SECURITY_HEADERS.trim()}
    <title>${title}</title>
    <style>
        body { margin: 0; overflow: hidden; background: #000; }
        canvas { display: block; }
    </style>
</head>
<body>
    <script type="importmap">
    {
        "imports": {
            "three": "${THREE_CDN}",
            "three/addons/": "${THREE_EXAMPLES_CDN}"
        }
    }
    </script>
    <script type="module">
${moduleCode}
    </script>
</body>
</html>`;
  }
}

export default ThreeWrapper;
