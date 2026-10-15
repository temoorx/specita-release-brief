import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHub } from '../src/github.js';

const sha = 'a'.repeat(40);
function client(handler) {
  return new GitHub({ token: 'test-only-token', repository: 'owner/repo', fetchImpl: async (url, options) => {
    const data = await handler(new URL(url), options);
    return { ok: true, json: async () => data };
  } });
}

test('requires safe repository and API root; never follows token-bearing redirects', async () => {
  assert.throws(() => new GitHub({ token: 'x', repository: '../repo' }));
  assert.throws(() => new GitHub({ repository: 'owner/repo' }));
  for (const apiUrl of ['http://api.github.com', 'https://user:x@api.github.com', 'https://api.github.com?q=x']) {
    assert.throws(() => new GitHub({ token: 'x', repository: 'owner/repo', apiUrl }));
  }
  const api = client((url, options) => {
    assert.equal(url.origin, 'https://api.github.com');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer test-only-token');
    return { sha };
  });
  assert.equal(await api.resolve('release/v1'), sha);
});

test('does not expose provider errors or retry failed writes', async () => {
  let calls = 0;
  const api = new GitHub({ token: 'secret', repository: 'owner/repo', fetchImpl: async () => {
    calls++;
    return { ok: false, status: 403, json: async () => ({ message: 'secret payload' }) };
  } });
  await assert.rejects(api.updateRelease(1, 'body'), /HTTP 403/);
  assert.equal(calls, 1);
  const failing = new GitHub({ token: 'secret', repository: 'owner/repo', fetchImpl: async () => { throw new Error('secret'); } });
  await assert.rejects(failing.resolve('v1'), (error) => !error.message.includes('secret'));
});

test('validates references, release ID, SHA, and total request deadline', async () => {
  const api = client(() => ({ sha: 'not-a-sha' }));
  await assert.rejects(api.resolve(''), /nonempty/);
  await assert.rejects(api.resolve('v1\n'), /nonempty/);
  await assert.rejects(api.resolve('v1'), /valid commit SHA/);
  await assert.rejects(api.release('1?x=1'), /integer/);
  api.deadline = 0;
  await assert.rejects(api.release(1), /timed out/);
});

test('automatic base uses publication date, excludes drafts and stable-target prereleases', async () => {
  const api = client(() => [
    { id: 1, tag_name: 'v1', published_at: '2026-01-01T00:00:00Z' },
    { id: 2, tag_name: 'v1.1', published_at: '2026-02-01T00:00:00Z' },
    { id: 3, tag_name: 'v2-rc', published_at: '2026-02-02T00:00:00Z', prerelease: true },
    { id: 4, tag_name: 'draft', published_at: '2026-02-03T00:00:00Z', draft: true },
    { id: 5, tag_name: 'v2', published_at: '2026-03-01T00:00:00Z' },
  ]);
  assert.equal(await api.previousRelease({ id: 5, published_at: '2026-03-01T00:00:00Z' }), 'v1.1');
  assert.equal(await api.previousRelease({ id: 5, published_at: '2026-03-01T00:00:00Z', prerelease: true }), 'v2-rc');
});

test('automatic baseline refuses empty, draft and incomplete release histories', async () => {
  await assert.rejects(client(() => []).previousRelease({ published_at: '2026-01-01' }), /No earlier/);
  await assert.rejects(client(() => []).previousRelease({}), /published release/);
  const api = client(() => Array(100).fill({ id: 1, tag_name: 'v1', published_at: '2026-01-01' }));
  await assert.rejects(api.previousRelease({ id: 2, published_at: '2026-02-01' }), /500-release/);
});

test('comparison paginates frozen SHAs, keeps first-page files, flags truncated commits', async () => {
  const paths = [];
  const api = client((url) => {
    paths.push(url.pathname);
    const page = Number(url.searchParams.get('page'));
    return { status: 'ahead', total_commits: 450, commits: Array(100).fill({ sha }),
      files: page === 1 ? Array(300).fill({ filename: 'x' }) : [] };
  });
  const data = await api.comparison(sha, 'b'.repeat(40));
  assert.equal(paths.length, 3);
  assert.ok(paths.every((path) => path.endsWith(`${sha}...${'b'.repeat(40)}`)));
  assert.equal(data.commits.length, 300);
  assert.equal(data.files.length, 300);
  assert.ok(data.warnings.some((value) => value.includes('300 of 450')));
  assert.ok(data.warnings.some((value) => value.includes('300 files')));
});

test('comparison refuses diverged and behind baselines; identical is valid', async () => {
  for (const status of ['diverged', 'behind']) {
    await assert.rejects(client(() => ({ status })).comparison(sha, sha), /same release line/);
  }
  const data = await client(() => ({ status: 'identical', total_commits: 0, commits: [], files: [] })).comparison(sha, sha);
  assert.equal(data.commits.length, 0);
});

test('PR evidence deduplicates and excludes unmerged or foreign-repository PRs', async () => {
  const api = client(() => [
    { number: 7, merged_at: '2026-01-01', base: { repo: { full_name: 'OWNER/REPO' } } },
    { number: 8, merged_at: null, base: { repo: { full_name: 'owner/repo' } } },
    { number: 9, merged_at: '2026-01-01', base: { repo: { full_name: 'other/repo' } } },
  ]);
  const result = await api.associatedPullRequests([{ sha }, { sha }]);
  assert.deepEqual(result.pullRequests.map((pr) => pr.number), [7]);
});

test('PR collection has a hard commit bound and explicit warning', async () => {
  let calls = 0;
  const api = client(() => { calls++; return []; });
  const data = await api.associatedPullRequests(Array(51).fill({ sha }));
  assert.equal(calls, 50);
  assert.ok(data.warnings[0].includes('first 50'));
});
