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
import { updatePassword, User } from "firebase/auth";

interface ChangePasswordDialogProps{
    open:boolean,
    onClose: ()=>void
}
const ChangepasswordDialog:React.FC<ChangePasswordDialogProps> = ({open, onClose}) => {
    const [newPassword, setNewPassword]= useState("");
    const handlePasswordChange = async()=>{
        const user= auth.currentUser;
        if(user){
            await updatePassword(user,newPassword);
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
                <Typography variant="inherit">Change Password</Typography>
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
                        sx={{
                            color: "#FAFAFA",
                            backgroundColor: "#1E2A34",
                            borderRadius: 1,
                            '& .MuiInputLabel-root': { color: '#888' }, // Style the label directly
                            '& .MuiInputBase-root': { color: '#FAFAFA' }  // Style the input text
                        }}
                    />
                </Box>
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

export default ChangepasswordDialog