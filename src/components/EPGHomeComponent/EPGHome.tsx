import {useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import ConfirmationDialog from "../ConfirmationDialogComponent.tsx";
import InvestmentEmails from "../InvestmentEmails/InvestmentEmails.tsx";
import DepositModal from "../DepositsComponent.tsx";
import RatesModal from "../RatesModal.tsx";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import {fetchRates} from "../../services/investmentService.ts";
import {useMessage} from "../../contexts/MessageContext.tsx";
import {formatCurrency} from "../WealthDigest/formatters.ts";
import {formatDateString} from "../../utils/util.tsx";
import type {EPGResponse} from "../../utils/interfaces.ts";
import style from "./EPGHome.module.scss";

/**
 * FE-5 (ak-20zo) Investment detail — EPG variants (EPF / PPF / Gold).
 *
 * Replaces the pre-FE-5 EPGHome stack with a Nocturne-native page
 * parameterized by asset type, not forked. Routes mapped by
 * `InvestmentDetail.tsx` from `/investments/:asset` → `state.selectedCard.*`.
 *
 * Hero + metrics inlined — the legacy `MSNSummary.tsx` is NO LONGER
 * imported here (per FE-5 bead instruction). With MSNHome also stopping
 * its MSNSummary consumption in FE-4, MSNSummary has no remaining
 * importers after this bead merges and can be formally retired in the
 * post-chain P3 orphan-cleanup bead.
 *
 * §23 rule #3 — day_change_known gate: EPG assets have no intraday day
 * change by definition (contributions/accrual, not market-priced ticks),
 * so this page explicitly OMITS the Today line from the hero. Matches
 * FE-4's `deriveMsnHero` EPG-exclusion decision.
 *
 * Cross-cutting:
 * - §2 accounting correctness: hero sums BE-emitted `net`/`netProfit`/
 *   `unAccountedProfit` fields directly. CAGR is a FE-local derivation
 *   from `(1 + total_return) ^ (1/years) - 1` using deposits[0].date as
 *   the anchor — mirrors the pre-FE-5 math byte-for-byte.
 * - §6 INR formatting: shared `formatCurrency` + tabular-nums.
 * - §4 PII containment: no raw receipt / email bodies here.
 * - Delete-all affordance: pre-FE-5 wired the ConfirmationDialog but had
 *   NO trigger button (brief 01 pain point). This bead adds the trash
 *   button to the top strip, same shape as FE-4's MSNHome.
 */

const CLR_GAIN = "oklch(0.80 0.13 155)";
const CLR_LOSS = "oklch(0.74 0.15 25)";

type AssetKey = "epf" | "ppf" | "gold";

interface EpgListRow {
    date: string;
    description?: string;
    amount: number;
    interest: number;
    quantity?: number;
    goldType?: string;
}

const ASSET_LABELS: Record<AssetKey, string> = {
    epf: "EPF",
    ppf: "PPF",
    gold: "Gold",
};

function getAccountAge(deposits: {date: string}[]): string {
    if (!deposits || deposits.length === 0) return "—";
    const firstDate = new Date(deposits[0].date);
    if (Number.isNaN(firstDate.getTime())) return "—";
    const now = new Date();
    const diffMs = now.getTime() - firstDate.getTime();
    const totalMonths = Math.floor(diffMs / (30.44 * 24 * 60 * 60 * 1000));
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    return years > 0 ? `${years}y ${months}m` : `${months}m`;
}

/**
 * Hero derivation — mirrors the pre-FE-5 MSNSummary EPG branches
 * byte-for-byte so numbers stay stable under reviewer scrutiny.
 *
 * - EPF  : net=net; invested=net-netProfit; current=net; CAGR on account age.
 * - Gold : net=net; invested=net-netProfit; current=net; non-annualized % if age<1yr,
 *          CAGR otherwise (same as pre-FE-5).
 * - PPF  : net=net; invested=net-(netProfit-unaccounted); current=net+unaccounted;
 *          CAGR on account age using `current`.
 */
function deriveHero(
    assetKey: AssetKey,
    summary: EPGResponse | undefined,
): {
    currentValue: number;
    invested: number;
    profit: number;
    changePercent: number;
    hasData: boolean;
} {
    if (!summary) return {currentValue: 0, invested: 0, profit: 0, changePercent: 0, hasData: false};
    const net = Number(summary.net) || 0;
    const netProfit = Number(summary.netProfit) || 0;
    const deposits = summary.deposits || [];

    if (assetKey === "epf") {
        const invested = net - netProfit;
        const currentValue = net;
        let changePercent = 0;
        if (invested > 0 && deposits.length > 0) {
            const firstDate = new Date(deposits[0].date);
            const years = (Date.now() - firstDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
            if (years >= 1) {
                changePercent = (Math.pow(currentValue / invested, 1 / years) - 1) * 100;
            } else if (years > 0) {
                changePercent = (netProfit / invested) * 100;
            }
        }
        return {currentValue, invested, profit: netProfit, changePercent, hasData: net !== 0};
    }

    if (assetKey === "gold") {
        const invested = net - netProfit;
        const currentValue = net;
        const changePercent = invested !== 0 ? (netProfit / invested) * 100 : 0;
        return {currentValue, invested, profit: netProfit, changePercent, hasData: net !== 0};
    }

    // PPF
    const unaccounted = Number(summary.unAccountedProfit || 0);
    const invested = net - (netProfit - unaccounted);
    const currentValue = net + unaccounted;
    let changePercent = 0;
    if (invested > 0 && deposits.length > 0) {
        const firstDate = new Date(deposits[0].date);
        const years = (Date.now() - firstDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (years >= 1) {
            changePercent = (Math.pow(currentValue / invested, 1 / years) - 1) * 100;
        } else if (years > 0) {
            changePercent = (netProfit / invested) * 100;
        }
    }
    return {currentValue, invested, profit: netProfit, changePercent, hasData: net !== 0};
}

const EPGHome = () => {
    const {state, fetchAndSetUserSecurities, deleteComplete, getServiceType} = useMSNContext();
    const navigate = useNavigate();
    const {setPayload} = useMessage();

    const [depositsOpen, setDepositsOpen] = useState(false);
    const [ratesOpen, setRatesOpen] = useState(false);
    const [ratesData, setRatesData] = useState<any[]>([]);
    const [deleteConfirmation, setDeleteConfirmation] = useState(false);
    const [epgTab, setEpgTab] = useState(0);

    const assetKey: AssetKey = state.selectedCard.ppf
        ? "ppf"
        : state.selectedCard.epf
            ? "epf"
            : "gold";
    const isPPF = assetKey === "ppf";
    const isEPF = assetKey === "epf";
    const isGold = assetKey === "gold";
    const label = ASSET_LABELS[assetKey];

    const summary = state.summaries[assetKey] as EPGResponse | undefined;

    const listState: EpgListRow[] = useMemo(() => {
        const transactions = summary?.transactions || [];
        return transactions.map((item: any) => ({
            date: item.date,
            amount: item.amount,
            interest: item.interest,
            description: isEPF || isGold ? item.description : undefined,
            quantity: isGold ? item.quant : undefined,
            goldType: isGold ? item.goldType : undefined,
        }));
    }, [summary, isEPF, isGold]);

    const hero = useMemo(() => deriveHero(assetKey, summary), [assetKey, summary]);

    useEffect(() => {
        fetchAndSetUserSecurities();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reset tab when switching between EPG assets.
    useEffect(() => {
        setEpgTab(0);
    }, [assetKey]);

    const metrics = useMemo(() => {
        if (!summary) return null;
        const netProfit = Number(summary.netProfit) || 0;
        const deposits = summary.deposits || [];
        const transactions = summary.transactions || [];

        if (isPPF || isEPF) {
            const unaccounted = Number(summary.unAccountedProfit) || 0;
            return {
                type: "interest" as const,
                depositCount: deposits.length,
                accountAge: getAccountAge(deposits),
                pendingInterest: unaccounted,
                totalInterest: netProfit,
            };
        }
        // Gold
        const totalWeight = transactions.reduce(
            (sum, t: any) => sum + Number(t.quant || 0),
            0,
        );
        const typeCounts: Record<string, number> = {};
        transactions.forEach((t: any) => {
            const key = `${t.goldType || "?"}K`;
            typeCounts[key] = (typeCounts[key] || 0) + 1;
        });
        return {
            type: "gold" as const,
            purchaseCount: deposits.length,
            totalWeight,
            typeCounts,
        };
    }, [summary, isEPF, isPPF]);

    const handleBack = () => navigate("/investments");

    const handleDeleteAll = () => {
        setDeleteConfirmation(false);
        deleteComplete();
    };

    const openRates = () => {
        fetchRates(getServiceType())
            .then((response) => {
                setRatesData(response.data.data);
                setRatesOpen(true);
            })
            .catch(() => {
                setPayload({
                    type: "error",
                    message: "Error while fetching rates. Please try later",
                });
            });
    };

    const emailCategory =
        isEPF ? "epf_passbook" : isGold ? "gold_receipt" : "investment_confirmation";

    if (!summary) return <div className={style.empty}/>;

    return (
        <div className={style.container}>
            {/* ── Top strip ── */}
            <div className={style.topStrip}>
                <button
                    type="button"
                    onClick={handleBack}
                    className={`btn btn-ghost ${style.backBtn}`}
                    aria-label="Back"
                >
                    <i className="ph ph-arrow-left"/>
                    <span>Investments</span>
                </button>
                <span className={style.topTitle}>{label}</span>
                <span className={style.spacer}/>
                {isPPF && (
                    <button
                        type="button"
                        onClick={() => setDepositsOpen(true)}
                        className={`btn btn-secondary ${style.actionBtn}`}
                    >
                        <i className="ph ph-list-bullets"/>
                        <span>Deposits</span>
                    </button>
                )}
                <button
                    type="button"
                    onClick={openRates}
                    className={`btn btn-secondary ${style.actionBtn}`}
                >
                    <i className="ph ph-percent"/>
                    <span>Rates</span>
                </button>
                {/* FE-5 fix: pre-FE-5 had the ConfirmationDialog wired but no
                    visible trigger — the delete-all affordance was dead.
                    Adding the trash button here (same pattern as FE-4's
                    MSNHome header) closes that gap. */}
                <button
                    type="button"
                    onClick={() => setDeleteConfirmation(true)}
                    className={`btn btn-secondary ${style.actionBtn} ${style.actionBtnDanger}`}
                    title={`Delete all ${label} data`}
                    aria-label={`Delete all ${label} data`}
                >
                    <i className="ph ph-trash"/>
                </button>
            </div>

            {/* ── Nocturne hero (NO MSNSummary import) ── */}
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
                            style={{color: hero.profit >= 0 ? CLR_GAIN : CLR_LOSS}}
                        >
                            {hero.profit >= 0 ? "+" : "−"}₹{formatCurrency(Math.abs(hero.profit))}
                        </span>
                    </div>
                    <div className={style.heroMetric}>
                        <span className={style.heroMetricLabel}>
                            {isPPF || isEPF ? "CAGR" : "% Change"}
                        </span>
                        <span
                            className={style.heroMetricValue}
                            style={{color: hero.changePercent >= 0 ? CLR_GAIN : CLR_LOSS}}
                        >
                            {hero.changePercent >= 0 ? "+" : "−"}{Math.abs(hero.changePercent).toFixed(2)}%
                        </span>
                    </div>
                    {/* §23 rule #3: EPG has no intraday day change — Today line
                        is OMITTED by design rather than rendered as '—', which
                        matches the hero's semantics of "EPG never has a day
                        basis to begin with" (distinct from MSN's "unknown"). */}
                </div>
            </section>

            {/* ── Metrics grid (EPF/PPF 'interest' variant · Gold 'purity' variant) ── */}
            {metrics?.type === "interest" && (
                <section className={style.metricsGrid}>
                    <div className={style.metricsCell}>
                        <span className={style.metricsLabel}>Deposits</span>
                        <span className={style.metricsValue}>{metrics.depositCount}</span>
                    </div>
                    <div className={style.metricsCell}>
                        <span className={style.metricsLabel}>Account Age</span>
                        <span className={style.metricsValue}>{metrics.accountAge}</span>
                    </div>
                    <div className={style.metricsCell}>
                        <span className={style.metricsLabel}>Pending Interest</span>
                        <span
                            className={style.metricsValue}
                            style={{color: metrics.pendingInterest >= 0 ? CLR_GAIN : CLR_LOSS}}
                        >
                            ₹{formatCurrency(metrics.pendingInterest)}
                        </span>
                    </div>
                    <div className={style.metricsCell}>
                        <span className={style.metricsLabel}>Total Interest</span>
                        <span
                            className={style.metricsValue}
                            style={{color: metrics.totalInterest >= 0 ? CLR_GAIN : CLR_LOSS}}
                        >
                            ₹{formatCurrency(metrics.totalInterest)}
                        </span>
                    </div>
                </section>
            )}
            {metrics?.type === "gold" && (
                <section className={style.metricsGrid}>
                    <div className={style.metricsCell}>
                        <span className={style.metricsLabel}>Purchases</span>
                        <span className={style.metricsValue}>{metrics.purchaseCount}</span>
                    </div>
                    <div className={style.metricsCell}>
                        <span className={style.metricsLabel}>Total Weight</span>
                        <span className={style.metricsValue}>{metrics.totalWeight.toFixed(2)}g</span>
                    </div>
                    {Object.entries(metrics.typeCounts).map(([type, count]) => (
                        <div className={style.metricsCell} key={type}>
                            <span className={style.metricsLabel}>{type} Gold</span>
                            <span className={style.metricsValue}>{count}</span>
                        </div>
                    ))}
                </section>
            )}

            {/* ── Tabs ── */}
            <nav className={style.tabs} role="tablist">
                {["Deposits", "Emails"].map((t, idx) => (
                    <button
                        key={t}
                        type="button"
                        role="tab"
                        aria-selected={epgTab === idx}
                        onClick={() => setEpgTab(idx)}
                        className={`${style.tab} ${epgTab === idx ? style.tabActive : ""}`}
                    >
                        {t}
                    </button>
                ))}
            </nav>

            <div className={style.content}>
                {epgTab === 0 ? (
                    listState.length === 0 ? (
                        <div className={style.emptyPanel}>
                            <span className={style.emptyPrimary}>No data!</span>
                            <span className={style.emptySub}>Upload statement or add instrument.</span>
                        </div>
                    ) : (
                        <div className={style.table}>
                            <div
                                className={style.tableHead}
                                style={{
                                    gridTemplateColumns: isPPF
                                        ? "1.2fr 1fr 1fr"
                                        : isGold
                                            ? "1fr 1.4fr 1fr 1fr 0.8fr 0.8fr"
                                            : "1fr 1.4fr 1fr 1fr",
                                }}
                            >
                                <span>Date</span>
                                {!isPPF && <span>Description</span>}
                                <span>Amount</span>
                                <span>Profit</span>
                                {isGold && <span>Qty</span>}
                                {isGold && <span>Type</span>}
                            </div>
                            {listState.map((item, index) => {
                                const profit = Number(item.interest);
                                return (
                                    <div
                                        key={index}
                                        className={style.tableRow}
                                        style={{
                                            gridTemplateColumns: isPPF
                                                ? "1.2fr 1fr 1fr"
                                                : isGold
                                                    ? "1fr 1.4fr 1fr 1fr 0.8fr 0.8fr"
                                                    : "1fr 1.4fr 1fr 1fr",
                                        }}
                                    >
                                        <span>{formatDateString(item.date)}</span>
                                        {!isPPF && <span className={style.tableMuted}>{item.description || "—"}</span>}
                                        <span>₹{formatCurrency(item.amount)}</span>
                                        <span style={{color: profit >= 0 ? CLR_GAIN : CLR_LOSS}}>
                                            {profit >= 0 ? "+" : "−"}₹{formatCurrency(Math.abs(profit))}
                                        </span>
                                        {isGold && <span>{item.quantity}g</span>}
                                        {isGold && <span>{item.goldType}K</span>}
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : (
                    <InvestmentEmails category={emailCategory}/>
                )}
            </div>

            <DepositModal
                open={depositsOpen}
                onClose={() => setDepositsOpen(false)}
                data={summary?.deposits || []}
                title={assetKey}
            />
            <RatesModal
                open={ratesOpen}
                onClose={() => setRatesOpen(false)}
                data={ratesData}
                title={assetKey}
            />
            <ConfirmationDialog
                open={deleteConfirmation}
                onCancel={() => setDeleteConfirmation(false)}
                onSubmit={handleDeleteAll}
                message={`Are you sure you want to delete all ${label} data?`}
            />
        </div>
    );
};

export default EPGHome;
