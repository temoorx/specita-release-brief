# Synthetic example

This report uses fabricated sample data. Its repository and commit links are illustrative, not live evidence.

## Specita Release Brief

[View exact comparison](https://github.com/example/shop/compare/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa...bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb) · **2 commits** · **3 files returned** · **1 associated merged PRs found**

**Base:** v1&#46;4&#46;0 → [aaaaaaaaaaaa](https://github.com/example/shop/commit/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa)

**Head:** v1&#46;5&#46;0 → [bbbbbbbbbbbb](https://github.com/example/shop/commit/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb)

Baseline: the most recently published eligible release before this release. This is not necessarily the nearest Git tag.

### Review before shipping

These prompts use file paths only. They do not establish a defect, breaking change, security finding, or release approval.

- **Database changes:** Check migration order, compatibility with the previous version, and the recovery plan. (1 matching files)
  - db/migrations/014&#95;order&#95;index&#46;sql
- **Dependencies:** Review dependency changes and run the relevant compatibility checks. (1 matching files)
  - package-lock&#46;json

### Associated merged pull requests

GitHub associates these PRs with the scanned commits. This does not prove that each entire PR was introduced in this range.

- [#42](https://github.com/example/shop/pull/42) Handle empty carts and speed up order lookup

### Commits

- [bbbbbbbbbbbb](https://github.com/example/shop/commit/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb) Preserve empty-cart fallback
- [cccccccccccc](https://github.com/example/shop/commit/cccccccccccccccccccccccccccccccccccccccc) Add order lookup index

### Changed files

| File | Status | + / − |
| --- | --- | --- |
| src/checkout&#46;js | modified | 8 / 3 |
| db/migrations/014&#95;order&#95;index&#46;sql | added | 2 / 0 |
| package-lock&#46;json | modified | 15 / 12 |

### Evidence limits

- Source evidence only. No deployment, test result, crash, adoption, or causal conclusion is inferred.
- PR lookup is bounded to 50 commits and 300 associated PRs per scanned commit. File evidence is bounded by GitHub’s 300-file comparison limit.

[Powered by Specita](https://specita.com/?utm_source=github&utm_medium=release-brief&utm_campaign=standalone-action) — connect source changes to delivery and runtime evidence.
