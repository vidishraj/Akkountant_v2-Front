import {useEffect, useMemo, useRef, useState} from "react";
import {Link, useLocation, useNavigate} from "react-router-dom";
import {getAuth} from "firebase/auth";
import {useAuth} from "../../contexts/AuthContext";
import {useMessage} from "../../contexts/MessageContext";
import {useWealthDigest} from "../../contexts/WealthDigestContext";
import AgentHeaderInput from "./AgentHeaderInput";
import {AgentType} from "../../services/agentService";
import styles from "./Header.module.scss";

/**
 * FE-1 (ak-1myo) Global shell header. Ports the design's Home.dc.html
 * header (lines 19-61) to React + Nocturne tokens. The same instance
 * mounts on every authenticated page via main.tsx's layout.
 *
 * Structure matches the design verbatim:
 *   [Ak chip + Akkountant wordmark] [primary nav … | · | secondary nav]
 *   <flex spacer> [per-page Ask input?] [bell + badge] [avatar]
 *
 * Mobile collapse: below 720px the primary nav collapses into a ph-list
 * button that opens a dropdown of every link.
 *
 * Out-of-scope per the bead (deferred to later FE beads):
 * - Omni Ask bar (lives on Home, FE-2)
 * - Real inbox data (stub: empty list → badge hidden)
 * - Settings/Jobs/File-Timestamps/Visitors surfaces (the pre-FE-1 Settings
 *   drawer entry — the design does not surface these). Those dialog
 *   components still exist and can be re-wired via a dedicated /settings
 *   route in a later bead. Flagged in the handoff.
 */

interface InboxItem {
    id: string;
    icon: string;      // phosphor class after `ph `
    color: string;     // hex or var(--...)
    title: string;
    sub: string;
    href: string;
}

// FE-1 stub: empty list hides the badge + popover showing "no items".
// FE-2 wires this to the real alerts strip.
const STUB_INBOX: InboxItem[] = [];

interface NavItem {
    label: string;
    href: string;
    group: "primary" | "secondary";
    unread?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    {label: "Home", href: "/home", group: "primary"},
    {label: "Transactions", href: "/transactions", group: "primary"},
    {label: "Investments", href: "/investments", group: "primary"},
    {label: "Freelance", href: "/freelance", group: "primary"},
    {label: "Files", href: "/files", group: "primary"},
    // Wealth Digest sits in the secondary group per the design. It carries
    // its own unread-dot (consumed from WealthDigestContext.hasUnread) —
    // distinct from the top-right inbox badge.
    {label: "Wealth Digest", href: "/wealth-digest", group: "secondary"},
];

const Header = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const {currentUser, loading} = useAuth();
    const {setPayload} = useMessage();
    const {hasUnread: hasUnreadDigest} = useWealthDigest();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [inboxOpen, setInboxOpen] = useState(false);
    const [avatarOpen, setAvatarOpen] = useState(false);
    const headerRef = useRef<HTMLElement | null>(null);

    // Per-page agent input — same gating as before: null on Home (omni lives
    // in-page), rendered inline on content pages that have a scoped agent.
    const activeAgentType: AgentType | null = useMemo(() => {
        const p = location.pathname;
        if (p.startsWith("/transactions")) return "transaction";
        if (p.startsWith("/investments")) return "investment";
        if (p.startsWith("/freelance")) return "freelance";
        return null;
    }, [location.pathname]);

    // Close popovers on route change (user navigated into the thing).
    useEffect(() => {
        setMobileMenuOpen(false);
        setInboxOpen(false);
        setAvatarOpen(false);
    }, [location.pathname]);

    // Click-outside: any click outside the <header> closes every popover.
    useEffect(() => {
        if (!mobileMenuOpen && !inboxOpen && !avatarOpen) return;
        const onDocClick = (e: MouseEvent) => {
            if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
                setMobileMenuOpen(false);
                setInboxOpen(false);
                setAvatarOpen(false);
            }
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [mobileMenuOpen, inboxOpen, avatarOpen]);

    // Only exactly one popover open at a time — opening one closes the others.
    const openInbox = () => {
        setInboxOpen((v) => !v);
        setAvatarOpen(false);
        setMobileMenuOpen(false);
    };
    const openAvatar = () => {
        setAvatarOpen((v) => !v);
        setInboxOpen(false);
        setMobileMenuOpen(false);
    };
    const openMenu = () => {
        setMobileMenuOpen((v) => !v);
        setInboxOpen(false);
        setAvatarOpen(false);
    };

    const isActive = (href: string) => {
        if (href === "/home") return location.pathname === "/home";
        return location.pathname.startsWith(href);
    };

    // Initials derive from displayName (preferred) → email (fallback) → "U".
    // Keeps the design's "VR" shape without leaking the raw email.
    const initials = useMemo(() => {
        const name = currentUser?.displayName?.trim();
        if (name) {
            const parts = name.split(/\s+/).filter(Boolean);
            if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        }
        const email = currentUser?.email;
        if (email) return email.slice(0, 2).toUpperCase();
        return "U";
    }, [currentUser]);

    const signOut = () => {
        setAvatarOpen(false);
        getAuth()
            .signOut()
            .then(() => navigate("/"))
            .catch(() =>
                setPayload({type: "error", message: "Error logging out."}),
            );
    };

    const unreadInboxCount = STUB_INBOX.length;
    // Active nav link style — rendered via module class toggle so :focus-visible,
    // hover, etc. all come from the stylesheet rather than inline styles.
    const linkClass = (href: string, group: NavItem["group"]) =>
        [
            group === "primary" ? styles.navLink : styles.navLinkSecondary,
            isActive(href) ? styles.navLinkActive : "",
        ]
            .filter(Boolean)
            .join(" ");

    // While auth resolves we still render the header chrome (logo + divider)
    // so there's no pop-in, but hide the nav + user-affordances.
    const authReady = !loading && currentUser != null;

    return (
        <header className={styles.header} ref={headerRef}>
            <Link to="/" className={styles.brand}>
                <span className={styles.brandChip} aria-hidden="true">Ak</span>
                <span className={styles.brandWord}>Akkountant</span>
            </Link>

            {authReady && (
                <>
                    {/* Full-width primary nav — hidden under 720px via SCSS. */}
                    <nav className={styles.navFull} aria-label="Primary">
                        {NAV_ITEMS.filter((n) => n.group === "primary").map((n) => (
                            <Link
                                key={n.href}
                                to={n.href}
                                className={linkClass(n.href, "primary")}
                            >
                                {n.label}
                            </Link>
                        ))}
                        <span className={styles.navDivider} aria-hidden="true"/>
                        {NAV_ITEMS.filter((n) => n.group === "secondary").map((n) => (
                            <Link
                                key={n.href}
                                to={n.href}
                                className={linkClass(n.href, "secondary")}
                            >
                                {n.label}
                                {n.href === "/wealth-digest" && hasUnreadDigest && (
                                    <span className={styles.navDot} aria-label="unread"/>
                                )}
                            </Link>
                        ))}
                    </nav>

                    {/* Compact menu button — shown under 720px via SCSS. */}
                    <button
                        type="button"
                        onClick={openMenu}
                        className={`btn btn-secondary ${styles.menuBtn}`}
                        aria-label="Open navigation"
                        aria-expanded={mobileMenuOpen}
                    >
                        <i className="ph ph-list"/>
                        <span>Menu</span>
                    </button>
                </>
            )}

            <span className={styles.spacer}/>

            {/* Per-page agent Ask input — content pages with a scoped agent. */}
            {authReady && activeAgentType && (
                <div className={styles.agentInputHost}>
                    <AgentHeaderInput agentType={activeAgentType}/>
                </div>
            )}

            {authReady && (
                <>
                    <button
                        type="button"
                        onClick={openInbox}
                        className={`btn btn-icon ${styles.iconBtn}`}
                        title="Things Akkountant wants to tell you"
                        aria-label="Inbox"
                        aria-expanded={inboxOpen}
                    >
                        <i className="ph ph-bell"/>
                        {unreadInboxCount > 0 && (
                            <span className={styles.badge}>{unreadInboxCount}</span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={openAvatar}
                        className={styles.avatar}
                        title="Signed in"
                        aria-label="Account"
                        aria-expanded={avatarOpen}
                    >
                        {initials}
                    </button>
                </>
            )}

            {!authReady && !loading && (
                <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className={`btn btn-primary ${styles.loginBtn}`}
                >
                    Sign in
                </button>
            )}

            {/* Mobile-collapsed menu */}
            {mobileMenuOpen && authReady && (
                <div
                    className={styles.popoverMenu}
                    role="menu"
                    aria-label="Navigation"
                >
                    {NAV_ITEMS.map((n) => (
                        <Link
                            key={n.href}
                            to={n.href}
                            className={`${styles.popoverLink} ${isActive(n.href) ? styles.popoverLinkActive : ""}`}
                            role="menuitem"
                        >
                            {n.label}
                            {n.href === "/wealth-digest" && hasUnreadDigest && (
                                <span className={styles.navDot} aria-label="unread"/>
                            )}
                        </Link>
                    ))}
                </div>
            )}

            {/* Inbox popover */}
            {inboxOpen && authReady && (
                <div className={styles.popoverInbox} role="dialog" aria-label="Inbox">
                    <span className={styles.popoverKicker}>Needs attention</span>
                    {STUB_INBOX.length === 0 ? (
                        <span className={styles.popoverEmpty}>You're caught up.</span>
                    ) : (
                        STUB_INBOX.map((item) => (
                            <Link
                                key={item.id}
                                to={item.href}
                                className={styles.popoverInboxItem}
                            >
                                <i className={`ph ${item.icon}`} style={{color: item.color}}/>
                                <span className={styles.popoverInboxBody}>
                                    <span className={styles.popoverInboxTitle}>{item.title}</span>
                                    <span className={styles.popoverInboxSub}>{item.sub}</span>
                                </span>
                            </Link>
                        ))
                    )}
                </div>
            )}

            {/* Avatar popover */}
            {avatarOpen && authReady && (
                <div className={styles.popoverAvatar} role="menu" aria-label="Account">
                    <div className={styles.popoverAvatarIdentity}>
                        <span className={styles.popoverAvatarName}>
                            {currentUser?.displayName || "Signed in"}
                        </span>
                        <span className={styles.popoverAvatarMeta}>
                            Signed in with Google
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={signOut}
                        className={styles.popoverAvatarSignOut}
                        role="menuitem"
                    >
                        <i className="ph ph-sign-out"/>
                        <span>Sign out</span>
                    </button>
                </div>
            )}
        </header>
    );
};

export default Header;
