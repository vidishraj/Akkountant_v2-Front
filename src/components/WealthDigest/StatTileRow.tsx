import React, {ReactNode} from "react";
import style from "./WealthDigest.module.scss";

interface StatTileRowProps {
    children: ReactNode;
}

/**
 * FE-6 (ak-jhy8) Nocturne-skinned KPI row container.
 * Layout still driven by `.tileRow` in WealthDigest.module.scss (CSS Grid
 * with 5/2/1-across breakpoints per the Overseer-locked Q3).
 */
const StatTileRow: React.FC<StatTileRowProps> = ({children}) => {
    return <div className={style.tileRow}>{children}</div>;
};

export default StatTileRow;
