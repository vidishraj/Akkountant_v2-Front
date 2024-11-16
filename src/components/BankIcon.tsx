import React from "react";
import {getBankIcon} from "../utils/util.tsx";

type BankIconProps = {
    bankKey: string;
    altText?: string;
    size?: number; // Optional: to customize icon size
};

const BankIcon: React.FC<BankIconProps> = ({bankKey, altText = "Bank Icon", size = 24}) => {
    const iconSrc = getBankIcon(bankKey);

    if (!iconSrc) {
        return <span>Unknown Bank</span>; // Graceful fallback if the bank is not found
    }

    return <img src={iconSrc} alt={altText} style={{width: size, height: size}}/>;
};

export default BankIcon;
