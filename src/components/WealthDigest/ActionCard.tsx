import React from "react";
import { Box, Checkbox, Chip, Tooltip, Typography } from "@mui/material";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import DiamondIcon from "@mui/icons-material/Diamond";
import CategoryIcon from "@mui/icons-material/Category";
import BasicCard from "../BasicCard";
import { DigestAction } from "../../services/wealthDigestService";
import style from "./WealthDigest.module.scss";

interface ActionCardProps {
  action: DigestAction;
  /** True when the user has ticked the checkbox for this day. */
  done: boolean;
  onToggleDone: (id: string, done: boolean) => void;
}

const CATEGORY_META: Record<
  DigestAction["category"],
  { label: string; icon: React.ReactNode; colorClass: string }
> = {
  cash: {
    label: "Cash",
    icon: <AttachMoneyIcon fontSize="inherit" />,
    colorClass: "categoryPill_cash",
  },
  equity: {
    label: "Equity",
    icon: <ShowChartIcon fontSize="inherit" />,
    colorClass: "categoryPill_equity",
  },
  debt: {
    label: "Debt",
    icon: <AccountBalanceIcon fontSize="inherit" />,
    colorClass: "categoryPill_debt",
  },
  gold: {
    label: "Gold",
    icon: <DiamondIcon fontSize="inherit" />,
    colorClass: "categoryPill_gold",
  },
  other: {
    label: "Other",
    icon: <CategoryIcon fontSize="inherit" />,
    colorClass: "categoryPill_other",
  },
};

const PRIORITY_LABEL: Record<DigestAction["priority"], string> = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
};

/**
 * A single actionable item from the digest. Category + priority pills give
 * quick visual triage; the interactive checkbox lets the user mark items
 * done for the day (client-side, per-digest-date, localStorage-persisted).
 *
 * The category color palette is category-semantic (cash green, equity blue,
 * debt purple, gold amber, other neutral) — NOT the same as the categorical
 * data-viz series palette, because these categories carry meaning even in
 * isolation (an equity action is an equity action regardless of what else
 * is on screen).
 */
const ActionCard: React.FC<ActionCardProps> = ({ action, done, onToggleDone }) => {
  const catMeta = CATEGORY_META[action.category];
  return (
    <BasicCard className={`${style.insightCard} ${done ? style.insightCardDone : ""}`}>
      <Box className={style.insightCardBody}>
        <Box className={style.insightCardHeader}>
          <Checkbox
            checked={done}
            onChange={(e) => onToggleDone(action.id, e.target.checked)}
            size="small"
            className={style.actionCheckbox}
            inputProps={{ "aria-label": `Mark "${action.title}" done` }}
          />
          <Typography
            className={`${style.insightCardTitle} ${done ? style.insightCardTitleDone : ""}`}
            component="div"
          >
            {action.title}
          </Typography>
        </Box>
        {action.detail && (
          <Typography className={style.insightCardDetail} component="div">
            {action.detail}
          </Typography>
        )}
        <Box className={style.insightCardMeta}>
          <Chip
            className={`${style.categoryPill} ${style[catMeta.colorClass]}`}
            icon={<span className={style.categoryPillIcon}>{catMeta.icon}</span>}
            label={catMeta.label}
            size="small"
          />
          <Tooltip title={PRIORITY_LABEL[action.priority]} arrow>
            <Chip
              className={`${style.priorityPill} ${style["priorityPill_" + action.priority]}`}
              label={action.priority.toUpperCase()}
              size="small"
            />
          </Tooltip>
        </Box>
      </Box>
    </BasicCard>
  );
};

export default ActionCard;
