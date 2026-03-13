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
    TableHead,
    TableRow,
    Collapse,
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
    fetchJobsDailyHistory,
    cancelJob,
    cancelJobsBulk,
    JobSummary,
    JobDetail,
    DailyHistory
} from '../../services/jobService.ts';
import {startJob, fetchJobsTable} from '../../services/investmentService.ts';
import {useMessage} from '../../contexts/MessageContext.tsx';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import cardStyles from './JobsDialog.module.scss';

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

const HISTORY_DAYS = 90;

const STATUS_COLORS: Record<string, string> = {
    Completed: '#4ade80',
    Pending: '#f59e0b',
    Overdue: '#ef4444',
    Failed: '#a855f7',
};

const STATUS_CELL_CLASS: Record<string, string> = {
    Completed: cardStyles.dayCellCompleted,
    Pending: cardStyles.dayCellPending,
    Overdue: cardStyles.dayCellOverdue,
    Failed: cardStyles.dayCellFailed,
};

/**
 * Generate an array of date strings for the last N days (oldest first).
 */
function generateDateRange(days: number): string[] {
    const dates: string[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
}

/**
 * Determine the dominant status for a day (worst wins).
 */
function dominantStatus(dayData: Record<string, number>): string {
    const priority = ['Failed', 'Overdue', 'Pending', 'Completed'];
    for (const s of priority) {
        if (dayData[s] && dayData[s] > 0) return s;
    }
    return 'Completed';
}

const JobsDialog: React.FC<JobsDialogProps> = ({open, onClose}) => {
    const [jobsSummary, setJobsSummary] = useState<JobSummary[]>([]);
    const [dailyHistory, setDailyHistory] = useState<DailyHistory>({});
    const [expandedJobs, setExpandedJobs] = useState<Record<string, ExpandedJobType>>({});
    const [loading, setLoading] = useState(false);
    const [availableJobs, setAvailableJobs] = useState<Record<string, string>>({});
    const [selectedJob, setSelectedJob] = useState<string>("");
    const [hoveredDay, setHoveredDay] = useState<string | null>(null);
    const {setPayload} = useMessage();
    const isMobile = useMediaQuery("(max-width:768px)");

    const dateRange = generateDateRange(HISTORY_DAYS);

    const loadJobsSummary = async (clearCache = false) => {
        try {
            setLoading(true);
            const [summaryRes, historyRes] = await Promise.all([
                fetchJobsSummary(clearCache),
                fetchJobsDailyHistory(HISTORY_DAYS, clearCache),
            ]);
            if (summaryRes.status === 'success') {
                setJobsSummary(summaryRes.data);
            }
            if (historyRes.status === 'success') {
                setDailyHistory(historyRes.data);
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
                        page: page,
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
            setExpandedJobs(prev => {
                const newState = {...prev};
                delete newState[key];
                return newState;
            });
        } else {
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
        const key = `${title}-${status}`;
        const currentJobData = expandedJobs[key];

        try {
            const response = await cancelJob(jobId);
            if (response.status === 'success') {
                setPayload({
                    type: "success",
                    message: response.message,
                });

                await loadJobsSummary(true);

                const currentPage = currentJobData?.page || 1;
                const currentJobsCount = currentJobData?.jobs?.length || 0;

                let pageToLoad = currentPage;
                if (currentJobsCount === 1 && currentPage > 1) {
                    pageToLoad = currentPage - 1;
                }

                await loadJobDetails(title, status, pageToLoad);
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
        const currentJobData = expandedJobs[key];

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

                await loadJobsSummary(true);

                const currentPage = currentJobData?.page || 1;
                const currentJobsCount = currentJobData?.jobs?.length || 0;
                const cancelledCount = selectedIds.length;

                let pageToLoad = currentPage;
                if (cancelledCount >= currentJobsCount && currentPage > 1) {
                    pageToLoad = currentPage - 1;
                }

                await loadJobDetails(title, status, pageToLoad);
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

    const canCancelJobs = (status: string) =>
        status.toLowerCase() === 'pending' || status.toLowerCase() === 'overdue';

    // --- Card helpers ---

    const getTotal = (job: JobSummary) =>
        job.pending_count + job.overdue_count + job.completed_count + job.failed_count;

    const getSuccessRate = (job: JobSummary) => {
        const total = getTotal(job);
        if (total === 0) return 0;
        return Math.round((job.completed_count / total) * 100);
    };

    const getHealthStatus = (job: JobSummary): { label: string; className: string } => {
        if (job.is_disabled) return { label: 'Down', className: cardStyles.down };
        const total = getTotal(job);
        if (total === 0) return { label: 'Idle', className: cardStyles.idle };
        const problematic = job.failed_count + job.overdue_count;
        if (problematic === 0) return { label: 'Healthy', className: cardStyles.healthy };
        if (problematic / total > 0.5) return { label: 'Critical', className: cardStyles.critical };
        return { label: 'Degraded', className: cardStyles.degraded };
    };

    const getPriorityClass = (priority: string) => {
        switch (priority) {
            case 'High': return cardStyles.priorityHigh;
            case 'Medium': return cardStyles.priorityMedium;
            default: return cardStyles.priorityLow;
        }
    };

    const getExpandedStatuses = (title: string) => {
        return Object.keys(expandedJobs).filter(k => k.startsWith(`${title}-`));
    };

    // --- Render day cells for a job ---
    const renderTimeline = (job: JobSummary) => {
        const jobHistory = dailyHistory[job.title] || {};
        const hoverKey = hoveredDay ? `${job.title}-${hoveredDay}` : null;

        return (
            <div style={{ position: 'relative' }}>
                <div className={cardStyles.timelineBar}>
                    {dateRange.map(date => {
                        const dayData = jobHistory[date];
                        const thisDayKey = `${job.title}-${date}`;
                        const isHovered = hoverKey === thisDayKey;

                        if (!dayData) {
                            return (
                                <div
                                    key={date}
                                    className={`${cardStyles.dayCell} ${cardStyles.dayCellEmpty}`}
                                    onMouseEnter={() => setHoveredDay(date)}
                                    onMouseLeave={() => setHoveredDay(null)}
                                    onClick={() => {
                                        // No data for this day
                                    }}
                                >
                                    {isHovered && (
                                        <div className={cardStyles.dayTooltip}>
                                            <div className={cardStyles.tooltipDate}>
                                                {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </div>
                                            <div style={{ color: '#5a6a7c' }}>No jobs</div>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        const statuses = Object.keys(dayData);
                        const dominant = dominantStatus(dayData);
                        const totalDay = Object.values(dayData).reduce((a, b) => a + b, 0);
                        const cellClass = statuses.length > 1 ? cardStyles.dayCellMixed : (STATUS_CELL_CLASS[dominant] || cardStyles.dayCellEmpty);

                        return (
                            <div
                                key={date}
                                className={`${cardStyles.dayCell} ${cellClass}`}
                                style={statuses.length > 1 ? {
                                    background: buildGradient(dayData, totalDay),
                                } : undefined}
                                onMouseEnter={() => setHoveredDay(date)}
                                onMouseLeave={() => setHoveredDay(null)}
                                onClick={() => {
                                    // Expand the dominant status for this job
                                    handleExpandToggle(job.title, dominant);
                                }}
                            >
                                {isHovered && (
                                    <div className={cardStyles.dayTooltip}>
                                        <div className={cardStyles.tooltipDate}>
                                            {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </div>
                                        {Object.entries(dayData).map(([status, count]) => (
                                            <div key={status} className={cardStyles.tooltipRow}>
                                                <span
                                                    className={cardStyles.tooltipDot}
                                                    style={{ backgroundColor: STATUS_COLORS[status] || '#8b8b8b' }}
                                                />
                                                {status}: {count}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className={cardStyles.timelineLabels}>
                    <span>{new Date(dateRange[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    <span>Today</span>
                </div>
            </div>
        );
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen={isMobile}
            maxWidth="md"
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
            <DialogTitle sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'center' },
                justifyContent: 'space-between',
                gap: { xs: 2, sm: 0 },
                padding: { xs: 2, sm: 3 }
            }}>
                <Typography variant={isMobile ? "subtitle1" : "h6"} sx={{ flexShrink: 0 }}>
                    Jobs Management
                </Typography>
                <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: 'center',
                    gap: { xs: 1, sm: 2 },
                    flexWrap: 'wrap'
                }}>
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        width: { xs: '100%', sm: 'auto' }
                    }}>
                        <FormControl size="small" sx={{ minWidth: { xs: 120, sm: 150 }, flex: { xs: 1, sm: 'none' } }}>
                            <InputLabel sx={{color: '#FAFAFA', '&.Mui-focused': {color: '#7b68ee'}}}>
                                Select Job
                            </InputLabel>
                            <Select
                                value={selectedJob}
                                onChange={(e) => setSelectedJob(e.target.value)}
                                label="Select Job"
                                sx={{
                                    color: '#FAFAFA',
                                    '& .MuiOutlinedInput-notchedOutline': {borderColor: '#5a6a7c'},
                                    '&:hover .MuiOutlinedInput-notchedOutline': {borderColor: '#FAFAFA'},
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {borderColor: '#7b68ee'},
                                    '& .MuiSvgIcon-root': {color: '#FAFAFA'}
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
                                '&:hover': {backgroundColor: '#6a5acd'},
                                '&:disabled': {backgroundColor: '#555'},
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {isMobile ? 'Start' : 'Start Job'}
                        </Button>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton
                            onClick={() => loadJobsSummary(true)}
                            disabled={loading}
                            sx={{color: '#FAFAFA'}}
                            size={isMobile ? "small" : "medium"}
                        >
                            <RefreshIcon/>
                        </IconButton>
                        <IconButton
                            onClick={onClose}
                            sx={{color: '#FAFAFA'}}
                            size={isMobile ? "small" : "medium"}
                        >
                            <CloseIcon/>
                        </IconButton>
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent sx={{padding: 0, overflow: 'auto'}}>
                <div className={cardStyles.cardList}>
                    {/* Legend at top */}
                    <div className={cardStyles.legend}>
                        {Object.entries(STATUS_COLORS).map(([status, color]) => (
                            <div key={status} className={cardStyles.legendItem} style={{ cursor: 'default' }}>
                                <span className={cardStyles.legendDot} style={{ backgroundColor: color }} />
                                {status}
                            </div>
                        ))}
                    </div>

                    {jobsSummary.map((job) => {
                        const health = getHealthStatus(job);
                        const total = getTotal(job);
                        const expandedKeys = getExpandedStatuses(job.title);

                        return (
                            <div key={job.title}>
                                {/* Job Card */}
                                <div className={cardStyles.jobCard}>
                                    {/* Card Header */}
                                    <div className={cardStyles.cardHeader}>
                                        <span className={cardStyles.jobTitle}>{job.title}</span>
                                        <span className={`${cardStyles.healthBadge} ${health.className}`}>
                                            {health.label}
                                        </span>
                                    </div>

                                    {/* Day-by-day timeline */}
                                    {renderTimeline(job)}

                                    {/* Card Footer */}
                                    <div className={cardStyles.cardFooter}>
                                        <div className={cardStyles.footerItem}>
                                            <span>{total} total</span>
                                        </div>
                                        <div className={cardStyles.footerItem}>
                                            <span className={cardStyles.successRate}>{getSuccessRate(job)}%</span>
                                            <span>success</span>
                                        </div>
                                        <span className={`${cardStyles.priorityPill} ${getPriorityClass(job.priority)}`}>
                                            {job.priority}
                                        </span>
                                    </div>
                                </div>

                                {/* Expanded detail sections */}
                                {expandedKeys.map((expandedKey) => {
                                    const jobData = expandedJobs[expandedKey];
                                    if (!jobData) return null;
                                    const status = jobData.status;

                                    return (
                                        <Collapse key={expandedKey} in={true} timeout="auto">
                                            <div className={cardStyles.expandedSection}>
                                                <div className={cardStyles.expandedHeader}>
                                                    <span className={cardStyles.expandedTitle}>
                                                        {job.title} — {status} Jobs
                                                    </span>
                                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                        {canCancelJobs(status) && (
                                                            <Button
                                                                startIcon={<DeleteIcon/>}
                                                                variant="outlined"
                                                                color="error"
                                                                size="small"
                                                                onClick={() => handleBulkCancel(job.title, status)}
                                                                disabled={(jobData?.selectedJobs?.size || 0) === 0}
                                                                sx={{ fontSize: '0.75rem' }}
                                                            >
                                                                Cancel ({jobData?.selectedJobs?.size || 0})
                                                            </Button>
                                                        )}
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleExpandToggle(job.title, status)}
                                                            sx={{color: '#FAFAFA'}}
                                                        >
                                                            <KeyboardArrowUpIcon/>
                                                        </IconButton>
                                                    </Box>
                                                </div>

                                                <Box sx={{
                                                    backgroundColor: '#0f1419',
                                                    borderRadius: 1,
                                                    border: '1px solid #2a3a50',
                                                    overflowX: 'auto',
                                                }}>
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow>
                                                                {canCancelJobs(status) && (
                                                                    <TableCell sx={{color: '#FAFAFA', borderBottom: '1px solid #2a3a50'}}>
                                                                        <Checkbox
                                                                            checked={jobData?.jobs?.length > 0 && jobData.jobs.every(j => jobData?.selectedJobs?.has(j.id))}
                                                                            indeterminate={(jobData?.selectedJobs?.size || 0) > 0 && (jobData?.selectedJobs?.size || 0) < (jobData?.jobs?.length || 0)}
                                                                            onChange={() => handleSelectAll(job.title, status)}
                                                                            sx={{color: '#FAFAFA', '&.Mui-checked': {color: '#7b68ee'}}}
                                                                        />
                                                                    </TableCell>
                                                                )}
                                                                <TableCell sx={{color: '#8b8b8b', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid #2a3a50'}}>ID</TableCell>
                                                                <TableCell sx={{color: '#8b8b8b', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid #2a3a50'}}>Priority</TableCell>
                                                                <TableCell sx={{color: '#8b8b8b', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid #2a3a50'}}>Due Date</TableCell>
                                                                <TableCell sx={{color: '#8b8b8b', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid #2a3a50'}}>Failures</TableCell>
                                                                <TableCell sx={{color: '#8b8b8b', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid #2a3a50'}}>Result</TableCell>
                                                                <TableCell sx={{color: '#8b8b8b', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid #2a3a50'}}>Status</TableCell>
                                                                {canCancelJobs(status) && (
                                                                    <TableCell sx={{color: '#8b8b8b', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid #2a3a50'}}>Actions</TableCell>
                                                                )}
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {jobData.loading ? (
                                                                <TableRow>
                                                                    <TableCell
                                                                        colSpan={canCancelJobs(status) ? 8 : 6}
                                                                        sx={{color: '#8b8b8b', textAlign: 'center', borderBottom: '1px solid #2a3a50'}}
                                                                    >
                                                                        Loading...
                                                                    </TableCell>
                                                                </TableRow>
                                                            ) : jobData.jobs.map((jobDetail) => (
                                                                <TableRow key={jobDetail.id} sx={{
                                                                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' }
                                                                }}>
                                                                    {canCancelJobs(status) && (
                                                                        <TableCell sx={{borderBottom: '1px solid #1a2938'}}>
                                                                            <Checkbox
                                                                                checked={jobData?.selectedJobs?.has(jobDetail.id) || false}
                                                                                onChange={() => handleJobSelection(jobDetail.id, job.title, status)}
                                                                                sx={{color: '#FAFAFA', '&.Mui-checked': {color: '#7b68ee'}}}
                                                                            />
                                                                        </TableCell>
                                                                    )}
                                                                    <TableCell sx={{color: '#FAFAFA', fontSize: '0.8rem', borderBottom: '1px solid #1a2938'}}>{jobDetail.id}</TableCell>
                                                                    <TableCell sx={{color: '#FAFAFA', fontSize: '0.8rem', borderBottom: '1px solid #1a2938'}}>{jobDetail.priority}</TableCell>
                                                                    <TableCell sx={{color: '#FAFAFA', fontSize: '0.8rem', borderBottom: '1px solid #1a2938'}}>
                                                                        {new Date(jobDetail.due_date).toLocaleString(undefined, {
                                                                            year: 'numeric',
                                                                            month: 'short',
                                                                            day: 'numeric',
                                                                            hour: '2-digit',
                                                                            minute: '2-digit',
                                                                        })}
                                                                    </TableCell>
                                                                    <TableCell sx={{color: '#FAFAFA', fontSize: '0.8rem', borderBottom: '1px solid #1a2938'}}>{jobDetail.failures}</TableCell>
                                                                    <TableCell sx={{color: '#FAFAFA', fontSize: '0.8rem', maxWidth: 180, borderBottom: '1px solid #1a2938'}}>
                                                                        <Tooltip title={jobDetail.result || 'No result yet'}>
                                                                            <Typography
                                                                                noWrap
                                                                                sx={{
                                                                                    overflow: 'hidden',
                                                                                    textOverflow: 'ellipsis',
                                                                                    maxWidth: 180,
                                                                                    fontSize: '0.8rem',
                                                                                }}
                                                                            >
                                                                                {jobDetail.result || 'Pending...'}
                                                                            </Typography>
                                                                        </Tooltip>
                                                                    </TableCell>
                                                                    <TableCell sx={{fontSize: '0.8rem', borderBottom: '1px solid #1a2938'}}>
                                                                        <span style={{
                                                                            color: jobDetail.job_type_disabled ? '#ef4444' : '#4ade80',
                                                                            fontSize: '0.75rem',
                                                                            fontWeight: 600,
                                                                        }}>
                                                                            {jobDetail.job_type_disabled ? 'Disabled' : 'Enabled'}
                                                                        </span>
                                                                    </TableCell>
                                                                    {canCancelJobs(status) && (
                                                                        <TableCell sx={{borderBottom: '1px solid #1a2938'}}>
                                                                            <IconButton
                                                                                size="small"
                                                                                onClick={() => handleCancelJob(jobDetail.id, job.title, status)}
                                                                                sx={{color: '#ef4444'}}
                                                                            >
                                                                                <CancelIcon fontSize="small"/>
                                                                            </IconButton>
                                                                        </TableCell>
                                                                    )}
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>

                                                    <TablePagination
                                                        component="div"
                                                        count={jobData.totalJobs}
                                                        page={jobData.page - 1}
                                                        onPageChange={(_, newPage) => handlePageChange(job.title, status, newPage)}
                                                        rowsPerPage={10}
                                                        rowsPerPageOptions={[10]}
                                                        sx={{
                                                            color: '#8b8b8b',
                                                            '& .MuiTablePagination-actions': {color: '#8b8b8b'},
                                                            '& .MuiIconButton-root': {color: '#8b8b8b'},
                                                            borderTop: '1px solid #2a3a50',
                                                        }}
                                                    />
                                                </Box>
                                            </div>
                                        </Collapse>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
};

/**
 * Build a CSS gradient showing proportional status colors for a mixed-status day.
 */
function buildGradient(dayData: Record<string, number>, total: number): string {
    const order = ['Completed', 'Pending', 'Overdue', 'Failed'];
    const stops: string[] = [];
    let pct = 0;

    for (const status of order) {
        const count = dayData[status];
        if (!count) continue;
        const color = STATUS_COLORS[status] || '#8b8b8b';
        const nextPct = pct + (count / total) * 100;
        stops.push(`${color} ${pct}%`);
        stops.push(`${color} ${nextPct}%`);
        pct = nextPct;
    }

    return `linear-gradient(to top, ${stops.join(', ')})`;
}

export default JobsDialog;
