import React from "react";
import {IconButton, Tooltip} from "@mui/material";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";

interface ClearFilterButtonProps {
    apply: () => void; // Function to be called on button click
}

const ClearFilterButton: React.FC<ClearFilterButtonProps> = ({apply}) => {
    return (
        <Tooltip title="Clear Filters">
            <IconButton
                onClick={apply}
                aria-label="clear-filters"
                sx={{
                    backgroundColor: "#121c24",
                    color: "#FAFAFA",
                    border: "0.px #FAFAFA solid",
                    "&:hover": {
                        backgroundColor: "#FAFAFA",
                        color: "#121C24",
                    },
                    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
                    borderRadius: "50%",
                }}
            >
                <FilterAltOffIcon/>
            </IconButton>
        </Tooltip>
    );
};

export default ClearFilterButton;
