import React, {useState, useEffect} from 'react';
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Paper,
    IconButton,
    Select,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    useMediaQuery,
    useTheme,
    TextField,
    FormControl,
    InputLabel,
    Grid,
    Chip,
    TableSortLabel
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import style from './Jobs.module.scss';
import {useMessage} from '../../contexts/MessageContext';
import {JobData, fetchJobs, updateJobs, processEmails} from '../../services/jobService';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DateModal from "../../components/DateModalComponent.tsx";

// Verdict mapping constants
const VERDICT_TO_DISPLAY = {
    1: 'applied',
    2: 'rejected',
    3: 'accepted'
} as const;

const DISPLAY_TO_VERDICT = {
    'applied': 1,
    'rejected': 2,
    'accepted': 3
} as const;

interface TextModalProps {
    open: boolean;
    onClose: () => void;
    text: string;
}

const TextModal: React.FC<TextModalProps> = ({open, onClose, text}) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen={fullScreen}
            PaperProps={{
                style: {
                    backgroundColor: '#121C24',
                    color: '#FAFAFA',
                    maxWidth: '600px',
                    width: '100%'
                }
            }}
        >
            <DialogTitle className={style.modalTitle}>
                Job Description
                <IconButton
                    onClick={onClose}
                    sx={{position: 'absolute', right: 8, top: 8, color: '#FAFAFA'}}
                >
                    <CloseIcon/>
                </IconButton>
            </DialogTitle>
            <DialogContent className={style.modalContent}>
                <Typography style={{whiteSpace: 'pre-wrap'}}>
                    {text}
                </Typography>
            </DialogContent>
            <DialogActions className={style.modalActions}>
                <Button onClick={onClose} variant="contained" color="primary">
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};

interface DescriptionCellProps {
    text: string;
    onExpand: () => void;
}

const DescriptionCell: React.FC<DescriptionCellProps> = ({text, onExpand}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));

    // Determine max width based on viewport
    const getMaxWidth = () => {
        if (isMobile) return '120px';
        if (isTablet) return '200px';
        return '300px';
    };

    // Clean text for preview (remove extra whitespace and newlines)
    const cleanText = text.replace(/\s+/g, ' ').trim();

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                maxWidth: getMaxWidth(),
                width: '100%'
            }}
        >
            <Typography
                variant="body2"
                sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0 // Important for ellipsis to work in flex container
                }}
                title={cleanText} // Show full text on hover
            >
                {cleanText}
            </Typography>
            <IconButton
                onClick={onExpand}
                className={style.expandButton}
                size="small"
                sx={{flexShrink: 0}}
            >
                <ExpandMoreIcon fontSize="small"/>
            </IconButton>
        </Box>
    );
};

const Jobs = () => {
    const [jobs, setJobs] = useState<JobData[]>([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [dateModalState, setDateModalState] = useState(false);
    const [editedCells, setEditedCells] = useState<Record<string, any>>({});
    const [selectedText, setSelectedText] = useState<string | null>(null);
    
    // Filter and Sort States
    const [filters, setFilters] = useState<Record<string, any>>({});
    const [sortBy, setSortBy] = useState('due_date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [showFilters, setShowFilters] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const {setPayload} = useMessage();

    const fetchJobsData = async (cache: boolean) => {
        try {
            setLoading(true);
            const data = await fetchJobs(page + 1, rowsPerPage, cache, filters, sortBy, sortOrder);
            setJobs(data.items);
            setTotalCount(data.pagination.total);
        } catch (error) {
            setPayload({
                type: 'error',
                message: 'Failed to fetch jobs. Please try again!'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobsData(true);
    }, [page, rowsPerPage, filters, sortBy, sortOrder]);

    const handleCellEdit = (jobId: string, field: string, value: string) => {
        setEditedCells(prev => ({
            ...prev,
            [`${jobId}-${field}`]: value
        }));
    };

    const handleSave = async () => {
        try {
            const updates = Object.entries(editedCells).map(([key, value]) => {
                const [jobId, field] = key.split('-');
                return {
                    jobId,
                    field,
                    value
                };
            });

            await updateJobs(updates);

            setPayload({
                type: 'success',
                message: 'Changes saved successfully!'
            });
            setEditedCells({});
            fetchJobsData(true);
        } catch (error) {
            setPayload({
                type: 'error',
                message: 'Failed to save changes. Please try again!'
            });
        }
    };

    const getVerdictDisplay = (verdict: 1 | 2 | 3) => {
        return VERDICT_TO_DISPLAY[verdict];
    };

    const handleVerdictChange = (jobId: string, value: string) => {
        const numericValue = DISPLAY_TO_VERDICT[value as keyof typeof DISPLAY_TO_VERDICT];
        handleCellEdit(jobId, 'verdict', numericValue.toString());
    };

    const handleFilterChange = (key: string, value: any) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
        setPage(0); // Reset to first page when filtering
    };

    const handleClearFilter = (key: string) => {
        setFilters(prev => {
            const newFilters = { ...prev };
            delete newFilters[key];
            return newFilters;
        });
        setPage(0);
    };

    const handleClearAllFilters = () => {
        setFilters({});
        setPage(0);
    };

    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
        setPage(0);
    };

    const getActiveFiltersCount = () => {
        return Object.keys(filters).filter(key => filters[key] !== '' && filters[key] !== null).length;
    };

    return (
        <Box className={style.jobsContainer}>
            <Box className={style.actionsContainer}>
                <DateModal
                    title={"Job Email Search"}
                    isOpen={dateModalState}
                    onSubmit={(dates) => {
                        setDateModalState(false);
                        setPayload({
                            type: "warning",
                            message: "Jobs being read in the background.",
                        });
                        if (dates !== undefined) {
                            processEmails(dates.from, dates.to).then(() => {
                                setPayload({
                                    type: "success",
                                    message: "Jobs read successfully.",
                                });
                                fetchJobsData(true);
                            }).catch(() => {
                                setPayload({
                                    type: "error",
                                    message: "Error while looking for job emails.",
                                });
                            })
                        }
                        return;
                    }
                    }
                    onCancel={() => {
                        setDateModalState(false);
                    }}
                />
                <IconButton
                    onClick={() => setDateModalState(true)}
                    className={style.actionButton}
                >
                    <CalendarMonthIcon/>
                </IconButton>
                <IconButton
                    onClick={() => fetchJobsData(true)}
                    className={style.actionButton}
                    disabled={loading}
                >
                    <RefreshIcon/>
                </IconButton>
                <IconButton
                    onClick={() => setShowFilters(!showFilters)}
                    className={style.actionButton}
                    color={getActiveFiltersCount() > 0 ? "primary" : "default"}
                >
                    <FilterListIcon/>
                </IconButton>
                <IconButton
                    onClick={handleSave}
                    disabled={Object.keys(editedCells).length === 0}
                    className={style.actionButton}
                >
                    <SaveIcon/>
                </IconButton>
            </Box>
            
            {/* Filters Section */}
            {showFilters && (
                <Box className={style.filtersContainer}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <TextField
                                    label="Search Title/Employer"
                                    value={filters.title || ''}
                                    onChange={(e) => handleFilterChange('title', e.target.value)}
                                    size="small"
                                    variant="outlined"
                                />
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Status</InputLabel>
                                <Select
                                    value={filters.status || ''}
                                    onChange={(e) => handleFilterChange('status', e.target.value)}
                                    label="Status"
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
                                <InputLabel>Priority</InputLabel>
                                <Select
                                    value={filters.priority || ''}
                                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                                    label="Priority"
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
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Sort By</InputLabel>
                                <Select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    label="Sort By"
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
                                <InputLabel>Sort Order</InputLabel>
                                <Select
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                                    label="Sort Order"
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
                            >
                                Clear All
                            </Button>
                        </Grid>
                    </Grid>
                    
                    {/* Active Filters Display */}
                    {getActiveFiltersCount() > 0 && (
                        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            <Typography variant="body2" sx={{ alignSelf: 'center', mr: 1 }}>
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
                                        color="primary"
                                        variant="outlined"
                                    />
                                );
                            })}
                        </Box>
                    )}
                </Box>
            )}
            <Box className={style.tableWrapper}>
                <TableContainer component={Paper} className={style.tableContainer}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell>
                                    <TableSortLabel
                                        active={sortBy === 'email_date'}
                                        direction={sortBy === 'email_date' ? sortOrder : 'desc'}
                                        onClick={() => handleSort('email_date')}
                                    >
                                        Date
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel
                                        active={sortBy === 'employer'}
                                        direction={sortBy === 'employer' ? sortOrder : 'desc'}
                                        onClick={() => handleSort('employer')}
                                    >
                                        Employer
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel
                                        active={sortBy === 'role'}
                                        direction={sortBy === 'role' ? sortOrder : 'desc'}
                                        onClick={() => handleSort('role')}
                                    >
                                        Role
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>
                                    <TableSortLabel
                                        active={sortBy === 'verdict'}
                                        direction={sortBy === 'verdict' ? sortOrder : 'desc'}
                                        onClick={() => handleSort('verdict')}
                                    >
                                        Verdict
                                    </TableSortLabel>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {jobs.map((job) => (
                                <TableRow key={job.id}>
                                    <TableCell>{new Date(job.email_date).toLocaleDateString()}</TableCell>
                                    <TableCell className={style.editableCell}>
                                        <input
                                            type="text"
                                            value={editedCells[`${job.id}-employer`] ?? job.employer}
                                            onChange={(e) => handleCellEdit(job.id, 'employer', e.target.value)}
                                            className={style.editableInput}
                                        />
                                    </TableCell>
                                    <TableCell className={style.editableCell}>
                                        <input
                                            type="text"
                                            value={editedCells[`${job.id}-role`] ?? job.role}
                                            onChange={(e) => handleCellEdit(job.id, 'role', e.target.value)}
                                            className={style.editableInput}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <DescriptionCell
                                            text={job.email_body}
                                            onExpand={() => setSelectedText(job.email_body)}
                                        />
                                    </TableCell>
                                    <TableCell className={style.editableCell}>
                                        <Select
                                            value={editedCells[`${job.id}-verdict`]
                                                ? getVerdictDisplay(editedCells[`${job.id}-verdict`])
                                                : getVerdictDisplay(job.verdict)}
                                            onChange={(e) => handleVerdictChange(job.id, e.target.value)}
                                            className={style.verdictSelect}
                                            variant="standard"
                                            fullWidth
                                        >
                                            <MenuItem value="applied">Applied</MenuItem>
                                            <MenuItem value="rejected">Rejected</MenuItem>
                                            <MenuItem value="accepted">Accepted</MenuItem>
                                        </Select>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>
            <Box className={style.paginationContainer}>
                <TablePagination
                    component="div"
                    className={style.pagination}
                    page={page}
                    count={totalCount}
                    rowsPerPage={rowsPerPage}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                />
            </Box>
            <TextModal
                open={selectedText !== null}
                onClose={() => setSelectedText(null)}
                text={selectedText || ''}
            />
        </Box>
    );
};

export default Jobs;