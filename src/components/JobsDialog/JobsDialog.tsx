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
    const [results, setResults]= useState<Job[]>([]);
    const [jobs, setJobs]= useState<Record<string,string>>({});
    const [selectedJob, setSelectedJob]=useState<string>("");
    const {setPayload} = useMessage();

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

      const handleJobSelection = (e) =>{
        setSelectedJob(e.target.value);
      }

      const handleJobSubmit = () =>{
        if(!selectedJob){
           alert("Please select a job before submitting");
           return; 
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

           <div>
           <label>Jobs dropdown</label>
           <select value={selectedJob} onChange={handleJobSelection}>
            <option value="" disabled>Select a job</option>
            {Object.values(jobs).map((value) => (
                    <option key={value}>
                    {value}
                    </option>
                ))}
           </select>
           <button onClick={handleJobSubmit} disabled={!selectedJob}>Submit</button>
           </div>

            </DialogContent>
        </Dialog>
    )
}

export default JobsDialog