import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('preferences CLI contract', () => {
  const readCli = () => readFileSync(join(process.cwd(), 'bin', 'sinter'), 'utf8');

  it('advertises train and model alongside preference export and stats', () => {
    const cli = readCli();

    expect(cli).toContain('preferences <subcommand>  Preferences: export, stats, train, model');
  });

  it('uses TasteLearningService and project-local preference storage', () => {
    const cli = readCli();
    const start = cli.indexOf("else if (cmd === 'preferences')");
    const end = cli.indexOf("else if (cmd === 'emergence')", start);
    const preferencesBlock = cli.slice(start, end);

    expect(preferencesBlock).toContain('TasteLearningService');
    expect(preferencesBlock).toContain('resolveSinterProjectRoot');
    expect(preferencesBlock).toContain('SinterFS.open(resolveSinterProjectRoot())');
    expect(preferencesBlock).toContain('TasteLearningService.preferenceDirForProject(sinterFs)');
    expect(preferencesBlock).toContain("subCmd === 'train'");
    expect(preferencesBlock).toContain('service.trainFromProject()');
    expect(preferencesBlock).toContain("subCmd === 'model'");
    expect(preferencesBlock).toContain('service.loadLatestModel()');
  });
});
