import React, {useEffect} from "react";
import {formatDateString} from "../utils/util.tsx";
import {formatCurrency} from "./WealthDigest/formatters.ts";
import style from "./DepositsComponent.module.scss";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    data: {date: string; description: string; amount: number}[];
}

/**
 * FE-5 (ak-20zo) Nocturne-native deposits/purchases listing dialog.
 * Called from the PPF EPG page's top-strip Deposits button (PPF only).
 *
 * Prop shape (`{open, onClose, title, data}`) preserved so the legacy
 * MSNSummary.tsx importer keeps TS-compiling until it's formally
 * retired in the post-chain P3 orphan-cleanup bead.
 */
const DepositModal: React.FC<ModalProps> = ({open, onClose, title, data}) => {
    const total = data.reduce((sum, item) => sum + Number(item.amount), 0);
    const isGold = title.toLowerCase() === "gold";

    // Esc-to-close — keeps the dialog honest on keyboards.
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
                aria-label={`${title.toUpperCase()} ${isGold ? "purchases" : "deposits"}`}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className={style.header}>
                    <span className={style.title}>
                        {title.toUpperCase()} {isGold ? "Purchases" : "Deposits"}
                    </span>
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
                            <span>Date</span>
                            <span>Description</span>
                            <span className={style.alignRight}>Amount</span>
                        </div>
                        {data.map((item, index) => (
                            <div key={index} className={style.tableRow}>
                                <span>{formatDateString(item.date)}</span>
                                <span className={style.rowMuted}>{item.description || "—"}</span>
                                <span className={`${style.alignRight} ${style.rowAmount}`}>
                                    ₹{formatCurrency(Number(item.amount))}
                                </span>
                            </div>
                        ))}
                        <div className={style.tableTotal}>
                            <span>
                                Total ({data.length} {isGold ? "purchases" : "deposits"})
                            </span>
                            <span className={style.alignRight} style={{color: "oklch(0.80 0.13 155)"}}>
                                ₹{formatCurrency(total)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className={style.footer}>
                    <button type="button" onClick={onClose} className={`btn btn-primary ${style.closeAction}`}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DepositModal;
