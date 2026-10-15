import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/run.js';
import { START, END } from '../src/brief.js';

const base = 'a'.repeat(40);
const head = 'b'.repeat(40);
function setup(overrides = {}) {
  const writes = [];
  const github = {
    repo: 'owner/repo',
    release: async () => ({ id: 2, tag_name: 'v2', body: 'Human notes', published_at: '2026-01-02' }),
    previousRelease: async () => 'v1',
    resolve: async (ref) => ref === 'v1' ? base : head,
    comparison: async () => ({ totalCommits: 1, commits: [{ sha: head, commit: { message: 'Change' } }], files: [], warnings: [] }),
    associatedPullRequests: async () => ({ pullRequests: [], warnings: [] }),
    updateRelease: async (id, body) => writes.push({ id, body }), ...overrides,
  };
  return { options: { github, event: { action: 'published', release: { id: 2 } }, eventName: 'release' }, writes };
}

test('summary-only default generates evidence without release mutation', async () => {
  const { options, writes } = setup();
  const result = await run(options);
  assert.equal(result.baseSha, base);
  assert.equal(result.headSha, head);
  assert.equal(result.updated, false);
  assert.equal(writes.length, 0);
});

test('publishing preserves freshly reread notes and changes only the managed section', async () => {
  let reads = 0;
  const { options, writes } = setup({ release: async () => ({ id: 2, tag_name: 'v2', body: ++reads === 1 ? 'Old notes' : 'Latest human notes' }) });
  const result = await run({ ...options, publish: true });
  assert.equal(result.updated, true);
  assert.equal(writes.length, 1);
  assert.ok(writes[0].body.startsWith('Latest human notes\n\n' + START));
});

test('repeated publication is a no-op', async () => {
  const { options, writes } = setup();
  const first = await run(options);
  options.github.release = async () => ({ id: 2, tag_name: 'v2', body: `Human notes\n\n${START}\n${first.brief.trim()}\n${END}` });
  const second = await run({ ...options, publish: true });
  assert.equal(second.updated, false);
  assert.equal(writes.length, 0);
});

test('publishing refuses unsafe events, missing target, drafts, changed tags and mismatched head', async () => {
  for (const extra of [{ eventName: 'pull_request' }, { eventName: 'release', event: { action: 'edited', release: { id: 2 } } },
    { eventName: 'workflow_dispatch', event: {} }]) {
    const { options, writes } = setup();
    await assert.rejects(run({ ...options, ...extra, publish: true }));
    assert.equal(writes.length, 0);
  }
  const draft = setup({ release: async () => ({ draft: true, tag_name: 'v2' }) });
  await assert.rejects(run({ ...draft.options, publish: true }), /draft/);
  let reads = 0;
  const changed = setup({ release: async () => ({ tag_name: ++reads === 1 ? 'v2' : 'moved' }) });
  await assert.rejects(run({ ...changed.options, publish: true }), /identity changed/);
  const mismatched = setup({ resolve: async (ref) => ref === 'v1' ? base : ref === 'other-head' ? 'c'.repeat(40) : head });
  await assert.rejects(run({ ...mismatched.options, publish: true, headRef: 'other-head' }), /identity changed/);
});

test('tag moved during collection prevents publication', async () => {
  let headReads = 0;
  const { options, writes } = setup({ resolve: async (ref) => ref === 'v1' ? base : ++headReads === 1 ? head : 'c'.repeat(40) });
  await assert.rejects(run({ ...options, publish: true }), /identity changed/);
  assert.equal(writes.length, 0);
});

test('explicit refs support manual summary without a release', async () => {
  const { options, writes } = setup();
  const result = await run({ ...options, eventName: 'workflow_dispatch', event: {}, baseRef: 'v1', headRef: 'v2', attribution: false });
  assert.equal(writes.length, 0);
  assert.ok(result.brief.includes('explicitly selected'));
  assert.ok(!result.brief.includes('specita.com/'));
  await assert.rejects(run({ ...options, event: {}, headRef: 'v2' }), /base-ref/);
});

test('PR API failures and malformed markers fail closed without a release write', async () => {
  const failed = setup({ associatedPullRequests: async () => { throw new Error('API failure'); } });
  await assert.rejects(run({ ...failed.options, publish: true }), /API failure/);
  assert.equal(failed.writes.length, 0);
  const malformed = setup({ release: async () => ({ tag_name: 'v2', body: START }) });
  await assert.rejects(run({ ...malformed.options, publish: true }), /malformed/);
  assert.equal(malformed.writes.length, 0);
});
