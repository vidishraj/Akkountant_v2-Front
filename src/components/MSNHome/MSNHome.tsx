import {useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {ReactSearchAutocomplete} from "react-search-autocomplete";
import MSNList from "./MSNList.tsx";
import MSNDetails from "./MSNDetails.tsx";
import RealizedPnL from "./RealizedPnL.tsx";
import FOSection from "./FOSection.tsx";
import ObjectDetailsDialog from "./ObjectDetailsDialog.tsx";
import InvestmentEmails from "../InvestmentEmails/InvestmentEmails.tsx";
import ConfirmationDialog from "../ConfirmationDialogComponent.tsx";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import {useKite} from "../../contexts/KiteContext.tsx";
import {fetchSecurityScheme} from "../../services/investmentService.ts";
import {getRowDayChangeAmount} from "../../utils/holdings.ts";
import {formatCompact, formatCurrency} from "../WealthDigest/formatters.ts";
import type {MSNListResponse, MSNSummaryResponse} from "../../utils/interfaces.ts";
import style from "./MSNHome.module.scss";

/**
 * FE-4 (ak-gkqp) Investment detail — MSN variants (Stocks / MF / NPS).
 *
 * Replaces the pre-FE-4 MUI composition with a single Nocturne-native page
 * parameterized by asset type, not forked. Routes mapped by the parent
 * `InvestmentDetail.tsx` from `/investments/:asset` → `state.selectedCard.*`.
 *
 * Preserves EVERY authoritative computation from the pre-FE-4 stack:
 * - Hero day change sums BE-authoritative per-row `getRowDayChangeAmount`
 *   (same discipline as ak-7mru CRITICAL fix + ak-ff9r landing). Strict
 *   `dayChangeKnown`: no holdings → false; any null row → false; every row
 *   finite → true. When false, Today renders '—' with the design's
 *   "No day basis yet — unknown, not flat" title (§23 rule #3).
 * - MSNList / MSNDetails / RealizedPnL / FOSection continue to consume
 *   `getRowCurrentValue` / `getRowInvested` / `getRowUnrealizedPnL` /
 *   `getRowDayChangeAmount` / `isDayChangeKnown` directly on rows — never
 *   re-derive from average × qty (would break Overseer's reconcile
 *   invariant; see `utils/holdings.ts` policy chain).
 *
 * MSNSummary.tsx (EPG uses it for FE-5) is NOT touched here; the hero
 * surface is inlined in this file so EPGHome keeps working untouched until
 * FE-5 lands.
 */

const sortByCaseInsensitive = (a: string, b: string) => a.localeCompare(b);

const tabsFor = (asset: "stocks" | "mf" | "nps"): {label: string; key: number}[] => {
    if (asset === "stocks") {
        return [
            {label: "Holdings", key: 0},
            {label: "Equity History", key: 1},
            {label: "F&O History", key: 2},
            {label: "Emails", key: 3},
        ];
    }
    return [
        {label: "Holdings", key: 0},
        {label: "Emails", key: 1},
    ];
};

/**
 * Hero summary aggregation — MSN only (stocks/mf/nps). Reads the active
 * asset's summary + list, derives the day change from per-row helpers.
 */
function deriveMsnHero(
    summary: MSNSummaryResponse | undefined,
    list: MSNListResponse[] | undefined,
): {
    currentValue: number;
    invested: number;
    profit: number;
    profitPct: number;
    dayChange: number;
    dayChangeKnown: boolean;
    count: number;
} {
    const currentValue = Number(summary?.currentValue) || 0;
    const invested = Number(summary?.totalValue) || 0;
    const profit = Number(summary?.changeAmount) || 0;
    const profitPct = invested !== 0 ? (profit / invested) * 100 : 0;
    const count = Number(summary?.count) || 0;

    let dayChange = 0;
    let anyRows = false;
    let anyUnknown = false;
    (list || []).forEach((row) => {
        anyRows = true;
        const amt = getRowDayChangeAmount(row);
        if (amt === null) {
            anyUnknown = true;
            return;
        }
        dayChange += amt;
    });
    const dayChangeKnown = anyRows && !anyUnknown;
    if (!dayChangeKnown) dayChange = 0;

    return {currentValue, invested, profit, profitPct, dayChange, dayChangeKnown, count};
}

const MSNHome = () => {
    const {
        state,
        fetchAndSetUserSecurities,
        fetchAndSetSearchItems,
        deleteComplete,
        getServiceType,
        getContextKey,
        fetchAndSetRealizedPnL,
        fetchAndSetFOSummary,
    } = useMSNContext();
    const {syncHoldings} = useKite();
    const navigate = useNavigate();

    const [searchItems, setSearchItems] = useState<MSNListResponse[]>([]);
    const [detailState, setDetailState] = useState<MSNListResponse | undefined>(undefined);
    const [showDetails, setShowDetails] = useState(false);
    const [objectDialogOpen, setObjectDialogOpen] = useState(false);
    const [schemeData, setSchemeData] = useState<any>({});
    const [deleteConfirmation, setDeleteConfirmation] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    const contextKey = getContextKey();
    const summary = state.summaries[contextKey] as MSNSummaryResponse | undefined;
    const list = state.lists[contextKey] as MSNListResponse[] | undefined;

    // Which MSN asset is active, derived from legacy selectedCard booleans.
    const assetKey: "stocks" | "mf" | "nps" | null = state.selectedCard.stocks
        ? "stocks"
        : state.selectedCard.mf
            ? "mf"
            : state.selectedCard.nps
                ? "nps"
                : null;

    const assetTitle = assetKey === "stocks" ? "Stocks" : assetKey === "mf" ? "Mutual Funds" : "NPS";

    useEffect(() => {
        fetchAndSetUserSecurities();
        fetchAndSetSearchItems()
            .then((response) => setSearchItems(response))
            .catch(() => setSearchItems([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // Stocks-only history fetches.
        if (state.selectedCard.stocks) {
            fetchAndSetRealizedPnL();
            fetchAndSetFOSummary();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.selectedCard.stocks]);

    // Reset tab + details when the asset changes under us.
    useEffect(() => {
        setActiveTab(0);
        setShowDetails(false);
        setDetailState(undefined);
    }, [assetKey]);

    const hero = useMemo(() => deriveMsnHero(summary, list), [summary, list]);

    const handleOnSelect = async (item: any) => {
        try {
            const code = assetKey === "mf" || assetKey === "nps" ? item.code : item.name;
            const res = await fetchSecurityScheme(getServiceType(), code);
            setSchemeData(res.data);
            setObjectDialogOpen(true);
        } catch (e) {
            console.error("Error fetching security scheme:", e);
        }
    };

    const handleRowClick = (code: string) => {
        if (!list) return;
        const row = list.find((r) =>
            assetKey === "nps"
                ? r.info.name === code
                : assetKey === "mf"
                    ? r.info.companyName === code
                    : r.buyCode === code,
        );
        if (row) {
            setDetailState(row);
            setShowDetails(true);
        }
    };

    const handleBack = () => {
        if (showDetails) {
            setShowDetails(false);
            setDetailState(undefined);
        } else {
            setActiveTab(0);
            navigate("/investments");
        }
    };

    const emailCategory = "investment_confirmation";
    const emailServiceTypeFilter =
        assetKey === "stocks" ? "Stocks" : assetKey === "mf" ? "Mutual_Funds" : assetKey === "nps" ? "NPS" : undefined;

    const tabs = tabsFor(assetKey ?? "stocks");

    const renderTabContent = () => {
        if (showDetails && detailState) {
            return <MSNDetails details={detailState}/>;
        }
        if (assetKey === "stocks") {
            if (activeTab === 0) return <MSNList list={list || []} onClick={handleRowClick}/>;
            if (activeTab === 1) return <RealizedPnL/>;
            if (activeTab === 2) return <FOSection/>;
            if (activeTab === 3)
                return <InvestmentEmails category={emailCategory} serviceTypeFilter={emailServiceTypeFilter}/>;
        }
        // MF / NPS — only Holdings + Emails
        if (activeTab === 0) return <MSNList list={list || []} onClick={handleRowClick}/>;
        return <InvestmentEmails category={emailCategory} serviceTypeFilter={emailServiceTypeFilter}/>;
    };

    // Precompute sorted items for search autocomplete (library expects
    // `{id, name}` shape). Keeps the autocomplete alphabetized.
    const sortedSearchItems = useMemo(
        () => [...searchItems].sort((a, b) => sortByCaseInsensitive((a as any).name || "", (b as any).name || "")),
        [searchItems],
    );

    if (!summary || !list || !assetKey) return <div className={style.empty}/>;

    return (
        <div className={style.container}>
            {/* ── Top strip: Back + Title + Search + actions ── */}
            <div className={style.topStrip}>
                <button
                    type="button"
                    onClick={handleBack}
                    className={`btn btn-ghost ${style.backBtn}`}
                    aria-label="Back"
                >
                    <i className="ph ph-arrow-left"/>
                    <span>{showDetails ? "Back" : "Investments"}</span>
                </button>
                <span className={style.topTitle}>{assetTitle}</span>
                <span className={style.spacer}/>
                <div className={style.searchHost}>
                    <ReactSearchAutocomplete
                        styling={{
                            backgroundColor: "var(--color-surface)",
                            color: "#FAFAFA !important",
                            border: "1px solid var(--color-divider)",
                            iconColor: "var(--color-neutral-400)",
                            borderRadius: "var(--radius-md)",
                            lineColor: "var(--color-divider)",
                            hoverBackgroundColor: "var(--color-bg)",
                            zIndex: 50,
                        }}
                        resultStringKeyName="name"
                        items={sortedSearchItems}
                        onSelect={handleOnSelect}
                        placeholder="Search security…"
                    />
                </div>
                {assetKey === "stocks" && (
                    <button
                        type="button"
                        onClick={() => syncHoldings()}
                        className={`btn btn-secondary ${style.actionBtn}`}
                        title="Sync holdings from Kite"
                    >
                        <i className="ph ph-cloud-arrow-down"/>
                        <span>Kite sync</span>
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => setDeleteConfirmation(true)}
                    className={`btn btn-secondary ${style.actionBtn} ${style.actionBtnDanger}`}
                    title="Delete all holdings for this asset"
                    aria-label="Delete all"
                >
                    <i className="ph ph-trash"/>
                </button>
            </div>

            {/* ── Nocturne hero summary ── */}
            <section className={style.hero}>
                <div className={style.heroLeft}>
                    <span className={style.heroKicker}>Total asset value</span>
                    <span className={style.heroValue} title={`₹${formatCurrency(hero.currentValue)}`}>
                        ₹{formatCurrency(hero.currentValue)}
                    </span>
                </div>
                <div className={style.heroMetrics}>
                    <div className={style.heroMetric}>
                        <span className={style.heroMetricLabel}>Invested</span>
                        <span className={style.heroMetricValue}>₹{formatCurrency(hero.invested)}</span>
                    </div>
                    <div className={style.heroMetric}>
                        <span className={style.heroMetricLabel}>Change</span>
                        <span
                            className={style.heroMetricValue}
                            style={{color: hero.profit >= 0 ? "oklch(0.80 0.13 155)" : "oklch(0.74 0.15 25)"}}
                        >
                            {hero.profit >= 0 ? "+" : "−"}₹{formatCurrency(Math.abs(hero.profit))}
                        </span>
                    </div>
                    <div className={style.heroMetric}>
                        <span className={style.heroMetricLabel}>% Change</span>
                        <span
                            className={style.heroMetricValue}
                            style={{color: hero.profitPct >= 0 ? "oklch(0.80 0.13 155)" : "oklch(0.74 0.15 25)"}}
                        >
                            {hero.profitPct >= 0 ? "+" : "−"}{Math.abs(hero.profitPct).toFixed(2)}%
                        </span>
                    </div>
                    <div className={style.heroMetric}>
                        <span className={style.heroMetricLabel}>Today</span>
                        <span
                            className={style.heroMetricValue}
                            style={{color: hero.dayChangeKnown ? (hero.dayChange >= 0 ? "oklch(0.80 0.13 155)" : "oklch(0.74 0.15 25)") : "var(--color-neutral-500)"}}
                            title={hero.dayChangeKnown
                                ? "Day change across holdings with a known day basis"
                                : "No day basis yet — unknown, not flat"}
                        >
                            {hero.dayChangeKnown
                                ? `${hero.dayChange >= 0 ? "+" : "−"}₹${formatCompact(Math.abs(hero.dayChange))}`
                                : "—"}
                        </span>
                    </div>
                    <div className={style.heroMetric}>
                        <span className={style.heroMetricLabel}>Count</span>
                        <span className={style.heroMetricValue}>{hero.count}</span>
                    </div>
                    {assetKey === "stocks" && state.realizedPnl && state.realizedPnl.tradeCount > 0 && (
                        <div className={style.heroMetric}>
                            <span className={style.heroMetricLabel}>Realized P&amp;L</span>
                            <span
                                className={style.heroMetricValue}
                                style={{color: state.realizedPnl.netRealizedPnL >= 0 ? "oklch(0.80 0.13 155)" : "oklch(0.74 0.15 25)"}}
                            >
                                {state.realizedPnl.netRealizedPnL >= 0 ? "+" : "−"}₹{formatCurrency(Math.abs(state.realizedPnl.netRealizedPnL))}
                            </span>
                        </div>
                    )}
                    {assetKey === "stocks" && state.foSummary && state.foSummary.tradeCount > 0 && (
                        <div className={style.heroMetric}>
                            <span className={style.heroMetricLabel}>F&amp;O P&amp;L</span>
                            <span
                                className={style.heroMetricValue}
                                style={{color: state.foSummary.netPnL >= 0 ? "oklch(0.80 0.13 155)" : "oklch(0.74 0.15 25)"}}
                            >
                                {state.foSummary.netPnL >= 0 ? "+" : "−"}₹{formatCurrency(Math.abs(state.foSummary.netPnL))}
                            </span>
                        </div>
                    )}
                </div>
            </section>

            {/* ── Tabs + content ── */}
            {!showDetails && (
                <nav className={style.tabs} role="tablist">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`${style.tab} ${activeTab === t.key ? style.tabActive : ""}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </nav>
            )}

            <div className={style.content}>{renderTabContent()}</div>

            <ObjectDetailsDialog
                open={objectDialogOpen}
                onClose={() => setObjectDialogOpen(false)}
                title={schemeData?.companyName || ""}
                data={schemeData}
            />
            <ConfirmationDialog
                open={deleteConfirmation}
                onCancel={() => setDeleteConfirmation(false)}
                onSubmit={() => {
                    setDeleteConfirmation(false);
                    deleteComplete();
                }}
                message={`Are you sure you want to delete all ${assetTitle} data?`}
            />
        </div>
    );
};

export default MSNHome;
