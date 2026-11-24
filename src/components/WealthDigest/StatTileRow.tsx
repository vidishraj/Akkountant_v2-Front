import React, {ReactNode} from "react";
import style from "./WealthDigest.module.scss";

interface StatTileRowProps {
    children: ReactNode;
}

/**
 * ak-x1i5: auto-fit KPI grid (min 160px per tile); the hero tile spans two
 * columns above 560px, per the design.
 */
const StatTileRow: React.FC<StatTileRowProps> = ({children}) => {
    return <section className={style.tileRow}>{children}</section>;
};

export default StatTileRow;
