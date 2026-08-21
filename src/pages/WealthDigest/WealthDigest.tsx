import { useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";
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
import DigestBody from "../../components/WealthDigest/DigestBody.tsx";
import DigestActions from "../../components/WealthDigest/DigestActions.tsx";
import DigestArchiveModal from "../../components/WealthDigest/DigestArchiveModal.tsx";
import DigestSkeleton from "../../components/WealthDigest/DigestSkeleton.tsx";
import {
  DigestEmptyBanner,
  DigestErrorBanner,
  DigestNotConfigured,
  DigestTransientErrorBanner,
} from "../../components/WealthDigest/DigestStateBanners.tsx";
import { formatCompact, formatCurrency } from "../../components/WealthDigest/formatters.ts";
import wdStyle from "../../components/WealthDigest/WealthDigest.module.scss";

const SNOOZE_LOCAL_KEY = "wealthDigestSnoozedUntil";
const MSN_KEYS = ["stocks", "mf", "nps"] as const;
const EPG_KEYS = ["ppf", "epf", "gold"] as const;

/**
 * Derives the current portfolio total from MSNContext.summaries — matches the
 * accumulation logic in GlobalSummary's calculateSummary (ak-kpd made that
 * idempotent). We inline the sum here rather than call calculateSummary
 * because the signature there takes callback-owned `summary`/`read` that we
 * don't have on the WealthDigest page.
 */
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
 * Walks all MSN lists to find the top and worst per-asset movers for today.
 * Per-asset day-change = (info.change * buyQuant); we compare in absolute-
 * value terms so a large ₹ movement wins over a large % movement on a tiny
 * position. Ties break by first-seen order (Object.entries iteration).
 *
 * We track the asset's category (stocks / mf / nps) alongside its name so
 * the tile can drill down to `/investments/{category}` — matching the
 * :asset route param, which is category-scoped not per-security.
 */
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
 * WealthDigest page shell — the top-level route at /wealth-digest.
 *
 * Composition:
 * - Header (title, date, disclosure chip, history dropdown)
 * - Tile row (5 tiles derived from MSNContext live portfolio state)
 * - Digest body (markdown from BE, wrapped in a readable band)
 * - Action row (Ask follow-up, Mark read, kebab)
 * - Archive modal (opens from header, mounts lazily)
 *
 * State variants:
 * - MSNContext still loading + no digest yet → DigestSkeleton
 * - not_configured code from BE → DigestNotConfigured (full-page empty)
 * - transient fetch error → DigestTransientErrorBanner with retry
 * - digest.last_error present → DigestErrorBanner + fallback content below
 * - digest date older than today → DigestEmptyBanner + last-successful content
 * - normal → tiles + body + actions
 */
const WealthDigest = () => {
  const navigate = useNavigate();
  const { state } = useMSNContext();
  const { digest: latestDigest, loading, error, refresh, markReadLocal } =
    useWealthDigest();
  const { setCommand } = useAgentChatBridge();

  // When the user selects an older digest from the archive, we display it here
  // and flip the header to viewing-past mode. `null` means we're on the latest.
  const [pastDigest, setPastDigest] = useState<WealthDigestPayload | null>(
    null
  );
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [markReadInFlight, setMarkReadInFlight] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  // The digest we actually display — past-if-picked, otherwise latest.
  const displayed = pastDigest ?? latestDigest;

  // Derived KPI values (from MSNContext live state — NOT from the digest text)
  const totals = useMemo(
    () => derivePortfolioTotal(state.summaries),
    [state.summaries]
  );
  const movers = useMemo(() => deriveMovers(state.lists), [state.lists]);

  // Detect "digest text is stale relative to today" for the empty banner.
  const todayIso = new Date().toISOString().slice(0, 10);
  const isStaleForToday =
    !!latestDigest && !pastDigest && latestDigest.date !== todayIso;

  // Auto-clear the nav badge when the user lands on the page and the current
  // digest is unread. The optimistic FE-only mark-read fires; the durable
  // server POST fires alongside so cross-device state stays in sync.
  useEffect(() => {
    if (!latestDigest) return;
    if (latestDigest.read_at) return;
    // Mark locally right away so the badge disappears immediately.
    markReadLocal();
    // Fire and forget — visit-clears is a soft affordance; if this errors we
    // don't want to surface it (the user's IN the page, they see it, that's
    // the strongest possible "read" signal).
    void markDigestRead(latestDigest.date).catch(() => {
      /* swallow */
    });
    // Only run once per (latest) digest change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestDigest?.date]);

  const handleAskFollowUp = () => {
    // AgentChat is only mounted on Investments / Transactions / Freelance —
    // NOT here on /wealth-digest — so we route the user to /investments (the
    // investment agent's natural home) and dispatch the open_drawer bridge
    // command. When Investments' AgentChat mounts on arrival, it consumes
    // the command and springs the drawer open.
    //
    // Hidden-context digest seeding — the ORIGINAL Q1 intent — is deferred
    // to a P3 follow-up bead. The investment agent already has portfolio
    // tools and can answer any follow-up on today's narrative without the
    // digest text preloaded; the follow-up bead should extend the bridge
    // with a proper seed_context command type + AgentChat surgery to
    // prepend the digest as a hidden first turn on the user's next send.
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

  const handleSelectPastDigest = (d: WealthDigestPayload) => {
    setPastDigest(d);
  };

  const handleBackToToday = () => {
    setPastDigest(null);
  };

  // ── Rendering branches ────────────────────────────────────────────────────

  // Not-configured is a full-page state — no tiles, no header.
  if (error?.code === "not_configured") {
    return (
      <Box className={wdStyle.wealthDigestRoot}>
        <DigestNotConfigured />
      </Box>
    );
  }

  // Skeleton while both the digest fetch AND MSN context are loading.
  if (loading && !latestDigest) {
    return <DigestSkeleton />;
  }

  // Transient error with no digest at all — render banner + skeleton beneath.
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
    (!!displayed.read_at || (displayed === latestDigest && !latestDigest?.read_at));
  // Note: after the visit-auto-mark-read effect runs, latestDigest.read_at is
  // still null in FE state until refresh() lands. The `(displayed ===
  // latestDigest && !latestDigest?.read_at)` clause treats a visited-latest as
  // "read" for button purposes — matches the badge behavior.

  return (
    <Box className={wdStyle.wealthDigestRoot}>
      <DigestHeader
        date={displayed?.date ?? null}
        onOpenHistory={() => setArchiveOpen(true)}
        viewingPast={!!pastDigest}
        onBackToToday={pastDigest ? handleBackToToday : undefined}
      />

      {/* State banners — order: latest-stale (empty), then last_error, then transient */}
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

      {/* Tile row — always driven by live portfolio state, regardless of which
          digest (today / past) is being viewed in the body. Overseer's Q2
          intent: tiles are the "true now"; body is the narrative. */}
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

      {/* Body */}
      {displayed?.text && <DigestBody text={displayed.text} />}

      {/* Actions */}
      {displayed && (
        <DigestActions
          alreadyRead={alreadyRead || markReadInFlight}
          onAskFollowUp={handleAskFollowUp}
          onMarkRead={handleMarkRead}
          onCopy={handleCopy}
          onSnooze={handleSnooze}
          disabled={markReadInFlight}
        />
      )}

      {/* Archive modal (lazy) */}
      <DigestArchiveModal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onSelectDigest={handleSelectPastDigest}
      />

      {/* Snackbar for action feedback (kept inline instead of via a MUI
          Snackbar to avoid another portal). It's a passive line at the bottom;
          clears on next action. */}
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
