import {useEffect, useCallback} from "react";
import {debounce} from "lodash";
import {useFileFilterContext} from "../../contexts/FileFilterContext.tsx";
import {useUser} from "../../contexts/GlobalContext.tsx";
import styles from "./FileFilterCompact.module.scss";
import {IconButton} from "@mui/material";
import DragHandleIcon from "@mui/icons-material/DragHandle";

const FileFilterCompact = ({apply, isMobile, setDrawerState}: {
    apply: () => void,
    isMobile: boolean,
    setDrawerState: any
}) => {
    const {state, dispatch} = useFileFilterContext();
    const {fileName, startDate, endDate, bank} = state;
    const {optedBanks} = useUser();

    const fetchData = useCallback(() => {
        apply();
    }, [startDate, endDate, bank, fileName]);

    const debouncedFetchData = useCallback(debounce(fetchData, 500), [fetchData]);

    // Trigger debounced fetch when the state changes
    useEffect(() => {
        debouncedFetchData();
        return () => debouncedFetchData.cancel(); // Cleanup on unmount or dependency change
    }, [debouncedFetchData]);
    return (
        <div className={styles.container}>
            <div className={`${styles.group} ${styles.single}`}>
                {
                    isMobile &&
                    <IconButton style={{border: '0.4px solid white'}} onClick={setDrawerState}> <DragHandleIcon
                        style={{color: 'white'}}/></IconButton>
                }
                <input
                    type="text"
                    placeholder="File Name"
                    value={fileName}
                    onChange={(e) =>
                        dispatch({
                            type: "SET_FILE_NAME",
                            payload: e.target.value,
                        })
                    }
                    className={styles.input}
                />
            </div>

            <div className={`${styles.group} ${styles.single}`}>
                <select
                    value={bank}
                    onChange={(e) =>
                        dispatch({
                            type: "SET_BANK",
                            payload: e.target.value,
                        })
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
            </div>
            <div className={`${styles.group} ${styles.double}`}>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) =>
                        dispatch({
                            type: "SET_START_DATE",
                            payload: e.target.value,
                        })
                    }
                    className={styles.dateInput}
                />

                <input
                    type="date"
                    value={endDate}
                    onChange={(e) =>
                        dispatch({
                            type: "SET_END_DATE",
                            payload: e.target.value,
                        })
                    }
                    className={styles.dateInput}
                />

            </div>
        </div>
    );
};

export default FileFilterCompact;
