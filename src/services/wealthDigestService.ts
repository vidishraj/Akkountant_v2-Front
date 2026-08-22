import { auth } from "../components/FirebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { API_BASE_URL } from "./AxiosConfig.tsx";

/**
 * Structured action item that WealthDigestTask emits. Backend produces these
 * from LLM output; FE renders each as an ActionCard.
 *
 * `id` is synthesized client-side in `normalizeDigest` (below) — the backend
 * schema has `additionalProperties: false` and declares only the semantic
 * fields, so we assign a stable index-based key per array so React reconciles
 * and the per-action done-state map has non-colliding keys. If the backend
 * ever gains a real server-issued id, drop the synthesis in normalizeDigest
 * and this field stops being FE-provided.
 */
export interface DigestAction {
  id: string;          // client-synthesized
  title: string;
  detail?: string;
  category: "cash" | "equity" | "debt" | "gold" | "other";
  priority: "high" | "medium" | "low";
}

/**
 * Structured "keep an eye on" item — a pointer at a holding or category the
 * digest wants the reader aware of.
 *
 * `id` is client-synthesized (see DigestAction). `investigate_target` is
 * optional-and-may-be-absent (not just null-able) — the backend schema does
 * not require it, so FE code must treat it as truly optional (`if (item.
 * investigate_target)` before rendering the link).
 */
export interface DigestWatchItem {
  id: string;          // client-synthesized
  title: string;
  detail?: string;
  severity: "info" | "warning" | "critical";
  investigate_target?: "stocks" | "mf" | "nps" | "epf" | "ppf" | "gold" | null;
}

/**
 * Structured news/context item — market-level context extracted from the
 * digest narrative that relates to specific holdings (or asset categories).
 *
 * `id` is client-synthesized. `timestamp` is optional — the backend does
 * not currently emit it; when it does (future BE extension), the NewsCard
 * component already renders it if present.
 */
export interface DigestNewsItem {
  id: string;          // client-synthesized
  headline: string;
  detail?: string;
  related_holdings?: string[];
  timestamp?: string;
}

/**
 * Payload shape that GET /wealth-digest/latest and GET /wealth-digest?date=…
 * return. Wave 3 extends the shape with structured `actions`, `watch_items`,
 * and `news` arrays alongside the existing `text` narrative. Legacy digests
 * (pre-Wave-3 backend) return empty arrays for the new fields; the FE
 * degrades gracefully — narrative renders as-is, structured sections hide.
 */
export interface WealthDigest {
  date: string;                  // YYYY-MM-DD (IST calendar day)
  generated_at: string;          // ISO 8601 UTC
  text: string;                  // markdown body (existing)
  actions: DigestAction[];       // Wave 3 — empty for legacy
  watch_items: DigestWatchItem[]; // Wave 3 — empty for legacy
  news: DigestNewsItem[];        // Wave 3 — empty for legacy
  last_error: { at: string; message: string } | null;
  read_at: string | null;        // ISO 8601 UTC, or null if unread
}

/**
 * Reasons the wealth-digest endpoint can 4xx. Kept as a discriminated code
 * so the FE can special-case each state with the right UX:
 * - not_configured → full-page empty ("set env var")
 * - not_generated → dedicated first-run empty ("no digest yet")
 * - not_found → date-picker inline "no digest for this day"
 * - transient → banner with retry
 */
export type WealthDigestErrorCode =
  | "not_configured"      // WEALTH_DIGEST_USER_ID env not set for this user
  | "not_generated"       // user configured but no digest has ever been generated
  | "not_found"           // date given, no digest for that date
  | "transient";          // 5xx / network / unspecified

/**
 * Typed error thrown by every wealth-digest client fn on non-2xx. Callers can
 * `instanceof` + inspect `.code` to render the right state (not_configured →
 * full-page empty; not_found → date-picker "no digest for that day"; transient
 * → banner).
 */
export class WealthDigestError extends Error {
  constructor(
    public status: number,
    public code: WealthDigestErrorCode,
    message: string
  ) {
    super(message);
    this.name = "WealthDigestError";
  }
}

async function getFirebaseUID(): Promise<string> {
  const user = auth.currentUser;
  if (user) return user.uid;
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (loggedInUser) => {
      unsubscribe();
      if (loggedInUser) resolve(loggedInUser.uid);
      else reject(new Error("User not authenticated"));
    });
  });
}

async function authedFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const uid = await getFirebaseUID();
  const headers = new Headers(init.headers);
  headers.set("X-Firebase-ID", uid);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

/**
 * Best-effort inference of the error code from the response. The backend
 * contract from ak-5vg is:
 *   - 404 (any endpoint) → the resource doesn't exist for the given date.
 *     Body is `{"error": "..."}` with no code field.
 *   - `error_code === "WEALTH_DIGEST_USER_ID_UNSET"` → env var missing.
 *   - Anything else → transient (5xx / network / unspecified).
 *
 * We prefer status-code inference for the 404 path (structural, doesn't
 * depend on the BE remembering to include a code) and body-code inference
 * for not-configured (semantic, distinct from every other 400). If either
 * signal is missing or the body isn't JSON, we fall back to transient so
 * the UI still has a code to render against.
 */
async function inferErrorCode(res: Response): Promise<WealthDigestErrorCode> {
  if (res.status === 404) {
    return "not_found";
  }
  try {
    const body = await res.json();
    if (body?.error_code === "WEALTH_DIGEST_USER_ID_UNSET") {
      return "not_configured";
    }
  } catch {
    // fall through
  }
  return "transient";
}

/**
 * Fetches the most recent digest (today's if it landed, else the latest
 * available). The nav-badge fetcher and the WealthDigest page both consume
 * this — one call, two consumers.
 *
 * On this endpoint specifically, a 404 means "the user has never had a
 * digest generated" (a first-run state), not "date not found" — so we
 * override the generic 404 → not_found mapping to not_generated here.
 * The archive endpoint keeps the generic mapping (there, 404 = specific
 * date has no digest, which is a normal outcome of scrubbing history).
 *
 * Legacy digests (BE Wave 3 hasn't landed yet) return without the
 * structured arrays; we default them to empty so downstream consumers
 * can iterate without null-checking.
 */
export async function fetchLatestDigest(): Promise<WealthDigest> {
  const res = await authedFetch("wealth-digest/latest");
  if (!res.ok) {
    // Endpoint-specific override: 404 on /latest means "no digest ever"
    // (first-run), which gets its own dedicated empty state.
    if (res.status === 404) {
      throw new WealthDigestError(
        404,
        "not_generated",
        "no digest has been generated yet"
      );
    }
    const code = await inferErrorCode(res);
    throw new WealthDigestError(
      res.status,
      code,
      `fetchLatestDigest failed: ${res.status}`
    );
  }
  const body = await res.json();
  return normalizeDigest(body);
}

/**
 * Normalizes a BE response by:
 * 1. Filling default values for missing top-level fields
 * 2. Coercing legacy digests (no structured arrays) to Wave 3 shape with
 *    empty arrays — so downstream renders don't null-check
 * 3. **Synthesizing a stable `id` on each structured item** — the backend
 *    schema (`additionalProperties: false`, id-less) intentionally owns the
 *    contract, so FE assigns a per-array index-based key at parse time.
 *    Order is stable across renders because the array is stored server-side
 *    verbatim; a re-fetch of the same digest returns the same order. Fixes
 *    the Wave 3 v1 defect where undefined ids collapsed the per-action
 *    done-state map (ticking one checkbox marked all actions).
 *
 * The prefix per array keeps ids globally unique across the digest so
 * cross-section React key collisions never fire either.
 */
function normalizeDigest(body: Partial<WealthDigest>): WealthDigest {
  const actions = Array.isArray(body.actions)
    ? body.actions.map((a, i) => ({ ...a, id: `action-${i}` }))
    : [];
  const watch_items = Array.isArray(body.watch_items)
    ? body.watch_items.map((w, i) => ({ ...w, id: `watch-${i}` }))
    : [];
  const news = Array.isArray(body.news)
    ? body.news.map((n, i) => ({ ...n, id: `news-${i}` }))
    : [];
  return {
    date: body.date ?? "",
    generated_at: body.generated_at ?? "",
    text: body.text ?? "",
    actions,
    watch_items,
    news,
    last_error: body.last_error ?? null,
    read_at: body.read_at ?? null,
  };
}

/**
 * Fetches a digest for a specific calendar date (YYYY-MM-DD, IST). The archive
 * modal uses this. 404 → not_found (render "no digest for this day" in the
 * modal); other non-2xx → transient banner.
 */
export async function fetchDigestByDate(date: string): Promise<WealthDigest> {
  const res = await authedFetch(
    `wealth-digest?date=${encodeURIComponent(date)}`
  );
  if (!res.ok) {
    const code = await inferErrorCode(res);
    throw new WealthDigestError(
      res.status,
      code,
      `fetchDigestByDate(${date}) failed: ${res.status}`
    );
  }
  return normalizeDigest(await res.json());
}

/**
 * Records that the user has read the digest identified by `date`. Backend
 * updates the user's `wealth_digest_last_read_at` column. Server returns 200
 * with an updated WealthDigest (with `read_at` populated). Optimistic-clear
 * on FE; if this rejects, the caller reverts.
 */
export async function markDigestRead(date: string): Promise<WealthDigest> {
  const res = await authedFetch("wealth-digest/mark-read", {
    method: "POST",
    body: JSON.stringify({ date }),
  });
  if (!res.ok) {
    const code = await inferErrorCode(res);
    throw new WealthDigestError(
      res.status,
      code,
      `markDigestRead(${date}) failed: ${res.status}`
    );
  }
  return normalizeDigest(await res.json());
}

/**
 * A single day's portfolio-value data-point, returned by the trend endpoint.
 * The endpoint doesn't exist on the backend yet (P3 follow-up bead) — until
 * it does, fetchPortfolioTrend below returns an empty array and the chart
 * component renders its "no trend data yet" placeholder.
 */
export interface PortfolioTrendPoint {
  date: string;   // YYYY-MM-DD (IST)
  value: number;  // portfolio total in ₹ at end-of-day
}

/**
 * Fetches the last N days of portfolio-value snapshots. Contract:
 *   GET /investment-snapshot/history?days=30 → {points: [{date, value}, …]}
 *
 * Not-yet-implemented on the backend (P3 follow-up). Returns an empty array
 * on 404 so the trend-chart widget can render its placeholder rather than a
 * transient-error state. Any OTHER failure re-throws so genuine 5xx surfaces
 * to the UI's error banner.
 */
export async function fetchPortfolioTrend(
  days = 30
): Promise<PortfolioTrendPoint[]> {
  const res = await authedFetch(
    `investment-snapshot/history?days=${encodeURIComponent(String(days))}`
  );
  if (res.status === 404) {
    return [];
  }
  if (!res.ok) {
    throw new WealthDigestError(
      res.status,
      "transient",
      `fetchPortfolioTrend failed: ${res.status}`
    );
  }
  const body = await res.json();
  const points = Array.isArray(body?.points) ? body.points : [];
  return points
    .filter(
      (p: unknown): p is PortfolioTrendPoint =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as PortfolioTrendPoint).date === "string" &&
        typeof (p as PortfolioTrendPoint).value === "number"
    )
    .slice(-days);
}
