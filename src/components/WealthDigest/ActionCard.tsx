import React from "react";
import {DigestAction} from "../../services/wealthDigestService";
import style from "./WealthDigest.module.scss";

interface ActionCardProps {
    action: DigestAction;
    done: boolean;
    onToggleDone: (id: string, done: boolean) => void;
}

/**
 * FE-6 (ak-jhy8) Nocturne-skinned action card. MUI/BasicCard dropped;
 * plain div with Nocturne tokens + Phosphor category icons. Category
 * color-tokens remain semantic (cash / equity / debt / gold / other).
 */

const CATEGORY_META: Record<
    DigestAction["category"],
    {label: string; icon: string; colorClass: string}
> = {
    cash: {label: "Cash", icon: "ph-currency-inr", colorClass: "categoryPill_cash"},
    equity: {label: "Equity", icon: "ph-chart-line-up", colorClass: "categoryPill_equity"},
    debt: {label: "Debt", icon: "ph-bank", colorClass: "categoryPill_debt"},
    gold: {label: "Gold", icon: "ph-diamond", colorClass: "categoryPill_gold"},
    other: {label: "Other", icon: "ph-squares-four", colorClass: "categoryPill_other"},
};

const PRIORITY_LABEL: Record<DigestAction["priority"], string> = {
    high: "High priority",
    medium: "Medium priority",
    low: "Low priority",
};

const ActionCard: React.FC<ActionCardProps> = ({action, done, onToggleDone}) => {
    const catMeta = CATEGORY_META[action.category];
    return (
        <div className={`${style.insightCard} ${done ? style.insightCardDone : ""}`}>
            <div className={style.insightCardBody}>
                <div className={style.insightCardHeader}>
                    <input
                        type="checkbox"
                        checked={done}
                        onChange={(e) => onToggleDone(action.id, e.target.checked)}
                        className={style.actionCheckbox}
                        aria-label={`Mark "${action.title}" done`}
                    />
                    <div
                        className={`${style.insightCardTitle} ${done ? style.insightCardTitleDone : ""}`}
                    >
                        {action.title}
                    </div>
                </div>
                {action.detail && (
                    <div className={style.insightCardDetail}>{action.detail}</div>
                )}
                <div className={style.insightCardMeta}>
                    <span
                        className={`${style.categoryPill} ${style[catMeta.colorClass as "categoryPill_cash"]}`}
                    >
                        <i className={`ph ${catMeta.icon}`} aria-hidden/>
                        <span>{catMeta.label}</span>
                    </span>
                    <span
                        className={`${style.priorityPill} ${style["priorityPill_" + action.priority as "priorityPill_high"]}`}
                        title={PRIORITY_LABEL[action.priority]}
                    >
                        {action.priority.toUpperCase()}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ActionCard;
