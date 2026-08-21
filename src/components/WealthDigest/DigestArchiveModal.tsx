import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {
  WealthDigest,
  WealthDigestError,
  fetchDigestByDate,
} from "../../services/wealthDigestService";
import style from "./WealthDigest.module.scss";

interface DigestArchiveModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Fires when the user picks a date from the archive. Caller replaces the
   * main-view digest with this one AND flips the header into
   * "viewingPast + Back-to-today" mode.
   */
  onSelectDigest: (digest: WealthDigest) => void;
}

const HISTORY_DAYS = 30;

/**
 * Builds the past-N-day-list the archive shows. We compute anchored to the
 * user's local calendar; the backend accepts YYYY-MM-DD as IST dates but the
 * user's clock is a good-enough approximation of "yesterday" / "3 days ago"
 * for archive-scrubbing purposes. If a locale mismatch matters, this is the
 * one place to swap the date-arithmetic for IST-anchored math later.
 */
function buildDateOptions(): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Archive modal — 30-day rolling window of past digests (Overseer-locked Q2).
 * A DatePicker would need @mui/x-date-pickers wired for this bounded case; a
 * simple date-list + free-text date input keeps the modal light and avoids
 * pulling in extra deps for one surface.
 *
 * On date selection, we fetch just-in-time (no bulk-list endpoint on the BE
 * — one date, one GET) and hand the result up to the parent, which swaps its
 * main-view digest and flips the header banner.
 *
 * 404 (no digest for that day) is a legitimate outcome, not an error — the
 * modal renders an inline "No digest for {date}" line and stays open so the
 * user can try another.
 */
const DigestArchiveModal: React.FC<DigestArchiveModalProps> = ({
  open,
  onClose,
  onSelectDigest,
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateOptions, setDateOptions] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setDateOptions(buildDateOptions());
      setSelectedDate(null);
      setNotFound(null);
      setError(null);
    }
  }, [open]);

  const handleSelect = async (date: string) => {
    setSelectedDate(date);
    setLoading(true);
    setNotFound(null);
    setError(null);
    try {
      const digest = await fetchDigestByDate(date);
      onSelectDigest(digest);
      onClose();
    } catch (err) {
      if (err instanceof WealthDigestError && err.code === "not_found") {
        setNotFound(date);
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to load that digest"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      className={style.archiveDialog}
      PaperProps={{ className: style.archiveDialogPaper }}
    >
      <DialogTitle className={style.archiveDialogTitle}>
        Past digests
        <IconButton
          aria-label="close"
          onClick={onClose}
          className={style.archiveCloseBtn}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent className={style.archiveDialogContent}>
        <Typography className={style.archiveHint}>
          Pick a date from the past {HISTORY_DAYS} days. Not every day will
          have a digest — some days the task doesn't run.
        </Typography>

        <TextField
          type="date"
          size="small"
          label="Jump to date"
          value={selectedDate ?? ""}
          onChange={(e) => setSelectedDate(e.target.value || null)}
          onBlur={() => {
            if (selectedDate) void handleSelect(selectedDate);
          }}
          InputLabelProps={{ shrink: true }}
          className={style.archiveDateInput}
          fullWidth
        />

        <List dense className={style.archiveList}>
          {dateOptions.map((d) => (
            <ListItemButton
              key={d}
              onClick={() => handleSelect(d)}
              disabled={loading}
              selected={selectedDate === d}
            >
              <ListItemText primary={d} />
            </ListItemButton>
          ))}
        </List>

        {notFound && (
          <Box className={style.archiveNotice}>
            No digest for {notFound}. Try another date.
          </Box>
        )}
        {error && (
          <Box className={`${style.archiveNotice} ${style.archiveNoticeError}`}>
            {error}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} className={style.archiveCancelBtn}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DigestArchiveModal;
