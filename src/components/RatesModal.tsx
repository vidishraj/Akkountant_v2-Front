import React, {useEffect} from "react";
import {formatCurrency} from "./WealthDigest/formatters.ts";
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
 */
const ResponsiveDataModal: React.FC<ModalProps> = ({open, onClose, title, data}) => {
    const isObjectData = data && typeof data === "object" && !Array.isArray(data);
    const isGold = title.toLowerCase() === "gold";

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
                className={style.panel}
                role="dialog"
                aria-modal="true"
                aria-label={`${title.toUpperCase()} rates`}
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
                            ? Object.entries(data as Record<string, unknown>).map(([key, value], index) => (
                                  <div key={index} className={style.tableRow}>
                                      <span>{key}</span>
                                      <span className={`${style.alignRight} ${style.rowAccent}`}>
                                          ₹{value != null ? formatCurrency(Number(value)) : "0.00"}
                                      </span>
                                  </div>
                              ))
                            : Array.isArray(data)
                                ? data.map((item: {"Interest Rate": number; Year: string}, index: number) => (
                                      <div key={index} className={style.tableRow}>
                                          <span>{item.Year}</span>
                                          <span className={`${style.alignRight} ${style.rowAccent}`}>
                                              {Number(item["Interest Rate"]).toFixed(2)}%
                                          </span>
                                      </div>
                                  ))
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
