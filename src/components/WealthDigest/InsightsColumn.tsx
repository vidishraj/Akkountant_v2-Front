import React from "react";
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
 * FE-6 (ak-jhy8) Right-side widget column — trend chart + allocation donut.
 * MUI Box dropped; plain div with Nocturne tokens.
 */
const InsightsColumn: React.FC<InsightsColumnProps> = ({
    allocationSlices,
    totalCurrentValue,
}) => {
    return (
        <div className={style.insightsColumn}>
            <PortfolioTrendChart days={90}/>
            <AllocationDonut
                slices={allocationSlices}
                totalCurrentValue={totalCurrentValue}
            />
        </div>
    );
};

export default InsightsColumn;
