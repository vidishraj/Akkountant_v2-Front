import BasicCard from "../BasicCard.tsx";
import {IconButton} from "@mui/material";
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import {useUser} from "../../contexts/GlobalContext.tsx";

const FieldSelector = ({setTransactionMode}: { setTransactionMode: any }) => {
    const {transactionModeSelection} = useUser()
    return (<BasicCard
        style={{
            padding: '12px 12px',
            backgroundColor: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-evenly'
        }}>
        <IconButton style={{backgroundColor: !transactionModeSelection ? '#3d404a' : '#607AFB',}}
                    onClick={() => setTransactionMode(true)}>
            <ReceiptLongIcon style={{color: "#FAFAFA"}}/>
        </IconButton>
        <IconButton style={{backgroundColor: transactionModeSelection ? '#3d404a' : '#607AFB'}}
                    onClick={() => setTransactionMode(false)}>
            <DriveFileMoveIcon style={{color: "#FAFAFA"}}/>
        </IconButton>
    </BasicCard>)
}

export default FieldSelector;