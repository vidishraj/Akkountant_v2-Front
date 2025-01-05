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
import { Job, JobsResponse } from '../../utils/interfaces.ts';
import {fetchJobsTable} from '../../services/investmentService.ts';
import { useMessage } from '../../contexts/MessageContext.tsx';

interface JobsDialogProps {
    open: boolean,
    onClose: () => void
}

const JobsDialog: React.FC<JobsDialogProps> = ({open, onClose}) => {
    const [newPassword, setNewPassword] = useState("");
    const [results, setResults]= useState<Job[]>([]);
    const [jobs, setJobs]= useState<Record<string,string>>({});
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
            const jobsData = await fetchJobsTable(1); 
            setJobs(jobsData.jobs); 
            setResults(jobsData.results);
            console.log("Fetched jobs:", jobsData);
          } catch (err) {
            console.error("Error fetching jobs", err);
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
            <div>Cards</div>
            <div>
                {results.map((job) => (
                    <div key={job.id}>
                    <h3>{job.name}</h3>
                    <p>Status: {job.status}</p>
                    <p>Execution Time: {job.executionTime || "N/A"}</p>
                    <p>Due Time: {job.dueTime || "N/A"}</p>
                    </div>
                ))}
            </div>
            <div>Jobs dropdown</div>
            <ul>
                {Object.values(jobs).map((value) => (
                    <li key={value}>
                    {value}
                    </li>
                ))}
            </ul>

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