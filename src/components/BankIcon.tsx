import React from "react";
import {getBankIcon} from "../utils/util.tsx";

type BankIconProps = {
    bankKey: string;
    altText?: string;
    width?: number; // Optional: to customize icon size
    height?: number; // Optional: to customize icon size
};

const BankIcon: React.FC<BankIconProps> = ({bankKey, altText = "Bank Icon", width, height}) => {
    const iconSrc = getBankIcon(bankKey);

    if (!iconSrc) {
        return <span>Unknown Bank</span>; // Graceful fallback if the bank is not found
    }

    return <img src={iconSrc} alt={altText}
                style={{width: width, height: height, borderRadius: '50%', backgroundColor: 'white'}}/>;
};

export default BankIcon;
