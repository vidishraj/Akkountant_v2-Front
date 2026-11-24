import React, {useEffect, useCallback} from "react";
import {bankName} from "../../utils/bankLabels.ts";
import {debounce} from "lodash";
import {TransactionSource, useFilterContext} from "../../contexts/FilterContext.tsx";
import {getFirstAndLastDateOfMonth, getLast5Months} from "../../utils/util.tsx";
import styles from "./TransactionFilter.module.scss";
import {useUser} from "../../contexts/GlobalContext.tsx";

/**
 * ak-f5vf: ledger filter row per the 2026-11-24 design —
 * search · from "to" to · account · month · source (All / Statements /
 * Emails) · Clear · refresh · [trailing slot, e.g. + Add].
 * Filter semantics are unchanged; "All accounts" / "All months" map to the
 * existing empty values, and source "all" omits the BE source clause.
 */
const SOURCE_OPTS: {value: TransactionSource; label: string; icon: string}[] = [
    {value: "all", label: "All", icon: "ph-stack"},
    {value: "statement", label: "Statements", icon: "ph-file-text"},
    {value: "email", label: "Emails", icon: "ph-envelope-simple"},
];

const SearchFilterCompact = ({apply, isMobile, setDrawerState, trailing}: {
    apply: () => void,
    isMobile: boolean,
    setDrawerState: () => void,
    trailing?: React.ReactNode,
}) => {
    const {state, dispatch} = useFilterContext();
    const {searchTerm, startDate, endDate, bank, month, source} = state;
    const {optedBanks} = useUser();
    const months = getLast5Months();

    // Update fetchData only when relevant state values change (use specific state properties instead of `state` directly)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const fetchData = useCallback(() => apply(), [searchTerm, startDate, endDate, bank, month]);

    // Debounce the fetchData function
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedFetchData = useCallback(debounce(fetchData, 500), [fetchData]);

    // Trigger debounced fetch when the state changes
    useEffect(() => {
        debouncedFetchData();
        return () => debouncedFetchData.cancel(); // Cleanup on unmount or dependency change
    }, [debouncedFetchData]);

    const handleMonthChange = (value: string) => {
        if (!value) {
            dispatch({type: "SET_START_DATE", payload: ""});
            dispatch({type: "SET_END_DATE", payload: ""});
            dispatch({type: "SET_MONTH", payload: ""});
            return;
        }
        const {firstDay, lastDay} = getFirstAndLastDateOfMonth(value);
        dispatch({type: "SET_START_DATE", payload: firstDay});
        dispatch({type: "SET_END_DATE", payload: lastDay});
        dispatch({type: "SET_MONTH", payload: value});
    };

    return (
        <section className={styles.container} aria-label="Ledger filters">
            {isMobile && (
                <button
                    type="button"
                    className={`btn btn-secondary btn-icon ${styles.iconBtn}`}
                    onClick={setDrawerState}
                    aria-label="Open calendar and side panels"
                    title="Calendar & panels"
                >
                    <i className="ph ph-sidebar-simple" aria-hidden="true"/>
                </button>
            )}
            <div className={styles.searchWrap}>
                <i className={`ph ph-magnifying-glass ${styles.searchIcon}`} aria-hidden="true"/>
                <input
                    type="text"
                    placeholder="Filter descriptions"
                    aria-label="Filter descriptions"
                    value={searchTerm}
                    onChange={(e) =>
                        dispatch({type: "SET_SEARCH_TERM", payload: e.target.value})
                    }
                    className={`input ${styles.searchInput}`}
                />
            </div>

            <input
                type="date"
                title="From"
                aria-label="From date"
                value={startDate}
                onChange={(e) =>
                    dispatch({type: "SET_START_DATE", payload: e.target.value})
                }
                className={`input ${styles.dateInput}`}
            />
            <span className={styles.toLabel}>to</span>
            <input
                type="date"
                title="To"
                aria-label="To date"
                value={endDate}
                onChange={(e) =>
                    dispatch({type: "SET_END_DATE", payload: e.target.value})
                }
                className={`input ${styles.dateInput}`}
            />

            <select
                value={bank}
                aria-label="Account"
                onChange={(e) =>
                    dispatch({type: "SET_BANK", payload: e.target.value})
                }
                className={`input ${styles.bankSelect}`}
            >
                <option value="">All accounts</option>
                {optedBanks.map((option) => (
                    <option key={option} value={option}>
                        {bankName(option)}
                    </option>
                ))}
            </select>

            <select
                value={month}
                aria-label="Month"
                onChange={(e) => handleMonthChange(e.target.value)}
                className={`input ${styles.monthSelect}`}
            >
                <option value="">All months</option>
                {months.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>

            <div className={styles.sourceToggle} role="radiogroup" aria-label="Source">
                {SOURCE_OPTS.map((o) => (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={source === o.value}
                        onClick={() => dispatch({type: "SET_SOURCE", payload: o.value})}
                        className={`${styles.sourceBtn} ${source === o.value ? styles.sourceBtnActive : ""}`}
                    >
                        <i className={`ph ${o.icon}`} aria-hidden="true"/>
                        {o.label}
                    </button>
                ))}
            </div>

            <button
                type="button"
                className={`btn btn-ghost ${styles.clearBtn}`}
                onClick={() => dispatch({type: "RESET_FILTERS"})}
            >
                <i className="ph ph-funnel-x" aria-hidden="true"/>
                Clear
            </button>
            <button
                type="button"
                className={`btn btn-secondary btn-icon ${styles.iconBtn}`}
                onClick={apply}
                title="Refresh"
                aria-label="Refresh"
            >
                <i className="ph ph-arrow-clockwise" aria-hidden="true"/>
            </button>
            {trailing}
        </section>
    );

};

export default SearchFilterCompact;
