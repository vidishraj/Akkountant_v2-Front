import React from "react";
import style from "./WealthDigest.module.scss";

/**
 * FE-6 (ak-jhy8) Nocturne-skinned state banners. MUI Alert/Box/Typography/
 * Link dropped. All five variants share the `.stateBanner` surface but
 * differentiate via severity-keyed accent color + Phosphor icon.
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

type Severity = "info" | "warning" | "error";

const ICON: Record<Severity, string> = {
    info: "ph-info",
    warning: "ph-warning-circle",
    error: "ph-x-circle",
};

interface BannerProps {
    severity: Severity;
    children: React.ReactNode;
    action?: React.ReactNode;
}

const Banner: React.FC<BannerProps> = ({severity, children, action}) => (
    <div
        role="alert"
        className={`${style.stateBanner} ${style["stateBanner_" + severity as "stateBanner_info"]}`}
    >
        <i className={`ph-fill ${ICON[severity]}`} aria-hidden/>
        <div className={style.stateBannerBody}>{children}</div>
        {action}
    </div>
);

export const DigestEmptyBanner: React.FC<{latestDate: string | null}> = ({latestDate}) => (
    <Banner severity="info">
        Today's digest hasn't arrived yet. It usually lands by 8&nbsp;a.m. IST.
        {latestDate && (
            <>
                {" "}
                Last successful digest: <strong>{latestDate}</strong>.
            </>
        )}
    </Banner>
);

export const DigestErrorBanner: React.FC<{errorAt: string; errorMessage: string}> = ({
    errorAt,
    errorMessage,
}) => (
    <Banner severity="error">
        Latest digest task failed at <strong>{humanizeTimestamp(errorAt)}</strong>.
        Showing the most recent successful digest below.
        <span className={style.errorDetail}>&nbsp;· {errorMessage}</span>
    </Banner>
);

export const DigestZeroEmpty: React.FC = () => (
    <div className={style.notConfiguredRoot}>
        <h2 className={style.notConfiguredTitle}>You don't have a wealth digest yet</h2>
        <p className={style.notConfiguredBody}>
            Wealth Digest is set up for your account, but the daily task hasn't generated
            a digest yet. It usually runs in the early morning (around 6&nbsp;a.m. IST).
            Once it produces the first summary, this page will populate automatically.
        </p>
        <p className={style.notConfiguredBody}>
            If it's been more than a day, check that the WealthDigestTask scheduler is
            running server-side.
        </p>
    </div>
);

export const DigestNotConfigured: React.FC = () => (
    <div className={style.notConfiguredRoot}>
        <h2 className={style.notConfiguredTitle}>Wealth Digest isn't set up yet</h2>
        <p className={style.notConfiguredBody}>
            Set the <code>WEALTH_DIGEST_USER_ID</code> environment variable on the server
            to enable daily digests for your account. Once configured, the task runs each
            morning and this page picks up the output automatically.
        </p>
        <p className={style.notConfiguredBody}>
            Reach out to your admin if you're not sure how to set it — the digest
            pipeline reads that ID at task-run time to know which user to build the
            summary for.
        </p>
        <a
            href="https://github.com/vidishraj/Akkountant_v2-Front#wealth-digest"
            target="_blank"
            rel="noopener noreferrer"
            className={style.notConfiguredLink}
        >
            Docs →
        </a>
    </div>
);

export const DigestTransientErrorBanner: React.FC<{message: string; onRetry: () => void}> = ({
    message,
    onRetry,
}) => (
    <Banner
        severity="warning"
        action={
            <button
                type="button"
                className={`btn btn-ghost ${style.retryLink}`}
                onClick={onRetry}
            >
                Retry
            </button>
        }
    >
        Couldn't load your digest right now — {message}
    </Banner>
);
