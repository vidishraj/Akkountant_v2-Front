import React from 'react';
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
} from '@mui/material';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    data: any;
}

const formatINR = (val: number | string) =>
    Number(val).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});

const headerSx = {
    backgroundColor: '#1a2530 !important',
    color: '#7a7d85 !important',
    fontWeight: 'bold',
    borderBottom: '1px solid #29384D !important',
    fontSize: '12px !important',
};

const cellSx = {
    color: '#FAFAFA',
    borderBottom: '1px solid #29384D',
    fontSize: '13px',
    py: 1,
};

const ResponsiveDataModal: React.FC<ModalProps> = ({open, onClose, title, data}) => {
    const isObjectData = typeof data === 'object' && !Array.isArray(data);
    const isGold = title.toLowerCase() === 'gold';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            PaperProps={{
                sx: {
                    width: '100%',
                    maxWidth: 440,
                    margin: '0 auto',
                    color: "#FAFAFA",
                    backgroundColor: "#121C24",
                },
            }}
        >
            <DialogTitle sx={{textAlign: 'center', fontWeight: 'bold', pb: 1}}>
                {title.toUpperCase()} Rates
            </DialogTitle>
            <DialogContent dividers sx={{p: 0, borderColor: '#29384D'}}>
                <TableContainer sx={{maxHeight: 350}}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={headerSx}>
                                    {isGold ? 'Carat' : 'Period'}
                                </TableCell>
                                <TableCell align="right" sx={headerSx}>
                                    {isGold ? 'Price (per 10g)' : 'Interest Rate'}
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isObjectData ? (
                                Object.entries(data).map(([key, value], index) => (
                                    <TableRow key={index} sx={{'&:last-child td': {borderBottom: 'none'}}}>
                                        <TableCell sx={cellSx}>
                                            {key}
                                        </TableCell>
                                        <TableCell align="right" sx={{...cellSx, color: '#4a9eff', fontWeight: 'bold'}}>
                                            ₹{value ? formatINR(value as number) : '0.00'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                data.map((item: { 'Interest Rate': number; Year: string }, index: number) => (
                                    <TableRow key={index} sx={{'&:last-child td': {borderBottom: 'none'}}}>
                                        <TableCell sx={cellSx}>
                                            {item.Year}
                                        </TableCell>
                                        <TableCell align="right" sx={{...cellSx, color: '#4a9eff', fontWeight: 'bold'}}>
                                            {Number(item['Interest Rate']).toFixed(2)}%
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
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

export default ResponsiveDataModal;
