import React from 'react';
import {Select, MenuItem, FormControl, InputLabel} from '@mui/material';

interface SortedByProps {
    columns: string[];
    column: any;
    columnSetter: (state: string) => void;
    order: any;
    orderSetter: (state: "desc" | "asc") => void;
}

const selectSx = {
    color: "#FAFAFA",
    fontSize: "0.8rem",
    "& .MuiSelect-select": {
        padding: "6px 12px",
    },
    "& .MuiOutlinedInput-notchedOutline": {
        borderColor: "#2a3a50",
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
        borderColor: "#3a4f6a",
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
        borderColor: "#7b68ee",
    },
};

const labelSx = {
    color: "#8b8b8b",
    fontSize: "0.8rem",
    "&.Mui-focused": {color: "#7b68ee"},
};

const menuItemSx = {
    color: "#FAFAFA",
    backgroundColor: "#1a2730",
    fontSize: "0.8rem",
    "&:hover": {backgroundColor: "#243340"},
    "&.Mui-selected": {backgroundColor: "#29384D"},
    "&.Mui-selected:hover": {backgroundColor: "#243340"},
};

const SortedBy: React.FC<SortedByProps> = ({columns, column, columnSetter, order, orderSetter}) => {

    const handleSortChange = (event: any) => {
        columnSetter(event.target.value as string);
    };

    const handleOrderChange = (event: any) => {
        orderSetter(event.target.value as 'asc' | 'desc');
    };

    return (
        <div style={{display: 'flex', gap: '0.5rem'}}>
            <FormControl size="small" sx={{minWidth: 100}}>
                <InputLabel sx={labelSx}>Sort By</InputLabel>
                <Select
                    value={column}
                    onChange={handleSortChange}
                    label="Sort By"
                    sx={selectSx}
                    MenuProps={{
                        PaperProps: {sx: {backgroundColor: "#1a2730", border: "1px solid #2a3a50"}},
                        sx: {"& .MuiMenu-list": {padding: 0}},
                    }}
                >
                    {columns.map((col, index) => (
                        <MenuItem key={index} value={col} sx={menuItemSx}>
                            {col.charAt(0).toUpperCase() + col.slice(1)}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <FormControl size="small" sx={{minWidth: 110}}>
                <InputLabel sx={labelSx}>Order</InputLabel>
                <Select
                    value={order}
                    onChange={handleOrderChange}
                    label="Order"
                    sx={selectSx}
                    MenuProps={{
                        PaperProps: {sx: {backgroundColor: "#1a2730", border: "1px solid #2a3a50"}},
                        sx: {"& .MuiMenu-list": {padding: 0}},
                    }}
                >
                    <MenuItem value="asc" sx={menuItemSx}>Ascending</MenuItem>
                    <MenuItem value="desc" sx={menuItemSx}>Descending</MenuItem>
                </Select>
            </FormControl>
        </div>
    );
};

export default SortedBy;
