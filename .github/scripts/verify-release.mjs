import assert from 'node:assert/strict';
import { mergeBrief, START, END } from '../../src/brief.js';

// This workflow is deliberately limited to synthetic releases in the Action repository.
assert.equal(process.env.GITHUB_REPOSITORY, 'temoorx/specita-release-brief');
assert.match(process.env.RELEASE_ID ?? '', /^[1-9]\d*$/);
assert.ok(process.env.GH_TOKEN);
const response = await fetch(`https://api.github.com/repos/temoorx/specita-release-brief/releases/${process.env.RELEASE_ID}`, {
  headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.GH_TOKEN}` },
  redirect: 'error', signal: AbortSignal.timeout(20_000),
});
assert.equal(response.status, 200, 'Read the exact validation release');
const release = await response.json();
assert.match(release.tag_name, /^validation-/);
assert.equal(release.prerelease, true);
const original = 'Synthetic release used only to validate Specita Release Brief. No application was shipped.\n\nMaintainer note: keep this text intact.';
if (process.argv[2] === 'guard') {
  assert.ok(release.body.startsWith(original));
  console.log('Synthetic release identity guard passed.');
} else {
  assert.equal(process.argv[2], 'verify');
  assert.ok(['true', 'false'].includes(process.env.FIRST_UPDATED));
  assert.equal(process.env.SECOND_UPDATED, 'false');
  assert.equal(process.env.FIRST_BRIEF, process.env.SECOND_BRIEF);
  assert.match(process.env.BASE_SHA ?? '', /^[a-f0-9]{40}$/);
  assert.match(process.env.HEAD_SHA ?? '', /^[a-f0-9]{40}$/);
  assert.ok(process.env.FIRST_BRIEF.includes(`/compare/${process.env.BASE_SHA}...${process.env.HEAD_SHA}`));
  assert.equal(release.body, mergeBrief(original, process.env.FIRST_BRIEF));
  assert.equal(release.body.split(START).length - 1, 1);
  assert.equal(release.body.split(END).length - 1, 1);
  assert.match(process.env.FIRST_BRIEF, /Associated merged pull requests/);
  assert.ok(process.env.FIRST_BRIEF.includes('/pull/'), 'A real merged PR must be linked');
  console.log(`Live release checks passed. First update: ${process.env.FIRST_UPDATED}. Repeat update: false. Human notes preserved; one managed block; exact comparison and merged PR linked.`);
}
