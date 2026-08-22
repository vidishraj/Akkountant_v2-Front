import React from "react";
import { Box } from "@mui/material";
import PortfolioTrendChart from "./PortfolioTrendChart";
import AllocationDonut from "./AllocationDonut";
import style from "./WealthDigest.module.scss";

interface AllocationSlice {
  key: string;
  label: string;
  value: number;
  pct: number;
}

interface InsightsColumnProps {
  allocationSlices: AllocationSlice[];
  totalCurrentValue: number;
}

/**
 * Right-side widget column that fills the dead space Overseer flagged in
 * Wave 2. Contains the two data widgets — trend chart on top, allocation
 * donut below. At tablet-and-narrower widths, the page shell drops this
 * column beneath the digest column via SCSS grid rearrangement.
 */
const InsightsColumn: React.FC<InsightsColumnProps> = ({
  allocationSlices,
  totalCurrentValue,
}) => {
  return (
    <Box className={style.insightsColumn}>
      <PortfolioTrendChart days={30} />
      <AllocationDonut
        slices={allocationSlices}
        totalCurrentValue={totalCurrentValue}
      />
    </Box>
  );
};

export default InsightsColumn;
