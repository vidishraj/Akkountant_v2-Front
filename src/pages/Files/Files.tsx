import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import style from './Files.module.scss';
import {UserFileData, UserFolderData} from '../../utils/interfaces';
import {
    uploadVaultFile,
    listVaultFiles,
    downloadVaultFile,
    viewVaultFile,
    deleteVaultFile,
    updateFileLabel,
    moveFile,
    createFolder,
    renameFolder,
    deleteFolder,
} from '../../services/fileStorageService';
import {useMessage} from '../../contexts/MessageContext';
import useModalA11y from '../../hooks/useModalA11y';

// ──────────────────────────────── FE-10 (ak-2o3x) PII containment ─────────
// Document-type classification from filename + label + extension. This is
// the §4 critical path: thumbnails MUST default to type icons, NEVER raw
// file contents (brief 07 §7). The classifier has deliberately-broad
// patterns because mislabeling as "Identity" fails *closed* (icon shown
// instead of content) — the only failure mode worth optimizing for.
type FileCategory = 'identity' | 'insurance' | 'tax' | 'travel' | 'property' | 'other';

interface CategoryMeta {
    key: FileCategory;
    label: string;
    icon: string;     // phosphor ph-* name
    isIdentity: boolean; // governs the lock-affordance shown on the card
}

const CATEGORY_META: Record<FileCategory, CategoryMeta> = {
    identity: {key: 'identity', label: 'Identity', icon: 'ph-identification-badge', isIdentity: true},
    insurance: {key: 'insurance', label: 'Insurance', icon: 'ph-shield-check', isIdentity: false},
    tax: {key: 'tax', label: 'Tax', icon: 'ph-receipt', isIdentity: false},
    travel: {key: 'travel', label: 'Travel', icon: 'ph-airplane-tilt', isIdentity: true},
    property: {key: 'property', label: 'Property', icon: 'ph-house-line', isIdentity: false},
    other: {key: 'other', label: 'Other', icon: 'ph-file', isIdentity: false},
};

/**
 * Classify a file into a vault category from filename + label + extension.
 * Case-insensitive substring match; first-hit wins. Identity patterns (DL /
 * Aadhaar / PAN / Passport) take precedence because misclassifying an
 * identity doc as "Other" would surface a generic icon instead of flagging
 * it for the lock affordance.
 */
function classifyFile(f: UserFileData): FileCategory {
    const needle = (
        (f.original_filename || '') +
        ' ' +
        (f.label || '') +
        ' ' +
        (f.file_type || '')
    ).toLowerCase();

    if (/\b(aadhaar|aadhar|pan|voter)\b|pan[\s_-]?card/.test(needle)) return 'identity';
    if (/driving|licen[sc]e|\bdl\b|dl[\s_-]?no/.test(needle)) return 'identity';
    if (/passport/.test(needle)) return 'travel';
    if (/visa|ticket|boarding|itinerary/.test(needle)) return 'travel';
    if (/insur|policy|mediclaim|health|motor|bike|car[\s_-]?insur/.test(needle)) return 'insurance';
    if (/tax|itr|form\s?16|26as|tds|gst/.test(needle)) return 'tax';
    if (/rent|lease|property|deed|sale[\s_-]?agreement|khata/.test(needle)) return 'property';
    return 'other';
}

/**
 * File-extension → Phosphor icon fallback for the `other` category.
 */
function iconForExtension(ext: string): string {
    const e = (ext || '').toLowerCase();
    if (e === 'pdf') return 'ph-file-pdf';
    if (e === 'zip') return 'ph-file-zip';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(e)) return 'ph-image';
    return 'ph-file';
}

const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'zip'];

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface BreadcrumbItem {
    id: string | null;
    name: string;
}

const Files = () => {
    const {setPayload} = useMessage();
    const [files, setFiles] = useState<UserFileData[]>([]);
    const [folders, setFolders] = useState<UserFolderData[]>([]);
    const [loading, setLoading] = useState(true);

    // Folder navigation
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{id: null, name: 'Root'}]);

    // Upload dialog
    const [showUpload, setShowUpload] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadMode, setUploadMode] = useState<'file' | 'folder'>('file');
    const [label, setLabel] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [dragging, setDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    // Preview modal
    const [previewFile, setPreviewFile] = useState<UserFileData | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    // Editing label
    const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
    const [editLabelValue, setEditLabelValue] = useState('');

    // Folder dialogs
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
    const [renameFolderValue, setRenameFolderValue] = useState('');

    // Move file dialog
    const [movingFile, setMovingFile] = useState<UserFileData | null>(null);
    const [moveTargetFolderId, setMoveTargetFolderId] = useState<string | null>(null);
    const [allFolders, setAllFolders] = useState<UserFolderData[]>([]);

    // Context menu
    const [contextMenu, setContextMenu] = useState<{x: number; y: number; file?: UserFileData; folder?: UserFolderData} | null>(null);

    // ─── FE-10 (ak-2o3x) PII state ────────────────────────────────────────
    // Search over filename/label — brief 07 critical for 100+ item vaults.
    const [searchTerm, setSearchTerm] = useState('');

    // Revealed set: file IDs where the user has EXPLICITLY clicked the eye
    // icon to show the real thumbnail. `undefined` or absent → show the
    // type-icon (default-hidden state). Design choice per bead: a one-shot
    // auto-hide after 5s keeps the surface safe for ambient screenshotting
    // while still allowing a quick glance.
    const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
    const revealTimersRef = useRef<Map<string, number>>(new Map());

    const toggleReveal = useCallback((fileId: string) => {
        setRevealedIds((prev) => {
            const next = new Set(prev);
            if (next.has(fileId)) {
                // Explicit hide.
                next.delete(fileId);
                const t = revealTimersRef.current.get(fileId);
                if (t) {
                    window.clearTimeout(t);
                    revealTimersRef.current.delete(fileId);
                }
            } else {
                next.add(fileId);
                // Auto-hide after 5s — single-shot preview per bead.
                const timerId = window.setTimeout(() => {
                    setRevealedIds((p) => {
                        const n = new Set(p);
                        n.delete(fileId);
                        return n;
                    });
                    revealTimersRef.current.delete(fileId);
                }, 5000);
                revealTimersRef.current.set(fileId, timerId);
            }
            return next;
        });
    }, []);

    // Cleanup timers on unmount so a stale reveal doesn't fire after the
    // page navigates away.
    useEffect(() => {
        return () => {
            revealTimersRef.current.forEach((t) => window.clearTimeout(t));
            revealTimersRef.current.clear();
        };
    }, []);

    // Soft-delete + undo window (5s). The BE has no soft-delete endpoint,
    // so FE emulates one: on confirm, hide the card + fire an undo toast;
    // if the user doesn't click undo within 5s, call the real delete API.
    // Dialog state for the Nocturne confirm-gate (replaces window.confirm).
    const [deleteConfirmFile, setDeleteConfirmFile] = useState<UserFileData | null>(null);
    // ─── ak-zl3o MINOR 1: pendingDeletes is a Map keyed by file.id so
    // concurrent soft-deletes each keep their own undo window. Mirrors the
    // existing `revealTimersRef: Map<string, number>` pattern. The prior
    // single-slot shape silently dropped the first file's undo affordance
    // whenever a second delete was confirmed inside the 5s window.
    const [pendingDeletes, setPendingDeletes] = useState<Map<string, {
        file: UserFileData;
        timerId: number;
    }>>(new Map());
    const deleteDialogRef = useRef<HTMLDivElement>(null);
    useModalA11y({
        open: deleteConfirmFile !== null,
        panelRef: deleteDialogRef as React.RefObject<HTMLElement>,
    });

    // ─── ak-zl3o MINOR 2: folder delete now routes through the same
    // Nocturne destructive-variant gate as file delete (replaces the
    // native window.confirm path). Soft-delete semantics mirror file
    // delete: 5s undo window before the BE call fires. Files inside the
    // folder are relocated to the parent by the BE on `deleteFolder`;
    // the undo window gives the user a chance to abort before that.
    const [deleteConfirmFolder, setDeleteConfirmFolder] = useState<UserFolderData | null>(null);
    const [pendingFolderDeletes, setPendingFolderDeletes] = useState<Map<string, {
        folder: UserFolderData;
        timerId: number;
    }>>(new Map());
    const deleteFolderDialogRef = useRef<HTMLDivElement>(null);
    useModalA11y({
        open: deleteConfirmFolder !== null,
        panelRef: deleteFolderDialogRef as React.RefObject<HTMLElement>,
    });

    const loadFiles = useCallback(async (folderId: string | null = currentFolderId, clearCache = false) => {
        try {
            const data = await listVaultFiles(folderId, clearCache);
            setFiles(data.files);
            setFolders(data.folders);
        } catch {
            setPayload({type: 'error', message: 'Failed to load files'});
        } finally {
            setLoading(false);
        }
    }, [setPayload, currentFolderId]);

    useEffect(() => {
        loadFiles(currentFolderId);
    }, [currentFolderId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Navigate into folder
    const navigateToFolder = (folder: UserFolderData) => {
        setCurrentFolderId(folder.id);
        setBreadcrumbs(prev => [...prev, {id: folder.id, name: folder.name}]);
        setLoading(true);
    };

    // Navigate via breadcrumb
    const navigateToBreadcrumb = (index: number) => {
        const target = breadcrumbs[index];
        setCurrentFolderId(target.id);
        setBreadcrumbs(breadcrumbs.slice(0, index + 1));
        setLoading(true);
    };

    // Upload single file or folder of files
    const handleUpload = async () => {
        const filesToUpload = uploadMode === 'folder' ? selectedFiles : selectedFile ? [selectedFile] : [];
        if (filesToUpload.length === 0) return;

        // Validate all files
        for (const file of filesToUpload) {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                setPayload({type: 'error', message: `File type .${ext} is not allowed (${file.name})`});
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                setPayload({type: 'error', message: `${file.name} exceeds 10 MB limit`});
                return;
            }
        }

        setUploading(true);
        let uploaded = 0;
        let failed = 0;
        try {
            for (const file of filesToUpload) {
                try {
                    setUploadProgress(`Uploading ${uploaded + 1}/${filesToUpload.length}: ${file.name}`);
                    await uploadVaultFile(file, uploadMode === 'file' ? (label || undefined) : undefined, currentFolderId);
                    uploaded++;
                } catch {
                    failed++;
                }
            }
            if (failed === 0) {
                setPayload({type: 'success', message: `${uploaded} file${uploaded > 1 ? 's' : ''} uploaded`});
            } else {
                setPayload({type: 'error', message: `${uploaded} uploaded, ${failed} failed`});
            }
            setShowUpload(false);
            setSelectedFile(null);
            setSelectedFiles([]);
            setLabel('');
            setUploadProgress('');
            await loadFiles(currentFolderId, true);
        } catch {
            setPayload({type: 'error', message: 'Upload failed'});
        } finally {
            setUploading(false);
            setUploadProgress('');
        }
    };

    // Download
    const handleDownload = async (file: UserFileData) => {
        try {
            const blob = await downloadVaultFile(file.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.original_filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            setPayload({type: 'error', message: 'Download failed'});
        }
    };

    // Delete file (FE-10): NEVER call deleteVaultFile directly. Open the
    // Nocturne confirm-gate modal first. On confirm, enter soft-delete:
    // hide the card locally + schedule the real BE delete after 5s. The
    // undo toast lets the user cancel the pending delete within that
    // window. Preserves the pre-FE-10 success/failure semantics.
    const handleDelete = (file: UserFileData) => {
        setDeleteConfirmFile(file);
    };

    const confirmDelete = () => {
        const file = deleteConfirmFile;
        setDeleteConfirmFile(null);
        if (!file) return;

        // Local soft-hide: filter the card out of the visible list
        // optimistically. We re-insert if the user clicks undo; otherwise
        // the real BE call fires + loadFiles refreshes.
        setFiles((prev) => prev.filter((f) => f.id !== file.id));

        const timerId = window.setTimeout(async () => {
            // Clear this file's entry from the Map so its undo toast
            // disappears; other in-flight deletes are unaffected.
            setPendingDeletes((prev) => {
                if (!prev.has(file.id)) return prev;
                const next = new Map(prev);
                next.delete(file.id);
                return next;
            });
            try {
                await deleteVaultFile(file.id);
                setPayload({type: 'success', message: 'File deleted'});
                await loadFiles(currentFolderId, true);
            } catch {
                setPayload({type: 'error', message: 'Delete failed'});
                // Restore the card — the BE never actually deleted it.
                await loadFiles(currentFolderId, true);
            }
        }, 5000);

        setPendingDeletes((prev) => {
            const next = new Map(prev);
            next.set(file.id, {file, timerId});
            return next;
        });
    };

    const undoDelete = (fileId: string) => {
        const entry = pendingDeletes.get(fileId);
        if (!entry) return;
        window.clearTimeout(entry.timerId);
        // Restore the file into the local list; its position may shift
        // but the user's mental model is "the card came back" — accurate.
        setFiles((prev) => [entry.file, ...prev]);
        setPendingDeletes((prev) => {
            const next = new Map(prev);
            next.delete(fileId);
            return next;
        });
        setPayload({type: 'success', message: 'Delete undone'});
    };

    // Preview
    const handlePreview = async (file: UserFileData) => {
        setPreviewFile(file);
        setPreviewLoading(true);
        try {
            const blob = await viewVaultFile(file.id);
            setPreviewUrl(URL.createObjectURL(blob));
        } catch {
            setPayload({type: 'error', message: 'Failed to load preview'});
            setPreviewFile(null);
        } finally {
            setPreviewLoading(false);
        }
    };

    const closePreview = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setPreviewFile(null);
    };

    // Label editing
    const handleLabelSave = async (fileId: string) => {
        try {
            await updateFileLabel(fileId, editLabelValue);
            setEditingLabelId(null);
            await loadFiles(currentFolderId, true);
        } catch {
            setPayload({type: 'error', message: 'Failed to update label'});
        }
    };

    // Create folder
    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            await createFolder(newFolderName.trim(), currentFolderId);
            setPayload({type: 'success', message: 'Folder created'});
            setShowCreateFolder(false);
            setNewFolderName('');
            await loadFiles(currentFolderId, true);
        } catch {
            setPayload({type: 'error', message: 'Failed to create folder'});
        }
    };

    // Rename folder
    const handleRenameFolder = async (folderId: string) => {
        if (!renameFolderValue.trim()) return;
        try {
            await renameFolder(folderId, renameFolderValue.trim());
            setRenamingFolderId(null);
            setRenameFolderValue('');
            await loadFiles(currentFolderId, true);
            // Update breadcrumb if renamed folder is in the path
            setBreadcrumbs(prev => prev.map(b => b.id === folderId ? {...b, name: renameFolderValue.trim()} : b));
        } catch {
            setPayload({type: 'error', message: 'Failed to rename folder'});
        }
    };

    // Delete folder (ak-zl3o MINOR 2): replaces the native window.confirm
    // path with the Nocturne destructive-variant gate (role="alertdialog"
    // + ph-warning + useModalA11y focus-trap + 5s soft-delete undo window).
    // Mirrors the file-delete pattern exactly — see handleDelete /
    // confirmDelete / undoDelete above.
    const handleDeleteFolder = (folder: UserFolderData) => {
        setDeleteConfirmFolder(folder);
    };

    const confirmDeleteFolder = () => {
        const folder = deleteConfirmFolder;
        setDeleteConfirmFolder(null);
        if (!folder) return;

        // Local soft-hide: remove the folder from the visible list
        // optimistically. On undo we re-insert; otherwise the BE call
        // fires at timer-expiry and loadFiles refreshes.
        setFolders((prev) => prev.filter((f) => f.id !== folder.id));

        const timerId = window.setTimeout(async () => {
            setPendingFolderDeletes((prev) => {
                if (!prev.has(folder.id)) return prev;
                const next = new Map(prev);
                next.delete(folder.id);
                return next;
            });
            try {
                await deleteFolder(folder.id);
                setPayload({type: 'success', message: 'Folder deleted'});
                await loadFiles(currentFolderId, true);
            } catch {
                setPayload({type: 'error', message: 'Failed to delete folder'});
                // Restore — the BE never actually deleted it.
                await loadFiles(currentFolderId, true);
            }
        }, 5000);

        setPendingFolderDeletes((prev) => {
            const next = new Map(prev);
            next.set(folder.id, {folder, timerId});
            return next;
        });
    };

    const undoDeleteFolder = (folderId: string) => {
        const entry = pendingFolderDeletes.get(folderId);
        if (!entry) return;
        window.clearTimeout(entry.timerId);
        setFolders((prev) => [entry.folder, ...prev]);
        setPendingFolderDeletes((prev) => {
            const next = new Map(prev);
            next.delete(folderId);
            return next;
        });
        setPayload({type: 'success', message: 'Delete undone'});
    };

    // Move file
    const handleMoveFile = async () => {
        if (!movingFile) return;
        try {
            await moveFile(movingFile.id, moveTargetFolderId);
            setPayload({type: 'success', message: 'File moved'});
            setMovingFile(null);
            await loadFiles(currentFolderId, true);
        } catch {
            setPayload({type: 'error', message: 'Failed to move file'});
        }
    };

    const openMoveDialog = async (file: UserFileData) => {
        setMovingFile(file);
        setMoveTargetFolderId(null);
        // Load root-level folders for the move dialog
        try {
            const data = await listVaultFiles(null);
            setAllFolders(data.folders);
        } catch {
            setAllFolders([]);
        }
    };

    // Context menu
    const handleContextMenu = (e: React.MouseEvent, file?: UserFileData, folder?: UserFolderData) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({x: e.clientX, y: e.clientY, file, folder});
    };

    const closeContextMenu = () => setContextMenu(null);

    useEffect(() => {
        const handler = () => closeContextMenu();
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, []);

    // Drag and drop
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(true);
    };
    const handleDragLeave = () => setDragging(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length > 1) {
            setUploadMode('folder');
            setSelectedFiles(droppedFiles);
            setSelectedFile(null);
        } else if (droppedFiles.length === 1) {
            setUploadMode('file');
            setSelectedFile(droppedFiles[0]);
            setSelectedFiles([]);
        }
    };

    const isImage = (fileType: string) => fileType.startsWith('image/');

    // FE-10: filter + classify + group. Search matches filename + label
    // (case-insensitive), then classify remaining files by category. The
    // `fileGroups` memo drives the rendered Category section lineup so the
    // user sees Identity / Insurance / Tax grouped together instead of
    // chronological upload order.
    const filteredFiles = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return files;
        return files.filter((f) => {
            const needle = (
                (f.original_filename || '') + ' ' + (f.label || '')
            ).toLowerCase();
            return needle.includes(q);
        });
    }, [files, searchTerm]);

    const fileGroups = useMemo(() => {
        const groups: Record<FileCategory, UserFileData[]> = {
            identity: [], insurance: [], tax: [], travel: [], property: [], other: [],
        };
        filteredFiles.forEach((f) => groups[classifyFile(f)].push(f));
        // Only emit categories that actually have files; keep ordering stable
        // so the user's mental map survives filter toggles.
        const order: FileCategory[] = ['identity', 'insurance', 'tax', 'travel', 'property', 'other'];
        return order
            .filter((k) => groups[k].length > 0)
            .map((k) => ({...CATEGORY_META[k], files: groups[k]}));
    }, [filteredFiles]);

    const isEmpty = files.length === 0 && folders.length === 0;
    const isFilteredEmpty = !isEmpty && filteredFiles.length === 0;

    return (
        <div className={style.filesPage} onClick={closeContextMenu}>
            <div className={style.header}>
                <div className={style.headerLeft}>
                    <h2 className={style.pageTitle}>
                        <i className="ph ph-vault" aria-hidden/>
                        Document Vault
                    </h2>
                    {breadcrumbs.length > 1 && (
                        <div className={style.breadcrumbs}>
                            {breadcrumbs.map((crumb, i) => (
                                <span key={crumb.id ?? 'root'}>
                                    {i > 0 && <span className={style.breadcrumbSep}>/</span>}
                                    <button
                                        className={`${style.breadcrumbBtn} ${i === breadcrumbs.length - 1 ? style.breadcrumbActive : ''}`}
                                        onClick={() => navigateToBreadcrumb(i)}
                                    >
                                        {crumb.name}
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                {/* FE-10 search bar (brief 07 — critical for 100+ item vaults) */}
                <label className={style.searchHost}>
                    <i className="ph ph-magnifying-glass" aria-hidden/>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search filename or label…"
                        className={style.searchInput}
                        aria-label="Search files"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className={style.searchClear}
                            aria-label="Clear search"
                        >
                            <i className="ph ph-x"/>
                        </button>
                    )}
                </label>
                <div className={style.headerActions}>
                    <button
                        type="button"
                        className={`btn btn-secondary ${style.folderBtn}`}
                        onClick={() => setShowCreateFolder(true)}
                    >
                        <i className="ph ph-folder-plus"/>
                        <span>Folder</span>
                    </button>
                    {/* Upload is the PRIMARY action per brief 07 §7 */}
                    <button
                        type="button"
                        className={`btn btn-primary ${style.uploadBtn}`}
                        onClick={() => setShowUpload(true)}
                    >
                        <i className="ph ph-upload-simple"/>
                        <span>Upload</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className={style.loadingState}>Loading files...</div>
            ) : isEmpty ? (
                <div className={style.emptyState}>
                    <span>{currentFolderId ? 'This folder is empty' : 'No files uploaded yet'}</span>
                    <button className={`btn btn-primary ${style.uploadBtn}`} onClick={() => setShowUpload(true)}>
                        <i className="ph ph-upload-simple"/>
                        <span>Upload your first file</span>
                    </button>
                </div>
            ) : isFilteredEmpty ? (
                <div className={style.emptyState}>
                    <span>No files match "{searchTerm}"</span>
                    <button className={`btn btn-secondary ${style.folderBtn}`} onClick={() => setSearchTerm('')}>
                        Clear search
                    </button>
                </div>
            ) : (
                <>
                    {/* Folders (unchanged position, now with Phosphor icon) */}
                    {!searchTerm && folders.length > 0 && (
                        <div className={style.folderGrid}>
                            {folders.map((folder) => (
                                <button
                                    type="button"
                                    key={folder.id}
                                    className={style.folderCard}
                                    onDoubleClick={() => navigateToFolder(folder)}
                                    onClick={() => navigateToFolder(folder)}
                                    onContextMenu={(e) => handleContextMenu(e, undefined, folder)}
                                >
                                    <i className={`ph ph-folder-simple ${style.folderIconPh}`} aria-hidden/>
                                    {renamingFolderId === folder.id ? (
                                        <input
                                            autoFocus
                                            className={style.renameInput}
                                            value={renameFolderValue}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => setRenameFolderValue(e.target.value)}
                                            onBlur={() => handleRenameFolder(folder.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleRenameFolder(folder.id);
                                                if (e.key === 'Escape') setRenamingFolderId(null);
                                            }}
                                        />
                                    ) : (
                                        <div className={style.folderName} title={folder.name}>
                                            {folder.name}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* FE-10: files grouped by category with Phosphor type icons. */}
                    {fileGroups.map((group) => (
                        <section key={group.key} className={style.categorySection}>
                            <h3 className={style.categoryHeading}>
                                <i className={`ph ${group.icon}`} aria-hidden/>
                                <span>{group.label}</span>
                                <span className={style.categoryCount}>{group.files.length}</span>
                            </h3>
                            <div className={style.fileGrid}>
                                {group.files.map((file) => {
                                    const cat = CATEGORY_META[classifyFile(file)];
                                    const revealed = revealedIds.has(file.id);
                                    const iconClass = cat.key === 'other'
                                        ? iconForExtension(file.file_extension)
                                        : cat.icon;
                                    return (
                                        <div
                                            key={file.id}
                                            className={`${style.fileCard} ${cat.isIdentity ? style.fileCardIdentity : ''}`}
                                            onContextMenu={(e) => handleContextMenu(e, file)}
                                        >
                                            <div className={style.thumbnailContainer}>
                                                {/* §4 CRITICAL: thumbnail defaults to type icon.
                                                    File contents only render AFTER the user clicks
                                                    the eye icon AND auto-hides after 5 seconds. */}
                                                {revealed && file.thumbnail ? (
                                                    <img
                                                        src={`data:image/png;base64,${file.thumbnail}`}
                                                        alt=""  /* no filename in alt — PII-safe */
                                                        className={style.revealedThumb}
                                                    />
                                                ) : (
                                                    <i className={`ph ${iconClass} ${style.typeIcon}`} aria-hidden/>
                                                )}
                                                {cat.isIdentity && !revealed && (
                                                    <span className={style.lockBadge} title="Identity document — contents hidden">
                                                        <i className="ph ph-lock"/>
                                                    </span>
                                                )}
                                            </div>
                                            <div className={style.fileInfo}>
                                                <div className={style.fileName} title={file.original_filename}>
                                                    {file.original_filename}
                                                </div>
                                                <div className={style.fileMeta}>
                                                    {formatFileSize(file.file_size)}
                                                </div>
                                                {editingLabelId === file.id ? (
                                                    <input
                                                        autoFocus
                                                        value={editLabelValue}
                                                        onChange={(e) => setEditLabelValue(e.target.value)}
                                                        onBlur={() => handleLabelSave(file.id)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleLabelSave(file.id);
                                                            if (e.key === 'Escape') setEditingLabelId(null);
                                                        }}
                                                        className={style.labelEditInput}
                                                    />
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className={style.fileLabel}
                                                        onClick={() => {
                                                            setEditingLabelId(file.id);
                                                            setEditLabelValue(file.label || '');
                                                        }}
                                                        title="Click to edit label"
                                                    >
                                                        {file.label || 'Add label'}
                                                    </button>
                                                )}
                                            </div>
                                            <div className={style.fileActions}>
                                                {/* Eye-icon reveal (bead ask): one-shot preview
                                                    with 5-second auto-hide. Lock icon on identity
                                                    cards shown above; this button reveals. */}
                                                <button
                                                    type="button"
                                                    className={`btn btn-icon ${style.iconActionBtn}`}
                                                    onClick={() => toggleReveal(file.id)}
                                                    title={revealed ? 'Hide preview' : 'Reveal preview (auto-hides in 5s)'}
                                                    aria-label={revealed ? 'Hide file preview' : 'Reveal file preview'}
                                                >
                                                    <i className={`ph ${revealed ? 'ph-eye-slash' : 'ph-eye'}`}/>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`btn btn-icon ${style.iconActionBtn}`}
                                                    onClick={() => handlePreview(file)}
                                                    title="Open full preview"
                                                    aria-label="Open full preview"
                                                >
                                                    <i className="ph ph-arrows-out"/>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`btn btn-icon ${style.iconActionBtn}`}
                                                    onClick={() => handleDownload(file)}
                                                    title="Download"
                                                    aria-label="Download"
                                                >
                                                    <i className="ph ph-download-simple"/>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`btn btn-icon ${style.iconActionBtn} ${style.deleteBtn}`}
                                                    onClick={() => handleDelete(file)}
                                                    title="Delete"
                                                    aria-label="Delete"
                                                >
                                                    <i className="ph ph-trash"/>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </>
            )}

            {/* FE-10 (ak-2o3x) Nocturne destructive confirm-gate — replaces
                the window.confirm() path. Matches FE-7's destructive variant
                (ph-warning + kicker + "Confirm delete" affordance). */}
            {deleteConfirmFile && (
                <>
                    <div
                        className={style.dialogBackdrop}
                        onClick={() => setDeleteConfirmFile(null)}
                        role="presentation"
                    />
                    <div
                        ref={deleteDialogRef}
                        className={style.confirmDialog}
                        role="alertdialog"
                        aria-modal="true"
                        aria-label="Confirm delete"
                        tabIndex={-1}
                    >
                        <div className={style.confirmKicker}>
                            <i className="ph ph-warning" aria-hidden/>
                            <span>Destructive action</span>
                        </div>
                        <div className={style.confirmTitle}>
                            Delete "{deleteConfirmFile.original_filename}"?
                        </div>
                        <div className={style.confirmBody}>
                            This moves the file to a 5-second undo window. If you
                            don't click Undo, it's permanently removed from your vault.
                        </div>
                        <div className={style.confirmActions}>
                            <button
                                type="button"
                                className={`btn btn-secondary ${style.confirmNo}`}
                                onClick={() => setDeleteConfirmFile(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={`${style.confirmYesDestructive}`}
                                onClick={confirmDelete}
                            >
                                Confirm delete
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ak-zl3o MINOR 2: folder-delete destructive gate (replaces
                the native window.confirm path). Same shape as the file
                dialog above — role="alertdialog", ph-warning kicker,
                useModalA11y focus-trap, Nocturne destructive variant. */}
            {deleteConfirmFolder && (
                <>
                    <div
                        className={style.dialogBackdrop}
                        onClick={() => setDeleteConfirmFolder(null)}
                        role="presentation"
                    />
                    <div
                        ref={deleteFolderDialogRef}
                        className={style.confirmDialog}
                        role="alertdialog"
                        aria-modal="true"
                        aria-label="Confirm delete folder"
                        tabIndex={-1}
                    >
                        <div className={style.confirmKicker}>
                            <i className="ph ph-warning" aria-hidden/>
                            <span>Destructive action</span>
                        </div>
                        <div className={style.confirmTitle}>
                            Delete folder "{deleteConfirmFolder.name}"?
                        </div>
                        <div className={style.confirmBody}>
                            Files inside this folder will be moved to the parent folder.
                            You'll get a 5-second window to undo before the folder is
                            permanently removed.
                        </div>
                        <div className={style.confirmActions}>
                            <button
                                type="button"
                                className={`btn btn-secondary ${style.confirmNo}`}
                                onClick={() => setDeleteConfirmFolder(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={`${style.confirmYesDestructive}`}
                                onClick={confirmDeleteFolder}
                            >
                                Confirm delete
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ak-zl3o MINOR 1+2: soft-delete undo stack — one toast per
                in-flight file / folder delete. Each keeps its own 5s undo
                affordance; the prior single-slot design dropped any first
                file's undo button whenever a second delete landed inside
                the window. Files render above folders for stable order. */}
            {(pendingDeletes.size > 0 || pendingFolderDeletes.size > 0) && (
                <div className={style.undoToastStack} role="status" aria-live="polite">
                    {Array.from(pendingDeletes.values()).map(({file}) => (
                        <div key={`file:${file.id}`} className={style.undoToast}>
                            <i className="ph ph-trash" aria-hidden/>
                            <span className={style.undoToastText}>
                                "{file.original_filename}" will be deleted in 5s
                            </span>
                            <button
                                type="button"
                                onClick={() => undoDelete(file.id)}
                                className={`btn btn-primary ${style.undoToastBtn}`}
                            >
                                Undo
                            </button>
                        </div>
                    ))}
                    {Array.from(pendingFolderDeletes.values()).map(({folder}) => (
                        <div key={`folder:${folder.id}`} className={style.undoToast}>
                            <i className="ph ph-folder-minus" aria-hidden/>
                            <span className={style.undoToastText}>
                                Folder "{folder.name}" will be deleted in 5s
                            </span>
                            <button
                                type="button"
                                onClick={() => undoDeleteFolder(folder.id)}
                                className={`btn btn-primary ${style.undoToastBtn}`}
                            >
                                Undo
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className={style.contextMenu}
                    style={{top: contextMenu.y, left: contextMenu.x}}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.file && (
                        <>
                            <button onClick={() => { handlePreview(contextMenu.file!); closeContextMenu(); }}>Preview</button>
                            <button onClick={() => { handleDownload(contextMenu.file!); closeContextMenu(); }}>Download</button>
                            <button onClick={() => { openMoveDialog(contextMenu.file!); closeContextMenu(); }}>Move to...</button>
                            <button onClick={() => { handleDelete(contextMenu.file!); closeContextMenu(); }}>Delete</button>
                        </>
                    )}
                    {contextMenu.folder && (
                        <>
                            <button onClick={() => { navigateToFolder(contextMenu.folder!); closeContextMenu(); }}>Open</button>
                            <button onClick={() => {
                                setRenamingFolderId(contextMenu.folder!.id);
                                setRenameFolderValue(contextMenu.folder!.name);
                                closeContextMenu();
                            }}>Rename</button>
                            <button onClick={() => { handleDeleteFolder(contextMenu.folder!); closeContextMenu(); }}>Delete</button>
                        </>
                    )}
                </div>
            )}

            {/* Create Folder Dialog */}
            {showCreateFolder && (
                <div className={style.uploadOverlay} onClick={() => setShowCreateFolder(false)}>
                    <div className={style.uploadDialog} onClick={(e) => e.stopPropagation()}>
                        <div className={style.uploadDialogHeader}>
                            <h3>Create Folder</h3>
                            <button onClick={() => setShowCreateFolder(false)}>&times;</button>
                        </div>
                        <div className={style.labelInput}>
                            <label>Folder Name</label>
                            <input
                                autoFocus
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="e.g. Tax Documents"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreateFolder();
                                }}
                            />
                        </div>
                        <div className={style.uploadActions}>
                            <button className={style.cancelBtn} onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }}>
                                Cancel
                            </button>
                            <button className={style.submitBtn} disabled={!newFolderName.trim()} onClick={handleCreateFolder}>
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Move File Dialog */}
            {movingFile && (
                <div className={style.uploadOverlay} onClick={() => setMovingFile(null)}>
                    <div className={style.uploadDialog} onClick={(e) => e.stopPropagation()}>
                        <div className={style.uploadDialogHeader}>
                            <h3>Move "{movingFile.original_filename}"</h3>
                            <button onClick={() => setMovingFile(null)}>&times;</button>
                        </div>
                        <div className={style.moveList}>
                            <button
                                className={`${style.moveItem} ${moveTargetFolderId === null ? style.moveItemActive : ''}`}
                                onClick={() => setMoveTargetFolderId(null)}
                            >
                                Root
                            </button>
                            {allFolders.map(f => (
                                <button
                                    key={f.id}
                                    className={`${style.moveItem} ${moveTargetFolderId === f.id ? style.moveItemActive : ''}`}
                                    onClick={() => setMoveTargetFolderId(f.id)}
                                >
                                    📁 {f.name}
                                </button>
                            ))}
                        </div>
                        <div className={style.uploadActions}>
                            <button className={style.cancelBtn} onClick={() => setMovingFile(null)}>Cancel</button>
                            <button className={style.submitBtn} onClick={handleMoveFile}>Move</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Dialog */}
            {showUpload && (
                <div className={style.uploadOverlay} onClick={() => setShowUpload(false)}>
                    <div className={style.uploadDialog} onClick={(e) => e.stopPropagation()}>
                        <div className={style.uploadDialogHeader}>
                            <h3>Upload {uploadMode === 'folder' ? 'Folder' : 'File'}</h3>
                            <button onClick={() => setShowUpload(false)}>&times;</button>
                        </div>

                        <div className={style.uploadModeTabs}>
                            <button
                                className={uploadMode === 'file' ? style.activeTab : ''}
                                onClick={() => { setUploadMode('file'); setSelectedFiles([]); }}
                            >
                                File
                            </button>
                            <button
                                className={uploadMode === 'folder' ? style.activeTab : ''}
                                onClick={() => { setUploadMode('folder'); setSelectedFile(null); }}
                            >
                                Folder
                            </button>
                        </div>

                        {uploadMode === 'file' ? (
                            <>
                                {!selectedFile ? (
                                    <div
                                        className={`${style.dropZone} ${dragging ? style.dragging : ''}`}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        Drop a file here or click to browse
                                        <br />
                                        <small>PDF, PNG, JPG, GIF, BMP, WebP, ZIP (max 10 MB)</small>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
                                            style={{display: 'none'}}
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className={style.selectedFile}>
                                        <span>{selectedFile.name}</span>
                                        <button onClick={() => setSelectedFile(null)}>&times;</button>
                                    </div>
                                )}
                                <div className={style.labelInput}>
                                    <label>Label (optional)</label>
                                    <input
                                        value={label}
                                        onChange={(e) => setLabel(e.target.value)}
                                        placeholder="e.g. Driving Licence, PAN Card"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                {selectedFiles.length === 0 ? (
                                    <div
                                        className={`${style.dropZone} ${dragging ? style.dragging : ''}`}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        onClick={() => folderInputRef.current?.click()}
                                    >
                                        Click to select a folder
                                        <br />
                                        <small>All supported files in the folder will be uploaded</small>
                                        <input
                                            ref={folderInputRef}
                                            type="file"
                                            /* @ts-expect-error webkitdirectory is not in React types */
                                            webkitdirectory=""
                                            multiple
                                            style={{display: 'none'}}
                                            onChange={(e) => {
                                                if (e.target.files) {
                                                    const files = Array.from(e.target.files).filter(f => {
                                                        const ext = f.name.split('.').pop()?.toLowerCase() || '';
                                                        return ALLOWED_EXTENSIONS.includes(ext) && f.size <= 10 * 1024 * 1024;
                                                    });
                                                    setSelectedFiles(files);
                                                }
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className={style.selectedFile}>
                                        <span>{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected</span>
                                        <button onClick={() => setSelectedFiles([])}>&times;</button>
                                    </div>
                                )}
                            </>
                        )}

                        {currentFolderId && (
                            <div className={style.uploadFolder}>
                                Uploading to: <strong>{breadcrumbs[breadcrumbs.length - 1]?.name}</strong>
                            </div>
                        )}

                        {uploadProgress && (
                            <div className={style.uploadFolder}>
                                <small>{uploadProgress}</small>
                            </div>
                        )}

                        <div className={style.uploadActions}>
                            <button
                                className={style.cancelBtn}
                                onClick={() => {
                                    setShowUpload(false);
                                    setSelectedFile(null);
                                    setSelectedFiles([]);
                                    setLabel('');
                                    setUploadProgress('');
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className={style.submitBtn}
                                disabled={(uploadMode === 'file' ? !selectedFile : selectedFiles.length === 0) || uploading}
                                onClick={handleUpload}
                            >
                                {uploading ? 'Uploading...' : uploadMode === 'folder' ? `Upload ${selectedFiles.length} files` : 'Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewFile && (
                <div className={style.previewOverlay}>
                    <div className={style.previewHeader}>
                        <span>{previewFile.original_filename}</span>
                        <div className={style.previewActions}>
                            <button onClick={() => handleDownload(previewFile)}>Download</button>
                            <button className={style.closeBtn} onClick={closePreview}>
                                &times;
                            </button>
                        </div>
                    </div>
                    <div className={style.previewContent}>
                        {previewLoading ? (
                            <div className={style.previewLoading}>Loading preview...</div>
                        ) : previewUrl ? (
                            isImage(previewFile.file_type) ? (
                                <img src={previewUrl} alt={previewFile.original_filename} />
                            ) : (
                                <iframe src={previewUrl} title={previewFile.original_filename} />
                            )
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Files;
