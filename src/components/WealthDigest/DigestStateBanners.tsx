import React, {useState} from "react";
import {formatDigestDateLabel} from "./formatters";
import style from "./WealthDigest.module.scss";

/**
 * ak-x1i5: state banners per the design — one surface card with a
 * severity-tinted inset edge + icon, a title line, a muted body line, an
 * optional collapsible error detail and an optional CTA.
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

interface BannerProps {
    severity: Severity;
    icon: string;
    title: React.ReactNode;
    body?: React.ReactNode;
    detail?: string;
    cta?: {label: string; onClick: () => void};
}

const Banner: React.FC<BannerProps> = ({severity, icon, title, body, detail, cta}) => {
    const [detailOpen, setDetailOpen] = useState(false);
    return (
        <div
            role={severity === "info" ? "status" : "alert"}
            className={`${style.stateBanner} ${style[("stateBanner_" + severity) as "stateBanner_info"]}`}
        >
            <i className={`ph ${icon} ${style.stateBannerIcon}`} aria-hidden/>
            <div className={style.stateBannerBody}>
                <span className={style.stateBannerTitle}>{title}</span>
                {body && <span className={style.stateBannerText}>{body}</span>}
                {detail && detailOpen && (
                    <code className={style.stateBannerDetail}>{detail}</code>
                )}
            </div>
            {(detail || cta) && (
                <div className={style.stateBannerActions}>
                    {detail && (
                        <button
                            type="button"
                            className={`btn btn-ghost ${style.stateBannerDetailBtn}`}
                            onClick={() => setDetailOpen((v) => !v)}
                            aria-expanded={detailOpen}
                        >
                            {detailOpen ? "Hide details" : "Details"}
                        </button>
                    )}
                    {cta && (
                        <button
                            type="button"
                            className={`btn btn-secondary ${style.stateBannerCta}`}
                            onClick={cta.onClick}
                        >
                            {cta.label}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export const DigestEmptyBanner: React.FC<{latestDate: string | null}> = ({latestDate}) => (
    <Banner
        severity="info"
        icon="ph-hourglass-medium"
        title={<>Today's digest hasn't arrived yet. It usually lands by 8&nbsp;a.m. IST.</>}
        body={
            latestDate
                ? `Last successful digest: ${formatDigestDateLabel(latestDate)}. Tiles above show live portfolio state.`
                : "Tiles above show live portfolio state."
        }
    />
);

export const DigestErrorBanner: React.FC<{errorAt: string; errorMessage: string}> = ({
    errorAt,
    errorMessage,
}) => (
    <Banner
        severity="error"
        icon="ph-warning-circle"
        title={`Latest digest task failed at ${humanizeTimestamp(errorAt)}. Showing the most recent successful digest below.`}
        body="The portfolio tiles below are live."
        detail={errorMessage || undefined}
    />
);

export const DigestTransientErrorBanner: React.FC<{message: string; onRetry: () => void}> = ({
    message,
    onRetry,
}) => (
    <Banner
        severity="warning"
        icon="ph-wifi-slash"
        title="Couldn't load your digest right now — the request failed."
        body="Your portfolio tiles are unaffected."
        detail={message || undefined}
        cta={{label: "Retry", onClick: onRetry}}
    />
);

interface FullEmptyProps {
    icon: string;
    title: string;
    children: React.ReactNode;
}

const FullEmpty: React.FC<FullEmptyProps> = ({icon, title, children}) => (
    <div className={style.notConfiguredRoot}>
        <i className={`ph ${icon} ${style.notConfiguredIcon}`} aria-hidden/>
        <h3 className={style.notConfiguredTitle}>{title}</h3>
        {children}
    </div>
);

export const DigestZeroEmpty: React.FC = () => (
    <FullEmpty icon="ph-sun-horizon" title="You don't have a wealth digest yet">
        <p className={style.notConfiguredBody}>
            Wealth Digest is set up for your account, but the daily task hasn't generated
            a digest yet. It usually runs in the early morning (around 6&nbsp;a.m. IST).
            Once it produces the first summary, this page will populate automatically.
        </p>
        <p className={style.notConfiguredBody}>
            If it's been more than a day, check that the WealthDigestTask scheduler is
            running server-side.
        </p>
    </FullEmpty>
);

export const DigestNotConfigured: React.FC = () => (
    <FullEmpty icon="ph-gear-six" title="Wealth Digest isn't set up yet">
        <p className={style.notConfiguredBody}>
            Set the <code>WEALTH_DIGEST_USER_ID</code> environment variable on the server
            to enable daily digests for your account. Once configured, the task runs each
            morning and this page picks up the output automatically.
        </p>
        <p className={style.notConfiguredBody}>
            The pipeline reads that ID at task-run time to know whose summary to build.
        </p>
    </FullEmpty>
);
