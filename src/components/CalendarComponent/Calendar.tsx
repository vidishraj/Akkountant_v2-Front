import React from "react";
import dayjs, {Dayjs} from "dayjs";
import {bankName} from "../../utils/bankLabels.ts";
import {fetchCalendarTransactions} from "../../services/transactionService.ts";
import {useFilterContext} from "../../contexts/FilterContext.tsx";
import {useFileFilterContext} from "../../contexts/FileFilterContext.tsx";
import style from "./Calendar.module.scss";

/**
 * ak-f5vf: Transactions rail calendar, native Nocturne grid per the
 * 2026-11-24 design ("Filled days have transactions · click a day to
 * filter"). Replaces the MUI DateCalendar (fixed 320px → clipped in the
 * 290px rail; skeleton rendered as blank circles while loading).
 *
 * Preserved behaviour from the MUI version:
 * - same `/calendarTransactions` request per visible month;
 * - click a transaction day → ledger date range = that day (click again
 *   to clear it);
 * - click a statement day → statements date range = that day;
 * - statement-period coverage per bank (tinted days + day tooltip), with
 *   the bank chips narrowing which banks' coverage is shown;
 * - no navigation past the current month.
 */

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

interface CoveredPeriod {
    bank: string;
    period_start: string;
    period_end: string;
}

export default function DateCalendarWithBadges(): React.JSX.Element {
    const {state, dispatch} = useFilterContext();
    const {dispatch: statementDispatch} = useFileFilterContext();

    const currentMonth = React.useMemo(() => dayjs().startOf("month"), []);
    const [viewMonth, setViewMonth] = React.useState<Dayjs>(currentMonth);
    const [isLoading, setIsLoading] = React.useState(false);
    const [transactionDays, setTransactionDays] = React.useState<Set<number>>(new Set());
    const [statementDays, setStatementDays] = React.useState<Set<number>>(new Set());
    const [coverageMap, setCoverageMap] = React.useState<Record<number, string[]>>({});
    const [selectedBanks, setSelectedBanks] = React.useState<Set<string>>(new Set());

    // Drop responses for a month the user has already navigated away from.
    const reqSeq = React.useRef(0);

    React.useEffect(() => {
        const seq = ++reqSeq.current;
        const monthStart = viewMonth.startOf("month");
        const monthEnd = viewMonth.endOf("month");
        setIsLoading(true);
        fetchCalendarTransactions({
            monthStart: monthStart.format("YYYY-MM-DD"),
            monthEnd: monthEnd.format("YYYY-MM-DD"),
        })
            .then(({transaction_dates = [], statement_dates = [], covered_periods = []}) => {
                if (seq !== reqSeq.current) return;
                setTransactionDays(new Set((transaction_dates as string[]).map((d) => dayjs(d).date())));
                setStatementDays(new Set((statement_dates as string[]).map((d) => dayjs(d).date())));

                const map: Record<number, Set<string>> = {};
                for (const period of covered_periods as CoveredPeriod[]) {
                    const pStart = dayjs(period.period_start);
                    const pEnd = dayjs(period.period_end);
                    let cur = pStart.isBefore(monthStart) ? monthStart : pStart;
                    const end = pEnd.isAfter(monthEnd) ? monthEnd : pEnd;
                    while (cur.isBefore(end, "day") || cur.isSame(end, "day")) {
                        const d = cur.date();
                        (map[d] ??= new Set()).add(period.bank);
                        cur = cur.add(1, "day");
                    }
                }
                const result: Record<number, string[]> = {};
                for (const [d, banks] of Object.entries(map)) result[Number(d)] = Array.from(banks);
                setCoverageMap(result);
            })
            .catch((error) => {
                if (seq !== reqSeq.current) return;
                console.error("Error fetching calendar data:", error);
                setTransactionDays(new Set());
                setStatementDays(new Set());
                setCoverageMap({});
            })
            .finally(() => {
                if (seq === reqSeq.current) setIsLoading(false);
            });
    }, [viewMonth]);

    const visibleBanks = React.useMemo(() => {
        const banks = new Set<string>();
        for (const dayBanks of Object.values(coverageMap)) dayBanks.forEach((b) => banks.add(b));
        return Array.from(banks);
    }, [coverageMap]);

    const toggleBank = (bank: string) => {
        setSelectedBanks((prev) => {
            const next = new Set(prev);
            if (next.has(bank)) next.delete(bank);
            else next.add(bank);
            return next;
        });
    };

    const coverageFor = (d: number): string[] => {
        const banks = coverageMap[d] ?? [];
        return selectedBanks.size === 0 ? banks : banks.filter((b) => selectedBanks.has(b));
    };

    const selectedIso = state.startDate && state.startDate === state.endDate ? state.startDate : null;
    const today = dayjs();

    const handleDayClick = (date: Dayjs) => {
        const iso = date.format("YYYY-MM-DD");
        const d = date.date();
        if (transactionDays.has(d)) {
            const next = selectedIso === iso ? "" : iso;
            dispatch({type: "SET_START_DATE", payload: next});
            dispatch({type: "SET_END_DATE", payload: next});
        }
        if (statementDays.has(d)) {
            statementDispatch({type: "SET_START_DATE", payload: iso});
            statementDispatch({type: "SET_END_DATE", payload: iso});
        }
    };

    const pad = viewMonth.startOf("month").day();
    const daysInMonth = viewMonth.daysInMonth();
    const canGoNext = viewMonth.isBefore(currentMonth, "month");

    return (
        <div className={style.card}>
            <div className={style.head}>
                <span className={style.title}>{viewMonth.format("MMMM YYYY")}</span>
                <span className={style.spacer}/>
                <button
                    type="button"
                    className={`btn btn-icon ${style.navBtn}`}
                    onClick={() => setViewMonth((m) => m.subtract(1, "month"))}
                    aria-label="Previous month"
                >
                    <i className="ph ph-caret-left" aria-hidden="true"/>
                </button>
                <button
                    type="button"
                    className={`btn btn-icon ${style.navBtn}`}
                    onClick={() => canGoNext && setViewMonth((m) => m.add(1, "month"))}
                    disabled={!canGoNext}
                    aria-label="Next month"
                >
                    <i className="ph ph-caret-right" aria-hidden="true"/>
                </button>
            </div>

            <div
                className={`${style.grid} ${isLoading ? style.gridLoading : ""}`}
                aria-busy={isLoading}
            >
                {DOW.map((d, i) => (
                    <span key={`dow-${i}`} className={style.dow} aria-hidden="true">{d}</span>
                ))}
                {Array.from({length: pad}, (_, i) => <span key={`pad-${i}`}/>)}
                {Array.from({length: daysInMonth}, (_, i) => {
                    const n = i + 1;
                    const date = viewMonth.date(n);
                    const iso = date.format("YYYY-MM-DD");
                    const hasTx = transactionDays.has(n);
                    const hasStmt = statementDays.has(n);
                    const covered = coverageFor(n);
                    const titleParts = [
                        hasTx ? "Has transactions" : "",
                        hasStmt ? "Statement received" : "",
                        covered.length ? `Statement coverage: ${covered.map(bankName).join(", ")}` : "",
                    ].filter(Boolean);
                    const cls = [
                        style.day,
                        covered.length && !hasTx ? style.dayCovered : "",
                        hasTx ? style.dayActive : "",
                        hasStmt && !hasTx ? style.dayStatement : "",
                        date.isAfter(today, "day") ? style.dayFuture : "",
                        date.isSame(today, "day") ? style.dayToday : "",
                        selectedIso === iso ? style.daySelected : "",
                    ].filter(Boolean).join(" ");
                    const interactive = hasTx || hasStmt;
                    return (
                        <button
                            key={iso}
                            type="button"
                            className={cls}
                            title={titleParts.join(" · ") || undefined}
                            aria-label={`${date.format("D MMMM YYYY")}${titleParts.length ? ` — ${titleParts.join(", ")}` : ""}`}
                            aria-pressed={hasTx ? selectedIso === iso : undefined}
                            tabIndex={interactive ? 0 : -1}
                            onClick={interactive ? () => handleDayClick(date) : undefined}
                        >
                            {n}
                            {hasStmt && <span className={style.stmtDot} aria-hidden="true"/>}
                        </button>
                    );
                })}
            </div>

            <span className={style.hint}>Filled days have transactions · click a day to filter</span>

            {visibleBanks.length > 0 && (
                <div className={style.legend} role="group" aria-label="Statement coverage by bank">
                    {visibleBanks.map((bank) => {
                        const active = selectedBanks.size === 0 || selectedBanks.has(bank);
                        return (
                            <button
                                key={bank}
                                type="button"
                                className={`${style.legendChip} ${active ? style.legendChipActive : ""}`}
                                aria-pressed={selectedBanks.has(bank)}
                                onClick={() => toggleBank(bank)}
                            >
                                {bankName(bank)}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
