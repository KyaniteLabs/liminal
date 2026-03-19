/**
 * GUI preview state - derive preview URL and code content from selected iteration index.
 */

export interface GuiIteration {
  id: number;
  code: string;
  timestamp: number;
}

export interface PreviewState {
  previewUrl: string;
  codeContent: string;
}

/**
 * Returns preview URL and code content for the selected iteration.
 * version in URL = selectedIndex + 1 (1-based).
 */
export function getPreviewState(
  iterations: GuiIteration[],
  selectedIndex: number,
  baseUrl: string
): PreviewState {
  const version = selectedIndex + 1;
  const separator = baseUrl.includes('?') ? '&' : '?';
  const previewUrl = `${baseUrl}${separator}version=${version}`;
  const iteration = iterations[selectedIndex];
  const codeContent = iteration ? iteration.code : '';
  return { previewUrl, codeContent };
}
