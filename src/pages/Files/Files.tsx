import {useCallback, useEffect, useRef, useState} from 'react';
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

const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];

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
    const [label, setLabel] = useState('');
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Upload
    const handleUpload = async () => {
        if (!selectedFile) return;
        const ext = selectedFile.name.split('.').pop()?.toLowerCase() || '';
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            setPayload({type: 'error', message: `File type .${ext} is not allowed`});
            return;
        }
        if (selectedFile.size > 10 * 1024 * 1024) {
            setPayload({type: 'error', message: 'File must be under 10 MB'});
            return;
        }
        setUploading(true);
        try {
            await uploadVaultFile(selectedFile, label || undefined, currentFolderId);
            setPayload({type: 'success', message: 'File uploaded successfully'});
            setShowUpload(false);
            setSelectedFile(null);
            setLabel('');
            await loadFiles(currentFolderId, true);
        } catch {
            setPayload({type: 'error', message: 'Upload failed'});
        } finally {
            setUploading(false);
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

    // Delete file
    const handleDelete = async (file: UserFileData) => {
        if (!confirm(`Delete "${file.original_filename}"?`)) return;
        try {
            await deleteVaultFile(file.id);
            setPayload({type: 'success', message: 'File deleted'});
            await loadFiles(currentFolderId, true);
        } catch {
            setPayload({type: 'error', message: 'Delete failed'});
        }
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

    // Delete folder
    const handleDeleteFolder = async (folder: UserFolderData) => {
        if (!confirm(`Delete folder "${folder.name}"? Files inside will be moved to the parent folder.`)) return;
        try {
            await deleteFolder(folder.id);
            setPayload({type: 'success', message: 'Folder deleted'});
            await loadFiles(currentFolderId, true);
        } catch {
            setPayload({type: 'error', message: 'Failed to delete folder'});
        }
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
        if (e.dataTransfer.files.length > 0) {
            setSelectedFile(e.dataTransfer.files[0]);
        }
    };

    const isImage = (fileType: string) => fileType.startsWith('image/');

    const isEmpty = files.length === 0 && folders.length === 0;

    return (
        <div className={style.filesPage} onClick={closeContextMenu}>
            <div className={style.header}>
                <div className={style.headerLeft}>
                    <h2>Document Vault</h2>
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
                <div className={style.headerActions}>
                    <button className={style.folderBtn} onClick={() => setShowCreateFolder(true)}>
                        + Folder
                    </button>
                    <button className={style.uploadBtn} onClick={() => setShowUpload(true)}>
                        + Upload
                    </button>
                </div>
            </div>

            {loading ? (
                <div className={style.loadingState}>Loading files...</div>
            ) : isEmpty ? (
                <div className={style.emptyState}>
                    <span>{currentFolderId ? 'This folder is empty' : 'No files uploaded yet'}</span>
                    <button className={style.uploadBtn} onClick={() => setShowUpload(true)}>
                        Upload your first file
                    </button>
                </div>
            ) : (
                <div className={style.fileGrid}>
                    {/* Folders */}
                    {folders.map((folder) => (
                        <div
                            key={folder.id}
                            className={style.folderCard}
                            onDoubleClick={() => navigateToFolder(folder)}
                            onClick={() => navigateToFolder(folder)}
                            onContextMenu={(e) => handleContextMenu(e, undefined, folder)}
                        >
                            <div className={style.folderIcon}>
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#7b68ee" strokeWidth="1.5">
                                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                            </div>
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
                        </div>
                    ))}

                    {/* Files */}
                    {files.map((file) => (
                        <div
                            key={file.id}
                            className={style.fileCard}
                            onContextMenu={(e) => handleContextMenu(e, file)}
                        >
                            <div
                                className={style.thumbnailContainer}
                                onClick={() => handlePreview(file)}
                            >
                                {file.thumbnail ? (
                                    <img
                                        src={`data:image/png;base64,${file.thumbnail}`}
                                        alt={file.original_filename}
                                    />
                                ) : (
                                    <span className={style.genericIcon}>
                                        {file.file_extension}
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
                                    <div
                                        className={style.fileLabel}
                                        onClick={() => {
                                            setEditingLabelId(file.id);
                                            setEditLabelValue(file.label || '');
                                        }}
                                        title="Click to edit label"
                                    >
                                        {file.label || 'Add label'}
                                    </div>
                                )}
                            </div>
                            <div className={style.fileActions}>
                                <button onClick={() => handleDownload(file)}>Download</button>
                                <button
                                    className={style.deleteBtn}
                                    onClick={() => handleDelete(file)}
                                >
                                    Delete
                                </button>
                            </div>
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
                            <h3>Upload File</h3>
                            <button onClick={() => setShowUpload(false)}>&times;</button>
                        </div>

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
                                <small>PDF, PNG, JPG, GIF, BMP, WebP (max 10 MB)</small>
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

                        {currentFolderId && (
                            <div className={style.uploadFolder}>
                                Uploading to: <strong>{breadcrumbs[breadcrumbs.length - 1]?.name}</strong>
                            </div>
                        )}

                        <div className={style.uploadActions}>
                            <button
                                className={style.cancelBtn}
                                onClick={() => {
                                    setShowUpload(false);
                                    setSelectedFile(null);
                                    setLabel('');
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className={style.submitBtn}
                                disabled={!selectedFile || uploading}
                                onClick={handleUpload}
                            >
                                {uploading ? 'Uploading...' : 'Upload'}
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
