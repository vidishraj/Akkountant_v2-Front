import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from "@mui/material";
import {formatDateString} from "../utils/util.tsx";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    data: { date: string; description: string; amount: number }[];
}

const formatINR = (val: number | string) =>
    Number(val).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});

const DepositModal: React.FC<ModalProps> = ({open, onClose, title, data}) => {
    const total = data.reduce((sum, item) => sum + Number(item.amount), 0);
    const isGold = title.toLowerCase() === "gold";

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            PaperProps={{
                sx: {
                    width: "100%",
                    maxWidth: 440,
                    margin: "0 auto",
                    color: "#FAFAFA",
                    backgroundColor: "#121C24",
                },
            }}
        >
            <DialogTitle sx={{textAlign: "center", fontWeight: "bold", pb: 1}}>
                {title.toUpperCase()} {isGold ? "Purchases" : "Deposits"}
            </DialogTitle>
            <DialogContent dividers sx={{p: 0, borderColor: '#29384D'}}>
                <TableContainer sx={{maxHeight: 350}}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{backgroundColor: '#1a2530 !important', color: '#7a7d85 !important', fontWeight: 'bold', borderBottom: '1px solid #29384D !important', fontSize: '12px !important'}}>
                                    Date
                                </TableCell>
                                <TableCell sx={{backgroundColor: '#1a2530 !important', color: '#7a7d85 !important', fontWeight: 'bold', borderBottom: '1px solid #29384D !important', fontSize: '12px !important'}}>
                                    Description
                                </TableCell>
                                <TableCell align="right" sx={{backgroundColor: '#1a2530 !important', color: '#7a7d85 !important', fontWeight: 'bold', borderBottom: '1px solid #29384D !important', fontSize: '12px !important'}}>
                                    Amount
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.map((item, index) => (
                                <TableRow key={index} sx={{'&:last-child td': {borderBottom: 'none'}}}>
                                    <TableCell sx={{color: '#FAFAFA', borderBottom: '1px solid #29384D', fontSize: '13px', py: 1}}>
                                        {formatDateString(item.date)}
                                    </TableCell>
                                    <TableCell sx={{color: '#aaa', borderBottom: '1px solid #29384D', fontSize: '13px', py: 1}}>
                                        {item.description}
                                    </TableCell>
                                    <TableCell align="right" sx={{color: '#4a9eff', fontWeight: 'bold', borderBottom: '1px solid #29384D', fontSize: '13px', py: 1}}>
                                        ₹{formatINR(item.amount)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {/* Total row */}
                            <TableRow>
                                <TableCell colSpan={2} sx={{color: '#7a7d85', fontWeight: 'bold', borderBottom: 'none', fontSize: '13px', pt: 1.5}}>
                                    Total ({data.length} {isGold ? "purchases" : "deposits"})
                                </TableCell>
                                <TableCell align="right" sx={{color: '#4caf50', fontWeight: 'bold', borderBottom: 'none', fontSize: '14px', pt: 1.5}}>
                                    ₹{formatINR(total)}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </DialogContent>
            <DialogActions sx={{borderTop: '1px solid #29384D', p: 1.5}}>
                <Button variant="contained" color="primary" onClick={onClose} fullWidth size="small">
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DepositModal;
