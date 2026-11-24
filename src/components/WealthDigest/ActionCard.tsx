import React from "react";
import {DigestAction} from "../../services/wealthDigestService";
import style from "./WealthDigest.module.scss";

interface ActionCardProps {
    action: DigestAction;
    done: boolean;
    onToggleDone: (id: string, done: boolean) => void;
    onAsk?: () => void;
}

/**
 * ak-x1i5: design "Do" card — square check toggle, title (+ High priority
 * tag), detail, then a meta row: category icon · label · priority, and an
 * "Ask about this" link on the right.
 */
const CATEGORY_META: Record<DigestAction["category"], {label: string; icon: string}> = {
    cash: {label: "Cash", icon: "ph-currency-inr"},
    equity: {label: "Equity", icon: "ph-chart-line-up"},
    debt: {label: "Debt", icon: "ph-bank"},
    gold: {label: "Gold", icon: "ph-diamond"},
    other: {label: "Other", icon: "ph-squares-four"},
};

const PRIORITY_LABEL: Record<DigestAction["priority"], string> = {
    high: "High priority",
    medium: "Medium priority",
    low: "Low priority",
};

const ActionCard: React.FC<ActionCardProps> = ({action, done, onToggleDone, onAsk}) => {
    const catMeta = CATEGORY_META[action.category] ?? CATEGORY_META.other;
    return (
        <div className={`${style.insightCard} ${done ? style.insightCardDone : ""}`}>
            <button
                type="button"
                role="checkbox"
                aria-checked={done}
                aria-label={`Mark "${action.title}" done`}
                className={`${style.actionCheckbox} ${done ? style.actionCheckboxOn : ""}`}
                onClick={() => onToggleDone(action.id, !done)}
            >
                <i className="ph ph-check" aria-hidden/>
            </button>
            <div className={style.insightCardBody}>
                <div className={style.insightCardHeader}>
                    <span
                        className={`${style.insightCardTitle} ${done ? style.insightCardTitleDone : ""}`}
                    >
                        {action.title}
                    </span>
                    {action.priority === "high" && (
                        <span className={`tag tag-outline ${style.priorityTag}`}>High priority</span>
                    )}
                </div>
                {action.detail && (
                    <p className={style.insightCardDetail}>{action.detail}</p>
                )}
                <div className={style.insightCardMeta}>
                    <i className={`ph ${catMeta.icon}`} aria-hidden/>
                    <span>{catMeta.label}</span>
                    <span aria-hidden>·</span>
                    <span>{PRIORITY_LABEL[action.priority] ?? action.priority}</span>
                    <span className={style.metaSpacer}/>
                    {onAsk && (
                        <button
                            type="button"
                            className={`btn btn-ghost ${style.askLink}`}
                            onClick={onAsk}
                        >
                            Ask about this
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActionCard;
