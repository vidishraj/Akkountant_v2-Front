import {Card} from "@mui/material";
import React, {CSSProperties} from "react";

interface IBasicCard {
    style?: CSSProperties;
    children?: any;
    className?: string;
}

const BasicCard: React.FC<IBasicCard> = (props) => {
    const {style} = props;
    return (<Card className={props.className} style={style}>
        {props.children}
    </Card>)
}


export default BasicCard;