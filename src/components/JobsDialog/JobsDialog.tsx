import React, {useEffect, useState} from 'react';
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
import { JobResponseBody } from '../../utils/interfaces.ts';
import {fetchJobsTable} from '../../services/transactionService.ts';
import { useMessage } from '../../contexts/MessageContext.tsx';

interface JobsDialogProps {
    open: boolean,
    onClose: () => void
}
export type JobResponseBodyArray = JobResponseBody[]

const JobsDialog: React.FC<JobsDialogProps> = ({open, onClose}) => {
    const [newPassword, setNewPassword] = useState("");
    
    const [jobsTable, setJobsTable]= useState<JobResponseBodyArray>([]);
    const {setPayload} = useMessage();

    const handlePasswordChange = async () => {
        const user = auth.currentUser;
        if (user) {
            await updatePassword(user, newPassword);
            onClose();
        }
    }

    useEffect(() => {
        const fetchJobs = async () => {
          try {
            const jobsData = await fetchJobsTable();
            if (Array.isArray(jobsData)) {
              setJobsTable(jobsData);
            }
            console.log("Fetched jobs:", jobsData);
          } catch (err) {
            console.log("Error fetching jobs", err);
            setPayload({
              type: "error",
              message: "Failed to fetch jobs. Please try again!",
            });
          }
        };
    
        fetchJobs();
      }, []);
      
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
            {jobsTable.map((job, index) => (
                <div key={index}>
                <h3>{job.Name}</h3>
                <p>Status: {job.status}</p>
                <p>Result: {job.result}</p>
                </div>
            ))}
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