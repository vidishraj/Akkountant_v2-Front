// ak-rns8: the "things that need you" list, shared by the Home alerts strip
// and the header inbox (design: bell + count + "Needs attention" popover).
// One builder so the two surfaces can never disagree about what's pending.
// Pure; callers supply the already-fetched inputs.

export const CLR_LOSS = "oklch(0.74 0.15 25)";
export const CLR_WARN = "oklch(0.82 0.12 75)";

export interface AttentionItem {
    key: "digest-fail" | "kite-session" | "invoice-overdue" | "recon-open";
    icon: string;   // phosphor class after `ph `
    color: string;
    edge: string;
    title: string;
    sub: string;
    cta: string;
    href: string;
    sample?: boolean;
}

export interface AttentionInputs {
    /** Wealth Digest's latest task failed (digest.last_error present). */
    digestStale: boolean;
    /** IST "Aug 30"-style label for when it started failing, or "". */
    digestStaleSinceLabel: string;
    kiteAuthenticated: boolean;
    overdueInvoices: {invoiceNumber: string; clientName: string}[];
    /** Open reconciliation issues; null = unknown (not fetched / failed). */
    reconIssuesCount: number | null;
}

export function buildAttentionItems(input: AttentionInputs): AttentionItem[] {
    const out: AttentionItem[] = [];
    if (input.digestStale) {
        out.push({
            key: "digest-fail",
            icon: "ph-warning-circle",
            color: CLR_LOSS,
            edge: `color-mix(in srgb, ${CLR_LOSS} 40%, transparent)`,
            title: "Wealth Digest task failing",
            sub: input.digestStaleSinceLabel
                ? `Since ${input.digestStaleSinceLabel} · digests are stale`
                : "Digests are stale",
            cta: "View",
            href: "/wealth-digest",
        });
    }
    if (!input.kiteAuthenticated) {
        out.push({
            key: "kite-session",
            icon: "ph-plugs",
            color: CLR_WARN,
            edge: `color-mix(in srgb, ${CLR_WARN} 30%, transparent)`,
            title: "Kite session expired",
            sub: "Reconnect to refresh prices and margins",
            cta: "Reconnect",
            href: "/investments",
        });
    }
    if (input.overdueInvoices.length > 0) {
        const n = input.overdueInvoices.length;
        const first = input.overdueInvoices[0];
        out.push({
            key: "invoice-overdue",
            icon: "ph-receipt",
            color: CLR_WARN,
            edge: `color-mix(in srgb, ${CLR_WARN} 30%, transparent)`,
            title: n === 1 ? "1 invoice overdue" : `${n} invoices overdue`,
            sub: `${first.invoiceNumber} · ${first.clientName}`,
            cta: "Follow up",
            href: "/freelance",
        });
    }
    // ak-j8tc: only when there is something to review. null (unknown) or 0
    // shows nothing rather than a false count.
    if (input.reconIssuesCount !== null && input.reconIssuesCount > 0) {
        const n = input.reconIssuesCount;
        out.push({
            key: "recon-open",
            icon: "ph-arrows-left-right",
            color: CLR_WARN,
            edge: `color-mix(in srgb, ${CLR_WARN} 30%, transparent)`,
            title: "Reconciliation",
            sub: n === 1 ? "1 issue to review" : `${n} issues to review`,
            cta: "Review",
            // Home opens the reconciliation drawer in place; elsewhere
            // (header inbox) this routes to Home, which hosts that drawer.
            href: "/home",
        });
    }
    return out;
}

/** IST "Aug 30" label for a digest error timestamp, or "" if unusable. */
export function digestStaleSinceLabel(at: string | null | undefined): string {
    if (!at) return "";
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        month: "short",
        day: "numeric",
    }).format(d);
}
