// ak-p612: one app-wide "your session has expired" signal.
//
// Raised when we cannot obtain a Firebase ID token (after one forced
// refresh), or when the API answers 401 to a request we sent with a token.
// The SessionExpiredDialog (mounted in the shell) listens and blocks the page
// with a clear re-auth prompt, so expired auth never looks like empty data.
//
// Deliberately a tiny module-level emitter (not React context): the axios
// interceptor and the fetch helpers live outside the React tree.

export type SessionExpiredReason = "token_unavailable" | "unauthorized";

type Listener = (reason: SessionExpiredReason) => void;

const listeners = new Set<Listener>();
let expired: SessionExpiredReason | null = null;

export function notifySessionExpired(reason: SessionExpiredReason): void {
    if (expired) return; // already showing; don't re-fire per request
    expired = reason;
    listeners.forEach((l) => l(reason));
}

export function clearSessionExpired(): void {
    expired = null;
}

export function currentSessionExpiry(): SessionExpiredReason | null {
    return expired;
}

export function onSessionExpired(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * A 401 means our session is no longer accepted — EXCEPT the Kite 401
 * (`{reconnect_required: true}`), which is "reconnect your broker", handled
 * by KiteContext, not "you are signed out". (Review: the exemption is the
 * body flag only, not the whole /kite/ URL prefix; BE is adding a stable
 * `error_code: "APP_AUTH_REQUIRED"` to match on once it lands.)
 *
 * `sentCredential`: a 401 for a request that carried NO X-Firebase-ID header
 * (signed-out background traffic) is expected, not an expiry — never latch
 * the dialog for it.
 */
export function isSessionUnauthorized(
    status: number | undefined,
    body: unknown,
    sentCredential = true,
): boolean {
    if (status !== 401 || !sentCredential) return false;
    const b = body as {reconnect_required?: unknown} | null | undefined;
    return !(b && typeof b === "object" && b.reconnect_required === true);
}

/** Convenience for fetch-based callers that always send the header. */
export function reportIfSessionUnauthorized(status: number, body?: unknown): void {
    if (isSessionUnauthorized(status, body, true)) notifySessionExpired("unauthorized");
}

/** Minimal shape of a Firebase User we need — keeps this module SDK-free. */
export interface IdTokenSource {
    getIdToken(forceRefresh?: boolean): Promise<string>;
}

/**
 * ak-p612: the credential policy, isolated so it can be checked without the
 * Firebase SDK. Cached token → one forced refresh → null (+ session-expired).
 * There is deliberately no path that returns anything except an ID token or
 * null; in particular never the uid.
 */
export async function resolveIdToken(
    user: IdTokenSource,
    onUnavailable: () => void = () => notifySessionExpired("token_unavailable"),
): Promise<string | null> {
    try {
        return await user.getIdToken(false);
    } catch {
        try {
            return await user.getIdToken(true);
        } catch {
            onUnavailable();
            return null;
        }
    }
}
