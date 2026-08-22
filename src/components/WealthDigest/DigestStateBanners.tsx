import React from "react";
import { Alert, Box, Link, Typography } from "@mui/material";
import style from "./WealthDigest.module.scss";

/**
 * Humanizes an ISO 8601 timestamp for display. Falls back to the raw string
 * if the input isn't parseable so we never render "Invalid Date" — better
 * to show the raw ISO string in that pathological case than a broken banner.
 */
function humanizeTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Banner shown when today's digest hasn't landed yet — page tiles still render
 * (live portfolio state), and this banner sits above the empty digest slot.
 * We show the last-successful digest's date so the user knows how stale the
 * situation is.
 */
export const DigestEmptyBanner: React.FC<{ latestDate: string | null }> = ({
  latestDate,
}) => (
  <Alert severity="info" className={style.stateBanner}>
    Today's digest hasn't arrived yet. It usually lands by 8&nbsp;a.m. IST.
    {latestDate && (
      <>
        {" "}
        Last successful digest:{" "}
        <strong>{latestDate}</strong>.
      </>
    )}
  </Alert>
);

/**
 * Banner shown when the most recent WealthDigestTask run failed (server
 * exposes `last_error`). Page falls back to the most recent successful
 * digest content below, and this banner sits above it.
 */
export const DigestErrorBanner: React.FC<{
  errorAt: string;
  errorMessage: string;
}> = ({ errorAt, errorMessage }) => (
  <Alert severity="error" className={style.stateBanner}>
    Latest digest task failed at <strong>{humanizeTimestamp(errorAt)}</strong>.
    Showing the most recent successful digest below.
    <Box component="span" className={style.errorDetail}>
      &nbsp;· {errorMessage}
    </Box>
  </Alert>
);

/**
 * Empty state for the "user is configured but no digest has ever been
 * generated" case (fetchLatestDigest → 404 → not_generated code). Distinct
 * from DigestNotConfigured (env var missing) because the remediation is
 * different — this one just waits for the scheduled task to run for the
 * first time.
 */
export const DigestZeroEmpty: React.FC = () => (
  <Box className={style.notConfiguredRoot}>
    <Typography variant="h5" className={style.notConfiguredTitle}>
      You don't have a wealth digest yet
    </Typography>
    <Typography className={style.notConfiguredBody}>
      Wealth Digest is set up for your account, but the daily task hasn't
      generated a digest yet. It usually runs in the early morning
      (around 6&nbsp;a.m. IST). Once it produces the first summary, this
      page will populate automatically.
    </Typography>
    <Typography className={style.notConfiguredBody}>
      If it's been more than a day, check that the WealthDigestTask
      scheduler is running server-side.
    </Typography>
  </Box>
);

/**
 * Full-page empty state when the user has not configured WealthDigest at all
 * (backend returned `code: "not_configured"`). This is a first-run affordance
 * — no tiles render because there's no digest and no read/history state to
 * show. Points to the env-var that gates it.
 */
export const DigestNotConfigured: React.FC = () => (
  <Box className={style.notConfiguredRoot}>
    <Typography variant="h5" className={style.notConfiguredTitle}>
      Wealth Digest isn't set up yet
    </Typography>
    <Typography className={style.notConfiguredBody}>
      Set the <code>WEALTH_DIGEST_USER_ID</code> environment variable on the
      server to enable daily digests for your account. Once configured, the
      task runs each morning and this page picks up the output automatically.
    </Typography>
    <Typography className={style.notConfiguredBody}>
      Reach out to your admin if you're not sure how to set it — the digest
      pipeline reads that ID at task-run time to know which user to build
      the summary for.
    </Typography>
    <Link
      href="https://github.com/vidishraj/Akkountant_v2-Front#wealth-digest"
      target="_blank"
      rel="noopener noreferrer"
      className={style.notConfiguredLink}
    >
      Docs →
    </Link>
  </Box>
);

/**
 * Generic transient-error banner used when a fetch failed for reasons other
 * than "not configured" or "not found." Retry action is a caller callback so
 * the page can re-fetch without a full reload.
 */
export const DigestTransientErrorBanner: React.FC<{
  message: string;
  onRetry: () => void;
}> = ({ message, onRetry }) => (
  <Alert
    severity="warning"
    className={style.stateBanner}
    action={
      <Link
        component="button"
        onClick={onRetry}
        className={style.retryLink}
      >
        Retry
      </Link>
    }
  >
    Couldn't load your digest right now — {message}
  </Alert>
);
