/**
 * Resolve the filesystem root under which the Sinter object store (`.sinter/`)
 * is created.
 *
 * Defaults to the current working directory — the real project root for the
 * CLI and TUI. The `SINTER_PROJECT_ROOT` override exists so callers that must
 * not touch the working directory (most importantly the test suite) can point
 * the content-addressable store at a throwaway directory. Without this, loop /
 * preview runs write `.sinter/objects` and `.sinter/refs/gallery/<project>`
 * into the repository tree, which is how test-fixture refs leaked into the
 * tracked working tree.
 *
 * @returns Absolute or cwd-relative directory that should contain `.sinter/`.
 */
export function resolveSinterProjectRoot(): string {
  const override = process.env.SINTER_PROJECT_ROOT?.trim();
  return override && override.length > 0 ? override : process.cwd();
}
