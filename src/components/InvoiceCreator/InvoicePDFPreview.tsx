import {useState} from 'react';
import {InvoiceData} from '../../utils/interfaces';
import {generateInvoicePDFLocal} from '../../services/freelanceService';
import {useMessage} from '../../contexts/MessageContext';
import styles from '../../pages/Freelance/Freelance.module.scss';

interface InvoicePDFPreviewProps {
    invoiceData: InvoiceData | null;
}

const InvoicePDFPreview = ({invoiceData}: InvoicePDFPreviewProps) => {
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const {setPayload} = useMessage();

    const handlePreviewPDF = async () => {
        if (!invoiceData) {
            setPayload({
                type: 'error',
                message: 'No invoice data available for preview'
            });
            return;
        }

        try {
            setLoading(true);
            const blob = await generateInvoicePDFLocal(invoiceData);
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
            // Preview generation success is evident from the preview appearing
        } catch (error) {
            setPayload({
                type: 'error',
                message: 'Failed to generate PDF preview.'
            });
            console.error('PDF preview error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!invoiceData) {
            setPayload({
                type: 'error',
                message: 'No invoice data available for download'
            });
            return;
        }

        try {
            setLoading(true);
            const blob = await generateInvoicePDFLocal(invoiceData);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${invoiceData.invoiceNumber}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setPayload({
                type: 'success',
                message: 'Invoice PDF downloaded successfully!'
            });
        } catch (error) {
            setPayload({
                type: 'error',
                message: 'Failed to download PDF.'
            });
            console.error('PDF download error:', error);
        } finally {
            setLoading(false);
        }
    };

    const refreshPreview = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
        handlePreviewPDF();
    };

    if (!invoiceData) {
        return (
            <div>
                {/*<h2 className={styles.sectionTitle}>📄 PDF Preview</h2>*/}
                <div className={styles.emptyState}>
                    <h3 style={{color: '#B0B0B0', marginBottom: '10px'}}>No Invoice Data</h3>
                    <p>Create a valid invoice in the Creation tab to generate and preview PDFs here.</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/*<h2 className={styles.sectionTitle}>📄 PDF Preview & Download</h2>*/}

            {/* Controls & Summary */}
            <div className={styles.invoiceForm} style={{marginBottom: '15px'}}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '10px',
                    flexWrap: 'wrap',
                    gap: '10px'
                }}>
                    <h3 style={{color: '#FAFAFA', margin: 0}}>PDF Controls</h3>
                    <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                        <button
                            className={styles.primaryBtn}
                            onClick={handlePreviewPDF}
                            disabled={loading}
                            style={{padding: '6px 12px', fontSize: '0.9rem'}}
                        >
                            {loading ? 'Generating...' : 'Generate Preview'}
                        </button>

                        {previewUrl && (
                            <button
                                className={styles.secondaryBtn}
                                onClick={refreshPreview}
                                disabled={loading}
                                style={{padding: '6px 12px', fontSize: '0.9rem'}}
                            >
                                Refresh
                            </button>
                        )}

                        <button
                            className={styles.secondaryBtn}
                            onClick={handleDownloadPDF}
                            disabled={loading}
                            style={{padding: '6px 12px', fontSize: '0.9rem'}}
                        >
                            {loading ? 'Downloading...' : 'Download'}
                        </button>
                    </div>
                </div>

                {/* Compact Invoice Summary */}
                <div style={{
                    padding: '10px',
                    backgroundColor: '#29384D',
                    borderRadius: '4px',
                    border: '1px solid #5B5B7B'
                }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: '8px',
                        color: '#B0B0B0',
                        fontSize: '0.85rem'
                    }}>
                        <div><strong style={{color: '#7B68EE'}}>Invoice:</strong> {invoiceData.invoiceNumber}</div>
                        <div><strong style={{color: '#7B68EE'}}>Project:</strong> {invoiceData.projectName}</div>
                        <div><strong style={{color: '#7B68EE'}}>Client:</strong> {invoiceData.to.name}</div>
                        <div><strong style={{color: '#7B68EE'}}>Total:</strong> ${invoiceData.total.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            {/* PDF Preview */}
            {previewUrl ? (
                <div className={styles.pdfPreview}>
                    <h3 className={styles.sectionTitle}>PDF Preview</h3>
                    <div style={{
                        backgroundColor: '#29384D',
                        padding: '20px',
                        borderRadius: '8px',
                        border: '1px solid #5B5B7B'
                    }}>
                        <iframe
                            src={previewUrl}
                            width="100%"
                            height="800px"
                            style={{
                                border: '1px solid #5B5B7B',
                                borderRadius: '4px',
                                backgroundColor: 'white'
                            }}
                            title="Invoice PDF Preview"
                        />

                        <div style={{
                            marginTop: '15px',
                            padding: '10px',
                            backgroundColor: 'rgba(123, 104, 238, 0.1)',
                            borderRadius: '4px',
                            color: '#B0B0B0',
                            fontSize: '0.9rem',
                            textAlign: 'center'
                        }}>
                            💡 Use browser zoom controls to adjust preview size. The downloaded PDF will be in full A4
                            quality.
                        </div>
                    </div>
                </div>
            ) : (
                <div className={styles.invoiceForm}>
                    <div style={{
                        textAlign: 'center',
                        padding: '40px',
                        color: '#B0B0B0'
                    }}>
                        <div style={{fontSize: '3rem', marginBottom: '15px'}}>📄</div>
                        <h3 style={{marginBottom: '10px'}}>No PDF Preview Generated</h3>
                        <p>Click "Generate Preview" to create and display your invoice PDF here.</p>
                    </div>
                </div>
            )}

            {/* PDF Features Info */}
            {/* <div style={{ 
                marginTop: '30px', 
                padding: '20px', 
                backgroundColor: '#29384D', 
                borderRadius: '8px',
                border: '1px solid #5B5B7B'
            }}>
                <h4 style={{ color: '#FAFAFA', marginBottom: '15px' }}>📋 PDF Features:</h4>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '20px'
                }}>
                    <div>
                        <h5 style={{ color: '#7B68EE', marginBottom: '8px' }}>Professional Layout:</h5>
                        <ul style={{ color: '#B0B0B0', fontSize: '0.9rem', lineHeight: '1.6', margin: 0, paddingLeft: '20px' }}>
                            <li>Standard A4 page format (210 × 297 mm)</li>
                            <li>Professional typography and spacing</li>
                            <li>Branded color scheme</li>
                            <li>Clear section divisions</li>
                        </ul>
                    </div>
                    <div>
                        <h5 style={{ color: '#7B68EE', marginBottom: '8px' }}>Content Features:</h5>
                        <ul style={{ color: '#B0B0B0', fontSize: '0.9rem', lineHeight: '1.6', margin: 0, paddingLeft: '20px' }}>
                            <li>Complete invoice information</li>
                            <li>Itemized line items table</li>
                            <li>Tax calculations and totals</li>
                            <li>Notes and terms sections</li>
                        </ul>
                    </div>
                    <div>
                        <h5 style={{ color: '#7B68EE', marginBottom: '8px' }}>Print Ready:</h5>
                        <ul style={{ color: '#B0B0B0', fontSize: '0.9rem', lineHeight: '1.6', margin: 0, paddingLeft: '20px' }}>
                            <li>High-quality PDF output</li>
                            <li>Print-optimized layout</li>
                            <li>Consistent formatting</li>
                            <li>Professional presentation</li>
                        </ul>
                    </div>
                </div>
            </div> */}
        </div>
    );
};

export default InvoicePDFPreview;