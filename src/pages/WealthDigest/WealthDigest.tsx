import { useEffect, useMemo, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useMSNContext } from "../../contexts/MSNContext.tsx";
import { useWealthDigest } from "../../contexts/WealthDigestContext.tsx";
import { useAgentChatBridge } from "../../contexts/AgentChatBridgeContext.tsx";
import {
  WealthDigest as WealthDigestPayload,
  markDigestRead,
} from "../../services/wealthDigestService.ts";
import { MSNListResponse } from "../../utils/interfaces.ts";
import StatTileRow from "../../components/WealthDigest/StatTileRow.tsx";
import StatTile from "../../components/WealthDigest/StatTile.tsx";
import DigestHeader from "../../components/WealthDigest/DigestHeader.tsx";
import NarrativeSection from "../../components/WealthDigest/NarrativeSection.tsx";
import ActionCard from "../../components/WealthDigest/ActionCard.tsx";
import WatchItemCard from "../../components/WealthDigest/WatchItemCard.tsx";
import NewsCard from "../../components/WealthDigest/NewsCard.tsx";
import InsightsColumn from "../../components/WealthDigest/InsightsColumn.tsx";
import DigestActions from "../../components/WealthDigest/DigestActions.tsx";
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

function derivePortfolioTotal(summaries: Record<string, any>): {
  totalInvestment: number;
  currentValue: number;
  profit: number;
  profitPercentage: number;
} {
  let totalInvestment = 0;
  let currentValue = 0;
  let profit = 0;

  MSN_KEYS.forEach((k) => {
    const s = summaries[k];
    if (s && s.totalValue !== 0) {
      totalInvestment += Number(s.totalValue) || 0;
      currentValue += Number(s.currentValue) || 0;
      profit += Number(s.changeAmount) || 0;
    }
  });

  EPG_KEYS.forEach((k) => {
    const s = summaries[k];
    if (!s) return;
    const net = Number(s.net) || 0;
    const netProfit = Number(s.netProfit) || 0;
    const unaccounted = Number(s.unAccountedProfit || 0);
    if (net !== 0) {
      if (k === "ppf") {
        totalInvestment += net - (netProfit - unaccounted);
        currentValue += net + unaccounted;
      } else {
        totalInvestment += net - netProfit;
        currentValue += net;
      }
      profit += netProfit;
    }
  });

  const profitPercentage =
    totalInvestment !== 0 ? (profit / totalInvestment) * 100 : 0;

  return { totalInvestment, currentValue, profit, profitPercentage };
}

/**
 * Rough "is MSNContext populated?" check. Every category starts with a zero-
 * initialized summary object, so a genuinely empty state has every currentValue
 * and net at zero. Returns true if we should trigger a bootstrap fetch.
 */
function msnLooksEmpty(summaries: Record<string, any>): boolean {
  const msnZero = MSN_KEYS.every(
    (k) => Number(summaries[k]?.currentValue) === 0
  );
  const epgZero = EPG_KEYS.every((k) => Number(summaries[k]?.net) === 0);
  return msnZero && epgZero;
}

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
      const change = Number(item.info?.change) || 0;
      const quant = Number(item.buyQuant) || 0;
      const rupees = change * quant;
      if (change !== 0) {
        hasData = true;
        totalDayChange += rupees;
        const name =
          (item as { stockCode?: string; name?: string; schemeName?: string })
            .stockCode ??
          (item as { name?: string }).name ??
          (item as { schemeName?: string }).schemeName ??
          "—";
        const pct =
          Number(item.info?.previousClose) > 0
            ? (change / Number(item.info.previousClose)) * 100
            : 0;
        const entry: Mover = { name, category: k, delta: rupees, deltaPct: pct };
        if (!top || rupees > top.delta) top = entry;
        if (!worst || rupees < worst.delta) worst = entry;
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
  const { state, globalInvestmentRefresh } = useMSNContext();
  const { digest: latestDigest, loading, error, refresh, markReadLocal } =
    useWealthDigest();
  const { setCommand } = useAgentChatBridge();

  const [pastDigest, setPastDigest] = useState<WealthDigestPayload | null>(
    null
  );
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [markReadInFlight, setMarkReadInFlight] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [actionsDone, setActionsDone] = useState<Record<string, boolean>>({});

  const displayed = pastDigest ?? latestDigest;

  const totals = useMemo(
    () => derivePortfolioTotal(state.summaries),
    [state.summaries]
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

  // ── Lane 1a fix: MSNContext bootstrap ─────────────────────────────────────
  // If the user hits /wealth-digest as their first authenticated page (nav
  // badge draws them straight here) then MSNContext has never fetched, all
  // tiles read as zero, and the whole KPI row is misleading. Trigger the
  // same refresh the /investments page uses. globalInvestmentRefresh fires
  // 8 parallel category fetches — worth doing once on mount, not on every
  // rerender.
  //
  // Also sweep stale action-done localStorage keys older than the archive
  // window — bounded namespace + free housekeeping on the one guaranteed
  // mount surface for this feature.
  useEffect(() => {
    if (msnLooksEmpty(state.summaries)) {
      globalInvestmentRefresh();
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ACTION_DONE_TTL_DAYS);
    sweepStaleActionDoneKeys(cutoff.toISOString().slice(0, 10));
    // Intentionally not depending on state.summaries — we only want the
    // bootstrap-on-mount fire, not a re-fire after the fetches populate it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (error?.code === "not_configured") {
    return (
      <Box className={wdStyle.wealthDigestRoot}>
        <DigestNotConfigured />
      </Box>
    );
  }

  if (error?.code === "not_generated") {
    return (
      <Box className={wdStyle.wealthDigestRoot}>
        <DigestZeroEmpty />
      </Box>
    );
  }

  if (loading && !latestDigest) {
    return <DigestSkeleton />;
  }

  if (error && !latestDigest) {
    return (
      <Box className={wdStyle.wealthDigestRoot}>
        <DigestHeader
          date={null}
          onOpenHistory={() => setArchiveOpen(true)}
        />
        <DigestTransientErrorBanner
          message={error.message}
          onRetry={() => void refresh()}
        />
      </Box>
    );
  }

  const alreadyRead =
    !!displayed &&
    (!!displayed.read_at ||
      (displayed === latestDigest && !latestDigest?.read_at));

  const hasActions = (displayed?.actions?.length ?? 0) > 0;
  const hasWatchItems = (displayed?.watch_items?.length ?? 0) > 0;
  const hasNews = (displayed?.news?.length ?? 0) > 0;
  const hasNarrative = !!displayed?.text;

  return (
    <Box className={wdStyle.wealthDigestRoot}>
      <DigestHeader
        date={displayed?.date ?? null}
        generatedAt={displayed?.generated_at ?? null}
        onOpenHistory={() => setArchiveOpen(true)}
        viewingPast={!!pastDigest}
        onBackToToday={pastDigest ? handleBackToToday : undefined}
      />

      {/* State banners */}
      {!pastDigest && isStaleForToday && (
        <DigestEmptyBanner latestDate={displayed?.date ?? null} />
      )}
      {displayed?.last_error && (
        <DigestErrorBanner
          errorAt={displayed.last_error.at}
          errorMessage={displayed.last_error.message}
        />
      )}
      {error && latestDigest && (
        <DigestTransientErrorBanner
          message={error.message}
          onRetry={() => void refresh()}
        />
      )}

      {/* Tile row — full-width above the 2-col split */}
      <StatTileRow>
        <StatTile
          label="Total"
          value={`₹${formatCompact(totals.currentValue)}`}
          valueTooltip={`₹${formatCurrency(totals.currentValue)}`}
          subtitle={
            totals.totalInvestment !== 0
              ? `Invested ₹${formatCompact(totals.totalInvestment)}`
              : undefined
          }
          delta={{
            text: `${totals.profit >= 0 ? "+" : ""}${totals.profitPercentage.toFixed(2)}%`,
            polarity:
              totals.profit === 0
                ? "neutral"
                : totals.profit > 0
                  ? "positive"
                  : "negative",
          }}
          hero
          onClick={() => navigate("/investments")}
          ariaLabel={`Total portfolio value ${formatCurrency(totals.currentValue)} rupees, drill into investments`}
        />

        <StatTile
          label="Today"
          value={
            movers.hasData
              ? `${movers.totalDayChange >= 0 ? "+" : ""}₹${formatCompact(movers.totalDayChange)}`
              : "—"
          }
          valueTooltip={
            movers.hasData
              ? `${movers.totalDayChange >= 0 ? "+" : ""}₹${formatCurrency(movers.totalDayChange)}`
              : undefined
          }
          delta={
            movers.hasData && totals.currentValue > 0
              ? {
                  text: `${movers.totalDayChange >= 0 ? "+" : ""}${((movers.totalDayChange / totals.currentValue) * 100).toFixed(2)}%`,
                  polarity:
                    movers.totalDayChange === 0
                      ? "neutral"
                      : movers.totalDayChange > 0
                        ? "positive"
                        : "negative",
                }
              : undefined
          }
          subtitle="Day change"
          onClick={() => navigate("/investments")}
          ariaLabel="Today's day change, drill into investments"
        />

        <StatTile
          label="Top mover"
          value={movers.top ? movers.top.name : "—"}
          subtitle={movers.top ? "Best-performing today" : "No movement"}
          delta={
            movers.top
              ? {
                  text: `${movers.top.deltaPct >= 0 ? "+" : ""}${movers.top.deltaPct.toFixed(2)}%`,
                  polarity: "positive",
                }
              : undefined
          }
          onClick={
            movers.top
              ? () => navigate(`/investments/${movers.top!.category}`)
              : undefined
          }
          ariaLabel={movers.top ? `Top mover ${movers.top.name}` : undefined}
        />

        <StatTile
          label="Worst mover"
          value={movers.worst ? movers.worst.name : "—"}
          subtitle={movers.worst ? "Weakest today" : "No movement"}
          delta={
            movers.worst
              ? {
                  text: `${movers.worst.deltaPct >= 0 ? "+" : ""}${movers.worst.deltaPct.toFixed(2)}%`,
                  polarity:
                    movers.worst.deltaPct >= 0 ? "positive" : "negative",
                }
              : undefined
          }
          onClick={
            movers.worst
              ? () => navigate(`/investments/${movers.worst!.category}`)
              : undefined
          }
          ariaLabel={
            movers.worst ? `Worst mover ${movers.worst.name}` : undefined
          }
        />

        <StatTile
          label="Cash %"
          value={
            totals.currentValue > 0
              ? `${(
                  ((state.summaries["ppf"]?.net || 0) /
                    Math.max(totals.currentValue, 1)) *
                    100
                ).toFixed(1)}%`
              : "—"
          }
          subtitle="Of portfolio"
          delta={{ text: "in cash-equivalent", polarity: "neutral" }}
          onClick={() => navigate("/transactions")}
          ariaLabel="Cash percentage, drill into transactions"
        />
      </StatTileRow>

      {/* 2-col main body */}
      <Box className={wdStyle.mainGrid}>
        <Box className={wdStyle.digestColumn}>
          {displayed && (
            <DigestActions
              alreadyRead={alreadyRead || markReadInFlight}
              onAskFollowUp={handleAskFollowUp}
              onMarkRead={handleMarkRead}
              onCopy={handleCopy}
              onSnooze={handleSnooze}
              disabled={markReadInFlight}
              sticky
            />
          )}

          {hasActions && (
            <Box className={wdStyle.section}>
              <Typography className={wdStyle.sectionHeading} component="h2">
                Actions
              </Typography>
              <Box className={wdStyle.cardStack}>
                {displayed!.actions.map((a) => (
                  <ActionCard
                    key={a.id}
                    action={a}
                    done={!!actionsDone[a.id]}
                    onToggleDone={handleToggleActionDone}
                  />
                ))}
              </Box>
            </Box>
          )}

          {hasWatchItems && (
            <Box className={wdStyle.section}>
              <Typography className={wdStyle.sectionHeading} component="h2">
                Keep an eye on
              </Typography>
              <Box className={wdStyle.cardStack}>
                {displayed!.watch_items.map((w) => (
                  <WatchItemCard key={w.id} item={w} />
                ))}
              </Box>
            </Box>
          )}

          {hasNews && (
            <Box className={wdStyle.section}>
              <Typography className={wdStyle.sectionHeading} component="h2">
                Market context
              </Typography>
              <Box className={wdStyle.cardStack}>
                {displayed!.news.map((n) => (
                  <NewsCard key={n.id} item={n} />
                ))}
              </Box>
            </Box>
          )}

          {hasNarrative && <NarrativeSection text={displayed!.text} />}
        </Box>

        <Box className={wdStyle.insightsColumnSlot}>
          <InsightsColumn
            allocationSlices={allocationSlices}
            totalCurrentValue={totals.currentValue}
          />
        </Box>
      </Box>

      {/* Archive modal */}
      <DigestArchiveModal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onSelectDigest={handleSelectPastDigest}
      />

      {snackbarMessage && (
        <Box
          role="status"
          aria-live="polite"
          onClick={() => setSnackbarMessage(null)}
          sx={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0, 0, 0, 0.85)",
            color: "#FAFAFA",
            padding: "8px 16px",
            borderRadius: 4,
            fontSize: 13,
            zIndex: 2000,
            cursor: "pointer",
          }}
        >
          {snackbarMessage}
        </Box>
      )}
    </Box>
  );
};

export default WealthDigest;
