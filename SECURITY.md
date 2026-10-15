# Security policy

## Before you enable publication

- Review the code and pin the Action to a full commit SHA.
- Use the job-scoped `GITHUB_TOKEN`. Do not create a broad personal access token for this Action.
- Use `contents: read` and `pull-requests: read` for summaries. Add `contents: write` only for publication.
- Run publication on `release: published` or a trusted manual workflow. Do not grant write access to untrusted pull-request code.
- Use release-scoped workflow concurrency and avoid simultaneous manual release-body edits.
- Do not point `GITHUB_API_URL` at an untrusted endpoint. The runner's API and server URL configuration are trusted inputs.

## Boundaries

No checkout, shell execution, AI call, Specita credential, database, or third-party runtime dependency is required. GitHub metadata is still untrusted text. The renderer escapes Markdown/HTML control characters and suppresses mentions. It does not treat commit messages as executable instructions.

Collection is bounded. Missing permissions, rate limits, diverged history, identity changes, malformed managed markers, and oversized release notes stop publication. Existing notes are not intentionally replaced on these failures. A network error during PATCH can leave the write outcome uncertain. Check the release and rerun; the managed block makes a successful rerun idempotent.

GitHub's release API has no atomic text merge. A manual edit between the final read and PATCH can be lost. The Action cannot remove that provider limitation.

## Report a vulnerability

Email **support@specita.com**. Do not include tokens, private source, or customer data in a public issue. Describe the affected version, impact, and safe reproduction steps. Do not test vulnerabilities against other people's repositories.

This pre-release has local automated coverage. A live GitHub runner and release-write check are required before the first public version. There is no guaranteed response-time SLA for this free project.
