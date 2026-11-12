import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import style from "./WealthDigest.module.scss";

interface NarrativeSectionProps {
    text: string;
}

/**
 * FE-6 (ak-jhy8) Nocturne-skinned narrative section. MUI Box/Typography
 * dropped; the signed-number colorization through markdown's <strong>
 * preserved byte-for-byte so green/red treatment of (+X%) / (−X%) still
 * fires.
 */
const NarrativeSection: React.FC<NarrativeSectionProps> = ({text}) => {
    return (
        <div className={style.narrativeBand}>
            <div className={style.narrativeInner}>
                <h2 className={style.narrativeHeading}>In summary</h2>
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
        </div>
    );
};

export default NarrativeSection;
