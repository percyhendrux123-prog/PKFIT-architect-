// netlify/functions/axiom-overseer.js
//
// AXIOM Overseer — daily editor's morning brief.
//
// Scheduled function. Reads the GitHub repo, synthesizes what matters across
// the bench (open PRs, issues by priority, 24h velocity, blockers), and posts
// a single markdown block to a dedicated Slack ops webhook.
//
// Sits ABOVE the bench. Doesn't ship code. Reads, synthesizes, posts.
//
// Schedule: defined in netlify.toml (`0 13 * * *` = 08:00 CT during CDT).
//
// Env (set in Netlify dashboard, never committed):
//   GITHUB_TOKEN          — PAT or fine-grained token, repo:read scope
//   GITHUB_OWNER          — defaults to "percyhendrux123-prog"
//   GITHUB_REPO           — defaults to "PKFIT-architect-"
//   SLACK_WEBHOOK_URL_OPS — incoming webhook for #axiom-build-ops (or DM)
//   DRY_RUN               — "1" to skip Slack post; returns rendered markdown
//                            in the function response (used by axiom:smoke)

const GH_API = 'https://api.github.com';

const cfg = () => ({
  token: process.env.GITHUB_TOKEN,
  owner: process.env.GITHUB_OWNER || 'percyhendrux123-prog',
  repo: process.env.GITHUB_REPO || 'PKFIT-architect-',
  // The branch the bench actually merges into. Velocity is measured here.
  buildBranch: process.env.GITHUB_BUILD_BRANCH || 'app-main',
  slackUrl: process.env.SLACK_WEBHOOK_URL_OPS,
  dryRun: process.env.DRY_RUN === '1',
});

// ─── HTTP helpers ────────────────────────────────────────────────────────────

async function gh(path, { token }) {
  const res = await fetch(`${GH_API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'axiom-overseer/1.0',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status} on ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ─── Data fetchers ───────────────────────────────────────────────────────────

async function fetchOpenPRs(c) {
  const prs = await gh(
    `/repos/${c.owner}/${c.repo}/pulls?state=open&per_page=50&sort=updated&direction=desc`,
    c,
  );
  // Enrich with CI status (combined check-runs from the head sha).
  const enriched = await Promise.all(
    prs.map(async (p) => {
      let ci = 'unknown';
      try {
        const checks = await gh(
          `/repos/${c.owner}/${c.repo}/commits/${p.head.sha}/check-runs?per_page=20`,
          c,
        );
        const runs = checks.check_runs || [];
        if (runs.length === 0) ci = 'no checks';
        else if (runs.some((r) => r.status !== 'completed')) ci = 'pending';
        else if (runs.every((r) => r.conclusion === 'success')) ci = 'green';
        else if (runs.some((r) => r.conclusion === 'failure')) ci = 'failing';
        else ci = runs.map((r) => r.conclusion).filter(Boolean).join(',') || 'mixed';
      } catch (e) {
        ci = `err:${e.message.slice(0, 30)}`;
      }
      return {
        number: p.number,
        title: p.title,
        author: p.user?.login || 'unknown',
        url: p.html_url,
        ci,
        updatedAt: p.updated_at,
        createdAt: p.created_at,
        draft: p.draft,
        ageHours: (Date.now() - new Date(p.updated_at).getTime()) / 36e5,
      };
    }),
  );
  return enriched;
}

async function fetchOpenIssuesByPriority(c) {
  // Pull all open issues (excluding PRs — GitHub returns both from this endpoint).
  const all = await gh(
    `/repos/${c.owner}/${c.repo}/issues?state=open&per_page=100`,
    c,
  );
  const issues = all.filter((i) => !i.pull_request);
  const bucket = (label) =>
    issues
      .filter((i) => i.labels.some((l) => l.name === label))
      .map((i) => ({ number: i.number, title: i.title, url: i.html_url }));
  return {
    high: bucket('priority:high'),
    medium: bucket('priority:medium'),
  };
}

async function fetchRecentlyClosedIssues(c) {
  const since = new Date(Date.now() - 7 * 24 * 36e5).toISOString();
  const closed = await gh(
    `/repos/${c.owner}/${c.repo}/issues?state=closed&since=${since}&per_page=50&sort=updated&direction=desc`,
    c,
  );
  return closed
    .filter((i) => !i.pull_request)
    .slice(0, 3)
    .map((i) => ({ number: i.number, title: i.title, url: i.html_url }));
}

async function fetchVelocity24h(c) {
  const sinceIso = new Date(Date.now() - 24 * 36e5).toISOString();

  // Merged PRs in last 24h. PRs endpoint can't filter by merged_at; sort by
  // updated and stop early.
  const recent = await gh(
    `/repos/${c.owner}/${c.repo}/pulls?state=closed&base=${c.buildBranch}&per_page=50&sort=updated&direction=desc`,
    c,
  );
  const merged24h = recent.filter(
    (p) => p.merged_at && new Date(p.merged_at).getTime() > Date.now() - 24 * 36e5,
  );

  // Sum +/- across those PRs (each fetch needed for additions/deletions).
  let additions = 0;
  let deletions = 0;
  for (const p of merged24h) {
    try {
      const full = await gh(`/repos/${c.owner}/${c.repo}/pulls/${p.number}`, c);
      additions += full.additions || 0;
      deletions += full.deletions || 0;
    } catch {
      /* skip — best-effort line counts */
    }
  }

  // Top contributor by commit count in the last 24h.
  const commits = await gh(
    `/repos/${c.owner}/${c.repo}/commits?sha=${c.buildBranch}&since=${sinceIso}&per_page=100`,
    c,
  );
  const tally = {};
  for (const c2 of commits) {
    const who = c2.author?.login || c2.commit?.author?.name || 'unknown';
    tally[who] = (tally[who] || 0) + 1;
  }
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];

  return {
    mergedCount: merged24h.length,
    additions,
    deletions,
    topContributor: top ? `${top[0]} (${top[1]})` : 'none',
  };
}

// ─── Renderer ────────────────────────────────────────────────────────────────

function fmtPR(p) {
  const blocker = p.ci === 'failing' ? ' — CI red' : p.draft ? ' — draft' : '';
  const stale = p.ageHours > 24 ? ` — stale ${Math.round(p.ageHours)}h` : '';
  const updated = new Date(p.updatedAt).toISOString().slice(0, 16).replace('T', ' ');
  return `- #${p.number} — ${p.title} — ${p.author} — CI: ${p.ci} — last update ${updated}Z${blocker}${stale}`;
}

function fmtIssueList(items) {
  if (items.length === 0) return '_(none)_';
  return items.map((i) => `  - #${i.number} — ${i.title}`).join('\n');
}

function render({ date, prs, issues, recentlyClosed, velocity }) {
  const stalePRs = prs.filter((p) => p.ageHours > 24 && !p.draft);
  const failingPRs = prs.filter((p) => p.ci === 'failing');

  const blockerLines = [];
  if (stalePRs.length > 0) {
    for (const p of stalePRs) {
      blockerLines.push(
        `- PR awaiting review > 24h: #${p.number} ${p.title} (${Math.round(p.ageHours)}h)`,
      );
    }
  }
  if (failingPRs.length > 0) {
    for (const p of failingPRs) {
      blockerLines.push(`- Failing CI: #${p.number} ${p.title} — ${p.url}`);
    }
  }
  if (blockerLines.length === 0) blockerLines.push('- None.');

  // One-sentence recommendation. Mechanism-first, no hype.
  let rec;
  if (failingPRs.length > 0) {
    rec = `Land the red CI on #${failingPRs[0].number} before opening anything new.`;
  } else if (stalePRs.length > 0) {
    rec = `Clear the stalest PR (#${stalePRs[0].number}, ${Math.round(stalePRs[0].ageHours)}h) — review or close.`;
  } else if (issues.high.length > 0) {
    rec = `Pick up high-priority issue #${issues.high[0].number} — nothing on the bench is blocked.`;
  } else if (prs.length > 0) {
    rec = `Bench is healthy. Merge what's reviewable, then start the next high-priority issue.`;
  } else {
    rec = `Quiet day. Use it to harden tests or write the next ADR.`;
  }

  return [
    `*Axiom Overseer — pkfit-app build, ${date}*`,
    ``,
    `*Open PRs (state)* ▸`,
    prs.length === 0 ? '_(none)_' : prs.map(fmtPR).join('\n'),
    ``,
    `*Issues by priority* ▸`,
    `*high (open):* ${issues.high.length}`,
    fmtIssueList(issues.high),
    `*medium (open):* ${issues.medium.length}`,
    fmtIssueList(issues.medium),
    recentlyClosed.length === 0
      ? `*recently closed:* _(none in last 7d)_`
      : `*recently closed:*\n${fmtIssueList(recentlyClosed)}`,
    ``,
    `*Build velocity* ▸`,
    `- Merged in last 24h: ${velocity.mergedCount} ${velocity.mergedCount === 1 ? 'PR' : 'PRs'}`,
    `- Lines changed: +${velocity.additions} / -${velocity.deletions}`,
    `- Top contributor (by commits): ${velocity.topContributor}`,
    ``,
    `*Blockers* ▸`,
    blockerLines.join('\n'),
    ``,
    `*Today's recommendation* ▸`,
    rec,
  ].join('\n') + '\n';
}

// ─── Slack post ──────────────────────────────────────────────────────────────

async function postToSlack(text, c) {
  const res = await fetch(c.slackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, mrkdwn: true }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack ${res.status}: ${body.slice(0, 200)}`);
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const handler = async () => {
  const c = cfg();
  if (!c.token) {
    if (!c.dryRun) {
      return { statusCode: 500, body: JSON.stringify({ error: 'GITHUB_TOKEN missing' }) };
    }
    // eslint-disable-next-line no-console
    console.warn('[axiom-overseer] GITHUB_TOKEN unset — falling back to unauthenticated API (rate-limited, public repos only).');
  }
  if (!c.dryRun && !c.slackUrl) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'SLACK_WEBHOOK_URL_OPS missing (or set DRY_RUN=1)' }),
    };
  }

  try {
    const [prs, issues, recentlyClosed, velocity] = await Promise.all([
      fetchOpenPRs(c),
      fetchOpenIssuesByPriority(c),
      fetchRecentlyClosedIssues(c),
      fetchVelocity24h(c),
    ]);

    const date = new Date().toISOString().slice(0, 10);
    const text = render({ date, prs, issues, recentlyClosed, velocity });

    if (c.dryRun) {
      // Body holds the rendered markdown; caller decides what to do with it.
      return { statusCode: 200, body: text };
    }

    await postToSlack(text, c);
    return { statusCode: 200, body: JSON.stringify({ ok: true, posted: true }) };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('axiom-overseer failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Exported for the smoke-test runner (scripts/axiom-smoke.js).
export const __internals = {
  render,
  fetchOpenPRs,
  fetchOpenIssuesByPriority,
  fetchRecentlyClosedIssues,
  fetchVelocity24h,
  cfg,
};
