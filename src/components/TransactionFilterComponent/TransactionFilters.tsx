import {useEffect, useCallback} from "react";
import {debounce} from "lodash";
import {useFilterContext} from "../../contexts/FilterContext.tsx";
import {getFirstAndLastDateOfMonth, getLast5Months} from "../../utils/util.tsx";
import styles from "./TransactionFilter.module.scss";
import {useUser} from "../../contexts/GlobalContext.tsx";
import DragHandleIcon from '@mui/icons-material/DragHandle';
import {IconButton} from "@mui/material";

const SearchFilterCompact = ({apply, isMobile, setDrawerState}: {
    apply: () => void,
    isMobile: boolean,
    setDrawerState: any
}) => {
    const {state, dispatch} = useFilterContext();
    const {searchTerm, startDate, endDate, bank, month} = state;
    const {optedBanks} = useUser();
    const months = getLast5Months();

    // Update fetchData only when relevant state values change (use specific state properties instead of `state` directly)
    const fetchData = useCallback(() => apply(), [searchTerm, startDate, endDate, bank, month]);

    // Debounce the fetchData function
    const debouncedFetchData = useCallback(debounce(fetchData, 500), [fetchData]);

    // Trigger debounced fetch when the state changes
    useEffect(() => {
        debouncedFetchData();
        return () => debouncedFetchData.cancel(); // Cleanup on unmount or dependency change
    }, [debouncedFetchData]);

    const handleMonthChange = (value: string) => {
        const {firstDay, lastDay} = getFirstAndLastDateOfMonth(value);
        dispatch({type: "SET_START_DATE", payload: firstDay});
        dispatch({type: "SET_END_DATE", payload: lastDay});
        dispatch({type: "SET_MONTH", payload: value});
    };

    return (
        <div className={styles.container}>
            {/* First group: Search input */}
            <div className={`${styles.group} ${styles.single}`}>
                {
                    isMobile &&
                    <IconButton style={{border: '0.4px solid white'}} onClick={setDrawerState}> <DragHandleIcon
                        style={{color: 'white'}}/></IconButton>
                }
                <input
                    type="text"
                    placeholder="Search"
                    value={searchTerm}
                    onChange={(e) =>
                        dispatch({type: "SET_SEARCH_TERM", payload: e.target.value})
                    }
                    className={styles.input}
                />
            </div>

            {/* Second group: Start and End Date */}
            <div className={`${styles.group} ${styles.double}`}>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) =>
                        dispatch({type: "SET_START_DATE", payload: e.target.value})
                    }
                    className={styles.dateInput}
                />

                <input
                    type="date"
                    value={endDate}
                    onChange={(e) =>
                        dispatch({type: "SET_END_DATE", payload: e.target.value})
                    }
                    className={styles.dateInput}
                />
            </div>

            {/* Third group: Bank and Month */}
            <div className={`${styles.group} ${styles.double}`}>
                <select
                    value={bank}
                    onChange={(e) =>
                        dispatch({type: "SET_BANK", payload: e.target.value})
                    }
                    className={styles.select}
                >
                    <option value="" disabled>
                        Bank
                    </option>
                    {optedBanks.map((option, idx) => (
                        <option key={idx} value={option}>
                            {option.replace("_", " ")}
                        </option>
                    ))}
                </select>

                <select
                    value={month}
                    onChange={(e) => handleMonthChange(e.target.value)}
                    className={styles.select}
                >
                    <option value="" disabled>
                        Month
                    </option>
                    {months.map((option, idx) => (
                        <option key={idx} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );

};

export default SearchFilterCompact;
