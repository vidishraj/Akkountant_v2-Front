import React, { useState } from "react";
import { Box, Button, IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SnoozeIcon from "@mui/icons-material/Snooze";
import style from "./WealthDigest.module.scss";

interface DigestActionsProps {
  /**
   * Whether the digest is already marked-read on the server. When true, the
   * Mark Read button becomes a passive indicator ("Read ✓") rather than an
   * active button — matches the standard "already-actioned" affordance.
   */
  alreadyRead: boolean;
  /** Fires when the user clicks Ask follow-up. Caller opens the AgentChat drawer. */
  onAskFollowUp: () => void;
  /** Fires when the user clicks Mark read. Caller does the optimistic + POST. */
  onMarkRead: () => void;
  /** Fires when the user clicks Copy in the kebab. Caller does the clipboard write. */
  onCopy: () => void;
  /** Fires when the user picks Snooze 24h in the kebab. Caller stores localStorage flag. */
  onSnooze: () => void;
  /**
   * When true, all interactive controls disable — used while a prior action
   * is in-flight so the user can't fire duplicate mark-read/etc requests.
   */
  disabled?: boolean;
}

/**
 * Action row for the WealthDigest page.
 *
 * Two primary buttons visible (Ask follow-up + Mark read), one kebab holding
 * Copy and Snooze. This is the Overseer-locked action set — rebalance and
 * add-transaction were explicitly excluded in Wave 1 as either infra-missing
 * or misaligned with the digest's read-only nature.
 *
 * Mark Read collapses to a passive "Read ✓" indicator once the digest has
 * already been read (server-confirmed OR optimistic-local) — this avoids the
 * dead-affordance smell of a button that no longer does anything useful.
 */
const DigestActions: React.FC<DigestActionsProps> = ({
  alreadyRead,
  onAskFollowUp,
  onMarkRead,
  onCopy,
  onSnooze,
  disabled = false,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const closeMenu = () => setMenuAnchor(null);

  return (
    <Box className={style.actionsRow}>
      <Button
        className={style.primaryActionBtn}
        onClick={onAskFollowUp}
        disabled={disabled}
        startIcon={<ChatBubbleOutlineIcon />}
        variant="contained"
      >
        Ask follow-up
      </Button>

      {alreadyRead ? (
        <Tooltip title="Digest already marked read" arrow>
          <span className={style.readIndicator} aria-label="Digest already read">
            <MarkEmailReadIcon fontSize="small" />
            Read
          </span>
        </Tooltip>
      ) : (
        <Button
          className={style.secondaryActionBtn}
          onClick={onMarkRead}
          disabled={disabled}
          startIcon={<MarkEmailReadIcon />}
          variant="outlined"
        >
          Mark read
        </Button>
      )}

      <Box sx={{ flexGrow: 1 }} />

      <IconButton
        className={style.kebabBtn}
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        aria-label="More digest actions"
        disabled={disabled}
      >
        <MoreHorizIcon />
      </IconButton>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            closeMenu();
            onCopy();
          }}
        >
          <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} />
          Copy digest to clipboard
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMenu();
            onSnooze();
          }}
        >
          <SnoozeIcon fontSize="small" sx={{ mr: 1 }} />
          Snooze notifications 24h
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default DigestActions;
