import React from "react";
import { Box, Button, Chip, Typography } from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import style from "./WealthDigest.module.scss";

interface DigestHeaderProps {
  /** The digest's calendar date, ISO YYYY-MM-DD (IST). Rendered as "Wed, Aug 21". */
  date: string | null;
  /** Callback for the "History ▾" button — opens DigestArchiveModal. */
  onOpenHistory: () => void;
  /**
   * When the user is viewing a past digest (via the archive), this shows an
   * inline "Back to today" affordance. Left null when we're on the latest.
   */
  viewingPast?: boolean;
  onBackToToday?: () => void;
}

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Formats YYYY-MM-DD → "Wed, Aug 21". Uses UTC parts so the calendar date on
 * the tile matches the one the BE sent (which is IST-anchored) — a local-tz
 * split would let "2026-08-21" display as "Aug 20" for a viewer in a west-of-
 * IST timezone.
 */
function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${DAY_NAMES[date.getUTCDay()].slice(0, 3)}, ${MONTH_NAMES[m - 1]} ${d}`;
}

/**
 * Page header for the WealthDigest — title + date on the left, inline
 * [Personal use — not investment advice] chip + History dropdown on the right.
 *
 * The chip renders inline (Overseer-locked Q4) rather than as a full-width
 * band. It's the least-clutter position that still meets the code-enforced
 * disclosure requirement — reader sees it without it dominating the layout.
 */
const DigestHeader: React.FC<DigestHeaderProps> = ({
  date,
  onOpenHistory,
  viewingPast = false,
  onBackToToday,
}) => {
  return (
    <Box className={style.headerRow}>
      <Box className={style.headerLeft}>
        <Typography className={style.headerTitle} component="h1">
          Wealth Digest
        </Typography>
        {date && (
          <Typography className={style.headerDate} component="div">
            · {formatDateLabel(date)}
          </Typography>
        )}
        {viewingPast && onBackToToday && (
          <Button
            className={style.backToTodayBtn}
            onClick={onBackToToday}
            size="small"
            variant="text"
          >
            ← Back to today
          </Button>
        )}
      </Box>
      <Box className={style.headerRight}>
        <Button
          className={style.historyBtn}
          onClick={onOpenHistory}
          startIcon={<HistoryIcon fontSize="small" />}
          size="small"
          variant="text"
        >
          History
        </Button>
        <Chip
          className={style.disclosureChip}
          label="Personal use — not investment advice"
          size="small"
        />
      </Box>
    </Box>
  );
};

export default DigestHeader;
