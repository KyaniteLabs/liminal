import { describe, it, expect } from 'vitest';
import { HTMLValidator } from '../../../src/core/validators/HTMLValidator.js';

describe('HTMLValidator', () => {
  describe('validate', () => {
    it('should validate valid HTML document', () => {
      const code = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Test Page</title>
</head>
<body>
  <h1>Hello World</h1>
</body>
</html>`;

      const result = HTMLValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate HTML with viewport meta tag', () => {
      const code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Responsive Page</title>
</head>
<body>
  <div class="container">Content</div>
</body>
</html>`;

      const result = HTMLValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate HTML with script tags', () => {
      const code = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Page with Script</title>
  <script src="app.js"></script>
</head>
<body>
  <script>
    console.log('Hello');
  </script>
</body>
</html>`;

      const result = HTMLValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject code without DOCTYPE', () => {
      const code = `<html>
<head><title>Test</title></head>
<body><h1>Hello</h1></body>
</html>`;

      const result = HTMLValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTML document must start with <!DOCTYPE html>');
    });

    it('should reject code without html tag', () => {
      const code = `<!DOCTYPE html>
<head><title>Test</title></head>
<body><h1>Hello</h1></body>`;

      const result = HTMLValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTML document must contain <html> tag');
    });

    it('should reject code without closing html tag', () => {
      const code = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><h1>Hello</h1></body>`;

      const result = HTMLValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTML document must have closing </html> tag');
    });

    it('should warn about missing head tag', () => {
      const code = `<!DOCTYPE html>
<html>
<body><h1>Hello</h1></body>
</html>`;

      const result = HTMLValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTML document should contain <head> tag');
    });

    it('should warn about missing body tag', () => {
      const code = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
</html>`;

      const result = HTMLValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTML document should contain <body> tag');
    });

    it('should reject empty code', () => {
      const result = HTMLValidator.validate('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is empty');
    });

    it('should detect dangerous eval()', () => {
      const code = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Unsafe</title>
</head>
<body>
  <script>
    eval('alert("danger")');
  </script>
</body>
</html>`;

      const result = HTMLValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTML Security: Dangerous eval() detected');
    });

    it('should detect dangerous new Function()', () => {
      const code = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <script>
    const fn = new Function('x', 'return x + 1');
  </script>
</body>
</html>`;

      const result = HTMLValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTML Security: Dangerous new Function() detected');
    });

    it('should detect document.write()', () => {
      const code = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <script>
    document.write('<h1>Hello</h1>');
  </script>
</body>
</html>`;

      const result = HTMLValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTML Security: document.write() is discouraged');
    });

    it('should detect innerHTML assignment', () => {
      const code = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <div id="app"></div>
  <script>
    document.getElementById('app').innerHTML = '<p>Content</p>';
  </script>
</body>
</html>`;

      const result = HTMLValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTML Security: innerHTML assignment - ensure content is sanitized');
    });

    it('should warn about missing title', () => {
      const code = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body><h1>Hello</h1></body>
</html>`;

      const result = HTMLValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTML document should have a <title> in <head>');
    });

    it('should warn about missing charset', () => {
      const code = `<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
</head>
<body><h1>Hello</h1></body>
</html>`;

      const result = HTMLValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTML document should specify charset meta tag');
    });

    it('should validate complex HTML document', () => {
      const code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complex Page</title>
</head>
<body>
  <header>
    <nav>
      <a href="#home">Home</a>
      <a href="#about">About</a>
    </nav>
  </header>
  <main>
    <article>
      <h1>Article Title</h1>
      <p>Article content</p>
    </article>
  </main>
  <footer>
    <p>Copyright 2024</p>
  </footer>
</body>
</html>`;

      const result = HTMLValidator.validate(code);
      // Complex HTML should be valid - checking for DOCTYPE, html tags, title, charset
      expect(result.errors).not.toContain('HTML document must start with <!DOCTYPE html>');
      expect(result.errors).not.toContain('HTML document must contain <html> tag');
    });

    it('should not count <header> as an opening <head> tag', () => {
      const code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Header Regression</title>
</head>
<body>
  <header><h1>Hero</h1></header>
</body>
</html>`;

      const result = HTMLValidator.validate(code);
      expect(result.errors).not.toContain('HTML document has mismatched <head> tags: 2 opening, 1 closing');
      expect(result.valid).toBe(true);
    });
  });

  describe('getMinSize', () => {
    it('should return 200 bytes as minimum size', () => {
      expect(HTMLValidator.getMinSize()).toBe(200);
    });
  });
});
