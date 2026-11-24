import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMSNContext } from "../../contexts/MSNContext.tsx";
import { useInvestmentSummaries } from "../../hooks/useInvestmentSummaries.ts";
import { useWealthDigest } from "../../contexts/WealthDigestContext.tsx";
import { useAgentChatBridge } from "../../contexts/AgentChatBridgeContext.tsx";
import { useKite } from "../../contexts/KiteContext.tsx";
import {
  refreshReconIssuesCount,
  setReconIssuesCount,
  useReconIssuesCount,
} from "../../services/reconCountStore.ts";
import ReconciliationDialog from "../../components/ReconciliationDialog/ReconciliationDialog.tsx";
import {
  WealthDigest as WealthDigestPayload,
  markDigestRead,
} from "../../services/wealthDigestService.ts";
import { MSNListResponse } from "../../utils/interfaces.ts";
import { getRowDayChangeAmount } from "../../utils/holdings.ts";
import StatTileRow from "../../components/WealthDigest/StatTileRow.tsx";
import StatTile from "../../components/WealthDigest/StatTile.tsx";
import DigestHeader from "../../components/WealthDigest/DigestHeader.tsx";
import NarrativeSection from "../../components/WealthDigest/NarrativeSection.tsx";
import ActionCard from "../../components/WealthDigest/ActionCard.tsx";
import WatchItemCard from "../../components/WealthDigest/WatchItemCard.tsx";
import NewsCard from "../../components/WealthDigest/NewsCard.tsx";
import InsightsColumn from "../../components/WealthDigest/InsightsColumn.tsx";
import DigestActions, {
  DigestPrompt,
} from "../../components/WealthDigest/DigestActions.tsx";
import DigestArchiveModal from "../../components/WealthDigest/DigestArchiveModal.tsx";
import DigestSkeleton from "../../components/WealthDigest/DigestSkeleton.tsx";
import {
  DigestEmptyBanner,
  DigestErrorBanner,
  DigestNotConfigured,
  DigestTransientErrorBanner,
  DigestZeroEmpty,
} from "../../components/WealthDigest/DigestStateBanners.tsx";
import {
  formatCompact,
  formatCurrency,
} from "../../components/WealthDigest/formatters.ts";
import wdStyle from "../../components/WealthDigest/WealthDigest.module.scss";

const SNOOZE_LOCAL_KEY = "wealthDigestSnoozedUntil";
const ACTION_DONE_LOCAL_KEY_PREFIX = "wealthDigestActionsDone:";
const ACTION_DONE_TTL_DAYS = 30;
const MSN_KEYS = ["stocks", "mf", "nps"] as const;
const EPG_KEYS = ["ppf", "epf", "gold"] as const;

/**
 * Sweeps `wealthDigestActionsDone:YYYY-MM-DD` localStorage keys whose date
 * suffix is older than the archive window. Runs once on page mount to keep
 * the key namespace bounded — otherwise every day's checkbox state persists
 * forever, silently growing the origin's localStorage quota. Idempotent and
 * best-effort: parse failures / non-standard keys are skipped rather than
 * throwing.
 */
function sweepStaleActionDoneKeys(cutoffIso: string): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(ACTION_DONE_LOCAL_KEY_PREFIX)) continue;
      const dateSuffix = key.slice(ACTION_DONE_LOCAL_KEY_PREFIX.length);
      // Only sweep well-formed date-suffixed keys; leave anything else alone.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateSuffix)) continue;
      if (dateSuffix < cutoffIso) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // localStorage unavailable / quota-limited — sweep is optimistic; no-op.
  }
}

const ALLOCATION_LABELS: Record<string, string> = {
  stocks: "Stocks",
  mf: "Mutual funds",
  nps: "NPS",
  epf: "EPF",
  ppf: "PPF",
  gold: "Gold",
};

/**
 * IST-anchored `YYYY-MM-DD` for today. Uses en-CA locale to guarantee the
 * ISO-shaped output rather than a human "8/21/2026" string. Overseer's
 * Lane 1b fix: previously `new Date().toISOString().slice(0,10)` used UTC,
 * which during the 00:00–05:30 IST early-morning window would resolve to
 * the previous day and false-alarm the "stale digest" banner even while
 * the current day's digest was rendering below.
 */
function todayInIST(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
}

/**
 * ak-x1i5: "Kite funds" tile (replaces Cash %). Same reading + state
 * precedence as the Investments "Available funds" tile (ak-oc5s): equity
 * available live_balance, falling back to cash; defensive on every field.
 */
type KiteFundsView = { value: string; sub: string; title?: string; muted: boolean };
function deriveKiteFunds(kite: ReturnType<typeof useKite>["state"]): KiteFundsView {
  const n = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const equity = kite.margins.data?.equity;
  const avail = n(equity?.available?.live_balance) ?? n(equity?.available?.cash);
  if (!kite.isAuthenticated) {
    return {
      value: "—",
      sub: kite.reconnect.reconnectRequired ? "Session expired · reconnect Kite" : "Connect Kite to see funds",
      muted: true,
    };
  }
  if (kite.margins.loading || !kite.margins.checked) {
    return { value: "—", sub: "Loading margins…", muted: true };
  }
  if (avail === null) {
    return { value: "—", sub: "Margins unavailable", muted: true };
  }
  return {
    value: `₹${formatCompact(avail)}`,
    sub: "Equity available · Kite live",
    title: `₹${formatCurrency(avail)} available`,
    muted: false,
  };
}

// ak-s74k: derivePortfolioTotal + msnLooksEmpty were replaced by the shared
// useInvestmentSummaries hook (utils/portfolioTotals holds the same formula).
// msnLooksEmpty could not tell "not fetched yet" from "fetched", so the tiles
// showed partial sums while the six summary requests landed.

type Mover = {
  name: string;
  category: (typeof MSN_KEYS)[number];
  delta: number;
  deltaPct: number;
};
function deriveMovers(lists: Record<string, MSNListResponse[]>): {
  top: Mover | null;
  worst: Mover | null;
  totalDayChange: number;
  hasData: boolean;
} {
  let top: Mover | null = null;
  let worst: Mover | null = null;
  let totalDayChange = 0;
  let hasData = false;

  MSN_KEYS.forEach((k) => {
    const list = lists[k];
    if (!list || list.length === 0) return;
    list.forEach((item) => {
      // ak-quts: CONSUME BE-authoritative per-row day-change (gated on
      // `day_change_known` inside getRowDayChangeAmount). Prior version
      // re-derived from `info.change × buyQuant` on the live NSE feed,
      // which (a) conflated unknown with flat and (b) diverged from BE's
      // own day-P&L aggregate by paise under rounding. Consume, don't
      // recompute (rig-std #11).
      //
      // null → unknown or not-emitted (legacy row / MF/NPS without BE
      // fold): exclude from BOTH totalDayChange AND movers. A row the
      // broker can't speak for doesn't become a mover and doesn't
      // contribute a pretend-0 to the aggregate.
      const rupees = getRowDayChangeAmount(item);
      if (rupees === null) return;
      if (rupees !== 0) {
        hasData = true;
        totalDayChange += rupees;
        const name =
          (item as { stockCode?: string; name?: string; schemeName?: string })
            .stockCode ??
          (item as { name?: string }).name ??
          (item as { schemeName?: string }).schemeName ??
          "—";
        // Per-share percentage — prefer BE `day_change_percentage` when
        // present, fall back to a derivation from the live feed only when
        // absent (so the mover chip still reads coherently on legacy rows).
        const bePct = Number(item.day_change_percentage);
        const pct =
          Number.isFinite(bePct) && bePct !== 0
            ? bePct
            : Number(item.info?.previousClose) > 0
              ? ((Number(item.info?.change) || 0) / Number(item.info.previousClose)) * 100
              : 0;
        const entry: Mover = { name, category: k, delta: rupees, deltaPct: pct };
        if (!top || rupees > top.delta) top = entry;
        if (!worst || rupees < worst.delta) worst = entry;
      } else {
        // rupees === 0 with a KNOWN flag: genuinely flat today. Counts as
        // "data" so the tile renders "₹0 (0.00%)" instead of "—", but not
        // as a mover (nothing to surface).
        hasData = true;
      }
    });
  });

  return { top, worst, totalDayChange, hasData };
}

/**
 * Computes the allocation slices (per-category current value + percentage).
 * Matches GlobalSummary's derivation exactly — we duplicate rather than
 * refactor to avoid coupling to that file's in-flight polish (ak-xob).
 */
function deriveAllocation(
  summaries: Record<string, any>,
  totalCurrentValue: number
): { key: string; label: string; value: number; pct: number }[] {
  const out: { key: string; label: string; value: number; pct: number }[] = [];
  MSN_KEYS.forEach((k) => {
    const cv = Number(summaries[k]?.currentValue) || 0;
    if (cv > 0) {
      out.push({
        key: k,
        label: ALLOCATION_LABELS[k] ?? k,
        value: cv,
        pct: 0,
      });
    }
  });
  EPG_KEYS.forEach((k) => {
    const s = summaries[k];
    if (!s) return;
    const cv =
      k === "ppf"
        ? Number(s.net) + Number(s.unAccountedProfit || 0)
        : Number(s.net) || 0;
    if (cv > 0) {
      out.push({
        key: k,
        label: ALLOCATION_LABELS[k] ?? k,
        value: cv,
        pct: 0,
      });
    }
  });
  out.forEach((slice) => {
    slice.pct =
      totalCurrentValue > 0 ? (slice.value / totalCurrentValue) * 100 : 0;
  });
  return out;
}

/**
 * WealthDigest page shell — Wave 3 dashboard-of-insights rebuild.
 *
 * Composition (desktop, 2-col grid):
 *
 * ┌────────────────────────────┬────────────────┐
 * │ Header + tiles (full-width)                 │
 * ├────────────────────────────┼────────────────┤
 * │ Digest column              │ Insights col.  │
 * │ - Actions row (sticky)     │ - Trend chart  │
 * │ - Action cards             │ - Alloc donut  │
 * │ - Watch items                               │
 * │ - News (hidden if empty)                    │
 * │ - Narrative section                         │
 * └────────────────────────────┴────────────────┘
 *
 * Tablet/phone: single column, insights column stacks below narrative.
 *
 * State variants (Wave 3):
 * - not_configured → DigestNotConfigured (full-page empty)
 * - not_generated → DigestZeroEmpty (never had a digest)
 * - transient with no digest → banner
 * - loading + no digest → skeleton
 * - normal → full 2-col layout with structured components
 */
const WealthDigest = () => {
  const navigate = useNavigate();
  const { state } = useMSNContext();
  // ak-s74k: loads any summary not yet loaded; totals stay null until all six
  // resolve so the Total tile never shows a partial sum or the ₹0 placeholder.
  const {
    readiness: portfolioReadiness,
    totals: portfolioTotals,
    stale: portfolioStale,
  } = useInvestmentSummaries();
  const { digest: latestDigest, loading, error, refresh, markReadLocal } =
    useWealthDigest();
  const { setCommand } = useAgentChatBridge();
  const { state: kiteState } = useKite();
  const reconIssuesCount = useReconIssuesCount();
  const [reconDialogOpen, setReconDialogOpen] = useState(false);

  const [pastDigest, setPastDigest] = useState<WealthDigestPayload | null>(
    null
  );
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [markReadInFlight, setMarkReadInFlight] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [actionsDone, setActionsDone] = useState<Record<string, boolean>>({});

  const displayed = pastDigest ?? latestDigest;

  // Zero fallback is only used by consumers that already treat 0 as "no
  // data" (Today %, allocation donut). The Total tile gates on
  // portfolioTotals directly.
  const totals = useMemo(
    () =>
      portfolioTotals
        ? {
            totalInvestment: portfolioTotals.invested,
            currentValue: portfolioTotals.currentValue,
            profit: portfolioTotals.profit,
            profitPercentage: portfolioTotals.profitPct,
          }
        : { totalInvestment: 0, currentValue: 0, profit: 0, profitPercentage: 0 },
    [portfolioTotals]
  );
  const movers = useMemo(() => deriveMovers(state.lists), [state.lists]);
  const allocationSlices = useMemo(
    () => deriveAllocation(state.summaries, totals.currentValue),
    [state.summaries, totals.currentValue]
  );

  // IST-aware today check (Lane 1b fix)
  const todayIso = todayInIST();
  const isStaleForToday =
    !!latestDigest && !pastDigest && latestDigest.date !== todayIso;

  // ── Housekeeping on mount ─────────────────────────────────────────────────
  // (ak-s74k: the old Lane 1a MSNContext bootstrap moved into the
  // useInvestmentSummaries hook above.) Sweep stale action-done localStorage
  // keys older than the archive window — bounded namespace + free
  // housekeeping on the one guaranteed mount surface for this feature.
  useEffect(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ACTION_DONE_TTL_DAYS);
    sweepStaleActionDoneKeys(cutoff.toISOString().slice(0, 10));
    // Shared open-issue count (Home strip + header bell use the same store).
    void refreshReconIssuesCount();
  }, []);

  // ── Auto mark-read on visit (unchanged from Wave 2) ───────────────────────
  useEffect(() => {
    if (!latestDigest) return;
    if (latestDigest.read_at) return;
    markReadLocal();
    void markDigestRead(latestDigest.date).catch(() => {
      /* swallow */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestDigest?.date]);

  // ── Action-done persistence (per-digest-date, localStorage) ───────────────
  // We namespace by digest date so switching between "today" and an archive
  // digest doesn't leak checkbox state across days. Reads on mount + on
  // displayed-date change.
  useEffect(() => {
    if (!displayed) return;
    const key = ACTION_DONE_LOCAL_KEY_PREFIX + displayed.date;
    try {
      const raw = localStorage.getItem(key);
      setActionsDone(raw ? JSON.parse(raw) : {});
    } catch {
      setActionsDone({});
    }
  }, [displayed?.date]);

  const handleToggleActionDone = (id: string, done: boolean) => {
    if (!displayed) return;
    const next = { ...actionsDone, [id]: done };
    setActionsDone(next);
    try {
      localStorage.setItem(
        ACTION_DONE_LOCAL_KEY_PREFIX + displayed.date,
        JSON.stringify(next)
      );
    } catch {
      // localStorage full / disabled — the UI update still happens; only
      // persistence is lost. Not worth surfacing a snackbar for.
    }
  };

  const handleAskFollowUp = () => {
    setCommand({
      type: "open_drawer",
      payload: "",
      timestamp: Date.now(),
    });
    navigate("/investments");
  };

  // ak-x1i5: suggested questions / "Ask about this" go to the Investment
  // Assistant (hosted on /investments) as a user message — same bridge
  // contract as Home's omni bar.
  const askAssistant = (text: string) => {
    setCommand({ type: "send_message", payload: text, timestamp: Date.now() });
    navigate("/investments");
  };

  const handleMarkRead = async () => {
    if (!displayed) return;
    setMarkReadInFlight(true);
    markReadLocal();
    try {
      await markDigestRead(displayed.date);
      await refresh();
      setSnackbarMessage("Marked as read");
    } catch {
      setSnackbarMessage("Couldn't mark as read — try again");
    } finally {
      setMarkReadInFlight(false);
    }
  };

  const handleCopy = async () => {
    if (!displayed?.text) return;
    try {
      await navigator.clipboard.writeText(displayed.text);
      setSnackbarMessage("Digest copied to clipboard");
    } catch {
      setSnackbarMessage("Copy failed — clipboard permission blocked?");
    }
  };

  const handleSnooze = () => {
    const until = new Date();
    until.setHours(until.getHours() + 24);
    try {
      localStorage.setItem(SNOOZE_LOCAL_KEY, until.toISOString());
      setSnackbarMessage("Notifications snoozed for 24 hours");
    } catch {
      setSnackbarMessage("Couldn't save snooze setting");
    }
  };

  const handleSelectPastDigest = (d: WealthDigestPayload) => setPastDigest(d);
  const handleBackToToday = () => setPastDigest(null);

  // ── Rendering branches ────────────────────────────────────────────────────

  if (
    !pastDigest &&
    (error?.code === "not_configured" || error?.code === "not_generated")
  ) {
    return (
      <div className={wdStyle.wealthDigestRoot}>
        <DigestHeader date={todayIso} onOpenHistory={() => setArchiveOpen(true)} />
        {error.code === "not_configured" ? <DigestNotConfigured /> : <DigestZeroEmpty />}
        <DigestArchiveModal
          open={archiveOpen}
          onClose={() => setArchiveOpen(false)}
          onSelectDigest={handleSelectPastDigest}
        />
      </div>
    );
  }

  if (loading && !latestDigest) {
    return <DigestSkeleton />;
  }

  const alreadyRead =
    !!displayed &&
    (!!displayed.read_at ||
      (displayed === latestDigest && !latestDigest?.read_at));

  const actions = displayed?.actions ?? [];
  const watchItems = displayed?.watch_items ?? [];
  const news = displayed?.news ?? [];
  const hasNarrative = !!displayed?.text;
  const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sortedActions = [...actions].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
  );
  const doneCount = actions.filter((a) => actionsDone[a.id]).length;

  // Suggested follow-ups: a fixed opener + one grounded in the digest's top
  // watch item (or a generic day-move question when there is none).
  const topWatch =
    watchItems.find((w) => w.severity === "critical") ??
    watchItems.find((w) => w.severity === "warning") ??
    watchItems[0];
  const digestPrompts: DigestPrompt[] = displayed
    ? [
        "What should I act on first today?",
        topWatch
          ? `Tell me more about "${topWatch.title}"`
          : "What moved my portfolio today?",
      ].map((label) => ({ label, onClick: () => askAssistant(label) }))
    : [];

  const kiteFunds = deriveKiteFunds(kiteState);
  const signed = (v: number) => `${v >= 0 ? "+" : "−"}`;

  return (
    <div className={wdStyle.wealthDigestRoot}>
      <DigestHeader
        date={displayed?.date ?? todayIso}
        generatedAt={displayed?.generated_at ?? null}
        onOpenHistory={() => setArchiveOpen(true)}
        viewingPast={!!pastDigest}
        onBackToToday={pastDigest ? handleBackToToday : undefined}
      />

      {/* State banners (hidden while viewing an archived digest, per design) */}
      {!pastDigest && isStaleForToday && (
        <DigestEmptyBanner latestDate={latestDigest?.date ?? null} />
      )}
      {!pastDigest && displayed?.last_error && (
        <DigestErrorBanner
          errorAt={displayed.last_error.at}
          errorMessage={displayed.last_error.message}
        />
      )}
      {/* Transient fetch failure, with or without a cached digest: the live
          tiles still render below (design: "tiles are unaffected"). */}
      {error && !pastDigest && (
        <DigestTransientErrorBanner
          message={error.message}
          onRetry={() => void refresh()}
        />
      )}

      <StatTileRow>
        <StatTile
          hero
          label="Total"
          value={portfolioTotals ? `₹${formatCompact(totals.currentValue)}` : "—"}
          valueTone={portfolioTotals ? undefined : "muted"}
          title={
            portfolioTotals
              ? `₹${formatCurrency(totals.currentValue)} · invested ₹${formatCurrency(totals.totalInvestment)}`
              : portfolioReadiness === "error"
                ? "Some holdings failed to load — total unknown"
                : "Loading holdings…"
          }
          sub={
            !portfolioTotals ? (
              portfolioReadiness === "error" ? "Couldn't load all holdings" : "Loading holdings…"
            ) : (
              <>
                Invested ₹{formatCompact(totals.totalInvestment)}
                {totals.totalInvestment !== 0 && (
                  <>
                    {" · "}
                    <span
                      className={
                        totals.profit > 0
                          ? wdStyle.textPositive
                          : totals.profit < 0
                            ? wdStyle.textNegative
                            : undefined
                      }
                    >
                      {signed(totals.profit)}
                      {Math.abs(totals.profitPercentage).toFixed(2)}%
                    </span>
                  </>
                )}
                {portfolioStale && " · may be stale"}
              </>
            )
          }
          onClick={() => navigate("/investments")}
          ariaLabel={
            portfolioTotals
              ? `Total portfolio value ${formatCurrency(totals.currentValue)} rupees, drill into investments`
              : "Total portfolio value not yet known, drill into investments"
          }
        />

        <StatTile
          label="Today"
          value={
            movers.hasData
              ? `${signed(movers.totalDayChange)}₹${formatCompact(Math.abs(movers.totalDayChange))}`
              : "—"
          }
          valueTone={
            !movers.hasData
              ? "muted"
              : movers.totalDayChange > 0
                ? "positive"
                : movers.totalDayChange < 0
                  ? "negative"
                  : undefined
          }
          title={
            movers.hasData
              ? `${signed(movers.totalDayChange)}₹${formatCurrency(Math.abs(movers.totalDayChange))}`
              : "Day change"
          }
          sub={
            movers.hasData && totals.currentValue > 0
              ? `${signed(movers.totalDayChange)}${Math.abs((movers.totalDayChange / totals.currentValue) * 100).toFixed(2)}% · day change`
              : "Day change"
          }
          onClick={() => navigate("/investments")}
          ariaLabel="Today's day change, drill into investments"
        />

        <StatTile
          label="Top mover"
          value={
            movers.top
              ? `${signed(movers.top.deltaPct)}${Math.abs(movers.top.deltaPct).toFixed(2)}%`
              : "—"
          }
          valueTone={
            !movers.top ? "muted" : movers.top.deltaPct >= 0 ? "positive" : "negative"
          }
          title={movers.top ? `${movers.top.name} · best-performing holding today` : undefined}
          sub={movers.top ? `${movers.top.name} · best today` : "No movement"}
          onClick={
            movers.top
              ? () => navigate(`/investments/${movers.top!.category}`)
              : undefined
          }
          ariaLabel={movers.top ? `Top mover ${movers.top.name}` : undefined}
        />

        <StatTile
          label="Worst mover"
          value={
            movers.worst
              ? `${signed(movers.worst.deltaPct)}${Math.abs(movers.worst.deltaPct).toFixed(2)}%`
              : "—"
          }
          valueTone={
            !movers.worst ? "muted" : movers.worst.deltaPct >= 0 ? "positive" : "negative"
          }
          title={movers.worst ? `${movers.worst.name} · weakest holding today` : undefined}
          sub={movers.worst ? `${movers.worst.name} · weakest today` : "No movement"}
          onClick={
            movers.worst
              ? () => navigate(`/investments/${movers.worst!.category}`)
              : undefined
          }
          ariaLabel={movers.worst ? `Worst mover ${movers.worst.name}` : undefined}
        />

        <StatTile
          label="Kite funds"
          value={kiteFunds.value}
          valueTone={kiteFunds.muted ? "muted" : undefined}
          title={kiteFunds.title ?? "Available cash from Kite margins"}
          sub={kiteFunds.sub}
          onClick={() => navigate("/investments")}
          ariaLabel="Kite funds, open investments"
        />

        <StatTile
          label="Reconciliation"
          value={
            reconIssuesCount === null
              ? "—"
              : reconIssuesCount === 0
                ? "All clear"
                : `${reconIssuesCount} open`
          }
          valueTone={reconIssuesCount === null ? "muted" : undefined}
          title="Unmatched Kite trades"
          sub="Zerodha vs statement"
          onClick={() => setReconDialogOpen(true)}
          ariaLabel="Reconciliation issues, open review"
        />
      </StatTileRow>

      <div className={wdStyle.mainGrid}>
        {displayed && (
          <div className={wdStyle.digestColumn}>
            <DigestActions
              alreadyRead={alreadyRead || markReadInFlight}
              prompts={digestPrompts}
              onAskFollowUp={handleAskFollowUp}
              onMarkRead={handleMarkRead}
              onCopy={handleCopy}
              onSnooze={handleSnooze}
              disabled={markReadInFlight}
              sticky
            />

            <section className={wdStyle.section}>
              <div className={wdStyle.sectionHead}>
                <h2 className={wdStyle.sectionHeading}>Do</h2>
                <span className={wdStyle.sectionMeta}>
                  {actions.length} suggested · {doneCount} done
                </span>
              </div>
              {sortedActions.length > 0 ? (
                sortedActions.map((a) => (
                  <ActionCard
                    key={a.id}
                    action={a}
                    done={!!actionsDone[a.id]}
                    onToggleDone={handleToggleActionDone}
                    onAsk={() => askAssistant(`Tell me more about "${a.title}"`)}
                  />
                ))
              ) : (
                <div className={wdStyle.sectionEmpty}>
                  <i className="ph ph-check-square" aria-hidden />
                  <span>No actions suggested in this digest.</span>
                </div>
              )}
            </section>

            <section className={wdStyle.section}>
              <div className={wdStyle.sectionHead}>
                <h2 className={wdStyle.sectionHeading}>Watch</h2>
                <span className={wdStyle.sectionMeta}>Keep an eye on</span>
              </div>
              {watchItems.length > 0 ? (
                watchItems.map((w) => (
                  <WatchItemCard
                    key={w.id}
                    item={w}
                    onAsk={() => askAssistant(`Tell me more about "${w.title}"`)}
                  />
                ))
              ) : (
                <div className={wdStyle.sectionEmpty}>
                  <i className="ph ph-eye" aria-hidden />
                  <span>Nothing flagged to watch in this digest.</span>
                </div>
              )}
            </section>

            <section className={wdStyle.section}>
              <div className={wdStyle.sectionHead}>
                <h2 className={wdStyle.sectionHeading}>Know</h2>
                <span className={wdStyle.sectionMeta}>Market context, with sources</span>
              </div>
              {news.length > 0 ? (
                news.map((n) => <NewsCard key={n.id} item={n} />)
              ) : (
                <div className={wdStyle.sectionEmpty}>
                  <i className="ph ph-newspaper" aria-hidden />
                  <span>
                    No market context in this digest. Once the digest is web-grounded,
                    each item here links to its source.
                  </span>
                </div>
              )}
            </section>

            {hasNarrative && <NarrativeSection text={displayed!.text} />}
          </div>
        )}

        <aside className={wdStyle.insightsColumnSlot}>
          <InsightsColumn
            allocationSlices={allocationSlices}
            totalCurrentValue={totals.currentValue}
          />
        </aside>
      </div>

      <DigestArchiveModal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onSelectDigest={handleSelectPastDigest}
      />

      <ReconciliationDialog
        open={reconDialogOpen}
        onClose={() => setReconDialogOpen(false)}
        onResolved={() => {
          setReconIssuesCount((prev) => (prev === null ? null : Math.max(0, prev - 1)));
        }}
      />

      {snackbarMessage && (
        <div
          role="status"
          aria-live="polite"
          onClick={() => setSnackbarMessage(null)}
          className={wdStyle.snackbar}
        >
          {snackbarMessage}
        </div>
      )}
    </div>
  );
};

export default WealthDigest;
