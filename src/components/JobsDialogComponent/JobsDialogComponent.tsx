import React, {useEffect, useState} from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Typography, Card, Box, TablePagination, useMediaQuery, Button, IconButton,
    TextField, FormControl, InputLabel, Select, MenuItem, Grid, Chip, Collapse
} from "@mui/material";
import {Job} from '../../utils/interfaces.ts';
import {fetchJobsTable, startJob} from '../../services/investmentService.ts';
import {useMessage} from '../../contexts/MessageContext.tsx';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
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
    
    // Filter and Sort States
    const [filters, setFilters] = useState<Record<string, any>>({});
    const [sortBy, setSortBy] = useState('due_date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [showFilters, setShowFilters] = useState(false);
    const [loading, setLoading] = useState(false);

    const isMobile = useMediaQuery("(max-width:600px)");

    const fetchJobs = async (cacheState: boolean) => {
        try {
            setLoading(true);
            const jobsData = await fetchJobsTable(pages + 1, cacheState, filters, sortBy, sortOrder);
            setJobs(jobsData.jobs);
            setResults(jobsData.results);
        } catch (err) {
            console.error("Error fetching jobs", err);
            setPayload({
                type: "error",
                message: "Failed to fetch jobs. Please try again!",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs(false);
    }, [pages, filters, sortBy, sortOrder]);

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

    const handleFilterChange = (key: string, value: any) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
        setPages(0); // Reset to first page when filtering
    };

    const handleClearFilter = (key: string) => {
        setFilters(prev => {
            const newFilters = { ...prev };
            delete newFilters[key];
            return newFilters;
        });
        setPages(0);
    };

    const handleClearAllFilters = () => {
        setFilters({});
        setPages(0);
    };

    const getActiveFiltersCount = () => {
        return Object.keys(filters).filter(key => filters[key] !== '' && filters[key] !== null).length;
    };

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
                {/* Control Bar */}
                <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: 'wrap', marginBottom: '20px'}}>
                    <div style={{display: "flex", alignItems: "center", gap: "15px", flexWrap: 'wrap'}}>
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
                    </div>
                    
                    <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
                        <IconButton 
                            onClick={() => setShowFilters(!showFilters)}
                            sx={{ 
                                color: getActiveFiltersCount() > 0 ? '#7b68ee' : '#FAFAFA',
                                '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                            }}
                        >
                            <FilterListIcon />
                        </IconButton>
                        <IconButton
                            onClick={(e) => {
                                e.stopPropagation();
                                fetchJobs(true)
                            }}
                            disabled={loading}
                            sx={{ 
                                color: '#FAFAFA',
                                '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                                '&:disabled': { color: '#666' }
                            }}
                        >
                            <RefreshIcon/>
                        </IconButton>
                    </div>
                </div>

                {/* Filters Section */}
                <Collapse in={showFilters}>
                    <Box sx={{ 
                        backgroundColor: '#121c24', 
                        padding: 3, 
                        borderRadius: 2, 
                        marginBottom: 3,
                        border: '1px solid #fafafa'
                    }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                    label="Search Title"
                                    value={filters.title || ''}
                                    onChange={(e) => handleFilterChange('title', e.target.value)}
                                    size="small"
                                    fullWidth
                                    sx={{
                                        '& .MuiInputLabel-root': { color: '#FAFAFA' },
                                        '& .MuiInputLabel-root.Mui-focused': { color: '#7b68ee' },
                                        '& .MuiOutlinedInput-root': {
                                            color: '#FAFAFA',
                                            '& fieldset': { borderColor: '#5a6a7c' },
                                            '&:hover fieldset': { borderColor: '#FAFAFA' },
                                            '&.Mui-focused fieldset': { borderColor: '#7b68ee' },
                                        }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ color: '#FAFAFA', '&.Mui-focused': { color: '#7b68ee' } }}>Status</InputLabel>
                                    <Select
                                        value={filters.status || ''}
                                        onChange={(e) => handleFilterChange('status', e.target.value)}
                                        label="Status"
                                        sx={{
                                            color: '#FAFAFA',
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#5a6a7c' },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#FAFAFA' },
                                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#7b68ee' },
                                            '& .MuiSvgIcon-root': { color: '#FAFAFA' }
                                        }}
                                    >
                                        <MenuItem value="">All</MenuItem>
                                        <MenuItem value="Pending">Pending</MenuItem>
                                        <MenuItem value="Completed">Completed</MenuItem>
                                        <MenuItem value="Failed">Failed</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ color: '#FAFAFA', '&.Mui-focused': { color: '#7b68ee' } }}>Priority</InputLabel>
                                    <Select
                                        value={filters.priority || ''}
                                        onChange={(e) => handleFilterChange('priority', e.target.value)}
                                        label="Priority"
                                        sx={{
                                            color: '#FAFAFA',
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#5a6a7c' },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#FAFAFA' },
                                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#7b68ee' },
                                            '& .MuiSvgIcon-root': { color: '#FAFAFA' }
                                        }}
                                    >
                                        <MenuItem value="">All</MenuItem>
                                        <MenuItem value="High">High</MenuItem>
                                        <MenuItem value="Medium">Medium</MenuItem>
                                        <MenuItem value="Low">Low</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                    label="Min Failures"
                                    type="number"
                                    value={filters.min_failures || ''}
                                    onChange={(e) => handleFilterChange('min_failures', e.target.value)}
                                    size="small"
                                    fullWidth
                                    sx={{
                                        '& .MuiInputLabel-root': { color: '#FAFAFA' },
                                        '& .MuiInputLabel-root.Mui-focused': { color: '#7b68ee' },
                                        '& .MuiOutlinedInput-root': {
                                            color: '#FAFAFA',
                                            '& fieldset': { borderColor: '#5a6a7c' },
                                            '&:hover fieldset': { borderColor: '#FAFAFA' },
                                            '&.Mui-focused fieldset': { borderColor: '#7b68ee' },
                                        }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ color: '#FAFAFA', '&.Mui-focused': { color: '#7b68ee' } }}>Sort By</InputLabel>
                                    <Select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        label="Sort By"
                                        sx={{
                                            color: '#FAFAFA',
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#5a6a7c' },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#FAFAFA' },
                                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#7b68ee' },
                                            '& .MuiSvgIcon-root': { color: '#FAFAFA' }
                                        }}
                                    >
                                        <MenuItem value="due_date">Due Date</MenuItem>
                                        <MenuItem value="failures">Failures</MenuItem>
                                        <MenuItem value="created_at">Created Date</MenuItem>
                                        <MenuItem value="title">Title</MenuItem>
                                        <MenuItem value="status">Status</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ color: '#FAFAFA', '&.Mui-focused': { color: '#7b68ee' } }}>Sort Order</InputLabel>
                                    <Select
                                        value={sortOrder}
                                        onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                                        label="Sort Order"
                                        sx={{
                                            color: '#FAFAFA',
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#5a6a7c' },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#FAFAFA' },
                                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#7b68ee' },
                                            '& .MuiSvgIcon-root': { color: '#FAFAFA' }
                                        }}
                                    >
                                        <MenuItem value="desc">Descending</MenuItem>
                                        <MenuItem value="asc">Ascending</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Button
                                    onClick={handleClearAllFilters}
                                    startIcon={<ClearIcon />}
                                    variant="outlined"
                                    fullWidth
                                    disabled={getActiveFiltersCount() === 0}
                                    sx={{
                                        color: '#FAFAFA',
                                        borderColor: '#5a6a7c',
                                        '&:hover': {
                                            borderColor: '#FAFAFA',
                                            backgroundColor: 'rgba(255, 255, 255, 0.08)'
                                        },
                                        '&:disabled': {
                                            color: '#666',
                                            borderColor: '#333'
                                        }
                                    }}
                                >
                                    Clear All
                                </Button>
                            </Grid>
                        </Grid>
                        
                        {/* Active Filters Display */}
                        {getActiveFiltersCount() > 0 && (
                            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                <Typography variant="body2" sx={{ alignSelf: 'center', mr: 1, color: '#FAFAFA' }}>
                                    Active Filters:
                                </Typography>
                                {Object.entries(filters).map(([key, value]) => {
                                    if (!value) return null;
                                    return (
                                        <Chip
                                            key={key}
                                            label={`${key}: ${value}`}
                                            onDelete={() => handleClearFilter(key)}
                                            size="small"
                                            sx={{
                                                backgroundColor: 'rgba(123, 104, 238, 0.2)',
                                                color: '#FAFAFA',
                                                border: '1px solid #7b68ee',
                                                '& .MuiChip-deleteIcon': {
                                                    color: '#FAFAFA',
                                                    '&:hover': { color: '#ff6b6b' }
                                                }
                                            }}
                                        />
                                    );
                                })}
                            </Box>
                        )}
                    </Box>
                </Collapse>

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