import React from "react";
import {Dayjs} from "dayjs";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import {PickersDay, PickersDayProps} from "@mui/x-date-pickers/PickersDay";

//@ts-ignore
export interface ServerDayProps extends PickersDayProps<Dayjs> {
    transactionDays: number[];
    statementDays: number[];
    onClick?: (day: Dayjs) => void;
}

export function ServerDay({
                              transactionDays = [],
                              statementDays = [],
                              day,
                              outsideCurrentMonth,
                              onClick,
                              ...other
                          }: ServerDayProps): React.JSX.Element {
    const isTransactionDay = !outsideCurrentMonth && transactionDays.includes(day.date());
    const isStatementDay = !outsideCurrentMonth && statementDays.includes(day.date());

    const handleClick = () => {
        if (onClick && !outsideCurrentMonth) onClick(day);
    };

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
                    "&.Mui-selected": {
                        backgroundColor: "#4CAF50",
                        color: "#FAFAFA",
                    },
                }}
            />
            <Box sx={{position: "absolute"}}>
                {isTransactionDay && <Badge overlap="circular" badgeContent="💰" color="primary"/>}
                {isStatementDay && <Badge overlap="circular" badgeContent="📄" color="secondary"/>}
            </Box>
        </Box>
    );
}