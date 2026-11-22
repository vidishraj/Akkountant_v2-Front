import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
    fetchJobsSummary,
    fetchJobsByTitleStatus,
    fetchJobsDailyHistory,
    cancelJob,
    cancelJobsBulk,
    runJobNow,
    getRunStatus,
    JobSummary,
    JobDetail,
    DailyHistory,
    RunStatusResponse,
} from '../../services/jobService.ts';
import {fetchJobsTable} from '../../services/investmentService.ts';
import {useMessage} from '../../contexts/MessageContext.tsx';
import useModalA11y from '../../hooks/useModalA11y.ts';
import cardStyles from './JobsDialog.module.scss';

/**
 * ak-cfzj (ak-2n09a): JobsDialog MUI → Nocturne rewrite.
 *
 * Pre-ak-cfzj was 872 LOC of MUI (Dialog/Table/TablePagination/Checkbox/
 * Select/FormControl/InputLabel/Collapse/Tooltip/IconButton/Button/
 * LinearProgress/Typography/Box, plus @mui/icons-material). The visuals
 * were force-themed inline with sx={{color: '#FAFAFA', ...}} hex
 * overrides because the MUI theme wasn't Nocturne-skinned.
 *
 * This commit swaps every MUI surface for Nocturne primitives + native
 * HTML + Phosphor icons, preserving ALL state, effects, refs, callbacks
 * and data wiring byte-for-byte. The render shape is intentionally the
 * same as the FE-5 DepositsComponent + ak-2n09 FileTimestampsDialog:
 * fixed backdrop + centered panel, useModalA11y focus-trap, inline Esc.
 *
 * Structural equivalents
 *   MUI Dialog              → .backdrop + .panel + useModalA11y
 *   MUI DialogTitle         → .header
 *   MUI DialogContent       → .body
 *   MUI Table/Head/…        → native <table>/<thead>/…
 *   MUI TablePagination     → hand-rolled .pager strip
 *   MUI Checkbox            → native <input type="checkbox"> + .checkbox
 *   MUI Select + FormControl → native <select>/<option>
 *   MUI Button              → <button> + .runBtn / "btn btn-*" shared
 *   MUI IconButton          → <button> + .iconBtn + Phosphor icon
 *   MUI LinearProgress      → .progressStrip (CSS keyframe)
 *   MUI Collapse            → direct conditional render (was always
 *                              `in={true}` in the pre-ak-cfzj use)
 *   MUI Tooltip             → `title` attribute on the child
 *   MUI Typography          → <span>/<div> with explicit SCSS class
 *   @mui/icons-material/*   → Phosphor ph-*
 *     Refresh              → ph-arrows-clockwise
 *     Close                → ph-x
 *     KeyboardArrowUp      → ph-caret-up
 *     Cancel               → ph-x-circle
 *     Delete               → ph-trash
 *   useMediaQuery           → window.matchMedia + useEffect hook
 *
 * Data wiring is unchanged — same jobService calls, same message
 * payload shapes, same bulk-cancel + run-now polling + 15s auto-dismiss
 * semantics. The helpers (generateDateRange, dominantStatus,
 * buildGradient) are copied byte-for-byte.
 */

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

/**
 * ak-cfzj: palette-aware status tokens. The tooltip legend reads these
 * as inline `style={{backgroundColor}}` to match the per-day timeline
 * cells; swapping to oklch() keeps the dashboard legible across the
 * Nocturne palette (previously the inline hex codes didn't participate
 * in token updates).
 */
const STATUS_COLORS: Record<string, string> = {
    Completed: 'oklch(0.80 0.13 155)',
    Pending: 'oklch(0.80 0.13 85)',
    Overdue: 'oklch(0.74 0.15 25)',
    Failed: 'oklch(0.60 0.25 300)',
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

/**
 * ak-cfzj: FE-local useMediaQuery stand-in. Returns `true` when the
 * passed query matches. Preserves the pre-ak-cfzj `isMobile` semantics
 * (viewport ≤ 768px) without pulling @mui/material/useMediaQuery.
 */
function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mql = window.matchMedia(query);
        const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
        // Safari < 14 lacks addEventListener on MQL — defensive dual path.
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', onChange);
            setMatches(mql.matches);
            return () => mql.removeEventListener('change', onChange);
        }
        // Fallback (legacy).
        const legacy = mql as unknown as {
            addListener: (cb: (e: MediaQueryListEvent) => void) => void;
            removeListener: (cb: (e: MediaQueryListEvent) => void) => void;
        };
        legacy.addListener(onChange);
        setMatches(mql.matches);
        return () => legacy.removeListener(onChange);
    }, [query]);

    return matches;
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

    // Active runs (run-now with polling)
    const [activeRuns, setActiveRuns] = useState<Record<string, RunStatusResponse>>({});
    const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

    // ak-cfzj: Nocturne modal a11y + inline Esc handler.
    const panelRef = useRef<HTMLDivElement>(null);
    useModalA11y({
        open,
        panelRef: panelRef as React.RefObject<HTMLElement>,
    });

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const startRunPolling = useCallback((runId: string, title: string) => {
        setActiveRuns(prev => ({
            ...prev,
            [runId]: {run_id: runId, job_id: 0, title, status: 'running', started_at: new Date().toISOString()},
        }));
        pollRefs.current[runId] = setInterval(async () => {
            try {
                const status = await getRunStatus(runId);
                setActiveRuns(prev => ({...prev, [runId]: status}));
                if (status.status === 'Completed' || status.status === 'Failed') {
                    clearInterval(pollRefs.current[runId]);
                    delete pollRefs.current[runId];
                    loadJobsSummary(true);
                    setPayload({
                        type: status.status === 'Completed' ? 'success' : 'error',
                        message: `${title}: ${status.result || status.error || status.status} (${status.duration_seconds}s)`,
                    });
                    // Auto-dismiss after 15 seconds
                    setTimeout(() => {
                        setActiveRuns(prev => {
                            const next = {...prev};
                            delete next[runId];
                            return next;
                        });
                    }, 15000);
                }
            } catch {
                // Polling failed — will retry next interval
            }
        }, 3000);
    }, [setPayload]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            Object.values(pollRefs.current).forEach(clearInterval);
        };
    }, []);

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
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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
            setPayload({type: "warning", message: "Please select a job to start"});
            return;
        }

        try {
            const response = await runJobNow(selectedJob);
            setPayload({type: "success", message: `${selectedJob} started — running now`});
            startRunPolling(response.run_id, selectedJob);
            setSelectedJob("");
        } catch (error) {
            const anyErr = error as {response?: {data?: {message?: string}}};
            const msg = anyErr?.response?.data?.message || "Failed to start job";
            setPayload({type: "error", message: msg});
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
                                            <div style={{ color: 'var(--color-neutral-600)' }}>No jobs</div>
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
                                                    style={{ backgroundColor: STATUS_COLORS[status] || 'var(--color-neutral-500)' }}
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

    if (!open) return null;

    return (
        <div
            className={cardStyles.backdrop}
            onMouseDown={onClose}
            role="presentation"
        >
            <div
                ref={panelRef}
                className={cardStyles.panel}
                role="dialog"
                aria-modal="true"
                aria-label="Jobs management"
                tabIndex={-1}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className={cardStyles.header}>
                    <span className={cardStyles.title}>
                        <i className="ph ph-briefcase" aria-hidden/>
                        <span>Jobs Management</span>
                    </span>

                    <div className={cardStyles.toolbar}>
                        <div className={cardStyles.toolbarSelectGroup}>
                            <select
                                className={cardStyles.jobSelect}
                                value={selectedJob}
                                onChange={(e) => setSelectedJob(e.target.value)}
                                aria-label="Select job"
                            >
                                <option value="" disabled>
                                    Select job…
                                </option>
                                {Object.entries(availableJobs).map(([key, value]) => (
                                    <option key={key} value={key}>
                                        {value}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className={cardStyles.runBtn}
                                onClick={handleJobCreation}
                                disabled={!selectedJob || loading}
                            >
                                {isMobile ? 'Run' : 'Run Now'}
                            </button>
                        </div>

                        <button
                            type="button"
                            className={cardStyles.iconBtn}
                            onClick={() => loadJobsSummary(true)}
                            disabled={loading}
                            aria-label="Refresh"
                            title="Refresh"
                        >
                            <i className="ph ph-arrows-clockwise"/>
                        </button>
                        <button
                            type="button"
                            className={cardStyles.iconBtn}
                            onClick={onClose}
                            aria-label="Close"
                            title="Close"
                        >
                            <i className="ph ph-x"/>
                        </button>
                    </div>
                </div>

                <div className={cardStyles.body}>
                    {/* Active Runs */}
                    {Object.keys(activeRuns).length > 0 && (
                        <div className={cardStyles.activeRunsSection}>
                            {Object.values(activeRuns).map(run => {
                                const statusClass =
                                    run.status === 'Completed'
                                        ? cardStyles.activeRunStatusCompleted
                                        : run.status === 'Failed'
                                            ? cardStyles.activeRunStatusFailed
                                            : cardStyles.activeRunStatusRunning;
                                return (
                                    <div key={run.run_id} className={cardStyles.activeRunCard}>
                                        <div className={cardStyles.activeRunHeader}>
                                            <span className={cardStyles.activeRunTitle}>
                                                {run.title}
                                            </span>
                                            <span className={`${cardStyles.activeRunStatus} ${statusClass}`}>
                                                {run.status === 'running'
                                                    ? 'Running…'
                                                    : `${run.status} (${run.duration_seconds}s)`}
                                            </span>
                                        </div>
                                        {run.status === 'running' && (
                                            <div className={cardStyles.progressStrip} aria-hidden/>
                                        )}
                                        {run.result && (
                                            <span className={cardStyles.activeRunResult}>
                                                {run.result}
                                            </span>
                                        )}
                                        {run.error && (
                                            <span className={cardStyles.activeRunError}>
                                                {run.error}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

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
                                        const canCancel = canCancelJobs(status);
                                        const selectedSize = jobData?.selectedJobs?.size || 0;
                                        const allSelectedOnPage = jobData?.jobs?.length > 0
                                            && jobData.jobs.every(j => jobData?.selectedJobs?.has(j.id));
                                        const someSelectedOnPage = selectedSize > 0 && !allSelectedOnPage;
                                        const totalPages = Math.max(1, Math.ceil(jobData.totalJobs / 10));

                                        return (
                                            <div key={expandedKey} className={cardStyles.expandedSection}>
                                                <div className={cardStyles.expandedHeader}>
                                                    <span className={cardStyles.expandedTitle}>
                                                        {job.title} — {status} Jobs
                                                    </span>
                                                    <div className={cardStyles.expandedHeaderActions}>
                                                        {canCancel && (
                                                            <button
                                                                type="button"
                                                                className={cardStyles.cancelBulkBtn}
                                                                onClick={() => handleBulkCancel(job.title, status)}
                                                                disabled={selectedSize === 0}
                                                            >
                                                                <i className="ph ph-trash"/>
                                                                <span>Cancel ({selectedSize})</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className={cardStyles.iconBtn}
                                                            onClick={() => handleExpandToggle(job.title, status)}
                                                            aria-label="Collapse"
                                                            title="Collapse"
                                                        >
                                                            <i className="ph ph-caret-up"/>
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className={cardStyles.tableWrapper}>
                                                    <table className={cardStyles.table}>
                                                        <thead>
                                                            <tr>
                                                                {canCancel && (
                                                                    <th>
                                                                        <input
                                                                            type="checkbox"
                                                                            className={cardStyles.checkbox}
                                                                            checked={allSelectedOnPage}
                                                                            ref={(el) => {
                                                                                if (el) el.indeterminate = someSelectedOnPage;
                                                                            }}
                                                                            onChange={() => handleSelectAll(job.title, status)}
                                                                            aria-label="Select all on page"
                                                                        />
                                                                    </th>
                                                                )}
                                                                <th>ID</th>
                                                                <th>Priority</th>
                                                                <th>Due Date</th>
                                                                <th>Failures</th>
                                                                <th>Result</th>
                                                                <th>Status</th>
                                                                {canCancel && <th>Actions</th>}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {jobData.loading ? (
                                                                <tr>
                                                                    <td
                                                                        className={cardStyles.tableLoadingCell}
                                                                        colSpan={canCancel ? 8 : 6}
                                                                    >
                                                                        Loading…
                                                                    </td>
                                                                </tr>
                                                            ) : jobData.jobs.map((jobDetail) => (
                                                                <tr key={jobDetail.id}>
                                                                    {canCancel && (
                                                                        <td>
                                                                            <input
                                                                                type="checkbox"
                                                                                className={cardStyles.checkbox}
                                                                                checked={jobData?.selectedJobs?.has(jobDetail.id) || false}
                                                                                onChange={() => handleJobSelection(jobDetail.id, job.title, status)}
                                                                                aria-label={`Select job ${jobDetail.id}`}
                                                                            />
                                                                        </td>
                                                                    )}
                                                                    <td>{jobDetail.id}</td>
                                                                    <td>{jobDetail.priority}</td>
                                                                    <td>
                                                                        {new Date(jobDetail.due_date).toLocaleString(undefined, {
                                                                            year: 'numeric',
                                                                            month: 'short',
                                                                            day: 'numeric',
                                                                            hour: '2-digit',
                                                                            minute: '2-digit',
                                                                        })}
                                                                    </td>
                                                                    <td>{jobDetail.failures}</td>
                                                                    <td
                                                                        className={cardStyles.tableResultCell}
                                                                        title={jobDetail.result || 'No result yet'}
                                                                    >
                                                                        {jobDetail.result || 'Pending…'}
                                                                    </td>
                                                                    <td>
                                                                        <span className={jobDetail.job_type_disabled ? cardStyles.statusDisabled : cardStyles.statusEnabled}>
                                                                            {jobDetail.job_type_disabled ? 'Disabled' : 'Enabled'}
                                                                        </span>
                                                                    </td>
                                                                    {canCancel && (
                                                                        <td>
                                                                            <button
                                                                                type="button"
                                                                                className={cardStyles.cancelIconBtn}
                                                                                onClick={() => handleCancelJob(jobDetail.id, job.title, status)}
                                                                                aria-label="Cancel job"
                                                                                title="Cancel job"
                                                                            >
                                                                                <i className="ph ph-x-circle"/>
                                                                            </button>
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>

                                                    {/* ak-cfzj: hand-rolled pager replacing MUI
                                                        TablePagination. 10 rows/page is fixed
                                                        (pre-ak-cfzj rowsPerPage was non-configurable
                                                        too). `handlePageChange` takes a 0-indexed
                                                        page to preserve the pre-ak-cfzj callback
                                                        signature. */}
                                                    <div className={cardStyles.pager}>
                                                        <span className={cardStyles.pagerStatus}>
                                                            {jobData.totalJobs === 0
                                                                ? '0 jobs'
                                                                : `Page ${jobData.page} of ${totalPages} · ${jobData.totalJobs} total`}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className={cardStyles.pagerBtn}
                                                            onClick={() => handlePageChange(job.title, status, jobData.page - 2)}
                                                            disabled={jobData.page <= 1 || jobData.loading}
                                                            aria-label="Previous page"
                                                        >
                                                            <i className="ph ph-caret-left"/>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={cardStyles.pagerBtn}
                                                            onClick={() => handlePageChange(job.title, status, jobData.page)}
                                                            disabled={jobData.page >= totalPages || jobData.loading}
                                                            aria-label="Next page"
                                                        >
                                                            <i className="ph ph-caret-right"/>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
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
        const color = STATUS_COLORS[status] || 'oklch(0.60 0 0)';
        const nextPct = pct + (count / total) * 100;
        stops.push(`${color} ${pct}%`);
        stops.push(`${color} ${nextPct}%`);
        pct = nextPct;
    }

    return `linear-gradient(to top, ${stops.join(', ')})`;
}

export default JobsDialog;
