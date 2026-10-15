import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const action = fileURLToPath(new URL('../src/action.js', import.meta.url));

test('real entrypoint writes summary and safe multiline outputs without leaking metadata to logs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'specita-action-test-'));
  try {
    const mock = join(dir, 'mock.mjs');
    await writeFile(mock, `globalThis.fetch = async (url, options) => {
      if (options.method !== 'GET') throw new Error('Unexpected write');
      let data;
      if (url.includes('/commits/')) data = { sha: url.endsWith('/v1') ? 'a'.repeat(40) : 'b'.repeat(40) };
      else if (url.includes('/compare/')) data = { status: 'ahead', total_commits: 0, commits: [], files: [] };
      else throw new Error('Unexpected URL');
      return { ok: true, json: async () => data };
    };`);
    const output = join(dir, 'output');
    const summary = join(dir, 'summary');
    const env = { ...process.env, GITHUB_TOKEN: 'synthetic-secret', GITHUB_REPOSITORY: 'owner/repo',
      GITHUB_API_URL: 'https://api.github.com', GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_EVENT_PATH: '', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: summary, 'INPUT_BASE-REF': 'v1', 'INPUT_HEAD-REF': 'v2',
      'INPUT_PUBLISH': 'false', 'INPUT_ATTRIBUTION': 'false', 'INPUT_RELEASE-ID': '', 'INPUT_GITHUB-TOKEN': '' };
    const result = spawnSync(process.execPath, ['--import', mock, action], { env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const markdown = await readFile(summary, 'utf8');
    const outputs = await readFile(output, 'utf8');
    assert.ok(markdown.includes('0 commits'));
    assert.ok(outputs.includes('base-sha=' + 'a'.repeat(40)));
    assert.ok(outputs.includes('updated=false'));
    assert.ok(outputs.includes('brief<<specita_'));
    assert.ok(!result.stdout.includes(markdown));
    assert.ok(!(result.stdout + result.stderr).includes('synthetic-secret'));
    assert.ok(!markdown.includes('specita.com/'));
    const invalid = spawnSync(process.execPath, ['--import', mock, action], {
      env: { ...env, INPUT_PUBLISH: 'yes' }, encoding: 'utf8',
    });
    assert.equal(invalid.status, 1);
    assert.ok(invalid.stderr.includes('publish must be true or false'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
