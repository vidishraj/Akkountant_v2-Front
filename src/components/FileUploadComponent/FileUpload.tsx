import {useState, DragEvent} from 'react';
import {
    Dialog,
    DialogActions,
    DialogContent,
    Button,
    Typography,
    CircularProgress,
    Box,
} from '@mui/material';
import styles from './FileUpload.module.scss';

interface FileUploadProps {
    open: boolean;
    onClose: () => void;
    onUpload: (file: File) => Promise<void>;
}

const FileUploadDialog: React.FC<FileUploadProps> = ({open, onClose, onUpload}) => {
    const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
    const [uploading, setUploading] = useState(false);

    // Handle file selection from the input
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
        }
    };

    // Handle file drop
    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    // Prevent default behavior for drag events
    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    };

    // Handle upload process
    const handleUpload = async () => {
        if (selectedFile) {
            setUploading(true);
            try {
                await onUpload(selectedFile);
            } finally {
                setUploading(false);
                setSelectedFile(undefined);
                onClose();
            }
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" className={styles.fileUploadDialog}>
            {uploading && (
                <Box className={styles.loadingOverlay}>
                    <CircularProgress size={60}/>
                </Box>
            )}
            <DialogContent className={styles.dialogContent}>
                <div
                    className={`${styles.dropArea} ${selectedFile ? styles.fileSelected : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                >
                    <label htmlFor="file-input" className={styles.uploadLabel}>
                        <input
                            type="file"
                            id="file-input"
                            onChange={handleFileChange}
                            style={{display: 'none'}}
                        />
                        {!selectedFile ? (
                            <Typography variant="h6" className={styles.uploadText}>
                                Drag & Drop files here or click to select a file
                            </Typography>
                        ) : (
                            <div className={styles.fileDetails}>
                                <Typography variant="subtitle1">File Details:</Typography>
                                <Typography variant="body2">{selectedFile.name}</Typography>
                                <Typography variant="body2">
                                    Size: {(selectedFile.size / 1024).toFixed(2)} KB
                                </Typography>
                            </div>
                        )}
                    </label>
                </div>
            </DialogContent>
            <DialogActions className={styles.buttonContainer}>
                <Button onClick={onClose} color="secondary" disabled={uploading}>
                    Cancel
                </Button>
                <Button
                    onClick={handleUpload}
                    color="primary"
                    variant="contained"
                    disabled={!selectedFile || uploading}
                >
                    {uploading ? 'Uploading...' : 'Upload'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default FileUploadDialog;
