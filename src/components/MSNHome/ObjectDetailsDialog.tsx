import React, {useState} from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Grid,
    Typography,
    IconButton,
    useMediaQuery,
    useTheme,
    Box, DialogActions, Button,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import CustomModal from "../InputDialogComponent/CustomModal.tsx";
import {insertEPG} from "../../services/investmentService.ts";
import {InsertEPGRequest} from "../../utils/interfaces.ts";
import {useMessage} from "../../contexts/MessageContext.tsx";

interface ObjectDetailsDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    data: Record<string, string | number | boolean>; // Accepts key-value pairs
}

const ObjectDetailsDialog: React.FC<ObjectDetailsDialogProps> = ({
                                                                     open,
                                                                     onClose,
                                                                     title,
                                                                     data,
                                                                 }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const {state, fetchAndSetUserSecurities, getServiceType, fetchAndSetSummary} = useMSNContext();
    const {setPayload} = useMessage()
    const [modalState, setModalState] = useState<boolean>(false)
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                style: {
                    padding: isMobile ? "16px" : "24px",
                    borderRadius: theme.shape.borderRadius,
                    backgroundColor: "#121C24",
                    color: "#FAFAFA"
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: isMobile ? "8px" : "16px",
                }}
            >
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: "bold",
                        textAlign: "center",
                        flexGrow: 1,
                        marginRight: isMobile ? 0 : "40px",
                    }}
                >
                    {title}
                </Typography>
                <IconButton
                    onClick={onClose}
                    sx={{
                        position: isMobile ? "absolute" : "static",
                        top: isMobile ? "8px" : "auto",
                        right: isMobile ? "8px" : "auto",
                    }}
                >
                    <CloseIcon/>
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "100%",
                        minHeight: isMobile ? "200px" : "300px",
                    }}
                >
                    <Grid container spacing={2} sx={{maxWidth: "100%"}}>
                        {Object.entries(data).map(([key, value]) => (
                            <React.Fragment key={key}>
                                <Grid item xs={6}>
                                    <Typography
                                        variant="subtitle2"
                                        sx={{
                                            fontWeight: "bold",
                                            color: "#FAFAFA",
                                            wordWrap: "break-word",
                                        }}
                                    >
                                        {key}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: "#FAFAFA",
                                            wordWrap: "break-word",
                                        }}
                                    >
                                        {String(value)}
                                    </Typography>
                                </Grid>
                            </React.Fragment>
                        ))}
                    </Grid>
                </Box>
                <CustomModal title={`Buy ${title}`}
                             open={modalState}
                             onCancel={() => setModalState(false)}
                             onSubmit={(formData: any) => {
                                 // Insert MF
                                 setModalState(false)
                                 const requestBody: InsertEPGRequest = {
                                     schemeCode: data['scheme_id'],
                                     date: formData.date,
                                     quantity: formData.quantity,
                                     amount: formData.nav
                                 };
                                 insertEPG("Mutual_Funds", requestBody).then((response) => {
                                     setPayload({
                                         type: 'success',
                                         message: response.data.Message,
                                     })
                                     fetchAndSetUserSecurities(true);
                                     fetchAndSetSummary(getServiceType(), true);
                                     onClose()
                                 }).catch(() => {
                                     setPayload({
                                         type: 'error',
                                         message: "Error occurred while inserting mutual fund"
                                     })
                                 })
                                 setModalState(false)
                             }}
                             cardType={"mf"}
                             maxNav={100}/>
            </DialogContent>
            {state.selectedCard.mf &&
                <DialogActions style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <Button style={{
                        backgroundColor: '#3d404a',
                        color: "#FAFAFA"
                    }} onClick={() => {
                        setModalState(true)
                    }}>Buy</Button>
                </DialogActions>}
        </Dialog>
    );
};

export default ObjectDetailsDialog;

