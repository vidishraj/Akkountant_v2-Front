import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Grid,
} from "@mui/material";
import {formatDateString} from "../utils/util.tsx";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    data: { date: string; description: string; amount: number }[];
}

const DepositModal: React.FC<ModalProps> = ({open, onClose, title, data}) => {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            PaperProps={{
                sx: {
                    width: "100%",
                    maxWidth: 400, // Ensures it fits on mobile screens
                    margin: "0 auto",
                    color: "#FAFAFA",
                    backgroundColor: "#121C24"
                },
            }}
        >
            <DialogTitle sx={{textAlign: "center", fontWeight: "bold"}}>
                {title} Deposits
            </DialogTitle>
            <DialogContent dividers>
                {data.map((item, index) => (
                    <Box
                        key={index}
                        sx={{
                            padding: "10px 0",
                            borderBottom: index !== data.length - 1 ? "1px solid #ccc" : "none",
                        }}
                    >
                        <Grid container spacing={1} alignItems="center">
                            <Grid item xs={4}>
                                <Typography variant="body2" fontWeight="bold">
                                    {formatDateString(item.date)}
                                </Typography>
                            </Grid>
                            <Grid item xs={4}>
                                <Typography variant="body2">{item.description}</Typography>
                            </Grid>
                            <Grid item xs={4}>
                                <Typography variant="body2" color="primary" fontWeight="bold">
                                    ₹{item.amount.toFixed(2)}
                                </Typography>
                            </Grid>
                        </Grid>
                    </Box>
                ))}
            </DialogContent>
            <DialogActions>
                <Button variant="contained" color="primary" onClick={onClose} fullWidth>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DepositModal;
