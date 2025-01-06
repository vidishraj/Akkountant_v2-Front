import React, {useEffect, useState} from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Typography, Card, Box, TablePagination, useMediaQuery, Button, IconButton,
} from "@mui/material";
import {Job} from '../../utils/interfaces.ts';
import {fetchJobsTable, startJob} from '../../services/investmentService.ts';
import {useMessage} from '../../contexts/MessageContext.tsx';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import styles from "../TransactionCardComponent/TransactionCard.module.scss";
import style from "../../pages/Transactions/Transaction.module.scss";
import filterStyles from '../TransactionFilterComponent/TransactionFilter.module.scss'

interface JobsDialogProps {
    open: boolean,
    onClose: () => void
}

const JobsDialog: React.FC<JobsDialogProps> = ({open, onClose}) => {
    const [results, setResults] = useState<Job[]>([]);
    const [jobs, setJobs] = useState<Record<string, string>>({});
    const [selectedJob, setSelectedJob] = useState<string>("");
    const {setPayload} = useMessage();
    const [pages, setPages] = useState<number>(0);

    const isMobile = useMediaQuery("(max-width:600px)");

    const fetchJobs = async (cacheState: boolean) => {
        try {
            const jobsData = await fetchJobsTable(pages + 1, cacheState);
            setJobs(jobsData.jobs);
            setResults(jobsData.results);
        } catch (err) {
            console.error("Error fetching jobs", err);
            setPayload({
                type: "error",
                message: "Failed to fetch jobs. Please try again!",
            });
        }
    };

    useEffect(() => {
        fetchJobs(false);
    }, [pages]);

    const handleJobSelection = (e: any) => {
        setSelectedJob(e.target.value);
    }

    const handleJobSubmit = async () => {
        if (!selectedJob) {
            setPayload({type: 'error', message: "Please select a job before submitting"});
            return;
        }
        startJob(selectedJob).then((res) => {
            if (res.status === 200) {
                setPayload({
                    type: "success",
                    message: "Job inserted",
                });
            }
        }).catch(() => {
            setPayload({
                type: "error",
                message: "Failed to insert job. Please try again!",
            });
        });
    }

    return (
        <Dialog open={open} onClose={onClose} fullScreen={isMobile} PaperProps={{
            sx: {
                backgroundColor: "#121C24",
                color: "#FAFAFA",
                borderRadius: 2,
                // padding: 3,
                width: '100%',
            },
        }}>
            <DialogTitle align={'center'} display={'flex'} alignItems={'centre'} justifyContent={'space-between'}>
                <Typography variant="inherit">Jobs Dashboard</Typography>
                <IconButton onClick={onClose}>
                    <CloseIcon style={{color: 'white'}}/>
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <div style={{display: "flex", alignItems: "center", justifyContent: "space-evenly", flexWrap: 'wrap'}}>
                    <select value={selectedJob} onChange={handleJobSelection}
                            className={filterStyles.select}>
                        <option value="" disabled>Select a job</option>
                        {Object.entries(jobs).map(([key, value]) => (
                            <option key={key} value={key}>
                                {value}
                            </option>
                        ))}
                    </select>
                    <button onClick={handleJobSubmit} disabled={!selectedJob}>Start job</button>
                    <Button
                        className={styles.refresh}
                        variant="contained"
                        sx={{
                            mt: 2,
                            py: 1,
                            backgroundColor: '#FAFAFA',
                            color: 'black',
                            fontSize: {xs: '0.8rem', sm: '1rem'},
                            '&:hover': {
                                backgroundColor: '#e0e0e0',
                            },
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            fetchJobs(true)
                        }}
                    >
                        <RefreshIcon/>
                    </Button>
                </div>

                <div className={style.transactionCards} style={{minHeight: isMobile ? '400px' : '550px'}}>
                    {results.map((job) => (
                        <Card className={styles.card}>
                            <Box className={styles.description} style={{minWidth: '30%', textAlign: 'center'}}>
                                <Typography className={styles.description__text}>
                                    {job.Title}
                                </Typography>
                                <Typography className={styles.description__date}>
                                    {new Date(job.DueTime).toLocaleString()}
                                </Typography>
                            </Box>
                            <Box className={styles.description} style={{minWidth: '20%', textAlign: 'center'}}>
                                <Typography className={styles.description__text}>
                                    {job.Status}
                                </Typography>
                                <Typography className={styles.description__date}>
                                    {job.Failures}
                                </Typography>
                            </Box>
                            <Box className={styles.amount}
                                 style={{
                                     justifyContent: isMobile ? 'unset' : 'center',
                                     overflowX: 'auto',
                                     color: '#FAFAFA',
                                     textAlign: 'center',
                                     minWidth: '40%'
                                 }}>
                                <Typography
                                >
                                    {job.Result ? job.Result : "JOB PENDING"}
                                </Typography>
                            </Box>
                        </Card>
                    ))}
                </div>
                <div className={style.paginationContainer}>

                    <TablePagination
                        component="div"
                        rowsPerPageOptions={[10]}
                        className={style.pagination}
                        page={pages}
                        count={100}
                        rowsPerPage={10}
                        onPageChange={(_, newPage) => {
                            setPages(newPage)
                        }}
                    />
                </div>
            </DialogContent>

        </Dialog>
    )
}

export default JobsDialog