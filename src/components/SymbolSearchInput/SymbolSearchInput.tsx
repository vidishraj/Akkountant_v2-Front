import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {searchKiteInstruments} from "../../services/watchlistService.ts";
import type {KiteInstrumentSearchResult} from "../../utils/interfaces.ts";
import style from "./SymbolSearchInput.module.scss";

/**
 * ak-i0zq / ak-v55t (BE): reusable symbol picker.
 *
 * Debounced autocomplete over /kite/instruments/search. First consumer
 * is the Watchlist add-bar; future alert-creation + order-ticket beads
 * reuse this component directly — any divergence should be captured by
 * props, never forked.
 *
 * Interaction model:
 *   - Type → 300ms debounce → fetch top `limit` matches.
 *   - Dropdown shows one row per result (tradingsymbol · exchange · name).
 *   - Arrow Up / Down navigates; Enter picks; Esc closes dropdown.
 *   - Click outside closes; focus still on the input.
 *   - Picking a row invokes `onSelect(result)`, clears the input, closes.
 *
 * Exchange chip: optional filter — null is "all exchanges" (BE's default).
 *   Common values: NSE / BSE / NFO / MCX / CDS.
 *
 * §23: #1 preserved (new reusable surface), #2 CONSUME (BE emits the
 *   search shape unchanged), #6 preserved (plain-text symbols, no
 *   locale concern).
 */

export interface SymbolSearchInputProps {
    onSelect: (result: KiteInstrumentSearchResult) => void;
    placeholder?: string;
    limit?: number;                      // default 20; clamp 1-100 BE-side
    autoFocus?: boolean;
    disabled?: boolean;
    exchanges?: Array<string | null>;    // chip options; first is initial
    initialExchange?: string | null;     // overrides exchanges[0] when present
    // When present, show these busy / error hints without flipping dropdown state.
    externalStatus?: string | null;
}

const DEFAULT_EXCHANGES: Array<string | null> = [null, "NSE", "BSE", "NFO", "MCX", "CDS"];
const DEBOUNCE_MS = 300;

const SymbolSearchInput = ({
    onSelect,
    placeholder = "Search symbol or company…",
    limit = 20,
    autoFocus = false,
    disabled = false,
    exchanges = DEFAULT_EXCHANGES,
    initialExchange,
    externalStatus,
}: SymbolSearchInputProps) => {
    const [q, setQ] = useState("");
    const [exchange, setExchange] = useState<string | null>(
        initialExchange !== undefined ? initialExchange : (exchanges[0] ?? null),
    );
    const [results, setResults] = useState<KiteInstrumentSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [errored, setErrored] = useState(false);
    const [open, setOpen] = useState(false);
    const [activeIdx, setActiveIdx] = useState(0);

    const inputRef = useRef<HTMLInputElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const debounceRef = useRef<number | null>(null);
    const requestSeqRef = useRef(0);

    // Debounced fetch. `requestSeqRef` guards against out-of-order
    // responses (slow network → fast re-type → stale dropdown).
    useEffect(() => {
        const trimmed = q.trim();
        if (debounceRef.current !== null) {
            window.clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        if (trimmed.length === 0) {
            setResults([]);
            setLoading(false);
            setErrored(false);
            return;
        }
        setLoading(true);
        setErrored(false);
        const seq = ++requestSeqRef.current;
        debounceRef.current = window.setTimeout(() => {
            searchKiteInstruments(trimmed, exchange ?? undefined, limit)
                .then((res) => {
                    if (seq !== requestSeqRef.current) return;  // stale
                    setResults(Array.isArray(res?.results) ? res.results : []);
                    setActiveIdx(0);
                    setOpen(true);
                })
                .catch(() => {
                    if (seq !== requestSeqRef.current) return;
                    setErrored(true);
                    setResults([]);
                })
                .finally(() => {
                    if (seq === requestSeqRef.current) setLoading(false);
                });
        }, DEBOUNCE_MS);
        return () => {
            if (debounceRef.current !== null) {
                window.clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
        };
    }, [q, exchange, limit]);

    // Click-outside closes the dropdown. Focus stays on the input via
    // the no-ops on re-entry — we never steal focus elsewhere.
    useEffect(() => {
        const onDocMouseDown = (ev: MouseEvent) => {
            if (!containerRef.current) return;
            if (!containerRef.current.contains(ev.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDocMouseDown);
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, []);

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    const handlePick = useCallback(
        (r: KiteInstrumentSearchResult) => {
            onSelect(r);
            setQ("");
            setResults([]);
            setOpen(false);
            setActiveIdx(0);
            // Return focus to input for consecutive adds.
            inputRef.current?.focus();
        },
        [onSelect],
    );

    const handleKeyDown = useCallback(
        (ev: React.KeyboardEvent<HTMLInputElement>) => {
            if (!open || results.length === 0) {
                if (ev.key === "ArrowDown" && results.length > 0) {
                    setOpen(true);
                    ev.preventDefault();
                }
                return;
            }
            if (ev.key === "ArrowDown") {
                ev.preventDefault();
                setActiveIdx((i) => (i + 1) % results.length);
            } else if (ev.key === "ArrowUp") {
                ev.preventDefault();
                setActiveIdx((i) => (i - 1 + results.length) % results.length);
            } else if (ev.key === "Enter") {
                ev.preventDefault();
                const r = results[activeIdx];
                if (r) handlePick(r);
            } else if (ev.key === "Escape") {
                ev.preventDefault();
                setOpen(false);
            }
        },
        [open, results, activeIdx, handlePick],
    );

    // Exchange-chip rendering — null label is "All", non-null is the raw
    // Kite exchange code.
    const chips = useMemo(
        () =>
            exchanges.map((ex) => ({
                value: ex,
                label: ex === null ? "All" : ex,
                key: ex === null ? "__all__" : ex,
            })),
        [exchanges],
    );

    const showStatusRow = externalStatus || loading || errored;

    return (
        <div ref={containerRef} className={style.wrap}>
            <div className={style.inputRow}>
                <i className={`ph ph-magnifying-glass ${style.icon}`} aria-hidden="true"/>
                <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-expanded={open && results.length > 0}
                    aria-autocomplete="list"
                    aria-controls="symbol-search-listbox"
                    className={style.input}
                    placeholder={placeholder}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (results.length > 0) setOpen(true);
                    }}
                    disabled={disabled}
                />
                {q && (
                    <button
                        type="button"
                        className={style.clearBtn}
                        aria-label="Clear search"
                        onClick={() => {
                            setQ("");
                            setResults([]);
                            setOpen(false);
                            inputRef.current?.focus();
                        }}
                    >
                        <i className="ph ph-x" aria-hidden="true"/>
                    </button>
                )}
            </div>
            {chips.length > 1 && (
                <div className={style.chipRow} role="radiogroup" aria-label="Exchange filter">
                    {chips.map((c) => (
                        <button
                            key={c.key}
                            type="button"
                            role="radio"
                            aria-checked={exchange === c.value}
                            className={`${style.chip} ${exchange === c.value ? style.chipActive : ""}`}
                            onClick={() => setExchange(c.value)}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            )}
            {showStatusRow && (
                <div className={style.statusRow}>
                    {externalStatus
                        ? externalStatus
                        : loading
                        ? "Searching…"
                        : errored
                        ? "Could not reach the instruments cache. Try again."
                        : null}
                </div>
            )}
            {open && results.length > 0 && (
                <ul
                    id="symbol-search-listbox"
                    role="listbox"
                    className={style.dropdown}
                >
                    {results.map((r, i) => {
                        const key = `${r.instrument_token}-${i}`;
                        const active = i === activeIdx;
                        const subtitle =
                            [r.name, r.segment, r.instrument_type]
                                .filter(Boolean)
                                .join(" · ") || "—";
                        return (
                            <li
                                key={key}
                                role="option"
                                aria-selected={active}
                                onMouseEnter={() => setActiveIdx(i)}
                                onMouseDown={(ev) => {
                                    // mousedown so we pick BEFORE blur closes the list.
                                    ev.preventDefault();
                                    handlePick(r);
                                }}
                                className={`${style.option} ${active ? style.optionActive : ""}`}
                            >
                                <div className={style.optionTop}>
                                    <span className={style.optionSymbol}>{r.tradingsymbol}</span>
                                    <span className={style.optionExchange}>{r.exchange ?? "—"}</span>
                                </div>
                                <div className={style.optionSubtitle}>{subtitle}</div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default SymbolSearchInput;
