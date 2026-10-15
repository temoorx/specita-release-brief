import test from 'node:test';
import assert from 'node:assert/strict';
import { text, reviewPrompts, renderBrief, mergeBrief, START, END } from '../src/brief.js';

const base = 'a'.repeat(40);
const head = 'b'.repeat(40);
const evidence = {
  repository: 'example/project', baseRef: 'v1', headRef: 'v2', baseSha: base, headSha: head,
  commits: [{ sha: head, commit: { message: 'Fix checkout\nPrivate extra detail' } }],
  files: [{ filename: 'src/checkout.js', status: 'modified', additions: 2, deletions: 1 }],
  totalCommits: 1, pullRequests: [{ number: 7, title: 'Fix checkout' }], warnings: [],
};

test('renders exact comparison, PR and commit citations with explicit evidence boundaries', () => {
  const brief = renderBrief(evidence);
  assert.ok(brief.includes(`/compare/${base}...${head}`));
  assert.ok(brief.includes('/pull/7'));
  assert.ok(brief.includes(`/commit/${head}`));
  assert.ok(brief.includes('No deployment, test result, crash, adoption, or causal conclusion'));
  assert.ok(!brief.includes('Private extra detail'));
  assert.ok(brief.includes('This is not a clean bill of health'));
});

test('inert rendering blocks HTML, Markdown links, mentions, and managed markers', () => {
  const hostile = '[click](https://evil.test) <img src=x> @all `x`\n' + START;
  const escaped = text(hostile);
  for (const token of ['[click]', '<img', '@all', '`x`', START]) assert.ok(!escaped.includes(token));
  assert.ok(!escaped.includes('\n'));
  assert.ok(!text('\u202eevil').includes('\u202e'));
  assert.ok(!text('https://evil.test www.evil.test').includes('https:'));
  assert.ok(!text('https://evil.test www.evil.test').includes('www.'));
  const brief = renderBrief({ ...evidence, pullRequests: [{ number: 7, title: hostile }] });
  assert.ok(!brief.includes(START));
  assert.ok(!brief.includes('[click](https://evil.test)'));
});

test('detects four configured review areas including renamed files, without claiming defects', () => {
  const files = ['db/migrations/001.sql', 'src/auth/session.js', 'pnpm-lock.yaml', '.github/workflows/release.yml']
    .map((filename) => ({ filename }));
  assert.equal(reviewPrompts(files).length, 4);
  assert.equal(reviewPrompts([{ filename: 'archived.txt', previous_filename: 'src/auth/login.js' }]).length, 1);
  assert.equal(reviewPrompts([{ filename: 'docs/author.md' }]).length, 0);
  assert.ok(renderBrief({ ...evidence, files }).includes('They do not establish a defect'));
});

test('attribution is removable and automatic baseline is labelled accurately', () => {
  assert.ok(!renderBrief({ ...evidence, attribution: false }).includes('specita.com/'));
  assert.ok(renderBrief({ ...evidence, automaticBase: true }).includes('not necessarily the nearest Git tag'));
});

test('large comparisons show explicit display limits', () => {
  const brief = renderBrief({ ...evidence, commits: Array(45).fill(evidence.commits[0]),
    files: Array(65).fill(evidence.files[0]), pullRequests: Array(35).fill(evidence.pullRequests[0]),
    totalCommits: 45, warnings: ['Collection warning'] });
  for (const value of ['40 of 45', '60 of 65', '30 of 35', 'Collection warning']) assert.ok(brief.includes(value));
});

test('managed section appends without changing original notes; repeated update is idempotent', () => {
  const original = 'My release notes.\n\nKeep this whitespace.\n';
  const first = mergeBrief(original, 'Brief one\n');
  assert.ok(first.startsWith(original + '\n\n'));
  assert.equal(mergeBrief(first, 'Brief one\n'), first);
  const withTail = first + '\nHuman footer';
  const updated = mergeBrief(withTail, 'Brief two');
  assert.ok(updated.startsWith(original + '\n\n'));
  assert.ok(updated.endsWith('\nHuman footer'));
  assert.ok(!updated.includes('Brief one'));
  assert.equal(updated.split(START).length, 2);
});

test('malformed or duplicate managed markers fail without replacing human notes', () => {
  for (const body of [START, END, END + START, START + END + START + END]) {
    assert.throws(() => mergeBrief(body, 'brief'), /malformed or duplicate/);
  }
  assert.throws(() => mergeBrief('a'.repeat(60_000), 'brief'), /safety limit/);
  assert.ok(mergeBrief(null, 'brief').startsWith(START));
});

test('server origin must be HTTPS and must not embed credentials or a path', () => {
  for (const serverUrl of ['http://github.com', 'https://user:secret@github.com', 'https://github.com/path']) {
    assert.throws(() => renderBrief({ ...evidence, serverUrl }));
  }
});
