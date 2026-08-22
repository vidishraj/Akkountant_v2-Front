import React from "react";
import { Alert, AlertTitle, Box, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { DigestWatchItem } from "../../services/wealthDigestService";
import style from "./WealthDigest.module.scss";

interface WatchItemCardProps {
  item: DigestWatchItem;
}

const SEVERITY_META: Record<
  DigestWatchItem["severity"],
  {
    muiSeverity: "info" | "warning" | "error";
    icon: React.ReactNode;
  }
> = {
  info: {
    muiSeverity: "info",
    icon: <InfoOutlinedIcon fontSize="small" />,
  },
  warning: {
    muiSeverity: "warning",
    icon: <WarningAmberIcon fontSize="small" />,
  },
  critical: {
    muiSeverity: "error",
    icon: <ErrorOutlineIcon fontSize="small" />,
  },
};

/**
 * A "keep an eye on" pointer from the digest — an alert-styled card with
 * severity icon + optional deep-jump to the relevant category page.
 *
 * The MUI Alert's built-in severity tinting handles the color scheme; we
 * lean on those tokens rather than defining new ones so the treatment stays
 * consistent with app-wide error/warning/info affordances (NotificationBanner
 * uses the same primitives).
 */
const WatchItemCard: React.FC<WatchItemCardProps> = ({ item }) => {
  const navigate = useNavigate();
  const meta = SEVERITY_META[item.severity];

  return (
    <Alert
      severity={meta.muiSeverity}
      icon={meta.icon}
      className={style.watchAlert}
      action={
        item.investigate_target ? (
          <Button
            onClick={() => navigate(`/investments/${item.investigate_target}`)}
            size="small"
            className={style.watchInvestigateBtn}
            endIcon={<ArrowForwardIcon fontSize="small" />}
          >
            Investigate
          </Button>
        ) : null
      }
    >
      <AlertTitle className={style.watchAlertTitle}>{item.title}</AlertTitle>
      {item.detail && (
        <Typography className={style.watchAlertBody} component="div">
          {item.detail}
        </Typography>
      )}
      {item.investigate_target && (
        <Box className={style.watchAlertTarget} component="span">
          Related: {item.investigate_target.toUpperCase()}
        </Box>
      )}
    </Alert>
  );
};

export default WatchItemCard;
