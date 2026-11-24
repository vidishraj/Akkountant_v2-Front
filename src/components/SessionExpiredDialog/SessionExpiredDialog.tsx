import {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useLocation, useNavigate} from "react-router-dom";
import {getAuth, onAuthStateChanged, signOut} from "firebase/auth";
import useModalA11y from "../../hooks/useModalA11y.ts";
import {
    clearSessionExpired,
    currentSessionExpiry,
    onSessionExpired,
    SessionExpiredReason,
} from "../../services/sessionExpiry.ts";
import style from "./SessionExpiredDialog.module.scss";

/**
 * ak-p612: app-wide re-auth prompt. Shown when no Firebase ID token can be
 * obtained (after one forced refresh) or the API returns a non-Kite 401.
 * It blocks the page so an expired session never reads as empty or zero
 * data. "Sign in again" signs out and returns to /login with a returnUrl,
 * so the user lands back where they were.
 */
const SessionExpiredDialog = () => {
    const [reason, setReason] = useState<SessionExpiredReason | null>(currentSessionExpiry());
    const navigate = useNavigate();
    const location = useLocation();
    const panelRef = useRef<HTMLDivElement | null>(null);
    const actionRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => onSessionExpired(setReason), []);

    // Review MINOR-1: a NEW sign-in clears any latched expiry (e.g. a 401
    // that arrived while we were on / or /login), so a normal login never
    // pops the dialog and forces an extra sign-out.
    useEffect(
        () => onAuthStateChanged(getAuth(), (user) => {
            if (user) {
                clearSessionExpired();
                setReason(null);
            }
        }),
        [],
    );

    // Public pages have nothing to protect; don't block them.
    const onPublicPage = location.pathname === "/" || location.pathname.startsWith("/login");
    const open = reason !== null && !onPublicPage;

    useModalA11y({
        open,
        panelRef: panelRef as React.RefObject<HTMLElement>,
        firstFocusableRef: actionRef as React.RefObject<HTMLElement>,
    });

    if (!open) return null;

    const signInAgain = () => {
        const returnUrl = encodeURIComponent(location.pathname + location.search);
        clearSessionExpired();
        setReason(null);
        signOut(getAuth())
            .catch(() => undefined)
            .finally(() => navigate(`/login?returnUrl=${returnUrl}`, {replace: true}));
    };

    return createPortal(
        <div className={`dialog-backdrop ${style.backdrop}`} role="presentation">
            <div
                ref={panelRef}
                className={`dialog ${style.panel}`}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="session-expired-title"
                aria-describedby="session-expired-body"
            >
                <div id="session-expired-title" className={`dialog-title ${style.title}`}>
                    <i className="ph ph-lock-key" aria-hidden/>
                    Session expired
                </div>
                <div id="session-expired-body" className="dialog-body">
                    {reason === "token_unavailable"
                        ? "We couldn't refresh your sign-in. Sign in again to keep seeing your data."
                        : "Your sign-in is no longer valid. Sign in again to keep seeing your data."}
                    {" "}Unsaved changes on this page will be lost.
                </div>
                <div className="dialog-actions">
                    <button ref={actionRef} type="button" className="btn btn-primary" onClick={signInAgain}>
                        <i className="ph ph-sign-in" aria-hidden/>
                        Sign in again
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default SessionExpiredDialog;
