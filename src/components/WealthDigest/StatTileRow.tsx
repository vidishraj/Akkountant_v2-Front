import React, { ReactNode } from "react";
import { Box } from "@mui/material";
import style from "./WealthDigest.module.scss";

interface StatTileRowProps {
  /** The tiles to lay out. Order matters — Total should come first (hero). */
  children: ReactNode;
}

/**
 * Responsive KPI row container for the WealthDigest page.
 *
 * Breakpoints (per Overseer-locked Q3):
 * - Desktop (>= 900px): 5-across, horizontal band.
 * - Tablet (600–899px): 2-across, wrapping to a 3rd row.
 * - Phone (< 600px): 1-across, single column with Total-hero at the top.
 *
 * Implemented via CSS Grid in WealthDigest.module.scss so the tile children
 * stay layout-agnostic — they know their own contents, not the row shape.
 * If a future variant needs a fixed 6-tile layout, add a `dense` prop that
 * swaps in a different grid-template-columns rather than branching here.
 */
const StatTileRow: React.FC<StatTileRowProps> = ({ children }) => {
  return <Box className={style.tileRow}>{children}</Box>;
};

export default StatTileRow;
