import React from "react";
import {
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Button,
} from "@mui/material";

interface ConfirmationDialogProps {
    open: boolean;
    onCancel: () => void;
    onSubmit: () => void;
    title?: string;
    message?: string;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
                                                                   open,
                                                                   onCancel,
                                                                   onSubmit,
                                                                   title = "Confirm",
                                                                   message = "Are you sure you want to proceed?",
                                                               }) => {
    return (
        <Dialog
            open={open}
            onClose={onCancel}
            aria-labelledby="confirmation-dialog-title"
            aria-describedby="confirmation-dialog-description"
            style={{width: "100%"}}
        >
            <DialogTitle
                id="confirmation-dialog-title"
                style={{
                    backgroundColor: "#121C24",
                    color: "#FAFAFA",
                }}
            >
                {title}
            </DialogTitle>
            <DialogContent style={{backgroundColor: "#121C24"}}>
                <DialogContentText
                    id="confirmation-dialog-description"
                    style={{color: "#FAFAFA"}}
                >
                    {message}
                </DialogContentText>
            </DialogContent>
            <DialogActions
                style={{
                    backgroundColor: "#121C24",
                    color: "#FAFAFA",
                    padding: "0 0 15px 0",
                    justifyContent: "space-evenly",
                }}
            >
                <Button
                    style={{
                        backgroundColor: "#121C24",
                        border: "2px solid #29384D",
                    }}
                    onClick={onSubmit}
                    color="inherit"
                    variant="contained"
                >
                    Confirm
                </Button>
                <Button
                    style={{
                        backgroundColor: "#121C24",
                        border: "2px solid #29384D",
                    }}
                    onClick={onCancel}
                    color="error"
                >
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmationDialog;
