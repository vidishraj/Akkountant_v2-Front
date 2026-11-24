import React, {CSSProperties} from "react";
import {getBankIcon} from "../utils/util.tsx";
import {bankMonogram, bankName} from "../utils/bankLabels.ts";
import style from "./BankIcon.module.scss";

type BankIconProps = {
    bankKey: string;
    altText?: string;
    width?: number; // Optional: to customize icon size
    height?: number; // Optional: to customize icon size
    style?: CSSProperties;
};

/**
 * Bank logo, or (ak-5aw4) a token-styled monogram for banks without a logo
 * asset (e.g. the ak-iu8i banks), instead of the old "Unknown Bank" text.
 */
const BankIcon: React.FC<BankIconProps> = ({bankKey, altText, width, height, style: extra}) => {
    const iconSrc = getBankIcon(bankKey);
    const label = bankName(bankKey);

    if (!iconSrc) {
        const size = width ?? height ?? 28;
        return (
            <span
                className={style.monogram}
                style={{width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.36)), ...extra}}
                title={label}
                role="img"
                aria-label={label}
            >
                {bankMonogram(bankKey)}
            </span>
        );
    }

    return <img src={iconSrc} alt={altText ?? label}
                style={{width: width, height: height, borderRadius: '50%', backgroundColor: 'white', ...extra}}/>;
};

export default BankIcon;
