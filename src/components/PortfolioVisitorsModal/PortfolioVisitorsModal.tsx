import {useState, useEffect} from 'react';
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
    TablePagination,
    Box,
    Card,
    CardContent,
    useMediaQuery,
    useTheme,
    Chip,
    Tab,
    Tabs,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import PublicIcon from '@mui/icons-material/Public';
import PeopleIcon from '@mui/icons-material/People';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import style from './PortfolioVisitorsModal.module.scss';
import {
    PortfolioVisitor,
    VisitorStats,
    fetchVisitors,
    fetchVisitorStats,
} from '../../services/portfolioVisitorService';

interface PortfolioVisitorsModalProps {
    open: boolean;
    onClose: () => void;
}

const PortfolioVisitorsModal: React.FC<PortfolioVisitorsModalProps> = ({open, onClose}) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [visitors, setVisitors] = useState<PortfolioVisitor[]>([]);
    const [stats, setStats] = useState<VisitorStats | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [totalCount, setTotalCount] = useState(0);

    const loadStats = async (clearCache = false) => {
        try {
            const data = await fetchVisitorStats(clearCache);
            setStats(data);
        } catch (e) {
            console.error('Failed to fetch visitor stats:', e);
        }
    };

    const loadVisitors = async (clearCache = false) => {
        try {
            setLoading(true);
            const data = await fetchVisitors(page + 1, rowsPerPage, clearCache);
            setVisitors(data.visitors);
            setTotalCount(data.pagination.total);
        } catch (e) {
            console.error('Failed to fetch visitors:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadStats();
            loadVisitors();
        }
    }, [open]);

    useEffect(() => {
        if (open && tab === 1) {
            loadVisitors();
        }
    }, [page, rowsPerPage]);

    const handleRefresh = () => {
        loadStats(true);
        loadVisitors(true);
    };

    const formatDate = (iso: string) => {
        // Daily stats send date-only strings like "2026-03-25".
        // Split and format directly to avoid timezone shifting.
        const parts = iso.split('-');
        if (parts.length === 3) {
            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            return d.toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'});
        }
        return iso;
    };

    const formatDateTime = (iso: string) => {
        // visited_at is stored as UTC (datetime.utcnow()) but sent without timezone.
        // Append Z so the browser converts UTC to the user's local time.
        const d = iso.includes('T') && !iso.includes('+') && !iso.includes('Z')
            ? new Date(iso + 'Z')
            : new Date(iso);
        return d.toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const truncateUA = (ua: string | null) => {
        if (!ua) return '-';
        // Extract browser name from user agent
        if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
        if (ua.includes('Edg')) return 'Edge';
        if (ua.includes('bot') || ua.includes('Bot')) return 'Bot';
        return ua.substring(0, 30) + '...';
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen={fullScreen}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    backgroundColor: '#121C24',
                    color: '#FAFAFA',
                    borderRadius: fullScreen ? 0 : 2,
                    height: fullScreen ? '100%' : '85vh',
                }
            }}
        >
            <DialogTitle className={style.modalTitle}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box display="flex" alignItems="center" gap={1}>
                        <PublicIcon sx={{color: '#7b68ee'}}/>
                        <Typography variant="h6">Portfolio Visitors</Typography>
                    </Box>
                    <Box>
                        <IconButton onClick={handleRefresh} sx={{color: '#FAFAFA'}}>
                            <RefreshIcon/>
                        </IconButton>
                        <IconButton onClick={onClose} sx={{color: '#FAFAFA'}}>
                            <CloseIcon/>
                        </IconButton>
                    </Box>
                </Box>
            </DialogTitle>
            <DialogContent className={style.modalContent} sx={{padding: 0}}>
                {/* Stats Cards */}
                {stats && (
                    <Box className={style.statsRow}>
                        <Card className={style.statCard}>
                            <CardContent className={style.statCardContent}>
                                <PeopleIcon sx={{color: '#4A90E2', fontSize: 28}}/>
                                <Typography variant="h5" className={style.statNumber}>
                                    {stats.unique_visitors}
                                </Typography>
                                <Typography variant="caption" className={style.statLabel}>
                                    Unique Visitors
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card className={style.statCard}>
                            <CardContent className={style.statCardContent}>
                                <TrendingUpIcon sx={{color: '#2ECC71', fontSize: 28}}/>
                                <Typography variant="h5" className={style.statNumber}>
                                    {stats.total_visits}
                                </Typography>
                                <Typography variant="caption" className={style.statLabel}>
                                    Total Visits
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card className={style.statCard}>
                            <CardContent className={style.statCardContent}>
                                <PublicIcon sx={{color: '#7b68ee', fontSize: 28}}/>
                                <Typography variant="h5" className={style.statNumber}>
                                    {stats.live_visits}
                                </Typography>
                                <Typography variant="caption" className={style.statLabel}>
                                    Live Tracked
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card className={style.statCard}>
                            <CardContent className={style.statCardContent}>
                                <LocationCityIcon sx={{color: '#F39C12', fontSize: 28}}/>
                                <Typography variant="h5" className={style.statNumber}>
                                    {stats.countries.length}
                                </Typography>
                                <Typography variant="caption" className={style.statLabel}>
                                    Countries
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>
                )}

                {/* Tabs */}
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    className={style.tabs}
                    TabIndicatorProps={{style: {backgroundColor: '#7b68ee'}}}
                >
                    <Tab label="Overview" sx={{color: '#FAFAFA', '&.Mui-selected': {color: '#7b68ee'}}}/>
                    <Tab label="All Visitors" sx={{color: '#FAFAFA', '&.Mui-selected': {color: '#7b68ee'}}}/>
                </Tabs>

                {/* Tab 0: Overview */}
                {tab === 0 && stats && (
                    <Box className={style.overviewContainer}>
                        {/* Daily visits */}
                        <Box className={style.section}>
                            <Typography variant="subtitle1" className={style.sectionTitle}>
                                Daily Visits (Last 30 Days)
                            </Typography>
                            <TableContainer className={style.innerTable}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Date</TableCell>
                                            <TableCell align="right">Unique</TableCell>
                                            <TableCell align="right">Total</TableCell>
                                            <TableCell>Bar</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {stats.daily.map((d) => {
                                            const maxVisits = Math.max(...stats.daily.map(x => x.total_visits), 1);
                                            const pct = (d.total_visits / maxVisits) * 100;
                                            return (
                                                <TableRow key={d.day}>
                                                    <TableCell>{formatDate(d.day)}</TableCell>
                                                    <TableCell align="right">{d.unique_visitors}</TableCell>
                                                    <TableCell align="right">{d.total_visits}</TableCell>
                                                    <TableCell sx={{width: '40%'}}>
                                                        <Box
                                                            sx={{
                                                                height: 8,
                                                                borderRadius: 4,
                                                                backgroundColor: '#29384D',
                                                                position: 'relative',
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    height: '100%',
                                                                    width: `${pct}%`,
                                                                    borderRadius: 4,
                                                                    backgroundColor: '#7b68ee',
                                                                }}
                                                            />
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>

                        {/* Side-by-side: Countries and Cities */}
                        <Box className={style.sideBySide}>
                            <Box className={style.section} sx={{flex: 1}}>
                                <Typography variant="subtitle1" className={style.sectionTitle}>
                                    By Country
                                </Typography>
                                <TableContainer className={style.innerTable}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Country</TableCell>
                                                <TableCell align="right">Visits</TableCell>
                                                <TableCell align="right">Unique</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {stats.countries.map((c) => (
                                                <TableRow key={c.country}>
                                                    <TableCell>
                                                        <Box display="flex" alignItems="center" gap={1}>
                                                            {c.country_code && (
                                                                <img
                                                                    src={`https://flagcdn.com/16x12/${c.country_code.toLowerCase()}.png`}
                                                                    alt={c.country_code}
                                                                    style={{width: 16, height: 12}}
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                                    }}
                                                                />
                                                            )}
                                                            {c.country}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="right">{c.visits}</TableCell>
                                                    <TableCell align="right">{c.unique_ips}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>

                            <Box className={style.section} sx={{flex: 1}}>
                                <Typography variant="subtitle1" className={style.sectionTitle}>
                                    Top Cities
                                </Typography>
                                <TableContainer className={style.innerTable}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>City</TableCell>
                                                <TableCell>Country</TableCell>
                                                <TableCell align="right">Visits</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {stats.cities.map((c, i) => (
                                                <TableRow key={i}>
                                                    <TableCell>{c.city}</TableCell>
                                                    <TableCell>{c.country}</TableCell>
                                                    <TableCell align="right">{c.visits}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        </Box>
                    </Box>
                )}

                {/* Tab 1: All Visitors */}
                {tab === 1 && (
                    <Box className={style.visitorsTableContainer}>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Time</TableCell>
                                        <TableCell>IP</TableCell>
                                        {!isMobile && <TableCell>City</TableCell>}
                                        {!isMobile && <TableCell>Country</TableCell>}
                                        {!isMobile && <TableCell>ISP</TableCell>}
                                        <TableCell>Browser</TableCell>
                                        <TableCell>Type</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={isMobile ? 4 : 7} align="center">
                                                <Typography variant="body2">Loading...</Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : visitors.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={isMobile ? 4 : 7} align="center">
                                                <Typography variant="body2">No visitors found.</Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        visitors.map((v) => (
                                            <TableRow key={v.id} hover>
                                                <TableCell sx={{fontSize: isMobile ? '0.7rem' : '0.8rem', whiteSpace: isMobile ? 'normal' : 'nowrap'}}>
                                                    {formatDateTime(v.visited_at)}
                                                </TableCell>
                                                <TableCell sx={{fontFamily: 'monospace', fontSize: isMobile ? '0.7rem' : '0.8rem', wordBreak: 'break-all'}}>
                                                    {v.ip}
                                                </TableCell>
                                                {!isMobile && (
                                                    <TableCell>{v.city || '-'}</TableCell>
                                                )}
                                                {!isMobile && (
                                                    <TableCell>
                                                        <Box display="flex" alignItems="center" gap={0.5}>
                                                            {v.country_code && (
                                                                <img
                                                                    src={`https://flagcdn.com/16x12/${v.country_code.toLowerCase()}.png`}
                                                                    alt={v.country_code}
                                                                    style={{width: 16, height: 12}}
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                                    }}
                                                                />
                                                            )}
                                                            {v.country || '-'}
                                                        </Box>
                                                    </TableCell>
                                                )}
                                                {!isMobile && (
                                                    <TableCell sx={{
                                                        maxWidth: 150, overflow: 'hidden',
                                                        textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                    }}>
                                                        {v.isp || '-'}
                                                    </TableCell>
                                                )}
                                                <TableCell>{truncateUA(v.user_agent)}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={v.is_backfill ? 'Log' : 'Live'}
                                                        size="small"
                                                        sx={{
                                                            backgroundColor: v.is_backfill
                                                                ? 'rgba(149, 165, 166, 0.2)'
                                                                : 'rgba(46, 204, 113, 0.2)',
                                                            color: v.is_backfill ? '#95A5A6' : '#2ECC71',
                                                            fontSize: '0.7rem',
                                                            height: 20,
                                                        }}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            component="div"
                            count={totalCount}
                            page={page}
                            onPageChange={(_, p) => setPage(p)}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={(e) => {
                                setRowsPerPage(parseInt(e.target.value, 10));
                                setPage(0);
                            }}
                            rowsPerPageOptions={[10, 25, 50]}
                            className={style.pagination}
                        />
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default PortfolioVisitorsModal;
