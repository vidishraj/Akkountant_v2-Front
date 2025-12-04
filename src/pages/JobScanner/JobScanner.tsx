import {useState, useEffect} from 'react';
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
    TableSortLabel,
    Card,
    CardContent,
    LinearProgress,
    Divider
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import EmailIcon from '@mui/icons-material/Email';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DeleteIcon from '@mui/icons-material/Delete';
import WorkIcon from '@mui/icons-material/Work';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import style from './JobScanner.module.scss';
import {useMessage} from '../../contexts/MessageContext';
import {
    JobEmail,
    fetchJobEmails,
    scanEmails,
    getEmailStats,
    updateEmailDetails,
    markEmailAsRead,
    deleteEmail,
} from '../../services/jobScannerService';
import DateModal from '../../components/DateModalComponent';

// Status mapping constants
const STATUS_COLORS: Record<string, string> = {
    applied: '#4A90E2',
    interview_scheduled: '#7B68EE',
    rejected: '#E74C3C',
    offer: '#2ECC71',
    status_update: '#F39C12',
    unknown: '#95A5A6'
};

interface EmailDetailsModalProps {
    open: boolean;
    onClose: () => void;
    email: JobEmail | null;
    onSave: (emailId: string, updates: any) => void;
}

const EmailDetailsModal: React.FC<EmailDetailsModalProps> = ({open, onClose, email, onSave}) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const [isEditing, setIsEditing] = useState(false);
    const [editedEmail, setEditedEmail] = useState<Partial<JobEmail>>({});

    useEffect(() => {
        if (email) {
            setEditedEmail({
                company_name: email.company_name,
                job_title: email.job_title,
                application_status: email.application_status,
                application_type: email.application_type
            });
        }
    }, [email]);

    if (!email) return null;

    const handleSave = () => {
        onSave(email.id, editedEmail);
        setIsEditing(false);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen={fullScreen}
            maxWidth="md"
            fullWidth
            PaperProps={{
                style: {
                    backgroundColor: '#121C24',
                    color: '#FAFAFA'
                }
            }}
        >
            <DialogTitle className={style.modalTitle}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Email Details</Typography>
                    <Box>
                        {isEditing ? (
                            <IconButton onClick={handleSave} sx={{color: '#FAFAFA', mr: 1}}>
                                <SaveIcon/>
                            </IconButton>
                        ) : (
                            <IconButton onClick={() => setIsEditing(true)} sx={{color: '#FAFAFA', mr: 1}}>
                                <EditIcon/>
                            </IconButton>
                        )}
                        <IconButton onClick={onClose} sx={{color: '#FAFAFA'}}>
                            <CloseIcon/>
                        </IconButton>
                    </Box>
                </Box>
            </DialogTitle>
            <DialogContent className={style.modalContent}>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Company Name"
                            value={editedEmail.company_name || ''}
                            onChange={(e) => setEditedEmail({...editedEmail, company_name: e.target.value})}
                            disabled={!isEditing}
                            variant="outlined"
                            sx={{
                                '& .MuiInputBase-input': {
                                    color: '#FAFAFA !important',
                                },
                                '& .MuiInputBase-input.Mui-disabled': {
                                    WebkitTextFillColor: '#FAFAFA !important',
                                }
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Job Title"
                            value={editedEmail.job_title || ''}
                            onChange={(e) => setEditedEmail({...editedEmail, job_title: e.target.value})}
                            disabled={!isEditing}
                            variant="outlined"
                            sx={{
                                '& .MuiInputBase-input': {
                                    color: '#FAFAFA !important',
                                },
                                '& .MuiInputBase-input.Mui-disabled': {
                                    WebkitTextFillColor: '#FAFAFA !important',
                                }
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth disabled={!isEditing}>
                            <InputLabel sx={{ color: '#FAFAFA !important' }}>Status</InputLabel>
                            <Select
                                value={editedEmail.application_status || ''}
                                onChange={(e) => setEditedEmail({...editedEmail, application_status: e.target.value as any})}
                                label="Status"
                                sx={{
                                    color: '#FAFAFA !important',
                                    '& .MuiSelect-select': {
                                        color: '#FAFAFA !important',
                                    },
                                    '& .MuiOutlinedInput-input': {
                                        color: '#FAFAFA !important',
                                    },
                                    '& .MuiInputBase-input': {
                                        color: '#FAFAFA !important',
                                    },
                                    '&.Mui-disabled': {
                                        color: '#FAFAFA !important',
                                        '& .MuiSelect-select': {
                                            color: '#FAFAFA !important',
                                            WebkitTextFillColor: '#FAFAFA !important',
                                        },
                                        '& .MuiOutlinedInput-input': {
                                            color: '#FAFAFA !important',
                                            WebkitTextFillColor: '#FAFAFA !important',
                                        }
                                    }
                                }}
                                MenuProps={{
                                    PaperProps: {
                                        sx: {
                                            backgroundColor: '#29384D',
                                            '& .MuiMenuItem-root': {
                                                color: '#FAFAFA',
                                                '&:hover': {
                                                    backgroundColor: '#3a4a5c',
                                                },
                                                '&.Mui-selected': {
                                                    backgroundColor: 'rgba(123, 104, 238, 0.2)',
                                                    '&:hover': {
                                                        backgroundColor: 'rgba(123, 104, 238, 0.3)',
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }}
                            >
                                <MenuItem value="applied">Applied</MenuItem>
                                <MenuItem value="interview_scheduled">Interview Scheduled</MenuItem>
                                <MenuItem value="rejected">Rejected</MenuItem>
                                <MenuItem value="offer">Offer</MenuItem>
                                <MenuItem value="status_update">Status Update</MenuItem>
                                <MenuItem value="unknown">Unknown</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth disabled={!isEditing}>
                            <InputLabel sx={{ color: '#FAFAFA !important' }}>Type</InputLabel>
                            <Select
                                value={editedEmail.application_type || ''}
                                onChange={(e) => setEditedEmail({...editedEmail, application_type: e.target.value as any})}
                                label="Type"
                                sx={{
                                    color: '#FAFAFA !important',
                                    '& .MuiSelect-select': {
                                        color: '#FAFAFA !important',
                                    },
                                    '& .MuiOutlinedInput-input': {
                                        color: '#FAFAFA !important',
                                    },
                                    '& .MuiInputBase-input': {
                                        color: '#FAFAFA !important',
                                    },
                                    '&.Mui-disabled': {
                                        color: '#FAFAFA !important',
                                        '& .MuiSelect-select': {
                                            color: '#FAFAFA !important',
                                            WebkitTextFillColor: '#FAFAFA !important',
                                        },
                                        '& .MuiOutlinedInput-input': {
                                            color: '#FAFAFA !important',
                                            WebkitTextFillColor: '#FAFAFA !important',
                                        }
                                    }
                                }}
                                MenuProps={{
                                    PaperProps: {
                                        sx: {
                                            backgroundColor: '#29384D',
                                            '& .MuiMenuItem-root': {
                                                color: '#FAFAFA',
                                                '&:hover': {
                                                    backgroundColor: '#3a4a5c',
                                                },
                                                '&.Mui-selected': {
                                                    backgroundColor: 'rgba(123, 104, 238, 0.2)',
                                                    '&:hover': {
                                                        backgroundColor: 'rgba(123, 104, 238, 0.3)',
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }}
                            >
                                <MenuItem value="new_application">New Application</MenuItem>
                                <MenuItem value="status_update">Status Update</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{mb: 1}}>Subject:</Typography>
                        <Typography variant="body2" sx={{color: '#B0B0B0'}}>{email.subject}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{mb: 1}}>From:</Typography>
                        <Typography variant="body2" sx={{color: '#B0B0B0'}}>{email.sender_email}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{mb: 1}}>Date Received:</Typography>
                        <Typography variant="body2" sx={{color: '#B0B0B0'}}>
                            {new Date(email.date_received).toLocaleString()}
                        </Typography>
                    </Grid>
                    <Grid item xs={12}>
                        <Divider sx={{backgroundColor: '#3a4a5c', my: 2}}/>
                        <Typography variant="subtitle2" sx={{mb: 1}}>Email Content:</Typography>
                        <Box
                            sx={{
                                backgroundColor: '#29384D',
                                padding: 2,
                                borderRadius: 1,
                                maxHeight: '300px',
                                overflowY: 'auto'
                            }}
                        >
                            <Typography variant="body2" style={{whiteSpace: 'pre-wrap', color: '#E0E0E0'}}>
                                {email.email_body}
                            </Typography>
                        </Box>
                    </Grid>
                    {email.gmail_link && (
                        <Grid item xs={12}>
                            <Button
                                variant="outlined"
                                href={email.gmail_link}
                                target="_blank"
                                startIcon={<EmailIcon/>}
                            >
                                Open in Gmail
                            </Button>
                        </Grid>
                    )}
                </Grid>
            </DialogContent>
            <DialogActions className={style.modalActions}>
                <Button onClick={onClose} variant="outlined">
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};

const JobScanner = () => {
    const [emails, setEmails] = useState<JobEmail[]>([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState<JobEmail | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [dateModalOpen, setDateModalOpen] = useState(false);
    
    // Filter states
    const [filters, setFilters] = useState<{
        company_name?: string;
        application_status?: string;
        application_type?: string;
        date_from?: string;
        date_to?: string;
        search?: string;
    }>({});
    
    // Sort states
    const [sortBy, setSortBy] = useState('date_received');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    
    // Stats
    const [stats, setStats] = useState({
        total_applications: 0,
        interviews_scheduled: 0,
        offers_received: 0,
        rejections: 0,
        pending_responses: 0
    });

    const {setPayload} = useMessage();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Convert date from YYYY/M/D to YYYY-MM-DD format
    const convertDateFormat = (dateStr: string): string => {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const year = parts[0];
            const month = parts[1].padStart(2, '0');
            const day = parts[2].padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        return dateStr;
    };

    const fetchEmails = async (clearCache: boolean = false) => {
        try {
            setLoading(true);
            const data = await fetchJobEmails(page + 1, rowsPerPage, filters, sortBy, sortOrder, clearCache);
            setEmails(data.emails);
            setTotalCount(data.pagination.total);
        } catch (error) {
            setPayload({
                type: 'error',
                message: 'Failed to fetch job emails. Please try again!'
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async (clearCache: boolean = false) => {
        try {
            const data = await getEmailStats(clearCache);
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    useEffect(() => {
        fetchEmails();
        fetchStats();
    }, [page, rowsPerPage, filters, sortBy, sortOrder]);

    const handleEmailClick = async (email: JobEmail) => {
        setSelectedEmail(email);
        if (!email.is_read) {
            try {
                await markEmailAsRead(email.id);
                // Update local state
                setEmails(emails.map(e => e.id === email.id ? {...e, is_read: true} : e));
            } catch (error) {
                console.error('Failed to mark as read:', error);
            }
        }
    };

    const handleUpdateEmail = async (emailId: string, updates: any) => {
        try {
            await updateEmailDetails(emailId, updates);
            setPayload({
                type: 'success',
                message: 'Email updated successfully!'
            });
            // Clear cache and refresh both emails and stats
            fetchEmails(true);
            fetchStats(true);
            setSelectedEmail(null);
        } catch (error) {
            setPayload({
                type: 'error',
                message: 'Failed to update email. Please try again!'
            });
        }
    };

    const handleDeleteEmail = async (emailId: string) => {
        if (!window.confirm('Are you sure you want to delete this email?')) {
            return;
        }
        
        try {
            await deleteEmail(emailId);
            setPayload({
                type: 'success',
                message: 'Email deleted successfully!'
            });
            // Clear cache and refresh both emails and stats
            fetchEmails(true);
            fetchStats(true);
        } catch (error) {
            setPayload({
                type: 'error',
                message: 'Failed to delete email. Please try again!'
            });
        }
    };

    const handleSort = (column: string) => {
        const isAsc = sortBy === column && sortOrder === 'asc';
        setSortOrder(isAsc ? 'desc' : 'asc');
        setSortBy(column);
    };

    const handleClearFilters = () => {
        setFilters({});
    };

    const getStatusChip = (status: string) => {
        return (
            <Chip
                label={status.replace(/_/g, ' ').toUpperCase()}
                size="small"
                sx={{
                    backgroundColor: STATUS_COLORS[status] || '#95A5A6',
                    color: '#FFFFFF',
                    fontWeight: 'bold'
                }}
            />
        );
    };

    return (
        <Box className={style.jobScannerContainer}>
            {/* Stats Cards */}
            <Box className={style.statsContainer}>
                <Card className={style.statCard}>
                    <CardContent className={style.statCardContent}>
                        <WorkIcon className={style.statIcon} sx={{ color: '#4A90E2' }} />
                        <Typography variant="h4" className={style.statNumber}>{stats.total_applications}</Typography>
                        <Typography variant="body2" className={style.statLabel}>Applied</Typography>
                    </CardContent>
                </Card>
                <Card className={style.statCard}>
                    <CardContent className={style.statCardContent}>
                        <HourglassEmptyIcon className={style.statIcon} sx={{ color: '#F39C12' }} />
                        <Typography variant="h4" className={style.statNumber}>{stats.pending_responses}</Typography>
                        <Typography variant="body2" className={style.statLabel}>Pending</Typography>
                    </CardContent>
                </Card>
                <Card className={style.statCard}>
                    <CardContent className={style.statCardContent}>
                        <CancelIcon className={style.statIcon} sx={{ color: '#E74C3C' }} />
                        <Typography variant="h4" className={style.statNumber}>{stats.rejections}</Typography>
                        <Typography variant="body2" className={style.statLabel}>Rejected</Typography>
                    </CardContent>
                </Card>
            </Box>

            {/* Actions Container */}
            <Box className={style.actionsContainer}>
                <IconButton 
                    onClick={() => setDateModalOpen(true)} 
                    className={style.iconButton}
                    disabled={scanning}
                    title="Scan Emails"
                >
                    <CalendarMonthIcon/>
                </IconButton>
                <IconButton 
                    onClick={() => {
                        fetchEmails(true);
                        fetchStats(true);
                    }} 
                    disabled={loading} 
                    className={style.iconButton}
                    title="Refresh"
                >
                    <RefreshIcon/>
                </IconButton>
                <IconButton onClick={() => setShowFilters(!showFilters)} className={style.iconButton}>
                    <FilterListIcon/>
                </IconButton>
                {Object.keys(filters).length > 0 && (
                    <IconButton onClick={handleClearFilters} className={style.iconButton}>
                        <ClearIcon/>
                    </IconButton>
                )}
            </Box>

            {scanning && <LinearProgress className={style.progressBar}/>}

            {/* Filters Container */}
            {showFilters && (
                <Box className={style.filtersContainer}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                fullWidth
                                label="Search"
                                value={filters.search || ''}
                                onChange={(e) => setFilters({...filters, search: e.target.value})}
                                placeholder="Search emails..."
                                InputProps={{
                                    startAdornment: <SearchIcon sx={{mr: 1, color: '#FAFAFA'}}/>
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                fullWidth
                                label="Company Name"
                                value={filters.company_name || ''}
                                onChange={(e) => setFilters({...filters, company_name: e.target.value})}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth>
                                <InputLabel sx={{ color: '#FAFAFA !important' }}>Status</InputLabel>
                                <Select
                                    value={filters.application_status || ''}
                                    onChange={(e) => setFilters({...filters, application_status: e.target.value})}
                                    label="Status"
                                    sx={{
                                        color: '#FAFAFA !important',
                                        '& .MuiSelect-select': {
                                            color: '#FAFAFA !important',
                                        }
                                    }}
                                    MenuProps={{
                                        PaperProps: {
                                            sx: {
                                                backgroundColor: '#29384D',
                                                '& .MuiMenuItem-root': {
                                                    color: '#FAFAFA',
                                                    '&:hover': {
                                                        backgroundColor: '#3a4a5c',
                                                    },
                                                    '&.Mui-selected': {
                                                        backgroundColor: 'rgba(123, 104, 238, 0.2)',
                                                        '&:hover': {
                                                            backgroundColor: 'rgba(123, 104, 238, 0.3)',
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }}
                                >
                                    <MenuItem value="">All</MenuItem>
                                    <MenuItem value="applied">Applied</MenuItem>
                                    <MenuItem value="interview_scheduled">Interview Scheduled</MenuItem>
                                    <MenuItem value="rejected">Rejected</MenuItem>
                                    <MenuItem value="offer">Offer</MenuItem>
                                    <MenuItem value="status_update">Status Update</MenuItem>
                                    <MenuItem value="unknown">Unknown</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth>
                                <InputLabel sx={{ color: '#FAFAFA !important' }}>Type</InputLabel>
                                <Select
                                    value={filters.application_type || ''}
                                    onChange={(e) => setFilters({...filters, application_type: e.target.value})}
                                    label="Type"
                                    sx={{
                                        color: '#FAFAFA !important',
                                        '& .MuiSelect-select': {
                                            color: '#FAFAFA !important',
                                        }
                                    }}
                                    MenuProps={{
                                        PaperProps: {
                                            sx: {
                                                backgroundColor: '#29384D',
                                                '& .MuiMenuItem-root': {
                                                    color: '#FAFAFA',
                                                    '&:hover': {
                                                        backgroundColor: '#3a4a5c',
                                                    },
                                                    '&.Mui-selected': {
                                                        backgroundColor: 'rgba(123, 104, 238, 0.2)',
                                                        '&:hover': {
                                                            backgroundColor: 'rgba(123, 104, 238, 0.3)',
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }}
                                >
                                    <MenuItem value="">All</MenuItem>
                                    <MenuItem value="new_application">New Application</MenuItem>
                                    <MenuItem value="status_update">Status Update</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </Box>
            )}

            {/* Table Container */}
            <TableContainer component={Paper} className={style.tableContainer}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>
                                <TableSortLabel
                                    active={sortBy === 'company_name'}
                                    direction={sortBy === 'company_name' ? sortOrder : 'asc'}
                                    onClick={() => handleSort('company_name')}
                                >
                                    Company
                                </TableSortLabel>
                            </TableCell>
                            {!isMobile && (
                                <TableCell>
                                    <TableSortLabel
                                        active={sortBy === 'job_title'}
                                        direction={sortBy === 'job_title' ? sortOrder : 'asc'}
                                        onClick={() => handleSort('job_title')}
                                    >
                                        Job Title
                                    </TableSortLabel>
                                </TableCell>
                            )}
                            <TableCell>Status</TableCell>
                            {!isMobile && <TableCell>Type</TableCell>}
                            <TableCell>
                                <TableSortLabel
                                    active={sortBy === 'date_received'}
                                    direction={sortBy === 'date_received' ? sortOrder : 'asc'}
                                    onClick={() => handleSort('date_received')}
                                >
                                    Date
                                </TableSortLabel>
                            </TableCell>
                            {!isMobile && <TableCell>Sender</TableCell>}
                            <TableCell align="center">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={isMobile ? 4 : 7} align="center">
                                    <Typography>Loading...</Typography>
                                </TableCell>
                            </TableRow>
                        ) : emails.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={isMobile ? 4 : 7} align="center">
                                    <Typography>No job emails found. Try scanning your inbox!</Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            emails.map((email) => (
                                <TableRow
                                    key={email.id}
                                    hover
                                    className={!email.is_read ? style.unreadRow : ''}
                                >
                                    <TableCell>
                                        {email.company_name}
                                    </TableCell>
                                    {!isMobile && (
                                        <TableCell>{email.job_title || 'N/A'}</TableCell>
                                    )}
                                    <TableCell>{getStatusChip(email.application_status)}</TableCell>
                                    {!isMobile && (
                                        <TableCell>
                                            <Chip
                                                label={email.application_type.replace(/_/g, ' ').toUpperCase()}
                                                size="small"
                                                sx={{
                                                    backgroundColor: email.application_type === 'new_application' ? 'rgba(74, 144, 226, 0.2)' : 'rgba(243, 156, 18, 0.2)',
                                                    color: email.application_type === 'new_application' ? '#4A90E2' : '#F39C12',
                                                    border: `1px solid ${email.application_type === 'new_application' ? '#4A90E2' : '#F39C12'}`,
                                                    fontWeight: 'bold'
                                                }}
                                            />
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        {new Date(email.date_received).toLocaleDateString()}
                                    </TableCell>
                                    {!isMobile && (
                                        <TableCell sx={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                            {email.sender_email}
                                        </TableCell>
                                    )}
                                    <TableCell align="center">
                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                            <IconButton
                                                onClick={() => handleEmailClick(email)}
                                                size="small"
                                                className={style.actionButton}
                                                title="View Details"
                                            >
                                                <VisibilityIcon fontSize="small"/>
                                            </IconButton>
                                            <IconButton
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteEmail(email.id);
                                                }}
                                                size="small"
                                                className={style.deleteButton}
                                                title="Delete Email"
                                            >
                                                <DeleteIcon fontSize="small"/>
                                            </IconButton>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Pagination */}
            <TablePagination
                component="div"
                count={totalCount}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                }}
                className={style.pagination}
            />

            {/* Email Details Modal */}
            <EmailDetailsModal
                open={!!selectedEmail}
                onClose={() => setSelectedEmail(null)}
                email={selectedEmail}
                onSave={handleUpdateEmail}
            />

            {/* Date Range Modal for Scanning */}
            <DateModal
                isOpen={dateModalOpen}
                onCancel={() => setDateModalOpen(false)}
                onSubmit={async (dates) => {
                    setDateModalOpen(false);
                    setPayload({
                        type: 'warning',
                        message: 'Scanning emails in the background...'
                    });
                    
                    try {
                        setScanning(true);
                        // Convert dates from YYYY/M/D to YYYY-MM-DD format
                        const formattedDateFrom = convertDateFormat(dates.from);
                        const formattedDateTo = convertDateFormat(dates.to);
                        
                        const result = await scanEmails({
                            date_from: formattedDateFrom,
                            date_to: formattedDateTo
                        });
                        setPayload({
                            type: 'success',
                            message: `Scan complete! Processed ${result.processed_count} emails, found ${result.new_emails_count} new applications.`
                        });
                        // Clear cache and refresh both emails and stats
                        fetchEmails(true);
                        fetchStats(true);
                    } catch (error) {
                        setPayload({
                            type: 'error',
                            message: 'Failed to scan emails. Please try again!'
                        });
                    } finally {
                        setScanning(false);
                    }
                }}
                title="Job Email Scanner - Select Date Range"
            />
        </Box>
    );
};

export default JobScanner;
