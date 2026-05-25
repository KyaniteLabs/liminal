export const Logger = {
  warn(scope: string, message: string, detail?: unknown): void {
    if (detail === undefined) {
      console.warn(`[${scope}] ${message}`);
      return;
    }
    console.warn(`[${scope}] ${message}`, detail);
  },
};
