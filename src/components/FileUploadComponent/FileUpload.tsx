import {useState, DragEvent, useRef} from 'react';
import {
    Dialog,
    DialogActions,
    DialogContent,
    Button,
    CircularProgress,
    Box,
} from '@mui/material';
import styles from './FileUpload.module.scss';
import {useMessage} from "../../contexts/MessageContext.tsx";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import axios from "../../services/AxiosConfig.tsx";

interface FileUploadProps {
    open: boolean;
    onClose: () => void;
    cardType: string | undefined;
    onUpload: (file: File) => Promise<void>;
}

const FileUploadDialog: React.FC<FileUploadProps> = ({open, onClose, onUpload, cardType}) => {
    const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
    const [uploading, setUploading] = useState(false);
    const {fetchAndSetSummary} = useMSNContext()
    const [isDragging, setIsDragging] = useState(false)
    const inputRef: any = useRef()
    const {setPayload} = useMessage()

    // Handle file selection from the input
    const handleFileChange = (event: any) => {
        const file = event.target.files[0]
        if (
            file &&
            (file.type === 'application/pdf' ||
                file.type === 'text/csv' ||
                file.type === 'text/plain' ||
                file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        ) {
            setSelectedFile(file)
        } else if (file) {

            setSelectedFile(undefined)
            event.target.value = null
        }
    }
    const handleDragEnter = (e: any) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e: any) => {
        e.preventDefault()
        setIsDragging(false)
    }

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
                onUpload(selectedFile).then((response: any) => {
                    const bought = response.data.Details.inserted.buy;
                    const sold = response.data.Details.inserted.sold;
                    setPayload({
                        type: 'success',
                        message: `File Read successfully. Bought ${bought} Sold ${sold}`
                    })
                    const service = cardType === "stocks" ? "Stocks" : cardType === "nps" ? "NPS" : "EPF";
                    fetchAndSetSummary(service, true)
                    axios.storage.remove(`fetchUserSecurities-{\\"serviceType\\":\\"${service}\\"}`)
                }).catch(() => {
                    setPayload({
                        type: 'error',
                        message: `Failed to read file`
                    })

                }).finally(() => {
                    setUploading(false);
                    setSelectedFile(undefined);
                    onClose();
                });
            } catch {
                onClose()
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
                    className={` box ${isDragging ? 'dragging' : ''}`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <div className={styles.box_input}>
                        <svg
                            className={styles.box__icon}
                            xmlns='http://www.w3.org/2000/svg'
                            width='50'
                            height='43'
                            viewBox='0 0 50 43'
                        >
                            <path
                                d='M48.4 26.5c-.9 0-1.7.7-1.7 1.7v11.6h-43.3v-11.6c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v13.2c0 .9.7 1.7 1.7 1.7h46.7c.9 0 1.7-.7 1.7-1.7v-13.2c0-1-.7-1.7-1.7-1.7zm-24.5 6.1c.3.3.8.5 1.2.5.4 0 .9-.2 1.2-.5l10-11.6c.7-.7.7-1.7 0-2.4s-1.7-.7-2.4 0l-7.1 8.3v-25.3c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v25.3l-7.1-8.3c-.7-.7-1.7-.7-2.4 0s-.7 1.7 0 2.4l10 11.6z'></path>
                        </svg>
                        <label htmlFor='file'>
                            <input
                                ref={inputRef}
                                onChange={handleFileChange}
                                type='file'
                                id='file'
                                className={styles.box__file}
                                data-multiple-caption='{count} files selected'
                                multiple={false}
                            ></input>
                            <strong style={{cursor: 'pointer', fontWeight: 800}}>Select a PDF/CSV file</strong>
                            <span className={`${styles.drop_zone} ${isDragging ? styles.dragging : ''}`}>
                or drag it here
              </span>
                        </label>
                        {selectedFile !== undefined ? (
                            <p className={styles.file_preview_font}>{selectedFile.name}</p>
                        ) : (
                            <></>
                        )}
                    </div>
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
