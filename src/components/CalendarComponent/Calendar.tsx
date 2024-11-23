import React from "react";
import dayjs, {Dayjs} from "dayjs";
import {AdapterDayjs} from "@mui/x-date-pickers/AdapterDayjs";
import {LocalizationProvider} from "@mui/x-date-pickers/LocalizationProvider";
import {PickersDayProps} from "@mui/x-date-pickers/PickersDay";
import {DateCalendar} from "@mui/x-date-pickers/DateCalendar";
import {DayCalendarSkeleton} from "@mui/x-date-pickers/DayCalendarSkeleton";
import BasicCard from "../BasicCard.tsx";
import {fetchCalendarTransactions} from "../../services/transactionService.ts";
import {useFilterContext} from "../../contexts/FilterContext.tsx";
import {useFileFilterContext} from "../../contexts/FileFilterContext.tsx";
import {ServerDay, ServerDayProps} from "./ServerDay.tsx";


export default function DateCalendarWithBadges(): React.JSX.Element {
    const [isLoading, setIsLoading] = React.useState(false);
    const [transactionDays, setTransactionDays] = React.useState<number[]>([]);
    const [statementDays, setStatementDays] = React.useState<number[]>([]);
    const {dispatch} = useFilterContext();
    const {dispatch: statementDispatch} = useFileFilterContext();

    const fetchHighlightedDays = async (startDate: string, endDate: string) => {
        setIsLoading(true);
        try {
            const {transaction_dates, statement_dates} = await fetchCalendarTransactions({
                monthStart: startDate,
                monthEnd: endDate,
            });
            setTransactionDays(transaction_dates.map((item: string) => dayjs(item).date()));
            setStatementDays(statement_dates.map((item: string) => dayjs(item).date()));
        } catch (error) {
            console.error("Error fetching calendar data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMonthChange = (date: Dayjs) => {
        fetchHighlightedDays(date.startOf("month").format("YYYY-MM-DD"), date.endOf("month").format("YYYY-MM-DD"));
    };

    const handleDateClick = (date: Dayjs) => {
        if (transactionDays.includes(date.date())) {
            dispatch({type: "SET_START_DATE", payload: date.format("YYYY-MM-DD")});
            dispatch({type: "SET_END_DATE", payload: date.format("YYYY-MM-DD")});
        }
        if (statementDays.includes(date.date())) {
            statementDispatch({type: "SET_START_DATE", payload: date.format("YYYY-MM-DD")});
            statementDispatch({type: "SET_END_DATE", payload: date.format("YYYY-MM-DD")});
        }
    };

    React.useEffect(() => {
        const now = dayjs();
        fetchHighlightedDays(now.startOf("month").format("YYYY-MM-DD"), now.endOf("month").format("YYYY-MM-DD"));
    }, []);

    const today = dayjs();
    const lastDayOfCurrentMonth = today.endOf("month");

    // @ts-ignore
    return (
        <BasicCard style={{width: "fit-content"}}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DateCalendar
                    maxDate={lastDayOfCurrentMonth}
                    sx={{
                        backgroundColor: "#121C24",
                        "& .MuiDayCalendar-weekDayLabel": {color: "#FAFAFA"},
                    }}
                    onMonthChange={handleMonthChange}
                    onYearChange={handleMonthChange}
                    onChange={handleDateClick}
                    loading={isLoading}
                    renderLoading={() => <DayCalendarSkeleton/>}
                    slots={{day: ServerDay as React.FC<PickersDayProps<Dayjs>>}}
                    slotProps={{
                        // @ts-ignore
                        day: {
                            transactionDays,
                            statementDays,
                            onClick: handleDateClick,
                        } as Partial<ServerDayProps>,
                        calendarHeader: {
                            sx: {
                                color: "#FAFAFA",
                                "& .MuiDayCalendar-weekDayLabel": {color: "blue", fontWeight: "bold"},
                            },
                        },
                        leftArrowIcon: {sx: {color: "#FAFAFA"}},
                        rightArrowIcon: {sx: {color: "#FAFAFA"}},
                        switchViewButton: {sx: {color: "#FAFAFA"}},
                        switchViewIcon: {sx: {color: "#FAFAFA"}},
                        yearButton: {sx: {color: "#FAFAFA"}},
                        monthButton: {sx: {color: "#FAFAFA"}},
                        nextIconButton: {sx: {color: "#FAFAFA"}},
                    }}
                />
            </LocalizationProvider>
        </BasicCard>
    );
}
