import { auth } from "../components/FirebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { API_BASE_URL } from "./AxiosConfig.tsx";

/**
 * Payload shape that GET /wealth-digest/latest and GET /wealth-digest?date=…
 * return. The FE renders `text` as markdown; `last_error` (when non-null) drives
 * the error banner; `read_at` (when non-null) suppresses the nav badge for this
 * digest. The date is the calendar date the digest was generated for (IST); the
 * generated_at timestamp is when the WealthDigestTask actually ran.
 */
export interface WealthDigest {
  date: string;                  // YYYY-MM-DD (IST calendar day)
  generated_at: string;          // ISO 8601 UTC
  text: string;                  // markdown body
  last_error: { at: string; message: string } | null;
  read_at: string | null;        // ISO 8601 UTC, or null if unread
}

/**
 * Reasons the wealth-digest endpoint can 400. Kept as a discriminated code so
 * the FE can special-case the "not configured" state (full-page empty) versus
 * generic transient errors (banner).
 */
export type WealthDigestErrorCode =
  | "not_configured"      // WEALTH_DIGEST_USER_ID env not set for this user
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
 */
export async function fetchLatestDigest(): Promise<WealthDigest> {
  const res = await authedFetch("wealth-digest/latest");
  if (!res.ok) {
    const code = await inferErrorCode(res);
    throw new WealthDigestError(
      res.status,
      code,
      `fetchLatestDigest failed: ${res.status}`
    );
  }
  return res.json();
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
  return res.json();
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
  return res.json();
}
