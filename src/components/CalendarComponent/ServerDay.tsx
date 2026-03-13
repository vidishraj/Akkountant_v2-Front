import React from "react";
import {Dayjs} from "dayjs";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import {PickersDay, PickersDayProps} from "@mui/x-date-pickers/PickersDay";
import Tooltip from "@mui/material/Tooltip";

export const BANK_COLORS: Record<string, string> = {
    HDFC_DEBIT: "#1a73e8",
    Millenia_Credit: "#e91e63",
    HDFC_REGALIA: "#9c27b0",
    ICICI_AMAZON_PAY: "#ff9800",
    YES_BANK_DEBIT: "#00bcd4",
    YES_BANK_ACE: "#009688",
    BOI: "#4caf50",
};

//@ts-ignore
export interface ServerDayProps extends PickersDayProps<Dayjs> {
    transactionDays: number[];
    statementDays: number[];
    coverageMap: Record<number, string[]>;
    onClick?: (day: Dayjs) => void;
}

export function ServerDay({
                              transactionDays = [],
                              statementDays = [],
                              coverageMap = {},
                              day,
                              outsideCurrentMonth,
                              onClick,
                              ...other
                          }: ServerDayProps): React.JSX.Element {
    const isTransactionDay = !outsideCurrentMonth && transactionDays.includes(day.date());
    const isStatementDay = !outsideCurrentMonth && statementDays.includes(day.date());
    const banks = (!outsideCurrentMonth && coverageMap[day.date()]) || [];
    const isCovered = banks.length > 0;

    const handleClick = () => {
        if (onClick && !outsideCurrentMonth) onClick(day);
    };

    const bankDots = isCovered ? (
        <Tooltip
            title={banks.map(b => b.replace(/_/g, " ")).join(", ")}
            arrow
            placement="top"
        >
            <Box sx={{
                position: "absolute",
                bottom: 2,
                display: "flex",
                gap: "2px",
                justifyContent: "center",
            }}>
                {banks.slice(0, 4).map((bank) => (
                    <Box
                        key={bank}
                        sx={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            backgroundColor: BANK_COLORS[bank] || "#888",
                        }}
                    />
                ))}
            </Box>
        </Tooltip>
    ) : null;

    return (
        <Box
            sx={{position: "relative", display: "flex", justifyContent: "center"}}
            onClick={handleClick}
        >
            <PickersDay
                {...other}
                day={day}
                outsideCurrentMonth={outsideCurrentMonth}
                sx={{
                    color: outsideCurrentMonth ? "#888888" : "#FAFAFA",
                    backgroundColor: isCovered ? "rgba(76, 175, 80, 0.1)" : "transparent",
                    "&.Mui-selected": {
                        backgroundColor: "#4CAF50",
                        color: "#FAFAFA",
                    },
                    "&:hover": {
                        backgroundColor: isCovered ? "rgba(76, 175, 80, 0.25)" : undefined,
                    },
                }}
            />
            <Box sx={{position: "absolute"}}>
                {isTransactionDay && <Badge overlap="circular" badgeContent="💰" color="primary"/>}
                {isStatementDay && <Badge overlap="circular" badgeContent="📄" color="secondary"/>}
            </Box>
            {bankDots}
        </Box>
    );
}
