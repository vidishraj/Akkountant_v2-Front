import {ReactNode, useState} from "react";
import {IconButton} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import style from "./ExtendablePage.module.scss";
import {ExpandLess} from "@mui/icons-material";

const ExtendablePage = ({children}: { children: ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={`${style.page} ${isOpen ? style.open : ""}`}>
            <div className={style.contentInside}>
                {children}
            </div>
            {!isOpen ? (
                <IconButton
                    className={style.expandButton}
                    onClick={() => setIsOpen(true)}
                >
                    <ExpandMoreIcon/>
                </IconButton>
            ) : (
                <IconButton
                    className={style.expandButton}
                    onClick={() => setIsOpen(false)}
                >
                    <ExpandLess/>
                </IconButton>
            )}
        </div>
    );
};

export default ExtendablePage;
