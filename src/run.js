import { renderBrief, mergeBrief } from './brief.js';

export async function run({ github, event = {}, eventName, baseRef, headRef, releaseId,
  publish = false, attribution = true, serverUrl }) {
  const targetId = releaseId || event.release?.id;
  if (publish && !((eventName === 'release' && event.action === 'published') || eventName === 'workflow_dispatch')) {
    throw new Error('Publishing requires release.published or an explicit workflow_dispatch.');
  }
  if (publish && !targetId) throw new Error('Publishing requires a target release ID.');
  const target = targetId ? await github.release(targetId) : null;
  if (target?.draft && publish) throw new Error('This version does not publish to draft releases.');
  const effectiveHead = headRef || target?.tag_name;
  if (!effectiveHead) throw new Error('Set head-ref when there is no target release.');
  const automaticBase = !baseRef;
  if (automaticBase && !target) throw new Error('Set base-ref when there is no target release.');
  const effectiveBase = baseRef || await github.previousRelease(target);
  const baseSha = await github.resolve(effectiveBase);
  const headSha = await github.resolve(effectiveHead);
  const comparison = await github.comparison(baseSha, headSha);
  const prs = await github.associatedPullRequests(comparison.commits);
  const brief = renderBrief({ repository: github.repo, serverUrl, baseRef: effectiveBase, headRef: effectiveHead,
    baseSha, headSha, ...comparison, ...prs, warnings: [...comparison.warnings, ...prs.warnings], attribution, automaticBase });
  let updated = false;
  if (publish) {
    // Re-read human notes immediately before PATCH. Workflow concurrency serializes Action runs.
    // GitHub provides no atomic body merge; simultaneous manual edits remain a documented limitation.
    const latest = await github.release(targetId);
    if (latest.draft || latest.tag_name !== target.tag_name || await github.resolve(latest.tag_name) !== headSha) {
      throw new Error('Release identity changed or head-ref does not match its tag. No release update was made.');
    }
    const body = mergeBrief(latest.body, brief);
    if (body !== (latest.body ?? '')) {
      await github.updateRelease(targetId, body);
      updated = true;
    }
  }
  return { brief, baseSha, headSha, updated };
}
