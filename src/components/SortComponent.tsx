import React from 'react';
import {Select, MenuItem, FormControl, InputLabel} from '@mui/material';

interface SortedByProps {
    columns: string[];
    column: any;
    columnSetter: (state: string) => void;
    order: any;
    orderSetter: (state: "desc" | "asc") => void;
}

const SortedBy: React.FC<SortedByProps> = ({columns, column, columnSetter, order, orderSetter}) => {

    const handleSortChange = (event: any) => {
        const column = event.target.value as string;
        columnSetter(column);

    };

    const handleOrderChange = (event: any) => {
        const newOrder = event.target.value as 'asc' | 'desc';
        orderSetter(newOrder);

    };

    return (
        <div style={{display: 'flex', color: "#FAFAFA", maxWidth: 'fit-content'}}>
            <FormControl
                style={{color: "#FAFAFA", borderLeft: '0.1px solid #FAFAFA', borderRight: '0.1px solid #FAFAFA'}}>
                <InputLabel style={{color: "#FAFAFA"}}>Sort By</InputLabel>
                <Select
                    MenuProps={{
                        sx: {"& .MuiMenu-list": {padding: 0, paddingTop: 0, paddingBottom: 0}}
                    }}
                    value={column} style={{color: "#FAFAFA"}}
                    onChange={handleSortChange}>
                    {columns.map((column, index) => (
                        <MenuItem style={{color: "#FAFAFA", backgroundColor: "#121c24"}} key={index}
                                  value={column}>
                            {column}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <FormControl
                style={{color: "#FAFAFA", borderLeft: '0.1px solid #FAFAFA', borderRight: '0.1px solid #FAFAFA'}}>
                
                <InputLabel style={{color: "#FAFAFA"}}>Order</InputLabel>
                <Select
                    MenuProps={{
                        sx: {"& .MuiMenu-list": {padding: 0, paddingTop: 0, paddingBottom: 0}}
                    }} style={{color: "#FAFAFA"}} value={order} onChange={handleOrderChange}>
                    <MenuItem style={{color: "#FAFAFA", backgroundColor: "#121c24"}} value="asc">Ascending</MenuItem>
                    <MenuItem style={{color: "#FAFAFA", backgroundColor: "#121c24"}}
                              value="desc">Descending</MenuItem>
                </Select>
            </FormControl>
        </div>
    );
};

export default SortedBy;
