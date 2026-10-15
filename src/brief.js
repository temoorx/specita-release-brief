export const START = '<!-- specita-release-brief:start -->';
export const END = '<!-- specita-release-brief:end -->';

// Render repository-controlled strings as inert text, not Markdown, HTML, or mentions.
export function text(value, limit = 180) {
  return String(value ?? '').replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .slice(0, limit).replace(/[&<>\[\]()`*_~|\\@#!.:]/g, (char) => `&#${char.charCodeAt(0)};`);
}

export function reviewPrompts(files) {
  const rules = [
    ['Database changes', /(^|\/)(migrations?|schema)(\/|\.)|\.sql$/i, 'Check migration order, compatibility with the previous version, and the recovery plan.'],
    ['Authentication and access', /(^|\/)(auth(?:entication|orization)?|permissions?|policies|sessions?)(\/|\.)/i, 'Check sign-in, session expiry, and access-denied paths.'],
    ['Dependencies', /(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|go\.(mod|sum)|Cargo\.(toml|lock)|pubspec\.(yaml|lock)|Podfile(\.lock)?|requirements[^/]*\.txt|poetry\.lock|Gemfile(\.lock)?|build\.gradle(\.kts)?)$/i, 'Review dependency changes and run the relevant compatibility checks.'],
    ['Deployment configuration', /(^|\/)(\.github\/workflows|terraform|k8s|helm)(\/|$)|(^|\/)(Dockerfile[^/]*|docker-compose[^/]*|compose\.ya?ml|wrangler\.[^/]+|vercel\.json|netlify\.toml)$/i, 'Check environment settings, deployment order, and rollback behaviour.'],
  ];
  return rules.flatMap(([title, pattern, prompt]) => {
    const matching = files.filter((file) => [file.filename, file.previous_filename].some((path) => path && pattern.test(path)));
    return matching.length ? [{ title, prompt, files: matching }] : [];
  });
}

export function renderBrief({ repository, serverUrl = 'https://github.com', baseRef, headRef, baseSha, headSha,
  commits, files, totalCommits, pullRequests, warnings = [], attribution = true, automaticBase = false }) {
  const server = new URL(serverUrl);
  if (server.protocol !== 'https:' || server.username || server.password || server.search || server.hash || server.pathname !== '/') {
    throw new Error('GITHUB_SERVER_URL must be an HTTPS origin.');
  }
  const root = `${server.origin}/${repository.split('/').map(encodeURIComponent).join('/')}`;
  const compare = `${root}/compare/${baseSha}...${headSha}`;
  const prompts = reviewPrompts(files);
  const notes = [...warnings];
  if (commits.length > 40) notes.push(`The brief displays 40 of ${commits.length} collected commits. Use the comparison link for more.`);
  if (files.length > 60) notes.push(`The brief displays 60 of ${files.length} returned files. Review prompts use all returned files.`);
  if (pullRequests.length > 30) notes.push(`The brief displays 30 of ${pullRequests.length} associated merged PRs.`);
  const lines = [
    '## Specita Release Brief', '',
    `[View exact comparison](${compare}) · **${totalCommits} commits** · **${files.length} files returned** · **${pullRequests.length} associated merged PRs found**`, '',
    `**Base:** ${text(baseRef)} → [${baseSha.slice(0, 12)}](${root}/commit/${baseSha})  `,
    `**Head:** ${text(headRef)} → [${headSha.slice(0, 12)}](${root}/commit/${headSha})`, '',
    automaticBase ? 'Baseline: the most recently published eligible release before this release. This is not necessarily the nearest Git tag.' : 'Baseline: explicitly selected by the workflow.', '',
    '### Review before shipping', '',
    'These prompts use file paths only. They do not establish a defect, breaking change, security finding, or release approval.', '',
  ];
  if (!prompts.length) lines.push('No configured review areas matched the returned file paths. This is not a clean bill of health.', '');
  for (const item of prompts) {
    lines.push(`- **${item.title}:** ${item.prompt} (${item.files.length} matching files)`);
    for (const file of item.files.slice(0, 3)) lines.push(`  - ${text(file.filename)}`);
  }
  lines.push('', '### Associated merged pull requests', '',
    'GitHub associates these PRs with the scanned commits. This does not prove that each entire PR was introduced in this range.', '');
  for (const pr of pullRequests.slice(0, 30)) lines.push(`- [#${pr.number}](${root}/pull/${pr.number}) ${text(pr.title)}`);
  if (!pullRequests.length) lines.push('No associated merged PRs were found in the scanned commits. Direct commits and cherry-picks may have no PR association.');
  lines.push('', '### Commits', '');
  for (const commit of commits.slice(0, 40)) lines.push(`- [${commit.sha.slice(0, 12)}](${root}/commit/${commit.sha}) ${text(commit.commit?.message?.split('\n')[0])}`);
  if (!commits.length) lines.push('No commits in this comparison.');
  lines.push('', '### Changed files', '', '| File | Status | + / − |', '| --- | --- | --- |');
  for (const file of files.slice(0, 60)) lines.push(`| ${text(file.filename)} | ${text(file.status, 30)} | ${Number.isSafeInteger(file.additions) ? file.additions : '?'} / ${Number.isSafeInteger(file.deletions) ? file.deletions : '?'} |`);
  if (!files.length) lines.push('| No files returned | — | — |');
  lines.push('', '### Evidence limits', '',
    '- Source evidence only. No deployment, test result, crash, adoption, or causal conclusion is inferred.',
    '- PR lookup is bounded to 50 commits and 300 associated PRs per scanned commit. File evidence is bounded by GitHub’s 300-file comparison limit.');
  for (const warning of [...new Set(notes)]) lines.push(`- ${text(warning, 500)}`);
  if (attribution) lines.push('', '[Powered by Specita](https://specita.com/?utm_source=github&utm_medium=release-brief&utm_campaign=standalone-action) — connect source changes to delivery and runtime evidence.');
  return `${lines.join('\n').trim()}\n`;
}

export function mergeBrief(body, brief) {
  body = body ?? '';
  const starts = body.split(START).length - 1;
  const ends = body.split(END).length - 1;
  const managed = `${START}\n${brief.trim()}\n${END}`;
  let result;
  if (!starts && !ends) result = body ? `${body}\n\n${managed}` : managed;
  else {
    if (starts !== 1 || ends !== 1 || body.indexOf(START) > body.indexOf(END)) {
      throw new Error('Release contains malformed or duplicate Specita markers. No release update was made.');
    }
    result = body.slice(0, body.indexOf(START)) + managed + body.slice(body.indexOf(END) + END.length);
  }
  if (result.length > 60_000) throw new Error('Combined release body exceeds the 60,000-character safety limit. Use summary-only mode.');
  return result;
}
