export class GitHub {
  constructor({ token, repository, apiUrl = 'https://api.github.com', fetchImpl = fetch }) {
    if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(repository ?? '')
      || ['.', '..'].includes(repository.split('/')[1])) {
      throw new Error('GITHUB_REPOSITORY must be an owner/repository name.');
    }
    const url = new URL(apiUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      throw new Error('GitHub API URL must be an HTTPS URL without credentials, query, or fragment.');
    }
    if (!token) throw new Error('A repository-scoped GitHub token is required.');
    this.root = apiUrl.replace(/\/$/, '');
    this.repo = repository;
    this.path = `/repos/${repository.split('/').map(encodeURIComponent).join('/')}`;
    this.token = token;
    this.fetch = fetchImpl;
    this.deadline = Date.now() + 180_000;
  }

  async request(path, { method = 'GET', body } = {}) {
    // Never follow a redirect with the installation token. Never log API bodies.
    let response;
    try {
      const remaining = this.deadline - Date.now();
      if (remaining <= 0) throw new Error('Request budget exhausted.');
      response = await this.fetch(`${this.root}${this.path}${path}`, {
        method,
        redirect: 'error',
        signal: AbortSignal.timeout(Math.min(20_000, remaining)),
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'specita-release-brief',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new Error('GitHub request failed or timed out. No release write is retried automatically.');
    }
    if (!response.ok) {
      throw new Error(`GitHub returned HTTP ${response.status}. Check token permissions, API limits, and repository access.`);
    }
    return response.json();
  }

  async resolve(ref) {
    if (typeof ref !== 'string' || !ref.trim() || ref.length > 256 || /[\x00-\x1f\x7f]/.test(ref)) {
      throw new Error('A nonempty tag or commit reference of at most 256 characters is required.');
    }
    const commit = await this.request(`/commits/${encodeURIComponent(ref)}`);
    if (!/^[a-f0-9]{40,64}$/i.test(commit.sha ?? '')) throw new Error('GitHub did not return a valid commit SHA.');
    return commit.sha;
  }

  async release(id) {
    if (!/^[1-9]\d*$/.test(String(id))) throw new Error('release-id must be a positive integer.');
    return this.request(`/releases/${id}`);
  }

  async previousRelease(target) {
    if (!target.published_at || !Number.isFinite(Date.parse(target.published_at))) {
      throw new Error('Automatic baseline selection requires a published release. Set base-ref explicitly for a draft.');
    }
    const candidates = [];
    let exhausted = false;
    for (let page = 1; page <= 5; page++) {
      const releases = await this.request(`/releases?per_page=100&page=${page}`);
      for (const release of releases) {
        if (!release.draft && release.id !== target.id && (target.prerelease || !release.prerelease)
          && Date.parse(release.published_at) < Date.parse(target.published_at)) candidates.push(release);
      }
      if (releases.length < 100) { exhausted = true; break; }
    }
    // Listing order is not a publication-date guarantee. Do not silently choose from a partial scan.
    if (!exhausted) throw new Error('Release history exceeds the 500-release scan limit. Set base-ref explicitly.');
    candidates.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at) || b.id - a.id);
    if (!candidates.length) throw new Error('No earlier eligible published release was found. Set base-ref explicitly.');
    return candidates[0].tag_name;
  }

  async comparison(base, head) {
    const commits = [];
    let first;
    for (let page = 1; page <= 3; page++) {
      const data = await this.request(`/compare/${base}...${head}?per_page=100&page=${page}`);
      if (!first) {
        first = data;
        if (!['ahead', 'identical'].includes(data.status)) {
          throw new Error('Head must equal or descend from base. Choose a baseline from the same release line.');
        }
        if (!Number.isSafeInteger(data.total_commits) || data.total_commits < 0) {
          throw new Error('GitHub returned an invalid comparison count.');
        }
      }
      commits.push(...(data.commits ?? []));
      if (commits.length >= first.total_commits || (data.commits ?? []).length < 100) break;
    }
    const warnings = [];
    if (commits.length < first.total_commits) warnings.push(`Commit collection is incomplete: ${commits.length} of ${first.total_commits} commits (300-commit limit).`);
    const files = first.files ?? [];
    if (files.length >= 300) warnings.push('Changed-file evidence may be incomplete: GitHub returns at most 300 files per comparison.');
    return { commits, files, totalCommits: first.total_commits, warnings };
  }

  async associatedPullRequests(commits) {
    const prs = new Map();
    const warnings = [];
    const scanned = commits.slice(0, 50);
    if (commits.length > scanned.length) warnings.push('PR lookup covers only the first 50 collected commits.');
    for (const commit of scanned) {
      if (!/^[a-f0-9]{40,64}$/i.test(commit.sha ?? '')) throw new Error('GitHub returned an invalid comparison commit SHA.');
      for (let page = 1; page <= 3; page++) {
        const items = await this.request(`/commits/${commit.sha}/pulls?per_page=100&page=${page}`);
        for (const pr of items) {
          if (pr.merged_at && pr.base?.repo?.full_name?.toLowerCase() === this.repo.toLowerCase()
            && Number.isSafeInteger(pr.number) && pr.number > 0) prs.set(pr.number, pr);
        }
        if (items.length < 100) break;
        if (page === 3) warnings.push('At least one commit has more associated PRs than the 300-PR lookup limit.');
      }
    }
    return { pullRequests: [...prs.values()].sort((a, b) => a.number - b.number), warnings };
  }

  async updateRelease(id, body) {
    return this.request(`/releases/${id}`, { method: 'PATCH', body: { body } });
  }
}
