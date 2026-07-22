import type { GithubConfig } from "../config.ts";

/** Minimal shape of a GitHub notification we care about. */
export interface GithubNotification {
  id: string;
  reason: string;
  updated_at: string;
  subject: {
    title: string;
    url: string | null;
    latest_comment_url: string | null;
    type: string;
  };
  repository: {
    full_name: string;
    name: string;
    owner: { login: string };
  };
}

export interface NotificationsResult {
  notifications: GithubNotification[];
  /** Server-suggested minimum seconds until the next poll. */
  pollIntervalSeconds: number | null;
  /** Value to send back as If-Modified-Since on the next poll. */
  lastModified: string | null;
  /** True when the server returned 304 Not Modified (no new notifications). */
  notModified: boolean;
}

export class GithubClient {
  /** Fine-grained token for issues/PRs/reactions/user. */
  private readonly actionToken: string;
  /** Token for the notifications API (classic PAT with `notifications` scope). */
  private readonly notificationsToken: string;
  private readonly baseUrl: string;

  constructor(config: GithubConfig) {
    this.actionToken = config.token;
    this.notificationsToken = config.notificationsToken;
    this.baseUrl = config.apiBaseUrl;
  }

  private headers(token: string, extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "integrations",
      ...extra,
    };
  }

  /** Returns the login of the account the token belongs to. */
  async getAuthenticatedLogin(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/user`, { headers: this.headers(this.actionToken) });
    if (!res.ok) {
      throw new Error(`GET /user failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as { login: string };
    return body.login;
  }

  async listNotifications(lastModified: string | null): Promise<NotificationsResult> {
    const res = await fetch(`${this.baseUrl}/notifications?all=false`, {
      headers: this.headers(
        this.notificationsToken,
        lastModified ? { "If-Modified-Since": lastModified } : undefined,
      ),
    });

    const pollHeader = res.headers.get("x-poll-interval");
    const pollIntervalSeconds = pollHeader ? Number(pollHeader) : null;

    if (res.status === 304) {
      return { notifications: [], pollIntervalSeconds, lastModified, notModified: true };
    }
    if (!res.ok) {
      let hint = "";
      if (res.status === 403) {
        hint =
          " — the notifications token lacks access. The notifications API needs a" +
          " classic PAT with the `notifications` scope (fine-grained PATs do not" +
          " work here); set GITHUB_TOKEN_CLASSIC_NOTIFICATIONS.";
      }
      throw new Error(`GET /notifications failed: ${res.status} ${await res.text()}${hint}`);
    }

    const notifications = (await res.json()) as GithubNotification[];
    return {
      notifications,
      pollIntervalSeconds,
      lastModified: res.headers.get("last-modified") ?? lastModified,
      notModified: false,
    };
  }

  /** Returns the logins currently assigned to an issue or PR (via its API URL). */
  async listAssignees(subjectUrl: string): Promise<string[]> {
    const res = await fetch(subjectUrl, { headers: this.headers(this.actionToken) });
    if (!res.ok) {
      throw new Error(`GET ${subjectUrl} failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as { assignees?: Array<{ login: string }> };
    return (body.assignees ?? []).map((a) => a.login);
  }

  /**
   * Removes the given assignee from an issue or pull request. Only the listed
   * login is removed; any other assignees are left in place.
   */
  async removeAssignee(owner: string, repo: string, issueNumber: number, login: string): Promise<void> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/assignees`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: this.headers(this.actionToken, { "Content-Type": "application/json" }),
      body: JSON.stringify({ assignees: [login] }),
    });
    if (!res.ok) {
      const hint =
        res.status === 403
          ? " — GITHUB_TOKEN needs write access to Issues (and Pull requests, for PRs)."
          : "";
      throw new Error(`DELETE assignees failed: ${res.status} ${await res.text()}${hint}`);
    }
  }

  /**
   * Adds a reaction to a reactions endpoint URL and returns its id (so it can
   * later be removed). Idempotent server-side: a repeated identical reaction
   * returns 200 with the existing reaction instead of 201.
   */
  async addReaction(reactionsUrl: string, content: string): Promise<number | null> {
    const res = await fetch(reactionsUrl, {
      method: "POST",
      headers: this.headers(this.actionToken, { "Content-Type": "application/json" }),
      body: JSON.stringify({ content }),
    });
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`POST reaction failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as { id?: number };
    return body.id ?? null;
  }

  /** Removes a previously added reaction (by id) from a reactions endpoint. */
  async removeReaction(reactionsUrl: string, reactionId: number): Promise<void> {
    const res = await fetch(`${reactionsUrl}/${reactionId}`, {
      method: "DELETE",
      headers: this.headers(this.actionToken),
    });
    // 204 No Content on success; 404 if already gone — both are fine.
    if (!res.ok && res.status !== 404) {
      throw new Error(`DELETE reaction failed: ${res.status} ${await res.text()}`);
    }
  }

  /** Returns the author login of a GitHub resource (issue, PR, or comment) given its API URL. */
  async getResourceAuthor(url: string): Promise<string | null> {
    const res = await fetch(url, { headers: this.headers(this.actionToken) });
    if (!res.ok) {
      throw new Error(`GET ${url} failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as { user?: { login: string } };
    return body.user?.login ?? null;
  }

  /** Returns the actor who performed the most recent assignment to the given bot login. */
  async getLastAssigner(owner: string, repo: string, issueNumber: number, botLogin: string): Promise<string | null> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/events`;
    const res = await fetch(url, { headers: this.headers(this.actionToken) });
    if (!res.ok) {
      throw new Error(`GET ${url} failed: ${res.status} ${await res.text()}`);
    }
    const events = (await res.json()) as Array<{
      event: string;
      assignee?: { login: string };
      actor: { login: string };
    }>;

    const lastAssignEvent = events.find((e) => e.event === "assigned" && e.assignee?.login === botLogin);
    return lastAssignEvent?.actor.login ?? null;
  }

  /** Fetches the body text at an issue/PR or comment API URL (for prompts). */

  async getBody(url: string): Promise<string> {
    const res = await fetch(url, { headers: this.headers(this.actionToken) });
    if (!res.ok) {
      throw new Error(`GET ${url} failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as { body?: string | null };
    return (body.body ?? "").trim();
  }

  /** Posts a comment on an issue or pull request. Requires Issues write. */
  async addIssueComment(owner: string, repo: string, issueNumber: number, body: string): Promise<void> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(this.actionToken, { "Content-Type": "application/json" }),
      body: JSON.stringify({ body }),
    });
    if (res.status !== 201) {
      const hint =
        res.status === 403 ? " — GITHUB_TOKEN needs write access to Issues." : "";
      throw new Error(`POST comment failed: ${res.status} ${await res.text()}${hint}`);
    }
  }

  /** Marks a notification thread as read so it stops reappearing in polls. */
  async markThreadRead(threadId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/notifications/threads/${threadId}`, {
      method: "PATCH",
      headers: this.headers(this.notificationsToken),
    });
    // 205 Reset Content on success; 404 if already gone — both are fine.
    if (!res.ok && res.status !== 205 && res.status !== 404) {
      throw new Error(`PATCH thread failed: ${res.status} ${await res.text()}`);
    }
  }
}

/**
 * Resolves the reactions endpoint for a notification. Prefers the specific
 * comment that triggered the notification; falls back to the issue/PR itself.
 * Returns null when no usable target can be derived.
 */
export function reactionsUrlFor(notification: GithubNotification): string | null {
  const { latest_comment_url, url } = notification.subject;

  // A comment URL looks like .../issues/comments/{id} or .../pulls/comments/{id}.
  if (latest_comment_url && latest_comment_url.includes("/comments/")) {
    return `${latest_comment_url}/reactions`;
  }

  // Otherwise react on the issue itself. Pull requests expose reactions through
  // their issues counterpart, so normalise /pulls/ -> /issues/.
  if (url) {
    const issueUrl = url.replace("/pulls/", "/issues/");
    return `${issueUrl}/reactions`;
  }

  return null;
}

/** Extracts the numeric issue/PR number from a subject URL. */
export function issueNumberFrom(subjectUrl: string | null): number | null {
  if (!subjectUrl) return null;
  const match = subjectUrl.match(/\/(?:issues|pulls)\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

/**
 * A stable, filename-safe id for a notification event. Prefers the triggering
 * comment id (so each new comment is its own event); falls back to the thread's
 * last-updated timestamp. proxy-agent uses this as the log filename and dedupe key.
 */
export function eventIdFor(notification: GithubNotification): string {
  const { full_name } = notification.repository;
  const num = issueNumberFrom(notification.subject.url) ?? "x";
  const commentMatch = notification.subject.latest_comment_url?.match(/\/comments\/(\d+)$/);
  const suffix = commentMatch ? `c${commentMatch[1]}` : notification.updated_at;
  return `github-${full_name}-${num}-${suffix}`.replace(/[^A-Za-z0-9._-]/g, "-");
}
