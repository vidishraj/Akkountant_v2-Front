import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import BasicCard from "../BasicCard";
import {
  PortfolioTrendPoint,
  fetchPortfolioTrend,
} from "../../services/wealthDigestService";
import { formatCompact } from "./formatters";
import style from "./WealthDigest.module.scss";

interface PortfolioTrendChartProps {
  days?: number;
}

/**
 * 30-day rolling portfolio-value line chart — Wave 3 deferred item from
 * Overseer's Q3 decision. Data source is a new backend endpoint that
 * doesn't exist yet (P3 follow-up bead recommended); the fetcher returns
 * [] on 404 so we render a placeholder rather than an error state.
 *
 * Chart specs follow the dataviz skill's mark conventions:
 * - Single-series line (single hue, no legend needed — title carries identity)
 * - 2px stroke, round join/cap
 * - Marker at ≥8px on hover (default recharts activeDot)
 * - Hairline recessive gridlines (dashArray removed intentionally — dashed
 *   grids read as noise; the skill's mark spec says solid hairline)
 * - Y-axis compacted (₹1.2L, ₹3.4L) via formatCompact helper
 * - Tooltip on hover — the crosshair+tooltip pattern the skill calls out
 *   for time-series
 */
const PortfolioTrendChart: React.FC<PortfolioTrendChartProps> = ({ days = 30 }) => {
  const [points, setPoints] = useState<PortfolioTrendPoint[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPortfolioTrend(days)
      .then((p) => {
        if (!cancelled) setPoints(p);
      })
      .catch(() => {
        // Any non-404 error: keep points null → placeholder message.
        if (!cancelled) setPoints([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  return (
    <BasicCard className={style.widgetCard}>
      <Box className={style.widgetHeader}>
        <Typography className={style.widgetTitle} component="h3">
          Portfolio value
        </Typography>
        <Typography className={style.widgetSubtitle} component="span">
          Last {days} days
        </Typography>
      </Box>
      <Box className={style.widgetBody}>
        {loading ? (
          <Box className={style.widgetPlaceholder}>Loading…</Box>
        ) : !points || points.length < 2 ? (
          <Box className={style.widgetPlaceholder}>
            Trend data not yet available.
            <br />
            <Typography
              component="span"
              className={style.widgetPlaceholderHint}
            >
              (backend snapshot-history endpoint pending)
            </Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={points}
              margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
            >
              <CartesianGrid stroke="#29384D" strokeWidth={1} />
              <XAxis
                dataKey="date"
                stroke="#7a7d85"
                fontSize={11}
                tick={{ fill: "#7a7d85" }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis
                stroke="#7a7d85"
                fontSize={11}
                tick={{ fill: "#7a7d85" }}
                tickFormatter={(v) => `₹${formatCompact(Number(v))}`}
                width={64}
              />
              <RechartsTooltip
                contentStyle={{
                  background: "#1a2530",
                  border: "1px solid #29384D",
                  color: "#FAFAFA",
                  fontSize: 12,
                }}
                formatter={(v: number) => [`₹${formatCompact(v)}`, "Portfolio"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#4A90E2"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 5, fill: "#4A90E2", stroke: "#1a2530", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Box>
    </BasicCard>
  );
};

export default PortfolioTrendChart;
