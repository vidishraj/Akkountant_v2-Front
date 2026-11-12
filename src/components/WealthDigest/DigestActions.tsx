import React, {useEffect, useRef, useState} from "react";
import style from "./WealthDigest.module.scss";

interface DigestActionsProps {
    alreadyRead: boolean;
    onAskFollowUp: () => void;
    onMarkRead: () => void;
    onCopy: () => void;
    onSnooze: () => void;
    disabled?: boolean;
    sticky?: boolean;
}

/**
 * FE-6 (ak-jhy8) Nocturne-skinned digest action row. MUI Button / IconButton /
 * Menu / Tooltip dropped; plain buttons + a self-managed popover for the
 * kebab menu (click-outside + Esc to close).
 */
const DigestActions: React.FC<DigestActionsProps> = ({
    alreadyRead,
    onAskFollowUp,
    onMarkRead,
    onCopy,
    onSnooze,
    disabled = false,
    sticky = false,
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const hostRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const onClick = (e: MouseEvent) => {
            if (hostRef.current && !hostRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMenuOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [menuOpen]);

    return (
        <div className={`${style.actionsRow} ${sticky ? style.actionsRowSticky : ""}`}>
            <button
                type="button"
                className={`btn btn-primary ${style.primaryActionBtn}`}
                onClick={onAskFollowUp}
                disabled={disabled}
            >
                <i className="ph ph-chat-circle-text"/>
                <span>Ask follow-up</span>
            </button>

            {alreadyRead ? (
                <span
                    className={style.readIndicator}
                    aria-label="Digest already read"
                    title="Digest already marked read"
                >
                    <i className="ph ph-check-circle"/>
                    <span>Marked read</span>
                </span>
            ) : (
                <button
                    type="button"
                    className={`btn btn-secondary ${style.secondaryActionBtn}`}
                    onClick={onMarkRead}
                    disabled={disabled}
                >
                    <i className="ph ph-envelope-open"/>
                    <span>Mark read</span>
                </button>
            )}

            <span style={{flex: 1}}/>

            <div ref={hostRef} className={style.kebabHost}>
                <button
                    type="button"
                    className={`btn btn-icon ${style.kebabBtn}`}
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-label="More digest actions"
                    aria-expanded={menuOpen}
                    disabled={disabled}
                >
                    <i className="ph ph-dots-three"/>
                </button>
                {menuOpen && (
                    <div className={style.kebabMenu} role="menu">
                        <button
                            type="button"
                            role="menuitem"
                            className={style.kebabItem}
                            onClick={() => {
                                setMenuOpen(false);
                                onCopy();
                            }}
                        >
                            <i className="ph ph-copy"/>
                            <span>Copy digest to clipboard</span>
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className={style.kebabItem}
                            onClick={() => {
                                setMenuOpen(false);
                                onSnooze();
                            }}
                        >
                            <i className="ph ph-bell-slash"/>
                            <span>Snooze notifications 24h</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DigestActions;
