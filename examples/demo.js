import { renderBrief } from '../src/brief.js';

// Synthetic data only. No network access or real repository evidence.
const head = 'b'.repeat(40);
console.log(renderBrief({
  repository: 'example/shop', baseRef: 'v1.4.0', headRef: 'v1.5.0',
  baseSha: 'a'.repeat(40), headSha: head, totalCommits: 2,
  commits: [
    { sha: head, commit: { message: 'Preserve empty-cart fallback' } },
    { sha: 'c'.repeat(40), commit: { message: 'Add order lookup index' } },
  ],
  files: [
    { filename: 'src/checkout.js', status: 'modified', additions: 8, deletions: 3 },
    { filename: 'db/migrations/014_order_index.sql', status: 'added', additions: 2, deletions: 0 },
    { filename: 'package-lock.json', status: 'modified', additions: 15, deletions: 12 },
  ],
  pullRequests: [{ number: 42, title: 'Handle empty carts and speed up order lookup' }],
  automaticBase: true,
}));
