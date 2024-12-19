import React from "react";
import {styled} from "@mui/material/styles";
import {Switch, SwitchProps, Box} from "@mui/material";

import GmailIcon from "../../assets/icons/gmail.png"; // Update with actual path
import GoogleDriveIcon from "../../assets/icons/google-drive.png";
import {useFilterContext} from "../../contexts/FilterContext.tsx"; // Update with actual path

interface CustomSwitchProps extends SwitchProps {
    setChecked: any;
}

const StyledSwitch = styled(Switch)(({theme}) => ({
    width: 62,
    height: 34,
    padding: 7,
    "& .MuiSwitch-switchBase": {
        padding: 0,
        margin: 2,
        transitionDuration: "300ms",
        "&.Mui-checked": {
            transform: "translateX(28px)",
            "& + .MuiSwitch-track": {
                backgroundColor: theme.palette.mode === "dark" ? "#2ECA45" : "#65C466",
                opacity: 1,
            },
        },
    },
    "& .MuiSwitch-thumb": {
        boxSizing: "border-box",
        width: 30,
        height: 30,
    },
    "& .MuiSwitch-track": {
        borderRadius: 20 / 2,
        backgroundColor: theme.palette.mode === "dark" ? "#39393D" : "#E9E9EA",
        opacity: 1,
        transition: theme.transitions.create(["background-color"], {
            duration: 500,
        }),
    },
}));

const CustomIconSwitch: React.FC<CustomSwitchProps> = ({
                                                           setChecked,
                                                           onChange,
                                                           ...rest
                                                       }) => {
    const {dispatch} = useFilterContext()
    return (
        <Box display="flex" alignItems="center" gap={1}>
            <StyledSwitch
                defaultChecked={true}
                {...rest}
                onChange={(item) => {
                    const target = !item.target.checked ? "email" : 'statement'
                    dispatch({
                        type: "SET_SOURCE",
                        payload: target
                    })
                    setChecked()
                }}
                icon={<img src={GmailIcon} alt="Gmail" style={{width: 30, height: 30}}/>}
                checkedIcon={<img src={GoogleDriveIcon} alt="Google Drive" style={{width: 30, height: 30}}/>}
            />
        </Box>
    );
};

export default CustomIconSwitch;
