import React, {useState} from 'react';
import {
    Modal,
    Box,
    TextField,
    Button,
    Typography,
    Grid,
} from '@mui/material';
import {format} from 'date-fns';

interface DateModalProps {
    isOpen: boolean;
    onSubmit: (dates: { from: string; to: string }) => void;
    onCancel: () => void;
    title: string;
}

const DateModal: React.FC<DateModalProps> = ({isOpen, onSubmit, onCancel, title}) => {
    const [fromDate, setFromDate] = useState<string>('');
    const [toDate, setToDate] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const handleFormSubmit = () => {
        if (!fromDate || !toDate) {
            setError('Both dates are required.');
            return;
        }

        setError(null);
        const formattedDates = {
            from: format(new Date(fromDate), 'yyyy/M/d'),
            to: format(new Date(toDate), 'yyyy/M/d'),
        };
        onSubmit(formattedDates);
    };

    return (
        <Modal open={isOpen} onClose={onCancel}>
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 400,
                    bgcolor: '#121C24',
                    boxShadow: 24,
                    p: 4,
                    borderRadius: 2,
                }}
            >
                <Typography variant="h6" mb={2} color={'white'}>
                    {title}
                </Typography>

                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField
                            label="Date From"
                            type="date"
                            fullWidth
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            InputLabelProps={{
                                shrink: true,
                            }}
                            sx={{
                                "& .MuiInputBase-input": {
                                    color: 'white'
                                }
                            }}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            label="Date To"
                            type="date"
                            fullWidth
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            InputLabelProps={{
                                shrink: true,
                            }}

                            sx={{
                                "& .MuiInputBase-input": {
                                    color: 'white'
                                }
                            }}
                        />
                    </Grid>
                    {error && (
                        <Grid item xs={12}>
                            <Typography color="error" variant="body2">
                                {error}
                            </Typography>
                        </Grid>
                    )}
                </Grid>

                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        mt: 3,
                        gap: 2,
                    }}
                >
                    <Button variant="contained" color="primary" onClick={handleFormSubmit}>
                        Submit
                    </Button>
                    <Button variant="outlined" onClick={onCancel}>
                        Cancel
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

export default DateModal;
