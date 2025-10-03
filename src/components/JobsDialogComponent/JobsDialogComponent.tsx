import React, {useEffect, useState} from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Collapse,
    Chip,
    Button,
    Checkbox,
    TablePagination,
    useMediaQuery,
    Box,
    Tooltip,
    Select,
    MenuItem,
    FormControl,
    InputLabel
} from "@mui/material";
import {
    fetchJobsSummary,
    fetchJobsByTitleStatus,
    cancelJob,
    cancelJobsBulk,
    JobSummary,
    JobDetail
} from '../../services/jobService.ts';
import { startJob, fetchJobsTable } from '../../services/investmentService.ts';
import {useMessage} from '../../contexts/MessageContext.tsx';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';

interface JobsDialogProps {
    open: boolean,
    onClose: () => void
}

interface ExpandedJobType {
    title: string;
    status: string;
    page: number;
    jobs: JobDetail[];
    totalJobs: number;
    selectedJobs: Set<number>;
    loading: boolean;
}

const JobsDialog: React.FC<JobsDialogProps> = ({open, onClose}) => {
    const [jobsSummary, setJobsSummary] = useState<JobSummary[]>([]);
    const [expandedJobs, setExpandedJobs] = useState<Record<string, ExpandedJobType>>({});
    const [loading, setLoading] = useState(false);
    const [availableJobs, setAvailableJobs] = useState<Record<string, string>>({});
    const [selectedJob, setSelectedJob] = useState<string>("");
    const {setPayload} = useMessage();
    const isMobile = useMediaQuery("(max-width:900px)");

    const loadJobsSummary = async (clearCache = false) => {
        try {
            setLoading(true);
            const response = await fetchJobsSummary(clearCache);
            if (response.status === 'success') {
                setJobsSummary(response.data);
            }
        } catch (error) {
            setPayload({
                type: "error",
                message: "Failed to load jobs summary. Please try again!",
            });
            console.error("Error fetching jobs summary:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadAvailableJobs = async () => {
        try {
            const jobsData = await fetchJobsTable(1, false, {}, 'due_date', 'desc');
            setAvailableJobs(jobsData.jobs);
        } catch (error) {
            console.error("Error fetching available jobs:", error);
        }
    };

    useEffect(() => {
        if (open) {
            loadJobsSummary();
            loadAvailableJobs();
        }
    }, [open]);

    const loadJobDetails = async (title: string, status: string, page = 1) => {
        const key = `${title}-${status}`;
        
        try {
            setExpandedJobs(prev => ({
                ...prev,
                [key]: { 
                    title,
                    status,
                    page,
                    jobs: [],
                    totalJobs: 0,
                    selectedJobs: new Set(),
                    loading: true
                }
            }));

            const response = await fetchJobsByTitleStatus(title, status, page, 10);
            if (response.status === 'success') {
                setExpandedJobs(prev => ({
                    ...prev,
                    [key]: {
                        title,
                        status,
                        page,
                        jobs: response.data.jobs,
                        totalJobs: response.data.pagination.total,
                        selectedJobs: new Set(),
                        loading: false
                    }
                }));
            }
        } catch (error) {
            setPayload({
                type: "error",
                message: `Failed to load ${status.toLowerCase()} jobs for ${title}`,
            });
            console.error("Error fetching job details:", error);
            setExpandedJobs(prev => ({
                ...prev,
                [key]: { 
                    ...prev[key],
                    loading: false
                }
            }));
        }
    };

    const handleExpandToggle = (title: string, status: string) => {
        const key = `${title}-${status}`;
        
        if (expandedJobs[key]) {
            // Remove from expanded jobs
            setExpandedJobs(prev => {
                const newState = { ...prev };
                delete newState[key];
                return newState;
            });
        } else {
            // Add to expanded jobs and load data
            loadJobDetails(title, status);
        }
    };

    const handleJobSelection = (jobId: number, title: string, status: string) => {
        const key = `${title}-${status}`;
        setExpandedJobs(prev => {
            const currentData = prev[key];
            if (!currentData || !currentData.selectedJobs) return prev;
            
            return {
                ...prev,
                [key]: {
                    ...currentData,
                    selectedJobs: currentData.selectedJobs.has(jobId)
                        ? new Set([...currentData.selectedJobs].filter(id => id !== jobId))
                        : new Set([...currentData.selectedJobs, jobId])
                }
            };
        });
    };

    const handleSelectAll = (title: string, status: string) => {
        const key = `${title}-${status}`;
        const jobData = expandedJobs[key];
        if (!jobData || !jobData.jobs || !jobData.selectedJobs) return;

        const allSelected = jobData.jobs.every(job => jobData.selectedJobs.has(job.id));
        setExpandedJobs(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                selectedJobs: allSelected 
                    ? new Set()
                    : new Set(jobData.jobs.map(job => job.id))
            }
        }));
    };

    const handleCancelJob = async (jobId: number, title: string, status: string) => {
        try {
            const response = await cancelJob(jobId);
            if (response.status === 'success') {
                setPayload({
                    type: "success",
                    message: response.message,
                });
                // Reload both summary and job details
                loadJobsSummary();
                loadJobDetails(title, status, expandedJobs[`${title}-${status}`]?.page || 1);
            }
        } catch (error) {
            setPayload({
                type: "error",
                message: "Failed to cancel job",
            });
            console.error("Error canceling job:", error);
        }
    };

    const handleBulkCancel = async (title: string, status: string) => {
        const key = `${title}-${status}`;
        const selectedIds = Array.from(expandedJobs[key]?.selectedJobs || []);
        
        if (selectedIds.length === 0) {
            setPayload({
                type: "warning",
                message: "Please select jobs to cancel",
            });
            return;
        }

        try {
            const response = await cancelJobsBulk(selectedIds);
            if (response.status === 'success') {
                setPayload({
                    type: "success",
                    message: `${response.message} (${selectedIds.length} jobs)`,
                });
                // Reload both summary and job details
                loadJobsSummary();
                loadJobDetails(title, status, expandedJobs[key]?.page || 1);
            }
        } catch (error) {
            setPayload({
                type: "error",
                message: "Failed to cancel selected jobs",
            });
            console.error("Error canceling jobs:", error);
        }
    };

    const handlePageChange = (title: string, status: string, newPage: number) => {
        loadJobDetails(title, status, newPage + 1);
    };

    const handleJobCreation = async () => {
        if (!selectedJob) {
            setPayload({
                type: "warning",
                message: "Please select a job to start",
            });
            return;
        }

        try {
            const response = await startJob(selectedJob);
            if (response.status === 200) {
                setPayload({
                    type: "success",
                    message: "Job started successfully",
                });
                setSelectedJob("");
                // Refresh the jobs summary to show the new job
                loadJobsSummary(true);
            }
        } catch (error) {
            setPayload({
                type: "error",
                message: "Failed to start job. Please try again!",
            });
            console.error("Error starting job:", error);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'completed': return '#4CAF50';
            case 'pending': return '#FF9800';
            case 'overdue': return '#F44336';
            case 'failed': return '#9C27B0';
            default: return '#757575';
        }
    };

    const getStatusCounts = (job: JobSummary) => [
        { status: 'Pending', count: job.pending_count },
        { status: 'Overdue', count: job.overdue_count },
        { status: 'Completed', count: job.completed_count },
        { status: 'Failed', count: job.failed_count }
    ].filter(item => item.count > 0);

    const canCancelJobs = (status: string) => 
        status.toLowerCase() === 'pending' || status.toLowerCase() === 'overdue';

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            fullScreen={isMobile} 
            maxWidth="xl"
            PaperProps={{
                sx: {
                    backgroundColor: "#121C24",
                    color: "#FAFAFA",
                    borderRadius: 2,
                    width: '95%',
                    height: '90%'
                },
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6">Jobs Management Dashboard</Typography>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {/* Job Creation Section */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel sx={{ color: '#FAFAFA', '&.Mui-focused': { color: '#7b68ee' } }}>
                                Select Job
                            </InputLabel>
                            <Select
                                value={selectedJob}
                                onChange={(e) => setSelectedJob(e.target.value)}
                                label="Select Job"
                                sx={{
                                    color: '#FAFAFA',
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#5a6a7c' },
                                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#FAFAFA' },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#7b68ee' },
                                    '& .MuiSvgIcon-root': { color: '#FAFAFA' }
                                }}
                            >
                                {Object.entries(availableJobs).map(([key, value]) => (
                                    <MenuItem key={key} value={key}>
                                        {value}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button
                            variant="contained"
                            onClick={handleJobCreation}
                            disabled={!selectedJob || loading}
                            size="small"
                            sx={{
                                backgroundColor: '#7b68ee',
                                '&:hover': { backgroundColor: '#6a5acd' },
                                '&:disabled': { backgroundColor: '#555' }
                            }}
                        >
                            Start Job
                        </Button>
                    </Box>
                    
                    <IconButton
                        onClick={() => loadJobsSummary(true)}
                        disabled={loading}
                        sx={{ color: '#FAFAFA' }}
                    >
                        <RefreshIcon />
                    </IconButton>
                    <IconButton onClick={onClose} sx={{ color: '#FAFAFA' }}>
                        <CloseIcon />
                    </IconButton>
                </div>
            </DialogTitle>
            
            <DialogContent sx={{ padding: 0 }}>
                <TableContainer component={Paper} sx={{ backgroundColor: '#121C24', height: '100%' }}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ backgroundColor: '#2C3E50', color: '#FAFAFA', fontWeight: 'bold' }}>
                                    Job Type
                                </TableCell>
                                <TableCell sx={{ backgroundColor: '#2C3E50', color: '#FAFAFA', fontWeight: 'bold' }}>
                                    Priority
                                </TableCell>
                                <TableCell sx={{ backgroundColor: '#2C3E50', color: '#FAFAFA', fontWeight: 'bold' }}>
                                    Status Summary
                                </TableCell>
                                <TableCell sx={{ backgroundColor: '#2C3E50', color: '#FAFAFA', fontWeight: 'bold' }}>
                                    Status
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {jobsSummary.map((job) => (
                                <React.Fragment key={job.title}>
                                    <TableRow sx={{ backgroundColor: '#1A252F' }}>
                                        <TableCell sx={{ color: '#FAFAFA', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                            {job.title}
                                        </TableCell>
                                        <TableCell sx={{ color: '#FAFAFA' }}>
                                            <Chip
                                                label={job.priority}
                                                color={job.priority === 'High' ? 'error' : job.priority === 'Medium' ? 'warning' : 'default'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell sx={{ color: '#FAFAFA' }}>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                {getStatusCounts(job).map(({ status, count }) => (
                                                    <Chip
                                                        key={status}
                                                        label={`${status}: ${count}`}
                                                        size="small"
                                                        sx={{
                                                            backgroundColor: getStatusColor(status),
                                                            color: 'white',
                                                            cursor: 'pointer'
                                                        }}
                                                        onClick={() => handleExpandToggle(job.title, status)}
                                                    />
                                                ))}
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ color: '#FAFAFA' }}>
                                            <Chip
                                                label={job.is_disabled ? 'Disabled' : 'Enabled'}
                                                size="small"
                                                color={job.is_disabled ? 'error' : 'success'}
                                                variant={job.is_disabled ? 'filled' : 'outlined'}
                                            />
                                        </TableCell>
                                    </TableRow>
                                    
                                    {/* Sub-tables for each status */}
                                    {getStatusCounts(job).map(({ status }) => {
                                        const key = `${job.title}-${status}`;
                                        const jobData = expandedJobs[key];
                                        
                                        return (
                                            <TableRow key={key}>
                                                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={4}>
                                                    <Collapse in={!!jobData} timeout="auto" unmountOnExit>
                                                        <Box sx={{ margin: 1, backgroundColor: '#0F1419', borderRadius: 1, border: '1px solid #34495E' }}>
                                                            <Box sx={{ 
                                                                display: 'flex', 
                                                                justifyContent: 'space-between', 
                                                                alignItems: 'center',
                                                                padding: 2,
                                                                borderBottom: '1px solid #34495E'
                                                            }}>
                                                                <Typography variant="h6" sx={{ color: '#FAFAFA' }}>
                                                                    {job.title} - {status} Jobs
                                                                </Typography>
                                                                
                                                                {canCancelJobs(status) && jobData && (
                                                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                                                        <Button
                                                                            startIcon={<DeleteIcon />}
                                                                            variant="outlined"
                                                                            color="error"
                                                                            size="small"
                                                                            onClick={() => handleBulkCancel(job.title, status)}
                                                                            disabled={(jobData?.selectedJobs?.size || 0) === 0}
                                                                        >
                                                                            Cancel Selected ({jobData?.selectedJobs?.size || 0})
                                                                        </Button>
                                                                    </Box>
                                                                )}
                                                                
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleExpandToggle(job.title, status)}
                                                                    sx={{ color: '#FAFAFA' }}
                                                                >
                                                                    <KeyboardArrowUpIcon />
                                                                </IconButton>
                                                            </Box>
                                                            
                                                            {jobData && (
                                                                <>
                                                                    <Table size="small">
                                                                        <TableHead>
                                                                            <TableRow>
                                                                                {canCancelJobs(status) && (
                                                                                    <TableCell sx={{ color: '#FAFAFA' }}>
                                                                                        <Checkbox
                                                                                            checked={jobData?.jobs?.length > 0 && jobData.jobs.every(j => jobData?.selectedJobs?.has(j.id))}
                                                                                            indeterminate={(jobData?.selectedJobs?.size || 0) > 0 && (jobData?.selectedJobs?.size || 0) < (jobData?.jobs?.length || 0)}
                                                                                            onChange={() => handleSelectAll(job.title, status)}
                                                                                            sx={{ color: '#FAFAFA' }}
                                                                                        />
                                                                                    </TableCell>
                                                                                )}
                                                                                <TableCell sx={{ color: '#FAFAFA', fontWeight: 'bold' }}>ID</TableCell>
                                                                                <TableCell sx={{ color: '#FAFAFA', fontWeight: 'bold' }}>Priority</TableCell>
                                                                                <TableCell sx={{ color: '#FAFAFA', fontWeight: 'bold' }}>Due Date</TableCell>
                                                                                <TableCell sx={{ color: '#FAFAFA', fontWeight: 'bold' }}>Failures</TableCell>
                                                                                <TableCell sx={{ color: '#FAFAFA', fontWeight: 'bold' }}>Result</TableCell>
                                                                                <TableCell sx={{ color: '#FAFAFA', fontWeight: 'bold' }}>Status</TableCell>
                                                                                {canCancelJobs(status) && (
                                                                                    <TableCell sx={{ color: '#FAFAFA', fontWeight: 'bold' }}>Actions</TableCell>
                                                                                )}
                                                                            </TableRow>
                                                                        </TableHead>
                                                                        <TableBody>
                                                                            {jobData.loading ? (
                                                                                <TableRow>
                                                                                    <TableCell 
                                                                                        colSpan={canCancelJobs(status) ? 8 : 6} 
                                                                                        sx={{ color: '#FAFAFA', textAlign: 'center' }}
                                                                                    >
                                                                                        Loading...
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            ) : jobData.jobs.map((jobDetail) => (
                                                                                <TableRow key={jobDetail.id}>
                                                                                    {canCancelJobs(status) && (
                                                                                        <TableCell>
                                                                                            <Checkbox
                                                                                                checked={jobData?.selectedJobs?.has(jobDetail.id) || false}
                                                                                                onChange={() => handleJobSelection(jobDetail.id, job.title, status)}
                                                                                                sx={{ color: '#FAFAFA' }}
                                                                                            />
                                                                                        </TableCell>
                                                                                    )}
                                                                                    <TableCell sx={{ color: '#FAFAFA' }}>{jobDetail.id}</TableCell>
                                                                                    <TableCell sx={{ color: '#FAFAFA' }}>{jobDetail.priority}</TableCell>
                                                                                    <TableCell sx={{ color: '#FAFAFA' }}>
                                                                                        {new Date(jobDetail.due_date).toLocaleString()}
                                                                                    </TableCell>
                                                                                    <TableCell sx={{ color: '#FAFAFA' }}>{jobDetail.failures}</TableCell>
                                                                                    <TableCell sx={{ color: '#FAFAFA', maxWidth: 200 }}>
                                                                                        <Tooltip title={jobDetail.result || 'No result yet'}>
                                                                                            <Typography
                                                                                                noWrap
                                                                                                sx={{
                                                                                                    overflow: 'hidden',
                                                                                                    textOverflow: 'ellipsis',
                                                                                                    maxWidth: 200
                                                                                                }}
                                                                                            >
                                                                                                {jobDetail.result || 'Pending...'}
                                                                                            </Typography>
                                                                                        </Tooltip>
                                                                                    </TableCell>
                                                                                    <TableCell sx={{ color: '#FAFAFA' }}>
                                                                                        <Chip
                                                                                            label={jobDetail.job_type_disabled ? 'Type Disabled' : 'Type Enabled'}
                                                                                            size="small"
                                                                                            color={jobDetail.job_type_disabled ? 'error' : 'success'}
                                                                                            variant={jobDetail.job_type_disabled ? 'filled' : 'outlined'}
                                                                                        />
                                                                                    </TableCell>
                                                                                    {canCancelJobs(status) && (
                                                                                        <TableCell>
                                                                                            <IconButton
                                                                                                size="small"
                                                                                                color="error"
                                                                                                onClick={() => handleCancelJob(jobDetail.id, job.title, status)}
                                                                                            >
                                                                                                <CancelIcon />
                                                                                            </IconButton>
                                                                                        </TableCell>
                                                                                    )}
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                    
                                                                    {/* Pagination for job details */}
                                                                    <TablePagination
                                                                        component="div"
                                                                        count={jobData.totalJobs}
                                                                        page={jobData.page - 1}
                                                                        onPageChange={(_, newPage) => handlePageChange(job.title, status, newPage)}
                                                                        rowsPerPage={10}
                                                                        rowsPerPageOptions={[10]}
                                                                        sx={{
                                                                            color: '#FAFAFA',
                                                                            '& .MuiTablePagination-actions': {
                                                                                color: '#FAFAFA'
                                                                            },
                                                                            '& .MuiIconButton-root': {
                                                                                color: '#FAFAFA'
                                                                            }
                                                                        }}
                                                                    />
                                                                </>
                                                            )}
                                                        </Box>
                                                    </Collapse>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DialogContent>
        </Dialog>
    );
};

export default JobsDialog;