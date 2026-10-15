import { readFile, appendFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { GitHub } from './github.js';
import { run } from './run.js';

function input(name) { return process.env[`INPUT_${name.toUpperCase()}`]?.trim() ?? ''; }
function boolean(name, fallback) {
  const value = input(name);
  if (!value) return fallback;
  if (!['true', 'false'].includes(value)) throw new Error(`${name} must be true or false.`);
  return value === 'true';
}

try {
  const github = new GitHub({ token: input('github-token') || process.env.GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY, apiUrl: process.env.GITHUB_API_URL });
  const result = await run({ github,
    event: process.env.GITHUB_EVENT_PATH ? JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8')) : {},
    eventName: process.env.GITHUB_EVENT_NAME,
    baseRef: input('base-ref'), headRef: input('head-ref'), releaseId: input('release-id'),
    publish: boolean('publish', false), attribution: boolean('attribution', true), serverUrl: process.env.GITHUB_SERVER_URL });
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, result.brief);
  if (process.env.GITHUB_OUTPUT) {
    const delimiter = `specita_${randomUUID()}`;
    await appendFile(process.env.GITHUB_OUTPUT, `brief<<${delimiter}\n${result.brief}\n${delimiter}\nbase-sha=${result.baseSha}\nhead-sha=${result.headSha}\nupdated=${result.updated}\n`);
  }
  // Do not print repository text: it could contain workflow-command injection or private content.
  console.log(`Specita release brief generated. Release body ${result.updated ? 'updated' : 'unchanged'}.`);
} catch (error) {
  // Only our own sanitized errors are expected; never print stack traces, payloads, or tokens.
  const message = error instanceof SyntaxError ? 'Event or API JSON could not be parsed.' : error.message;
  const safe = String(message ?? 'Action failed.').replace(/[%\r\n]/g, ' ').slice(0, 400);
  console.error(`::error::${safe}`);
  process.exitCode = 1;
}
