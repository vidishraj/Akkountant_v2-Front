import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';

interface DialogProps {
    message: string;
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const DialogComponent: React.FC<DialogProps> = (props) => {
    const {message, open, onConfirm, onCancel} = props;

    const handleConfirm = () => {
        onConfirm();
    };

    const handleClose = () => {
        onCancel()
    };

    return (
        <>
            <Dialog
                open={open}
                onClose={handleClose}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogContent style={{backgroundColor: '#121C24'}}>
                    <DialogContentText id="alert-dialog-description" style={{color: '#FAFAFA'}}>
                        {message}
                    </DialogContentText>
                </DialogContent>
                <DialogActions style={{backgroundColor: '#121C24'}}>
                    <Button style={{
                        backgroundColor: "#607AFB", color: "#FAFAFA"
                    }} onClick={handleConfirm} autoFocus>
                        Confirm
                    </Button>
                    <Button style={{
                        backgroundColor: "#607AFB", color: "#FAFAFA"
                    }} onClick={handleClose}>Cancel</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}