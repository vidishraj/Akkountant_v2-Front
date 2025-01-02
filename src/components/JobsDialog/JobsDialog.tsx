import React, {useState} from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
} from "@mui/material";
import {auth} from "../FirebaseConfig.tsx";
import {updatePassword} from "firebase/auth";

interface JobsDialogProps {
    open: boolean,
    onClose: () => void
}

const JobsDialog: React.FC<JobsDialogProps> = ({open, onClose}) => {
    const [newPassword, setNewPassword] = useState("");
    const handlePasswordChange = async () => {
        const user = auth.currentUser;
        if (user) {
            await updatePassword(user, newPassword);
            onClose();
        }
    }
    return (
        <Dialog open={open} onClose={onClose} fullWidth PaperProps={{
            sx: {
                backgroundColor: "#121C24",
                color: "#FAFAFA",
                borderRadius: 2,
                padding: 3,
            },
        }}>
            <DialogTitle>
                <Typography variant="inherit">Set jobs</Typography>
            </DialogTitle>
            <DialogContent>
               xyz
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={onClose}
                    color="error"
                    variant="text"
                >
                    Cancel
                </Button>
                <Button
                    onClick={handlePasswordChange}
                    color="primary"
                    variant="text"
                >
                    Submit
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default JobsDialog