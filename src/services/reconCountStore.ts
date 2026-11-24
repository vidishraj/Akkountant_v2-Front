import {useSyncExternalStore} from "react";
import {getReconciliationIssues} from "./reconciliationService";

// ak-h5jk (ak-rns8 review): ONE open-reconciliation-issue count shared by
// Home's alerts strip and the header bell, so the badge can never lag the
// strip (e.g. after resolving an issue in Home's drawer).
// null = unknown (not fetched yet / transport failure) → no item shown.

let count: number | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setReconIssuesCount(next: number | null | ((prev: number | null) => number | null)): void {
    const value = typeof next === "function" ? next(count) : next;
    if (value === count) return;
    count = value;
    emit();
}

/** Re-read from the BE (count CONSUMEd verbatim, never recomputed). */
export function refreshReconIssuesCount(): Promise<void> {
    return getReconciliationIssues("open")
        .then((res) => setReconIssuesCount(Number(res?.count) || 0))
        .catch(() => setReconIssuesCount(null));
}

export function useReconIssuesCount(): number | null {
    return useSyncExternalStore(
        (l) => {
            listeners.add(l);
            return () => listeners.delete(l);
        },
        () => count,
    );
}
