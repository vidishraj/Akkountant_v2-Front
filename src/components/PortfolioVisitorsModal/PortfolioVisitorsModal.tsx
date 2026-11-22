import React, {useCallback, useEffect, useRef, useState} from 'react';
import useModalA11y from '../../hooks/useModalA11y';
import style from './PortfolioVisitorsModal.module.scss';
import {
    PortfolioVisitor,
    VisitorStats,
    fetchVisitors,
    fetchVisitorStats,
} from '../../services/portfolioVisitorService';

/**
 * ak-pqcv (ak-2n09b) PortfolioVisitorsModal.
 *
 * Two deliverables folded into one commit:
 *
 * ## 1. MUI → Nocturne rewrite
 * Pre-ak-pqcv was 448 LOC of MUI (Dialog/Table/TablePagination/Tabs/Chip/
 * Card + @mui/icons-material + useTheme/useMediaQuery). The `.module.scss`
 * carried heavy `:global{.MuiTableCell-root {...}}` overrides because the
 * theme wasn't Nocturne-skinned. All of that goes away — hand-rolled
 * Nocturne dialog matching ak-cfzj (JobsDialog) / FE-5 (Deposits) / FE-10
 * (Files) — `.backdrop` + `.panel` + useModalA11y + inline Esc, native
 * `<table>`/`<select>`/`<input type="checkbox">`, Phosphor icons.
 *
 * ## 2. §4 PII pass — reveal-on-explicit-action for visitor IPs/geo
 *
 * Visitor IPs can be de-anonymized back to the viewer with modest effort;
 * precise city + ISP + lat/lon tighten that further. Default-show only
 * country-level + aggregate counts; sensitive fields require an explicit
 * user action to surface.
 *
 * Posture breakdown:
 *
 *   SAFE (default-visible)
 *     - Stats cards (unique_visitors / total_visits / live_visits /
 *       countries.length) — aggregates only.
 *     - Daily visits table — date + per-day counts, no visitor PII.
 *     - By-country table — country-level aggregates.
 *     - All-visitors row: visit time + country (flag + name) + browser +
 *       Live/Log chip.
 *
 *   PII (default-hidden; explicit reveal required)
 *     - Top-cities section — city-level aggregates. Hidden behind a
 *       single `Show cities (auto-hides in 5s)` toggle. One-shot reveal.
 *     - Per all-visitors row: IP, city, ISP. Hidden behind a per-row
 *       eye-click that reveals ONLY that row (mirrors FE-10 Files vault
 *       pattern). Auto-hides after 5s via a per-row setTimeout cleaned
 *       up on unmount. Region + lat + lon + referrer + page_url were
 *       already not surfaced in the pre-ak-pqcv UI; kept out of scope.
 *
 * Reveal mechanics (both):
 *   - setTimeout stored in a ref-Map so timers can be cleared on explicit
 *     hide + on unmount. No stale-reveal fires after the modal closes
 *     or the page navigates away.
 *   - Explicit-hide (click again) clears the timer + removes from the
 *     revealed set immediately, so the user can "un-reveal" without
 *     waiting for the timer to expire.
 *
 * Preserved semantics (byte-for-byte)
 *   - State: tab / loading / visitors / stats / page / rowsPerPage /
 *     totalCount — unchanged.
 *   - loadStats / loadVisitors / handleRefresh / formatDate /
 *     formatDateTime / truncateUA — byte-for-byte.
 *   - fetchVisitors + fetchVisitorStats service calls unchanged.
 *   - Pagination 10/25/50 options preserved (hand-rolled rows-per-page
 *     select replaces MUI TablePagination).
 *   - Mobile fullscreen semantics preserved via a FE-local useMediaQuery
 *     hook (same shape as the ak-cfzj hook).
 */

interface PortfolioVisitorsModalProps {
    open: boolean;
    onClose: () => void;
}

const REVEAL_AUTO_HIDE_MS = 5000;
const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

/**
 * ak-pqcv: FE-local useMediaQuery. Matches the pre-ak-pqcv mobile
 * breakpoint (MUI `theme.breakpoints.down('md')` ≈ 900px). Pulls
 * zero MUI deps.
 */
function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mql = window.matchMedia(query);
        const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', onChange);
            setMatches(mql.matches);
            return () => mql.removeEventListener('change', onChange);
        }
        const legacy = mql as unknown as {
            addListener: (cb: (e: MediaQueryListEvent) => void) => void;
            removeListener: (cb: (e: MediaQueryListEvent) => void) => void;
        };
        legacy.addListener(onChange);
        setMatches(mql.matches);
        return () => legacy.removeListener(onChange);
    }, [query]);

    return matches;
}

const PortfolioVisitorsModal: React.FC<PortfolioVisitorsModalProps> = ({open, onClose}) => {
    const fullScreen = useMediaQuery('(max-width:900px)');
    const [tab, setTab] = useState<0 | 1>(0);
    const [loading, setLoading] = useState(false);
    const [visitors, setVisitors] = useState<PortfolioVisitor[]>([]);
    const [stats, setStats] = useState<VisitorStats | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [totalCount, setTotalCount] = useState(0);

    // ak-pqcv §4 reveal state. revealedIds holds per-row ids the user has
    // explicitly asked to surface IP / city / ISP for; revealTimersRef
    // tracks the auto-hide timer for each so unmount + explicit-hide
    // both clear cleanly.
    const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set());
    const revealTimersRef = useRef<Map<number, number>>(new Map());
    // Separate one-shot reveal for the city-aggregate section.
    const [showCities, setShowCities] = useState(false);
    const citiesTimerRef = useRef<number | null>(null);

    // Nocturne modal a11y + inline Esc.
    const panelRef = useRef<HTMLDivElement>(null);
    useModalA11y({
        open,
        panelRef: panelRef as React.RefObject<HTMLElement>,
    });

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const loadStats = async (clearCache = false) => {
        try {
            const data = await fetchVisitorStats(clearCache);
            setStats(data);
        } catch (e) {
            console.error('Failed to fetch visitor stats:', e);
        }
    };

    const loadVisitors = async (clearCache = false) => {
        try {
            setLoading(true);
            const data = await fetchVisitors(page + 1, rowsPerPage, clearCache);
            setVisitors(data.visitors);
            setTotalCount(data.pagination.total);
        } catch (e) {
            console.error('Failed to fetch visitors:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadStats();
            loadVisitors();
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (open && tab === 1) {
            loadVisitors();
        }
    }, [page, rowsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps

    // ak-pqcv §4 reveal timers: clear on unmount to avoid setState after
    // dismount if a timer is still pending.
    useEffect(() => {
        return () => {
            revealTimersRef.current.forEach((t) => window.clearTimeout(t));
            revealTimersRef.current.clear();
            if (citiesTimerRef.current !== null) {
                window.clearTimeout(citiesTimerRef.current);
                citiesTimerRef.current = null;
            }
        };
    }, []);

    // On modal close, drop any reveal state so a re-open starts from the
    // default-hidden posture. Timers cleared to match.
    useEffect(() => {
        if (!open) {
            revealTimersRef.current.forEach((t) => window.clearTimeout(t));
            revealTimersRef.current.clear();
            setRevealedIds(new Set());
            if (citiesTimerRef.current !== null) {
                window.clearTimeout(citiesTimerRef.current);
                citiesTimerRef.current = null;
            }
            setShowCities(false);
        }
    }, [open]);

    const toggleReveal = useCallback((visitorId: number) => {
        setRevealedIds((prev) => {
            const next = new Set(prev);
            if (next.has(visitorId)) {
                next.delete(visitorId);
                const t = revealTimersRef.current.get(visitorId);
                if (t) {
                    window.clearTimeout(t);
                    revealTimersRef.current.delete(visitorId);
                }
            } else {
                next.add(visitorId);
                const timer = window.setTimeout(() => {
                    setRevealedIds((p) => {
                        const n = new Set(p);
                        n.delete(visitorId);
                        return n;
                    });
                    revealTimersRef.current.delete(visitorId);
                }, REVEAL_AUTO_HIDE_MS);
                revealTimersRef.current.set(visitorId, timer);
            }
            return next;
        });
    }, []);

    const toggleCities = useCallback(() => {
        setShowCities((prev) => {
            if (prev) {
                // Explicit hide — clear the pending auto-hide.
                if (citiesTimerRef.current !== null) {
                    window.clearTimeout(citiesTimerRef.current);
                    citiesTimerRef.current = null;
                }
                return false;
            }
            // One-shot reveal — same 5s window.
            if (citiesTimerRef.current !== null) {
                window.clearTimeout(citiesTimerRef.current);
            }
            citiesTimerRef.current = window.setTimeout(() => {
                setShowCities(false);
                citiesTimerRef.current = null;
            }, REVEAL_AUTO_HIDE_MS);
            return true;
        });
    }, []);

    const handleRefresh = () => {
        loadStats(true);
        loadVisitors(true);
    };

    const formatDate = (iso: string) => {
        // Daily stats send date-only strings like "2026-03-25".
        // Split and format directly to avoid timezone shifting.
        const parts = iso.split('-');
        if (parts.length === 3) {
            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            return d.toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'});
        }
        return iso;
    };

    const formatDateTime = (iso: string) => {
        // visited_at is stored as UTC (datetime.utcnow()) but sent without timezone.
        // Append Z so the browser converts UTC to the user's local time.
        const d = iso.includes('T') && !iso.includes('+') && !iso.includes('Z')
            ? new Date(iso + 'Z')
            : new Date(iso);
        return d.toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const truncateUA = (ua: string | null) => {
        if (!ua) return '-';
        // Extract browser name from user agent
        if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
        if (ua.includes('Edg')) return 'Edge';
        if (ua.includes('bot') || ua.includes('Bot')) return 'Bot';
        return ua.substring(0, 30) + '...';
    };

    const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));

    if (!open) return null;

    return (
        <div
            className={style.backdrop}
            onMouseDown={onClose}
            role="presentation"
        >
            <div
                ref={panelRef}
                className={`${style.panel} ${fullScreen ? style.panelFull : ''}`}
                role="dialog"
                aria-modal="true"
                aria-label="Portfolio visitors"
                tabIndex={-1}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className={style.header}>
                    <span className={style.title}>
                        <i className="ph ph-globe" aria-hidden/>
                        <span>Portfolio visitors</span>
                    </span>
                    <div className={style.headerActions}>
                        <button
                            type="button"
                            className={style.iconBtn}
                            onClick={handleRefresh}
                            aria-label="Refresh"
                            title="Refresh"
                        >
                            <i className="ph ph-arrows-clockwise"/>
                        </button>
                        <button
                            type="button"
                            className={style.iconBtn}
                            onClick={onClose}
                            aria-label="Close"
                            title="Close"
                        >
                            <i className="ph ph-x"/>
                        </button>
                    </div>
                </div>

                <div className={style.body}>
                    {/* Stats Cards — all aggregates, §4-safe */}
                    {stats && (
                        <div className={style.statsRow}>
                            <div className={style.statCard}>
                                <i className={`ph ph-users ${style.statIconUsers}`} aria-hidden/>
                                <span className={style.statNumber}>{stats.unique_visitors}</span>
                                <span className={style.statLabel}>Unique Visitors</span>
                            </div>
                            <div className={style.statCard}>
                                <i className={`ph ph-trend-up ${style.statIconTrend}`} aria-hidden/>
                                <span className={style.statNumber}>{stats.total_visits}</span>
                                <span className={style.statLabel}>Total Visits</span>
                            </div>
                            <div className={style.statCard}>
                                <i className={`ph ph-globe ${style.statIconLive}`} aria-hidden/>
                                <span className={style.statNumber}>{stats.live_visits}</span>
                                <span className={style.statLabel}>Live Tracked</span>
                            </div>
                            <div className={style.statCard}>
                                <i className={`ph ph-buildings ${style.statIconCity}`} aria-hidden/>
                                <span className={style.statNumber}>{stats.countries.length}</span>
                                <span className={style.statLabel}>Countries</span>
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className={style.tabBar} role="tablist" aria-label="Visitor views">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={tab === 0}
                            className={`${style.tab} ${tab === 0 ? style.tabActive : ''}`}
                            onClick={() => setTab(0)}
                        >
                            Overview
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={tab === 1}
                            className={`${style.tab} ${tab === 1 ? style.tabActive : ''}`}
                            onClick={() => setTab(1)}
                        >
                            All Visitors
                        </button>
                    </div>

                    {/* Tab 0: Overview */}
                    {tab === 0 && stats && (
                        <div className={style.overviewContainer}>
                            {/* Daily visits — date + counts only, no PII */}
                            <div className={style.section}>
                                <span className={style.sectionTitle}>
                                    Daily Visits (Last 30 Days)
                                </span>
                                <div className={style.innerTable}>
                                    <table className={style.table}>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th className={style.alignRight}>Unique</th>
                                                <th className={style.alignRight}>Total</th>
                                                <th>Bar</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stats.daily.map((d) => {
                                                const maxVisits = Math.max(...stats.daily.map(x => x.total_visits), 1);
                                                const pct = (d.total_visits / maxVisits) * 100;
                                                return (
                                                    <tr key={d.day}>
                                                        <td>{formatDate(d.day)}</td>
                                                        <td className={style.alignRight}>{d.unique_visitors}</td>
                                                        <td className={style.alignRight}>{d.total_visits}</td>
                                                        <td className={style.barCell}>
                                                            <div className={style.barTrack}>
                                                                <div className={style.barFill} style={{width: `${pct}%`}}/>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Side-by-side: Countries (always visible) + Cities (reveal-gated) */}
                            <div className={style.sideBySide}>
                                <div className={style.section}>
                                    <span className={style.sectionTitle}>By Country</span>
                                    <div className={style.innerTable}>
                                        <table className={style.table}>
                                            <thead>
                                                <tr>
                                                    <th>Country</th>
                                                    <th className={style.alignRight}>Visits</th>
                                                    <th className={style.alignRight}>Unique</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {stats.countries.map((c) => (
                                                    <tr key={c.country}>
                                                        <td>
                                                            <span className={style.countryCell}>
                                                                {c.country_code && (
                                                                    <img
                                                                        src={`https://flagcdn.com/16x12/${c.country_code.toLowerCase()}.png`}
                                                                        alt={c.country_code}
                                                                        className={style.flag}
                                                                        onError={(e) => {
                                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                                        }}
                                                                    />
                                                                )}
                                                                <span>{c.country}</span>
                                                            </span>
                                                        </td>
                                                        <td className={style.alignRight}>{c.visits}</td>
                                                        <td className={style.alignRight}>{c.unique_ips}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* §4: cities are sub-country precision — default-hide behind
                                    a one-shot reveal toggle. Same 5s auto-hide as the all-
                                    visitors eye-click. */}
                                <div className={style.section}>
                                    <div className={style.sectionTitleRow}>
                                        <span className={style.sectionTitle}>Top Cities</span>
                                        <button
                                            type="button"
                                            className={style.revealToggle}
                                            onClick={toggleCities}
                                            aria-label={showCities ? 'Hide cities' : 'Reveal cities'}
                                            title={showCities
                                                ? 'Hide (auto-hides in 5s)'
                                                : 'Reveal cities (auto-hides in 5s)'}
                                        >
                                            <i className={`ph ${showCities ? 'ph-eye-slash' : 'ph-eye'}`}/>
                                            <span>{showCities ? 'Hide' : 'Show cities'}</span>
                                        </button>
                                    </div>
                                    <div className={style.innerTable}>
                                        {showCities ? (
                                            <table className={style.table}>
                                                <thead>
                                                    <tr>
                                                        <th>City</th>
                                                        <th>Country</th>
                                                        <th className={style.alignRight}>Visits</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {stats.cities.map((c, i) => (
                                                        <tr key={i}>
                                                            <td>{c.city}</td>
                                                            <td>{c.country}</td>
                                                            <td className={style.alignRight}>{c.visits}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className={style.hiddenNotice}>
                                                <i className="ph ph-lock" aria-hidden/>
                                                <span>
                                                    City-level details are hidden by default (§4 PII).
                                                    Click <strong>Show cities</strong> to reveal.
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 1: All Visitors */}
                    {tab === 1 && (
                        <div className={style.visitorsTableContainer}>
                            <div className={style.piiHint}>
                                <i className="ph ph-info" aria-hidden/>
                                <span>
                                    IP, city, and ISP are hidden by default. Click the eye icon
                                    on a row to reveal them for 5 seconds.
                                </span>
                            </div>
                            <div className={style.tableWrapper}>
                                <table className={style.table}>
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            <th>IP</th>
                                            <th>City</th>
                                            <th>Country</th>
                                            <th>ISP</th>
                                            <th>Browser</th>
                                            <th>Type</th>
                                            <th aria-label="Reveal"/>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr>
                                                <td colSpan={8} className={style.loadingCell}>
                                                    Loading…
                                                </td>
                                            </tr>
                                        ) : visitors.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className={style.loadingCell}>
                                                    No visitors found.
                                                </td>
                                            </tr>
                                        ) : (
                                            visitors.map((v) => {
                                                const revealed = revealedIds.has(v.id);
                                                return (
                                                    <tr key={v.id}>
                                                        <td className={style.noWrap}>
                                                            {formatDateTime(v.visited_at)}
                                                        </td>
                                                        <td className={`${style.mono} ${style.noWrap}`}>
                                                            {revealed ? v.ip : <span className={style.piiMask} aria-label="IP hidden">•••.•••.•••.•••</span>}
                                                        </td>
                                                        <td className={style.noWrap}>
                                                            {revealed ? (v.city || '-') : <span className={style.piiMask}>—</span>}
                                                        </td>
                                                        <td className={style.noWrap}>
                                                            <span className={style.countryCell}>
                                                                {v.country_code && (
                                                                    <img
                                                                        src={`https://flagcdn.com/16x12/${v.country_code.toLowerCase()}.png`}
                                                                        alt={v.country_code}
                                                                        className={style.flag}
                                                                        onError={(e) => {
                                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                                        }}
                                                                    />
                                                                )}
                                                                <span>{v.country || '-'}</span>
                                                            </span>
                                                        </td>
                                                        <td className={`${style.truncateCell}`}>
                                                            {revealed ? (v.isp || '-') : <span className={style.piiMask}>—</span>}
                                                        </td>
                                                        <td>{truncateUA(v.user_agent)}</td>
                                                        <td>
                                                            <span className={`${style.chip} ${v.is_backfill ? style.chipLog : style.chipLive}`}>
                                                                {v.is_backfill ? 'Log' : 'Live'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <button
                                                                type="button"
                                                                className={style.revealRowBtn}
                                                                onClick={() => toggleReveal(v.id)}
                                                                aria-label={revealed ? 'Hide visitor PII' : 'Reveal visitor PII'}
                                                                title={revealed
                                                                    ? 'Hide IP/city/ISP'
                                                                    : 'Reveal IP + city + ISP (auto-hides in 5s)'}
                                                            >
                                                                <i className={`ph ${revealed ? 'ph-eye-slash' : 'ph-eye'}`}/>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* ak-pqcv: hand-rolled pager replacing MUI TablePagination.
                                Same 10 / 25 / 50 options + 0-indexed page state. */}
                            <div className={style.pager}>
                                <label className={style.pagerSelectLabel}>
                                    <span>Rows per page:</span>
                                    <select
                                        className={style.pagerSelect}
                                        value={rowsPerPage}
                                        onChange={(e) => {
                                            setRowsPerPage(parseInt(e.target.value, 10));
                                            setPage(0);
                                        }}
                                    >
                                        {ROWS_PER_PAGE_OPTIONS.map((n) => (
                                            <option key={n} value={n}>
                                                {n}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <span className={style.pagerStatus}>
                                    {totalCount === 0
                                        ? '0 visitors'
                                        : `Page ${page + 1} of ${totalPages} · ${totalCount} total`}
                                </span>
                                <button
                                    type="button"
                                    className={style.pagerBtn}
                                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                                    disabled={page <= 0 || loading}
                                    aria-label="Previous page"
                                >
                                    <i className="ph ph-caret-left"/>
                                </button>
                                <button
                                    type="button"
                                    className={style.pagerBtn}
                                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1 || loading}
                                    aria-label="Next page"
                                >
                                    <i className="ph ph-caret-right"/>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PortfolioVisitorsModal;
