# Specita Release Brief

**A release brief with receipts. Not another list of PR titles.**

See the exact commits, associated pull requests, changed files, and areas worth reviewing before you ship. Runs inside GitHub Actions. No Specita account. No AI key. No source upload to Specita.

> Standalone and open source. Read-only generation and release-note publication have been verified on GitHub-hosted runners using clearly labelled synthetic releases. [View the validation run](https://github.com/temoorx/specita-release-brief/actions/runs/38932959266).

[See a generated brief with synthetic sample data →](examples/brief.md)

## What you get

- An exact base → head comparison, pinned to commit SHAs.
- Commit and associated merged-PR links.
- Changed files with addition/deletion counts.
- Path-based review prompts for database migrations, authentication, dependencies, and deployment configuration.
- Visible warnings when collection or display limits apply.
- A GitHub job summary, a Markdown output, and optional release-note publication.

GitHub's built-in release notes already list merged PRs and contributors. This Action adds a source-evidence brief and a small review checklist. It does not replace a code review, test run, or runtime monitor.

## Try it without changing release notes

Save this workflow as `.github/workflows/release-brief.yml` in your repository:

```yaml
name: Release brief
on:
  release:
    types: [published]

permissions:
  contents: read
  pull-requests: read

jobs:
  brief:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: temoorx/specita-release-brief@v0.1.0
        # For production, replace the version tag with the reviewed full commit SHA.
        with:
          publish: 'false'
```

Open the workflow run's **Summary** tab to read the brief. This mode does not update a release. No repository checkout, package install, or personal access token is required.

The automatic baseline is the eligible release published most recently **before** this release. Stable releases exclude prerelease baselines. Prereleases can use either. This is not necessarily the nearest Git tag or the highest semantic version.

The baseline must be an ancestor of the head. For a first release, backport, or separate release line, set `base-ref` explicitly. The Action will not silently summarize the repository's whole history.

## Add the brief to each release

Use the same workflow with these changes:

```yaml
permissions:
  contents: write
  pull-requests: read

# Use the same concurrency group in every workflow that runs this Action.
concurrency:
  group: specita-release-brief-${{ github.repository }}-${{ github.event.release.id }}
  cancel-in-progress: false

jobs:
  brief:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: temoorx/specita-release-brief@v0.1.0
        with:
          publish: 'true'
          # Optional: choose the exact baseline instead of automatic selection.
          # base-ref: v1.4.0
```

This appends a section bounded by:

```html
<!-- specita-release-brief:start -->
<!-- specita-release-brief:end -->
```

Future runs replace only that section. Text outside it is preserved. An identical rerun does not make another write. Malformed or duplicate markers stop publication rather than risk replacing the wrong section.

The Action rereads release notes immediately before updating them. GitHub does not provide an atomic text-merge operation for release bodies. Avoid manually editing the notes while the Action is publishing. Workflow concurrency prevents conflicting Action runs, not simultaneous human edits.

## Manual comparisons

Use `workflow_dispatch` and pass both `base-ref` and `head-ref` for a summary-only comparison. For manual publication, also pass the numeric `release-id` and `publish: 'true'`. The resolved head must match the target release's tag. Draft publication is not supported in this version.

Do not pass untrusted PR text through an inline shell command. Prefer the Action's rendered job summary. If another step consumes the `brief` output, pass it through an environment variable or a file, not a shell source string.

## Inputs and outputs

| Input | Default | Purpose |
| --- | --- | --- |
| `github-token` | `${{ github.token }}` | Repository-scoped token. No Specita token needed. |
| `base-ref` | Automatic | Previous eligible published release, or your explicit tag/SHA. |
| `head-ref` | Target release tag | Explicit tag/SHA for manual comparisons. |
| `release-id` | Event release ID | Target for manual publication. |
| `publish` | `false` | Opt in to updating the managed release section. |
| `attribution` | `true` | Include a removable Powered by Specita link. |

Outputs: `brief` (Markdown), `base-sha`, `head-sha`, `updated` (`true` or `false`).

## Limits and honest claims

- Review prompts match paths, including old paths of renamed files. They do not inspect patches. False positives and missed areas are possible.
- Source evidence does **not** establish deployment success, passing tests, release safety, crashes, installed-version share, or causation.
- The comparison collects up to 300 commits. The brief displays up to 40.
- GitHub returns at most 300 changed files for a comparison. At that boundary, the brief warns that file coverage may be incomplete. It displays up to 60 files; prompts use all returned files.
- PR lookup scans the first 50 collected commits, with at most three pages of 100 PR associations per commit. It displays up to 30 deduplicated merged PRs from the same repository. Association is not proof that an entire PR was introduced in this range.
- Automatic baseline selection scans up to 500 releases. A full scan at that limit requires an explicit baseline rather than guessing from partial history.
- API requests have a 20-second timeout and a shared three-minute request budget. API errors fail the run. Writes are not automatically retried.
- Publication stops if the tag moves, the supplied head does not match, or the combined notes exceed 60,000 characters.
- Standard GitHub-hosted runners are free for public repositories. Private-repository quotas and other runner charges follow [GitHub's billing rules](https://docs.github.com/en/actions/concepts/billing-and-usage). The Action itself has no charge.
- Node 24 on a current GitHub Actions runner is required. GitHub Enterprise Server compatibility has not been verified.

## Data and security

This Action calls only the runner-configured GitHub API. It does not call Specita, an AI provider, or an analytics endpoint. It fetches metadata, not file contents, and does not execute repository code. The GitHub comparison response can include patches; the Action does not process or print those patches.

The token is sent only to the configured API endpoint. Redirects are refused. Repository-controlled titles, filenames, and messages are escaped before rendering. API response bodies and repository text are not written to the console.

Generated content is stored in GitHub job summaries, workflow outputs, and, when enabled, release notes. Their visibility follows your repository and workflow settings. Review private metadata before copying it elsewhere.

The optional attribution link contains fixed campaign parameters. The Action does not send click telemetry. Visiting the link opens Specita under the site's normal privacy policy.

Read [SECURITY.md](SECURITY.md) before enabling write permissions.

## Local development

Node 24 or later. No dependencies and no install step.

```sh
npm run check
npm test
npm run demo
```

The demo uses synthetic data and makes no network requests. Local tests use stubbed GitHub responses; they do not create releases or spend runner minutes.

The separate `Validate release publishing` workflow uses only synthetic prereleases in this repository. [The hosted validation](https://github.com/temoorx/specita-release-brief/actions/runs/38932959266) passed with a read-only summary job and a write-enabled publishing job. It verified the automatic baseline, a real merged PR link, preserved maintainer notes, and a second run with no duplicate write. This is controlled test evidence, not a claim of customer adoption or universal compatibility. That validation workflow's manual trigger accepts only releases whose tags start with `validation-`; this guard does not restrict ordinary consumer workflows.

## From source changes to runtime evidence

The free Action answers: **What changed, and what should I review?**

[Specita](https://specita.com/?utm_source=github&utm_medium=readme&utm_campaign=standalone-action) connects source changes to reported deliveries and available runtime evidence. Connecting the product is optional; this Action remains standalone.

## License

MIT. Attribution in generated briefs is optional. The license notice still applies to distributed copies of the software.
