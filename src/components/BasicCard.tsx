import {Card} from "@mui/material";
import React, {CSSProperties} from "react";

interface IBasicCard {
    style?: CSSProperties;
    children?: any;
    className?: string;
    onClick?: () => void;
}

const BasicCard: React.FC<IBasicCard> = (props) => {
    const {style} = props;
    return (<Card onClick={props.onClick} className={props.className} style={style}>
        {props.children}
    </Card>)
}


export default BasicCard;