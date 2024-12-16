import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Grid,
} from '@mui/material';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    data: any; // Data can be either object or array based on the format
}

const ResponsiveDataModal: React.FC<ModalProps> = ({open, onClose, title, data}) => {
    // Check if data is an object (key-value pairs) or an array of objects
    const isObjectData = typeof data === 'object' && !Array.isArray(data);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            PaperProps={{
                sx: {
                    width: '100%',
                    maxWidth: 400, // Ensures it fits on mobile screens
                    margin: '0 auto',
                    color: "#FAFAFA",
                    backgroundColor: "#121C24"
                },
            }}
        >
            <DialogTitle sx={{textAlign: 'center', fontWeight: 'bold'}}>
                {title} rates
            </DialogTitle>
            <DialogContent dividers>
                {/* Rendering for the Object Data (Gold Carat Information) */}
                {isObjectData ? (
                    <Box>
                        {Object.entries(data).map(([key, value], index) => (
                            <Box
                                key={index}
                                sx={{
                                    padding: '10px 0',
                                    borderBottom: index !== Object.entries(data).length - 1 ? '1px solid #ccc' : 'none',
                                }}
                            >
                                <Grid container spacing={1} alignItems="center">
                                    <Grid item xs={6}>
                                        <Typography variant="body2" fontWeight="bold">
                                            {key}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="body2" color="primary" fontWeight="bold">
                                            ₹{value ? Number(value).toFixed(2) : 0}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Box>
                        ))}
                    </Box>
                ) : (
                    // Rendering for the Array Data (Interest Rates by Year)
                    <Box>
                        {data.map((item: { 'Interest Rate': number; Year: string }, index: number) => (
                            <Box
                                key={index}
                                sx={{
                                    padding: '10px 0',
                                    borderBottom: index !== data.length - 1 ? '1px solid #ccc' : 'none',
                                }}
                            >
                                <Grid container spacing={1} alignItems="center">
                                    <Grid item xs={6}>
                                        <Typography variant="body2" fontWeight="bold">
                                            {item.Year}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="body2" color="primary" fontWeight="bold">
                                            {item['Interest Rate']}%
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Box>
                        ))}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button variant="contained" color="primary" onClick={onClose} fullWidth>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ResponsiveDataModal;
