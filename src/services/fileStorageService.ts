import axios from './AxiosConfig.tsx';
import {queueRequest} from './AxiosQueueManager.tsx';
import {withCacheCleared} from './transactionService.ts';
import {TrashListResponse, UserFileData, UserFolderData} from '../utils/interfaces';

function withRequestId(endpoint: string, options: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        ...options,
        id: `${endpoint}-${JSON.stringify((options as Record<string, unknown>).params || {})}`,
    };
}

export async function uploadVaultFile(file: File, label?: string, folderId?: string | null): Promise<UserFileData> {
    const formData = new FormData();
    formData.append('file', file);
    if (label) {
        formData.append('label', label);
    }
    if (folderId) {
        formData.append('folder_id', folderId);
    }
    const options = withRequestId('api/files/upload', withCacheCleared());
    const response = await queueRequest(() =>
        axios.post('files/upload', formData, {
            ...options,
            headers: {'Content-Type': 'multipart/form-data'},
        })
    );
    return response.data.file;
}

export async function listVaultFiles(folderId?: string | null, clearCache = false): Promise<{files: UserFileData[], folders: UserFolderData[]}> {
    const params: Record<string, unknown> = {};
    if (folderId) {
        params.folder_id = folderId;
    }
    // Build ID from only the meaningful params (exclude clearCacheEntry)
    const id = `api/files/list-${JSON.stringify({folder_id: folderId || null})}`;
    if (clearCache) {
        params.clearCacheEntry = true;
    }
    const response = await queueRequest(() =>
        axios.get('files/list', {id, params})
    );
    return {files: response.data.files, folders: response.data.folders || []};
}

export async function downloadVaultFile(fileId: string): Promise<Blob> {
    const response = await queueRequest(() =>
        axios.get(`files/${fileId}/download`, {
            responseType: 'blob',
            cache: false,
        } as Record<string, unknown>)
    );
    return response.data;
}

export async function viewVaultFile(fileId: string): Promise<Blob> {
    const response = await queueRequest(() =>
        axios.get(`files/${fileId}/view`, {
            responseType: 'blob',
            cache: false,
        } as Record<string, unknown>)
    );
    return response.data;
}

export async function deleteVaultFile(fileId: string): Promise<void> {
    const options = withRequestId(`api/files/${fileId}`, withCacheCleared());
    await queueRequest(() => axios.delete(`files/${fileId}`, options));
}

export async function updateFileLabel(fileId: string, label: string): Promise<UserFileData> {
    const options = withRequestId(`api/files/${fileId}/label`, withCacheCleared());
    const response = await queueRequest(() =>
        axios.put(`files/${fileId}/label`, {label}, options)
    );
    return response.data.file;
}

export async function moveFile(fileId: string, folderId: string | null): Promise<UserFileData> {
    const options = withRequestId(`api/files/${fileId}/move`, withCacheCleared());
    const response = await queueRequest(() =>
        axios.put(`files/${fileId}/move`, {folder_id: folderId}, options)
    );
    return response.data.file;
}

export async function createFolder(name: string, parentFolderId?: string | null): Promise<UserFolderData> {
    const options = withRequestId('api/folders', withCacheCleared());
    const response = await queueRequest(() =>
        axios.post('folders', {name, parent_folder_id: parentFolderId || null}, options)
    );
    return response.data.folder;
}

export async function renameFolder(folderId: string, name: string): Promise<UserFolderData> {
    const options = withRequestId(`api/folders/${folderId}`, withCacheCleared());
    const response = await queueRequest(() =>
        axios.put(`folders/${folderId}`, {name}, options)
    );
    return response.data.folder;
}

export async function deleteFolder(folderId: string): Promise<void> {
    const options = withRequestId(`api/folders/${folderId}`, withCacheCleared());
    await queueRequest(() => axios.delete(`folders/${folderId}`, options));
}

/* ───── ak-iqa6 (ak-kxdr companion FE): trash surface ───── */

/**
 * GET /files/trash — list soft-deleted files with `days_remaining`
 * counter (BE-computed, newest-trashed first). Returns the raw
 * {files, count} envelope so callers can surface the count in a
 * header pill without a second array traversal.
 */
export async function listTrash(clearCache = false): Promise<TrashListResponse> {
    const params: Record<string, unknown> = {};
    const id = "api/files/trash-list";
    if (clearCache) params.clearCacheEntry = true;
    const response = await queueRequest(() =>
        axios.get("files/trash", {id, params}),
    );
    return {
        files: Array.isArray(response.data?.files) ? response.data.files : [],
        count: typeof response.data?.count === "number" ? response.data.count : 0,
    };
}

/**
 * POST /files/trash/<fileId>/restore — clears `deleted_at` so the
 * file returns to the active grid. Idempotent per BE contract;
 * restoring an already-live file is a no-op 200.
 */
export async function restoreTrashedFile(fileId: string): Promise<UserFileData> {
    const options = withRequestId(`api/files/trash/${fileId}/restore`, withCacheCleared());
    const response = await queueRequest(() =>
        axios.post(`files/trash/${fileId}/restore`, {}, options),
    );
    return response.data.file;
}

/**
 * DELETE /files/trash/<fileId> — §23 #5 destructive-gate HARD-delete
 * from the trash. Body MUST carry `{confirm_id: fileId}` where
 * `confirm_id` EXACTLY matches the URL id — BE 400s if the strings
 * differ. The caller (FE modal) must enforce this at the UX layer
 * too so stray automated flows can't fire the DELETE with an echo
 * value that doesn't match user intent.
 */
export async function hardDeleteTrashedFile(
    fileId: string,
    confirmId: string,
): Promise<void> {
    const options = withRequestId(`api/files/trash/${fileId}`, withCacheCleared());
    await queueRequest(() =>
        axios.delete(`files/trash/${fileId}`, {
            ...options,
            data: {confirm_id: confirmId},
        }),
    );
}
