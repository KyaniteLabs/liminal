export async function generate(prompt, options) {
  return '// generated code for: ' + prompt;
}

export function canHandle(prompt) {
  if (prompt.includes('test')) return 0.8;
  if (prompt.includes('p5')) return 0.6;
  return 0.1;
}

let initialized = false;

export async function initialize() {
  initialized = true;
}

export async function destroy() {
  initialized = false;
}
