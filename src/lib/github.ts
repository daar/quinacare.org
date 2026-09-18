/**
 * The little of the GitHub REST API we need to file a fundraiser intake.
 *
 * Deliberately not Octokit: three endpoints and `fetch` is the whole
 * requirement, and a dependency that ships a full API client would be
 * more weight than the feature.
 *
 * Every call throws on failure. Callers are expected to catch and fall
 * back to email — GitHub being unreachable must never lose a submission.
 */
const API = "https://api.github.com";
const UA = "quinacare.org-intake";

export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  /** Branch the uploaded photos are committed to. */
  branch: string;
}

/**
 * Reads config from the environment. Returns null when unconfigured,
 * which is a supported state: the endpoint then delivers by email only.
 */
export function githubConfig(): GithubConfig | null {
  const token = import.meta.env.GITHUB_TOKEN;
  if (!token) return null;
  const slug = import.meta.env.GITHUB_REPO || "daar/quinacare.org";
  const [owner, repo] = slug.split("/");
  if (!owner || !repo) return null;
  return {
    token,
    owner,
    repo,
    branch: import.meta.env.GITHUB_INTAKE_BRANCH || "fundraiser-intake",
  };
}

async function api(
  cfg: GithubConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": UA,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

async function fail(res: Response, what: string): Promise<never> {
  const detail = await res.text().catch(() => "");
  throw new Error(`${what} failed (${res.status}): ${detail.slice(0, 300)}`);
}

/**
 * Make sure the upload branch exists, creating it from the default branch
 * if not. Photos are committed to a branch of their own so intake never
 * touches `main` — a commit there would trigger a production deploy for
 * every submission.
 */
async function ensureBranch(cfg: GithubConfig): Promise<void> {
  const existing = await api(
    cfg,
    `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${cfg.branch}`,
  );
  if (existing.ok) return;
  if (existing.status !== 404) await fail(existing, "branch lookup");

  const repo = await api(cfg, `/repos/${cfg.owner}/${cfg.repo}`);
  if (!repo.ok) await fail(repo, "repo lookup");
  const { default_branch } = (await repo.json()) as { default_branch: string };

  const head = await api(
    cfg,
    `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${default_branch}`,
  );
  if (!head.ok) await fail(head, "default branch lookup");
  const { object } = (await head.json()) as { object: { sha: string } };

  const created = await api(cfg, `/repos/${cfg.owner}/${cfg.repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${cfg.branch}`, sha: object.sha }),
  });
  // 422 means someone else created it between our check and our write.
  if (!created.ok && created.status !== 422) {
    await fail(created, "branch create");
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Commit a submitted photo and return a URL that renders inside an issue.
 * The repository is public, so the raw URL displays without a login.
 */
export async function uploadIntakeImage(
  cfg: GithubConfig,
  path: string,
  bytes: Uint8Array,
): Promise<string> {
  await ensureBranch(cfg);

  const res = await api(
    cfg,
    `/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(path)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: `intake: photo for ${path}`,
        content: toBase64(bytes),
        branch: cfg.branch,
      }),
    },
  );
  if (!res.ok) await fail(res, "image upload");

  return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${encodeURI(path)}`;
}

/**
 * Create the label if it is missing. Best-effort: a label that cannot be
 * created is not worth losing the issue over.
 */
async function ensureLabel(cfg: GithubConfig, label: string): Promise<boolean> {
  try {
    const res = await api(
      cfg,
      `/repos/${cfg.owner}/${cfg.repo}/labels/${encodeURIComponent(label)}`,
    );
    if (res.ok) return true;
    const created = await api(cfg, `/repos/${cfg.owner}/${cfg.repo}/labels`, {
      method: "POST",
      body: JSON.stringify({
        name: label,
        color: "0E8A16",
        description: "Fundraiser proposed through the website form",
      }),
    });
    return created.ok || created.status === 422;
  } catch {
    return false;
  }
}

export async function createIssue(
  cfg: GithubConfig,
  issue: { title: string; body: string; label?: string; assignees?: string[] },
): Promise<string> {
  const labels =
    issue.label && (await ensureLabel(cfg, issue.label)) ? [issue.label] : [];

  const res = await api(cfg, `/repos/${cfg.owner}/${cfg.repo}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: issue.title,
      body: issue.body,
      labels,
      ...(issue.assignees?.length ? { assignees: issue.assignees } : {}),
    }),
  });
  if (!res.ok) await fail(res, "issue create");

  const { html_url } = (await res.json()) as { html_url: string };
  return html_url;
}
