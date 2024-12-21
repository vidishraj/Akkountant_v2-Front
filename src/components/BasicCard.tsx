import {Card} from "@mui/material";
import React, {CSSProperties} from "react";

interface IBasicCard {
    style?: CSSProperties;
    children?: any;
    className?: string;
    onClick?: () => void;
    ref?: any
}

const BasicCard: React.FC<IBasicCard> = (props) => {
    const {style} = props;
    return (<Card onClick={props.onClick} className={props.className} style={style} ref={props.ref}>
        {props.children}
    </Card>)
}


export default BasicCard;