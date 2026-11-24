import {useCallback, useEffect, useMemo, useState} from "react";
import {useKite} from "../contexts/KiteContext";
import {useWealthDigest} from "../contexts/WealthDigestContext";
import {fetchFreelanceDashboard} from "../services/freelanceService";
import {getReconciliationIssues} from "../services/reconciliationService";
import type {FreelanceEarning} from "../utils/interfaces";
import {AttentionItem, buildAttentionItems, digestStaleSinceLabel} from "../utils/attentionItems";

/**
 * ak-rns8: header inbox data. Same inputs and builder as Home's alerts strip
 * (utils/attentionItems), fetched by the always-mounted header. Requests
 * reuse the axios cache, so Home and the header don't double-load.
 * `refresh()` re-reads (called when the inbox opens).
 */
export function useAttentionItems(enabled: boolean): {items: AttentionItem[]; refresh: () => void} {
    const {state: kiteState} = useKite();
    const {digest} = useWealthDigest();
    const [overdue, setOverdue] = useState<FreelanceEarning[]>([]);
    const [reconCount, setReconCount] = useState<number | null>(null);

    const refresh = useCallback(() => {
        if (!enabled) return;
        fetchFreelanceDashboard()
            .then((d) => setOverdue((d?.recentInvoices || []).filter((i) => i.status === "overdue")))
            .catch(() => setOverdue([]));
        getReconciliationIssues("open")
            .then((res) => setReconCount(Number(res?.count) || 0))
            .catch(() => setReconCount(null));
    }, [enabled]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const items = useMemo(
        () => (enabled
            ? buildAttentionItems({
                digestStale: digest?.last_error != null,
                digestStaleSinceLabel: digestStaleSinceLabel(digest?.last_error?.at),
                kiteAuthenticated: kiteState.isAuthenticated,
                overdueInvoices: overdue,
                reconIssuesCount: reconCount,
            })
            : []),
        [enabled, digest, kiteState.isAuthenticated, overdue, reconCount],
    );

    return {items, refresh};
}
