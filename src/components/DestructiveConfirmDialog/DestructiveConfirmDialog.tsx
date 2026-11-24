import React, {useEffect, useId, useRef, useState} from "react";
import {createPortal} from "react-dom";
import useModalA11y from "../../hooks/useModalA11y";
import style from "./DestructiveConfirmDialog.module.scss";

/**
 * ak-eub4: type-to-confirm dialog for destructive actions (design:
 * Akkountant Redesign · DIALOGS · deleteAll). Replaces the one-click MUI
 * ConfirmationDialog on the asset "Delete all" path, where a single stray
 * click wiped an entire asset class.
 *
 * The Delete button stays disabled until the user types `confirmWord`
 * exactly (case-sensitive; surrounding whitespace ignored). Enter submits
 * only when it matches; Esc and the backdrop cancel. Server-side gates are
 * untouched — this is an additional client-side guard.
 */

const confirmPhraseMatches = (typed: string, confirmWord: string): boolean =>
    confirmWord.length > 0 && typed.trim() === confirmWord;

interface DestructiveConfirmDialogProps {
    open: boolean;
    title: string;
    body: string;
    /** The exact text the user must type, e.g. the asset name. */
    confirmWord: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const DestructiveConfirmDialog: React.FC<DestructiveConfirmDialogProps> = ({
    open,
    title,
    body,
    confirmWord,
    confirmLabel = "Delete",
    onConfirm,
    onCancel,
}) => {
    const [typed, setTyped] = useState("");
    const panelRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const titleId = useId();
    const bodyId = useId();
    const inputId = useId();

    useModalA11y({
        open,
        panelRef: panelRef as React.RefObject<HTMLElement>,
        firstFocusableRef: inputRef as React.RefObject<HTMLElement>,
    });

    // Fresh, empty field every time the dialog opens.
    useEffect(() => {
        if (open) setTyped("");
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onCancel]);

    if (!open) return null;

    const matches = confirmPhraseMatches(typed, confirmWord);
    const submit = () => {
        if (matches) onConfirm();
    };

    return createPortal(
        <div className={`dialog-backdrop ${style.backdrop}`} onMouseDown={onCancel} role="presentation">
            <div
                ref={panelRef}
                className={`dialog ${style.panel}`}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={bodyId}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div id={titleId} className={`dialog-title ${style.title}`}>
                    <i className={`ph ph-warning ${style.titleIcon}`} aria-hidden/>
                    {title}
                </div>
                <div id={bodyId} className="dialog-body">{body}</div>
                <form
                    className="field"
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                >
                    <label htmlFor={inputId}>
                        Type <span className={style.word}>{confirmWord}</span> to confirm
                    </label>
                    <input
                        id={inputId}
                        ref={inputRef}
                        className="input"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={typed.length > 0 && !matches}
                    />
                </form>
                <div className="dialog-actions">
                    <button type="button" className="btn btn-secondary" onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={`btn btn-secondary ${style.danger}`}
                        onClick={submit}
                        disabled={!matches}
                    >
                        <i className="ph ph-trash" aria-hidden/>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default DestructiveConfirmDialog;
