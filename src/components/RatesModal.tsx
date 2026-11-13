import React, {useEffect, useRef} from "react";
import {formatCurrency} from "./WealthDigest/formatters.ts";
import useModalA11y from "../hooks/useModalA11y.ts";
import style from "./RatesModal.module.scss";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    data: any;
}

/**
 * FE-5 (ak-20zo) Nocturne-native rates history dialog.
 *
 * Accepts two BE shapes:
 * - Object (key→value map): Gold's per-carat price map
 * - Array of {Year, "Interest Rate"}: EPF/PPF per-year rate history
 *
 * Prop shape (`{open, onClose, title, data}`) preserved so the legacy
 * MSNSummary.tsx importer keeps TS-compiling until it's formally retired
 * in the post-chain P3 orphan-cleanup bead.
 *
 * a11y: ak-cqfn applies FE-7's shared useModalA11y hook here (focus-
 * on-open, focus-restore, tab-trap). Esc-to-close stays inline — see
 * hook docstring for the deliberate "no-Esc" contract.
 *
 * ak-cqfn also folds in the two defensive numeric guards the FE-5
 * reviewer flagged: a non-finite rate renders "—" rather than "NaN%"
 * (or "NaN" in the Gold object branch). Controlled BE data, low
 * concern, but the guard is free.
 */
const ResponsiveDataModal: React.FC<ModalProps> = ({open, onClose, title, data}) => {
    const isObjectData = data && typeof data === "object" && !Array.isArray(data);
    const isGold = title.toLowerCase() === "gold";

    const panelRef = useRef<HTMLDivElement>(null);
    useModalA11y({open, panelRef: panelRef as React.RefObject<HTMLElement>});

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className={style.backdrop} onMouseDown={onClose} role="presentation">
            <div
                ref={panelRef}
                className={style.panel}
                role="dialog"
                aria-modal="true"
                aria-label={`${title.toUpperCase()} rates`}
                tabIndex={-1}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className={style.header}>
                    <span className={style.title}>{title.toUpperCase()} Rates</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className={`btn btn-icon ${style.closeBtn}`}
                        aria-label="Close"
                    >
                        <i className="ph ph-x"/>
                    </button>
                </div>

                <div className={style.body}>
                    <div className={style.table}>
                        <div className={style.tableHead}>
                            <span>{isGold ? "Carat" : "Period"}</span>
                            <span className={style.alignRight}>
                                {isGold ? "Price (per 10g)" : "Interest Rate"}
                            </span>
                        </div>
                        {isObjectData
                            ? Object.entries(data as Record<string, unknown>).map(([key, value], index) => {
                                  // ak-cqfn defensive: a non-finite Gold price row
                                  // renders "—" instead of "NaN" (controlled BE data,
                                  // belt-and-braces guard).
                                  const n = Number(value);
                                  const priceCell = value != null && Number.isFinite(n)
                                      ? `₹${formatCurrency(n)}`
                                      : "—";
                                  return (
                                      <div key={index} className={style.tableRow}>
                                          <span>{key}</span>
                                          <span className={`${style.alignRight} ${style.rowAccent}`}>
                                              {priceCell}
                                          </span>
                                      </div>
                                  );
                              })
                            : Array.isArray(data)
                                ? data.map((item: {"Interest Rate": number; Year: string}, index: number) => {
                                      // ak-cqfn defensive: a row missing Interest Rate
                                      // renders "—" instead of "NaN%".
                                      const rate = Number(item["Interest Rate"]);
                                      const rateCell = Number.isFinite(rate)
                                          ? `${rate.toFixed(2)}%`
                                          : "—";
                                      return (
                                          <div key={index} className={style.tableRow}>
                                              <span>{item.Year}</span>
                                              <span className={`${style.alignRight} ${style.rowAccent}`}>
                                                  {rateCell}
                                              </span>
                                          </div>
                                      );
                                  })
                                : null}
                    </div>
                </div>

                <div className={style.footer}>
                    <button
                        type="button"
                        onClick={onClose}
                        className={`btn btn-primary ${style.closeAction}`}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ResponsiveDataModal;
