import React from "react";
import {getLast5Months} from "../utils/util.tsx";
import {useFilterContext} from "../contexts/FilterContext.tsx";
import {FormControlLabel, Switch} from "@mui/material";
import {styled} from "@mui/system";
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import {renderToStaticMarkup} from "react-dom/server";

const SearchFilterCompact = (props: any) => {
    const {state, dispatch} = useFilterContext();
    const {searchTerm, startDate, endDate, bank, month} = state;
    const bankOptions = ["Option 1", "Option 2", "Option 3"];
    const months = getLast5Months();

    return (
        <div style={styles.container}>
            {/* Search Field */}
            <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => dispatch({
                    type: 'SET_SEARCH_TERM',
                    payload: e.target.value,
                })}
                style={styles.input}
            />

            {/* Date Range and Dropdowns */}
            <div style={styles.row}>
                <FormControlLabel
                    control={<MaterialUISwitch sx={{m: 1}} defaultChecked/>}
                    label={""}
                />
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => dispatch({
                        type: 'SET_START_DATE',
                        payload: e.target.value,
                    })}
                    style={styles.dateInput}
                />
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => dispatch({
                        type: 'SET_END_DATE',
                        payload: e.target.value,
                    })}
                    style={styles.dateInput}
                />
                <select
                    value={bank}
                    onChange={(e) => dispatch({
                        type: 'SET_BANK',
                        payload: e.target.value,
                    })}
                    style={styles.select}
                >
                    <option value="" disabled>
                        Bank
                    </option>
                    {bankOptions.map((option, idx) => (
                        <option key={idx} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
                <select
                    value={month}
                    onChange={(e) => dispatch({
                        type: 'SET_MONTH',
                        payload: e.target.value,
                    })}
                    style={styles.select}
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
                <button
                    onClick={() => {
                        props.apply();
                    }
                    }
                    style={styles.button}
                >
                    Apply
                </button>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "8px",
        border: "1px solid #ccc",
        borderRadius: "8px",
        // maxWidth: "600px",
        margin: "0 auto",
        fontSize: "14px",
    },
    row: {
        display: "flex",
        flexWrap: 'wrap',
        alignItems: "center",
        gap: "5px",
    },
    input: {
        flex: 1,
        padding: "6px",
        fontSize: "14px",
        border: "1px solid #ccc",
        borderRadius: "4px",
    },
    dateInput: {
        padding: "6px",
        fontSize: "14px",
        border: "1px solid #ccc",
        borderRadius: "4px",
    },
    select: {
        padding: "6px",
        fontSize: "14px",
        border: "1px solid #ccc",
        borderRadius: "4px",
    },
    button: {
        padding: "6px 12px",
        fontSize: "14px",
        backgroundColor: "#007bff",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
    },
};
const mailIconSvg = encodeURIComponent(renderToStaticMarkup(<MailOutlineIcon/>));
const quoteIconSvg = encodeURIComponent(renderToStaticMarkup(<RequestQuoteIcon/>));

const MaterialUISwitch = styled(Switch)(({theme}) => ({
    width: 55,
    height: 34,
    padding: 7,
    '& .MuiSwitch-switchBase': {
        margin: 1,
        padding: 0,
        transform: 'translateX(6px)',
        '&.Mui-checked': {
            color: '#fff',
            transform: 'translateX(22px)',
            '& .MuiSwitch-thumb:before': {
                content: "''",
                position: 'absolute',
                width: '100%',
                height: '100%',
                left: 0,
                top: 0,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                backgroundImage: `url('data:image/svg+xml;utf8,${mailIconSvg}')`, // Mail icon
            },
            '& + .MuiSwitch-track': {
                opacity: 1,
                backgroundColor: '#aab4be',
                ...theme.applyStyles('dark', {
                    backgroundColor: '#8796A5',
                }),
            },
        },
    },
    '& .MuiSwitch-thumb': {
        backgroundColor: '#001e3c',
        width: 32,
        height: 32,
        '&::before': {
            content: "''",
            position: 'absolute',
            width: '100%',
            height: '100%',
            left: 0,
            top: 0,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundImage: `url('data:image/svg+xml;utf8,${quoteIconSvg}')`, // Quote icon
        },
        ...theme.applyStyles('dark', {
            backgroundColor: '#003892',
        }),
    },
    '& .MuiSwitch-track': {
        opacity: 1,
        backgroundColor: '#aab4be',
        borderRadius: 20 / 2,
        ...theme.applyStyles('dark', {
            backgroundColor: '#8796A5',
        }),
    },
}));
export default SearchFilterCompact;
