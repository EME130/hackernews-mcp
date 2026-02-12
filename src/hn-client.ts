import * as cheerio from "cheerio";

const FIREBASE_BASE = "https://hacker-news.firebaseio.com/v0";
const WEB_BASE = "https://news.ycombinator.com";

export interface HNItem {
  id: number;
  type?: string;
  by?: string;
  time?: number;
  text?: string;
  url?: string;
  title?: string;
  score?: number;
  descendants?: number;
  kids?: number[];
  parent?: number;
  parts?: number[];
  poll?: number;
  dead?: boolean;
  deleted?: boolean;
}

export interface HNUser {
  id: string;
  created: number;
  karma: number;
  about?: string;
  submitted?: number[];
}

export type StoryType =
  | "top"
  | "new"
  | "best"
  | "ask"
  | "show"
  | "job";

export class HNClient {
  private cookie: string | null = null;

  // ── Firebase read methods (no auth) ──

  async getItem(id: number): Promise<HNItem> {
    const res = await fetch(`${FIREBASE_BASE}/item/${id}.json`);
    if (!res.ok) throw new Error(`Firebase error: ${res.status}`);
    const data = await res.json();
    if (!data) throw new Error(`Item ${id} not found`);
    return data as HNItem;
  }

  async getUser(username: string): Promise<HNUser> {
    const res = await fetch(`${FIREBASE_BASE}/user/${username}.json`);
    if (!res.ok) throw new Error(`Firebase error: ${res.status}`);
    const data = await res.json();
    if (!data) throw new Error(`User "${username}" not found`);
    return data as HNUser;
  }

  async getStories(type: StoryType): Promise<number[]> {
    const endpoint =
      type === "top"
        ? "topstories"
        : type === "new"
          ? "newstories"
          : type === "best"
            ? "beststories"
            : type === "ask"
              ? "askstories"
              : type === "show"
                ? "showstories"
                : "jobstories";
    const res = await fetch(`${FIREBASE_BASE}/${endpoint}.json`);
    if (!res.ok) throw new Error(`Firebase error: ${res.status}`);
    return (await res.json()) as number[];
  }

  // ── Web write methods (cookie auth) ──

  async login(username: string, password: string): Promise<string> {
    const body = new URLSearchParams({
      acct: username,
      pw: password,
      goto: "news",
    });
    const res = await fetch(`${WEB_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      redirect: "manual",
    });

    const setCookie = res.headers.get("set-cookie");
    if (!setCookie || !setCookie.includes("user=")) {
      throw new Error("Login failed — invalid credentials or unexpected response");
    }

    const match = setCookie.match(/user=([^;]+)/);
    if (!match) throw new Error("Login failed — could not extract user cookie");

    this.cookie = `user=${match[1]}`;
    return `Logged in as ${username}`;
  }

  async submitStory(
    title: string,
    url?: string,
    text?: string,
  ): Promise<string> {
    this.requireAuth();

    // GET the submit page to extract fnid
    const page = await this.webGet("/submit");
    const fnid = this.extractFnid(page);

    const params: Record<string, string> = { fnid, fnop: "submit-page", title };
    if (url) params.url = url;
    if (text) params.text = text;

    const res = await this.webPost("/r", params);

    if (res.includes("error") || res.includes("Unknown")) {
      throw new Error("Submit failed — HN returned an error page");
    }
    return "Story submitted successfully";
  }

  async comment(parentId: number, text: string): Promise<string> {
    this.requireAuth();

    // GET the item page to extract fnid from the comment form
    const page = await this.webGet(`/item?id=${parentId}`);
    const fnid = this.extractFnid(page);

    const res = await this.webPost("/comment", {
      parent: String(parentId),
      text,
      fnid,
    });

    if (res.includes("error") || res.includes("Unknown")) {
      throw new Error("Comment failed — HN returned an error page");
    }
    return `Comment posted on item ${parentId}`;
  }

  async upvote(itemId: number): Promise<string> {
    this.requireAuth();

    const page = await this.webGet(`/item?id=${itemId}`);
    const $ = cheerio.load(page);
    const voteLink = $(`a#up_${itemId}`).attr("href");

    if (!voteLink) {
      throw new Error(
        `Cannot upvote item ${itemId} — vote link not found (already voted or not eligible)`,
      );
    }

    const voteUrl = voteLink.startsWith("http")
      ? voteLink
      : `${WEB_BASE}/${voteLink.replace(/^\//, "")}`;

    const res = await fetch(voteUrl, {
      headers: { Cookie: this.cookie! },
      redirect: "manual",
    });

    if (res.status >= 400) {
      throw new Error(`Upvote failed with status ${res.status}`);
    }
    return `Upvoted item ${itemId}`;
  }

  // ── Helpers ──

  private requireAuth(): void {
    if (!this.cookie) {
      throw new Error("Not logged in — call hn_login first");
    }
  }

  private async webGet(path: string): Promise<string> {
    const url = path.startsWith("http") ? path : `${WEB_BASE}${path}`;
    const res = await fetch(url, {
      headers: this.cookie ? { Cookie: this.cookie } : {},
    });
    if (!res.ok) throw new Error(`HN web request failed: ${res.status}`);
    return res.text();
  }

  private async webPost(
    path: string,
    params: Record<string, string>,
  ): Promise<string> {
    const res = await fetch(`${WEB_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: this.cookie!,
      },
      body: new URLSearchParams(params),
      redirect: "manual",
    });
    // HN typically redirects on success; read body if available
    if (res.body) {
      return res.text();
    }
    return "";
  }

  private extractFnid(html: string): string {
    const $ = cheerio.load(html);
    const fnid = $('input[name="fnid"]').val();
    if (!fnid || typeof fnid !== "string") {
      throw new Error("Could not extract FNID token from page");
    }
    return fnid;
  }
}
