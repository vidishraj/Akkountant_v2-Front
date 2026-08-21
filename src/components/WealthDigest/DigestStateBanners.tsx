import React from "react";
import { Alert, Box, Link, Typography } from "@mui/material";
import style from "./WealthDigest.module.scss";

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
    Latest digest task failed at <strong>{errorAt}</strong>. Showing the most
    recent successful digest below.
    <Box component="span" className={style.errorDetail}>
      &nbsp;· {errorMessage}
    </Box>
  </Alert>
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
