import React, {useLayoutEffect, useRef, useState} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import style from "./WealthDigest.module.scss";

interface NarrativeSectionProps {
    text: string;
}

/**
 * ak-x1i5: "In summary" — collapsed to two lines with a "Read full digest"
 * toggle (design). The toggle only renders when the text actually overflows
 * the collapsed height. Signed-number colouring through markdown <strong>
 * is preserved so (+X%) / (−X%) still read green/red.
 */
const NarrativeSection: React.FC<NarrativeSectionProps> = ({text}) => {
    const [open, setOpen] = useState(false);
    const [overflows, setOverflows] = useState(false);
    const bodyRef = useRef<HTMLDivElement | null>(null);

    // Reset to collapsed when a different digest is shown.
    useLayoutEffect(() => {
        setOpen(false);
    }, [text]);

    useLayoutEffect(() => {
        const el = bodyRef.current;
        if (!el || open) return;
        const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
        measure();
        const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
        ro?.observe(el);
        return () => ro?.disconnect();
    }, [text, open]);

    return (
        <section className={style.narrativeSection}>
            <h2 className={style.sectionHeading}>In summary</h2>
            <div
                ref={bodyRef}
                id="wd-narrative-body"
                className={`${style.narrativeInner} ${open ? "" : style.narrativeCollapsed}`}
            >
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        strong: ({children, ...rest}) => {
                            const raw = React.Children.toArray(children)
                                .map((c) => (typeof c === "string" ? c : ""))
                                .join("");
                            const trimmed = raw.trim();
                            const isPositive = /^\+\s?\S/.test(trimmed);
                            const isNegative = /^-\s?\S|^−\s?\S/.test(trimmed);
                            const cls = isPositive
                                ? style.narrativePositive
                                : isNegative
                                    ? style.narrativeNegative
                                    : "";
                            return (
                                <strong {...rest} className={cls}>
                                    {children}
                                </strong>
                            );
                        },
                    }}
                >
                    {text}
                </ReactMarkdown>
            </div>
            {(overflows || open) && (
                <button
                    type="button"
                    className={`btn btn-ghost ${style.narrativeToggle}`}
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                    aria-controls="wd-narrative-body"
                >
                    {open ? "Show less" : "Read full digest"}
                </button>
            )}
        </section>
    );
};

export default NarrativeSection;
