import {RefObject, useEffect, useRef} from "react";

/**
 * FE-7 (ak-6lyp) Shared modal-a11y hook. The reviewer flagged the same
 * focus-trap regression on FE-5 (EPG modals) and FE-6 (WealthDigest archive
 * modal). This hook is the single reference implementation the follow-up
 * bead (ak-cqfn) will roll out across those surfaces.
 *
 * Responsibilities (bead-scoped):
 *
 * 1. **Focus-on-open** — when `open` flips true, move focus to
 *    `firstFocusableRef.current` if provided; otherwise the first tab-
 *    focusable element inside `panelRef.current`. The browser's default
 *    focus state after a click-triggered open is the click target —
 *    without this, keyboard users land on the body and have to tab their
 *    way into the dialog.
 *
 * 2. **Focus-restore** — capture `document.activeElement` on the open-
 *    transition and restore it when `open` flips back to false (or the
 *    component unmounts). Prevents the classic "dialog closed, focus
 *    nowhere" dead end that forces screen-reader users to restart their
 *    traversal from the top of the document.
 *
 * 3. **Tab-trap** — while `open`, intercept `Tab`/`Shift+Tab` on
 *    `panelRef` and cycle focus within the panel's tab-focusable set.
 *    Prevents focus from leaking out to the background page (which the
 *    user cannot see through the backdrop anyway).
 *
 * Deliberately NOT included:
 *
 * - **Esc-to-close** — existing dialogs each wire their own Esc handler
 *   because the semantics differ (chat window may want Esc to clear a
 *   draft; a confirmation may want Esc as Cancel). Leaving this out keeps
 *   the hook focused on A11Y and lets the caller define policy.
 *
 * - **Aria-hiding background** — out of scope for this iteration; would
 *   require either a portal + inert attr on the sibling tree or a
 *   `role="dialog" aria-modal="true"` declaration on the caller's panel
 *   root, which callers already do.
 *
 * Shape: `useModalA11y({open, panelRef, firstFocusableRef?}) → void`. Pure
 * side-effect; the hook returns nothing. Caller is free to combine with
 * its own Esc / backdrop-click handlers.
 */

const TAB_FOCUSABLE_SELECTOR = [
    "a[href]",
    "area[href]",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "button:not([disabled])",
    "iframe",
    "object",
    "embed",
    "[contenteditable='true']",
    "[tabindex]:not([tabindex='-1'])",
].join(", ");

function getTabFocusable(root: HTMLElement): HTMLElement[] {
    const nodes = root.querySelectorAll<HTMLElement>(TAB_FOCUSABLE_SELECTOR);
    return Array.from(nodes).filter((el) => {
        // Skip hidden elements — some browsers will refuse focus on them
        // and skipping here keeps the cycle deterministic.
        if (el.hasAttribute("hidden")) return false;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        return true;
    });
}

interface UseModalA11yOptions {
    /** Whether the modal/panel is currently open. */
    open: boolean;
    /** Ref to the panel DOM node (dialog root). Required for tab-trap scope. */
    panelRef: RefObject<HTMLElement>;
    /**
     * Optional ref to the specific element that should receive focus on open.
     * When omitted, the first tab-focusable element inside `panelRef` is used.
     */
    firstFocusableRef?: RefObject<HTMLElement>;
}

export function useModalA11y({
    open,
    panelRef,
    firstFocusableRef,
}: UseModalA11yOptions): void {
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);

    // Focus-on-open + focus-restore-on-close.
    useEffect(() => {
        if (!open) return;

        // Capture whatever had focus before open. Stored in the ref so the
        // cleanup closure sees the same element the open captured.
        previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;

        // Microtask so the panel's render has committed before we focus —
        // React may not have attached refs or painted the panel on the same
        // tick as the `open` flip.
        const id = window.setTimeout(() => {
            const explicit = firstFocusableRef?.current;
            if (explicit) {
                explicit.focus();
                return;
            }
            const panel = panelRef.current;
            if (!panel) return;
            const list = getTabFocusable(panel);
            const first = list[0] ?? panel;
            first.focus();
        }, 0);

        return () => {
            window.clearTimeout(id);
            const prev = previouslyFocusedRef.current;
            if (prev && typeof prev.focus === "function" && document.contains(prev)) {
                // Microtask on restore too — same reason as above, if the
                // caller unmounts a subtree during the close animation, the
                // previously-focused element might not be attached yet on
                // the same tick.
                window.setTimeout(() => prev.focus(), 0);
            }
            previouslyFocusedRef.current = null;
        };
    }, [open, panelRef, firstFocusableRef]);

    // Tab-trap — intercept keyboard Tab inside the panel.
    useEffect(() => {
        if (!open) return;
        const panel = panelRef.current;
        if (!panel) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return;
            const list = getTabFocusable(panel);
            if (list.length === 0) {
                // No focusable targets — prevent the tab from escaping the panel.
                e.preventDefault();
                return;
            }
            const first = list[0];
            const last = list[list.length - 1];
            const active = document.activeElement as HTMLElement | null;

            if (e.shiftKey) {
                // Shift+Tab backwards. If we're on the first (or outside the
                // list entirely), wrap to the last.
                if (!active || active === first || !panel.contains(active)) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                // Forward Tab. If we're on the last, wrap to the first.
                if (!active || active === last || !panel.contains(active)) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        panel.addEventListener("keydown", onKeyDown);
        return () => panel.removeEventListener("keydown", onKeyDown);
    }, [open, panelRef]);
}

export default useModalA11y;
