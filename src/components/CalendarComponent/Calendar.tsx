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
import {ServerDay, ServerDayProps, BANK_COLORS} from "./ServerDay.tsx";
import Box from "@mui/material/Box";


export default function DateCalendarWithBadges(): React.JSX.Element {
    const [isLoading, setIsLoading] = React.useState(false);
    const [transactionDays, setTransactionDays] = React.useState<number[]>([]);
    const [statementDays, setStatementDays] = React.useState<number[]>([]);
    const [coverageMap, setCoverageMap] = React.useState<Record<number, string[]>>({});
    const {dispatch} = useFilterContext();
    const {dispatch: statementDispatch} = useFileFilterContext();

    const fetchHighlightedDays = async (startDate: string, endDate: string) => {
        setIsLoading(true);
        try {
            const {transaction_dates, statement_dates, covered_periods} = await fetchCalendarTransactions({
                monthStart: startDate,
                monthEnd: endDate,
            });
            setTransactionDays(transaction_dates.map((item: string) => dayjs(item).date()));
            setStatementDays(statement_dates.map((item: string) => dayjs(item).date()));

            // Build a map of day -> banks[] for coverage visualization
            if (covered_periods && covered_periods.length > 0) {
                const monthStart = dayjs(startDate);
                const monthEnd = dayjs(endDate);
                const map: Record<number, Set<string>> = {};
                for (const period of covered_periods) {
                    const pStart = dayjs(period.period_start);
                    const pEnd = dayjs(period.period_end);
                    const start = pStart.isBefore(monthStart) ? monthStart : pStart;
                    const end = pEnd.isAfter(monthEnd) ? monthEnd : pEnd;
                    let cur = start;
                    while (cur.isBefore(end) || cur.isSame(end, 'day')) {
                        const d = cur.date();
                        if (!map[d]) map[d] = new Set();
                        map[d].add(period.bank);
                        cur = cur.add(1, 'day');
                    }
                }
                const result: Record<number, string[]> = {};
                for (const [day, banks] of Object.entries(map)) {
                    result[Number(day)] = Array.from(banks);
                }
                setCoverageMap(result);
            } else {
                setCoverageMap({});
            }
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

    // Collect unique banks visible in this month's coverage
    const visibleBanks = React.useMemo(() => {
        const banks = new Set<string>();
        for (const dayBanks of Object.values(coverageMap)) {
            for (const bank of dayBanks) banks.add(bank);
        }
        return Array.from(banks);
    }, [coverageMap]);

    // Bank filter: when empty, show all; otherwise show only selected banks
    const [selectedBanks, setSelectedBanks] = React.useState<Set<string>>(new Set());

    const toggleBank = (bank: string) => {
        setSelectedBanks(prev => {
            const next = new Set(prev);
            if (next.has(bank)) {
                next.delete(bank);
            } else {
                next.add(bank);
            }
            return next;
        });
    };

    // Filter the coverageMap based on selected banks
    const filteredCoverageMap = React.useMemo(() => {
        if (selectedBanks.size === 0) return coverageMap;
        const filtered: Record<number, string[]> = {};
        for (const [day, banks] of Object.entries(coverageMap)) {
            const matching = banks.filter(b => selectedBanks.has(b));
            if (matching.length > 0) {
                filtered[Number(day)] = matching;
            }
        }
        return filtered;
    }, [coverageMap, selectedBanks]);

    // @ts-ignore
    return (
        <BasicCard style={{width: "fit-content", backgroundColor: "inherit", boxShadow: "none"}}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DateCalendar
                    maxDate={lastDayOfCurrentMonth}
                    sx={{
                        backgroundColor: "inherit",
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
                            coverageMap: filteredCoverageMap,
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
            {visibleBanks.length > 0 && (
                <Box sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                    padding: "4px 10px 8px",
                    justifyContent: "center",
                }}>
                    {visibleBanks.map((bank) => {
                        const isActive = selectedBanks.size === 0 || selectedBanks.has(bank);
                        const color = BANK_COLORS[bank] || "#888";
                        return (
                            <Box
                                key={bank}
                                onClick={() => toggleBank(bank)}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    padding: "3px 10px",
                                    borderRadius: "6px",
                                    border: `1px solid ${isActive ? color : "#333"}`,
                                    backgroundColor: isActive ? `${color}20` : "#29384D",
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    opacity: isActive ? 1 : 0.5,
                                    "&:hover": {
                                        borderColor: color,
                                        backgroundColor: `${color}30`,
                                        opacity: 1,
                                    },
                                }}
                            >
                                <Box sx={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: "50%",
                                    backgroundColor: color,
                                    flexShrink: 0,
                                }}/>
                                <span style={{
                                    color: isActive ? "#FAFAFA" : "#b0b0b0",
                                    fontSize: "0.65rem",
                                    whiteSpace: "nowrap",
                                    userSelect: "none",
                                }}>
                                    {bank.replace(/_/g, " ")}
                                </span>
                            </Box>
                        );
                    })}
                </Box>
            )}
        </BasicCard>
    );
}
