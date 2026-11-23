/**
 * ak-j8tc / ak-cipj (BE 2026-11-22): reconciliation issues surface.
 *
 * Consumer for the two BE endpoints landed by ak-cipj:
 *   GET  /reconciliation/issues?status=<open|resolved|all>
 *        → {issues, count, status}
 *   POST /reconciliation/issues/<id>/resolve
 *        body: {resolution_note?: string}
 *        → {id, idempotent, resolved_at, resolution_note}
 *
 * §23 posture:
 *   #1 preserved — new surface; no pre-existing contract changed.
 *   #2 CONSUME — BE emits the issue rows verbatim; callers render
 *     without re-deriving. `count` consumed directly for the
 *     Home-card badge (never FE-computed from `issues.length`).
 *   #5 resolve-action is the single mutation surface here — BE is
 *     idempotent (double-resolve = 200 + idempotent:true); FE still
 *     gates behind a confirm dialog in the drawer.
 *   #6 preserved (ISO timestamps + Record<string, unknown>
 *     discrepancy_detail; renderer formats en-IN).
 *
 * Pattern mirrors `investmentService.ts` — queueRequest +
 * withRequestId + optional withCacheCleared; no toasts here, caller
 * owns user-facing error surfacing.
 */
import axios from "./AxiosConfig.tsx";
import {queueRequest} from "./AxiosQueueManager.tsx";
import type {
    ReconciliationIssueStatus,
    ReconciliationIssuesResponse,
    ReconciliationResolveResponse,
} from "../utils/interfaces.ts";

// Local copies of the request-decorator helpers. Duplicated (not
// exported from investmentService) to keep this file standalone —
// third copy, promote to a shared `_requestHelpers.ts` if a fourth
// service repeats the pattern.
function withCacheCleared(options: Record<string, any> = {}): Record<string, any> {
    return {
        ...options,
        params: {
            ...options.params,
            clearCacheEntry: true,
        },
    };
}

function withRequestId(endpoint: string, options: Record<string, any>): Record<string, any> {
    return {
        ...options,
        id: `${endpoint}-${JSON.stringify(options.params || {})}`,
    };
}

/**
 * GET /reconciliation/issues?status=... — list reconcile deltas.
 *
 * Default `status="open"` matches the Home-card badge query ("N
 * issues to review" counts unresolved only). BE 400s on unknown
 * status; caller should pre-validate rather than depend on the
 * bounce.
 */
export async function getReconciliationIssues(
    status: ReconciliationIssueStatus = "open",
    clearCache = false,
): Promise<ReconciliationIssuesResponse> {
    const params = {status};
    const base: Record<string, any> = {params};
    const options = withRequestId(
        "reconciliation/issues",
        clearCache ? withCacheCleared(base) : base,
    );
    const response = await queueRequest(() =>
        axios.get("/reconciliation/issues", options),
    );
    return response.data;
}

/**
 * POST /reconciliation/issues/<id>/resolve — mark an issue as
 * reviewed. Optional `resolution_note` (truncated to 500 chars
 * server-side). Idempotent: double-resolve returns 200 with
 * `idempotent:true` and the ORIGINAL resolved_at + note preserved
 * (audit trail).
 */
export async function resolveReconciliationIssue(
    issueId: number,
    resolutionNote?: string | null,
): Promise<ReconciliationResolveResponse> {
    const body: Record<string, string> = {};
    if (resolutionNote && resolutionNote.trim().length > 0) {
        body.resolution_note = resolutionNote.trim();
    }
    const response = await queueRequest(() =>
        axios.post(`/reconciliation/issues/${issueId}/resolve`, body),
    );
    return response.data;
}
