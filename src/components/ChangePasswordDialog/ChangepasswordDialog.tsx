import React, { useState } from 'react';
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
import { auth } from "../FirebaseConfig.tsx";

interface ChangePasswordDialogProps{
    open:boolean,
    onClose: ()=>void
}
const ChangepasswordDialog:React.FC<ChangePasswordDialogProps> = ({open, onClose}) => {
    const [newPassword, setNewPassword]= useState("");
    const handlePasswordChange =()=>{

    }
  return (
    <Dialog open={open} onClose={onClose}>
            <DialogTitle>
                <Typography variant="h6">Change Password</Typography>
            </DialogTitle>
            <DialogContent>
                <Box display="flex" flexDirection="column" gap={2}>
                    <TextField
                        label="New Password"
                        type="password"
                        variant="outlined"
                        fullWidth
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={onClose}
                    color="secondary"
                    variant="text"
                >
                    Cancel
                </Button>
                <Button
                    onClick={handlePasswordChange}
                    color="primary"
                    variant="contained"
                >
                    Submit
                </Button>
            </DialogActions>
        </Dialog>
  )
}

export default ChangepasswordDialog