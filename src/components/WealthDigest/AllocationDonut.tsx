import React from "react";
import { Box, Typography } from "@mui/material";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import BasicCard from "../BasicCard";
import { formatCompact } from "./formatters";
import style from "./WealthDigest.module.scss";

interface AllocationSlice {
  key: string;
  label: string;
  value: number;
  pct: number;
}

interface AllocationDonutProps {
  slices: AllocationSlice[];
  totalCurrentValue: number;
}

// Reuse the app-wide allocation palette from GlobalSummary so the donut and
// GlobalSummary's allocation bar always match. Fixed hue order per the
// dataviz skill's categorical rule (assign in order, never cycled).
const ALLOCATION_COLORS: Record<string, string> = {
  stocks: "#4a9eff",
  mf: "#9c27b0",
  nps: "#ff9800",
  epf: "#4caf50",
  ppf: "#00bcd4",
  gold: "#ffd700",
};

/**
 * Allocation-by-asset-type donut. Reuses the existing MSNContext-derived
 * allocation slices (WealthDigest.tsx passes them in) so the donut and the
 * page's own tile derivations never disagree.
 *
 * Rendering rules from the dataviz skill:
 * - Categorical palette (identity across 6 asset types), fixed hue order
 * - Legend + direct-label capable: we render a compact legend row below
 *   the ring since ≥2 series are on screen
 * - No inner label (the hero number lives in the tile row above)
 * - Slice gap of 2px surface color between slices — WebKit's default pie
 *   rendering handles this via `paddingAngle`
 */
const AllocationDonut: React.FC<AllocationDonutProps> = ({
  slices,
  totalCurrentValue,
}) => {
  const hasData = slices.length > 0 && totalCurrentValue > 0;

  return (
    <BasicCard className={style.widgetCard}>
      <Box className={style.widgetHeader}>
        <Typography className={style.widgetTitle} component="h3">
          Allocation
        </Typography>
        <Typography className={style.widgetSubtitle} component="span">
          By asset type
        </Typography>
      </Box>
      <Box className={style.widgetBody}>
        {!hasData ? (
          <Box className={style.widgetPlaceholder}>
            Load some holdings on the Investments page to see allocation.
          </Box>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={78}
                  paddingAngle={2}
                  stroke="none"
                >
                  {slices.map((s) => (
                    <Cell
                      key={s.key}
                      fill={ALLOCATION_COLORS[s.key] || "#7a7d85"}
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    background: "#1a2530",
                    border: "1px solid #29384D",
                    color: "#FAFAFA",
                    fontSize: 12,
                  }}
                  formatter={(v: number, _n, entry) => [
                    `₹${formatCompact(v)} · ${(
                      (entry.payload as AllocationSlice).pct
                    ).toFixed(1)}%`,
                    (entry.payload as AllocationSlice).label,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <Box className={style.donutLegend}>
              {slices.map((s) => (
                <Box key={s.key} className={style.donutLegendRow}>
                  <Box
                    className={style.donutLegendSwatch}
                    sx={{
                      backgroundColor: ALLOCATION_COLORS[s.key] || "#7a7d85",
                    }}
                    aria-hidden
                  />
                  <Typography
                    className={style.donutLegendLabel}
                    component="span"
                  >
                    {s.label}
                  </Typography>
                  <Typography
                    className={style.donutLegendValue}
                    component="span"
                  >
                    {s.pct.toFixed(1)}%
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Box>
    </BasicCard>
  );
};

export default AllocationDonut;
