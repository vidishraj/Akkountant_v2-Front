import {useState, useEffect, useRef} from "react";
import {
    fetchAllInvoices,
    fetchUserSignatures,
    uploadSignature,
    deleteSignature,
    signInvoicePDFLocal,
} from "../../services/freelanceService";
import {SignatureData, InvoiceData, Signature} from "../../utils/interfaces";
import {useMessage} from "../../contexts/MessageContext";
import styles from "../../pages/Freelance/Freelance.module.scss";

const InvoiceSigner = () => {
    const [signatures, setSignatures] = useState<Signature[]>([]);
    const [selectedSignature, setSelectedSignature] = useState<string>("");
    const [invoices, setInvoices] = useState<InvoiceData[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<string>("");
    const [signaturePosition, setSignaturePosition] = useState({x: 20, y: 20});
    const [signatureSize, setSignatureSize] = useState({
        width: 50,
        height: 20,
    });
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [deletingSignature, setDeletingSignature] = useState<string | null>(
        null
    );
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const {setPayload} = useMessage();

    // Maximum number of signatures allowed
    const MAX_SIGNATURES = 3;

    // Helper function to convert base64 signature data to data URL
    const getSignatureDataUrl = (signature: Signature): string => {
        if (signature.signature_data.startsWith('data:')) {
            return signature.signature_data;
        }
        return `data:image/png;base64,${signature.signature_data}`;
    };


    useEffect(() => {
        loadSignatures();
        loadInvoices();
    }, []);

    // Clean up preview URL when selection changes
    useEffect(() => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
    }, [selectedInvoice, selectedSignature, signaturePosition, signatureSize]);

    // Clean up preview URL on unmount
    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const loadSignatures = async () => {
        try {
            const fetchedSignatures = await fetchUserSignatures();
            setSignatures(fetchedSignatures);
            if (fetchedSignatures.length > 0 && !selectedSignature) {
                const firstSignatureUrl = getSignatureDataUrl(fetchedSignatures[0]);
                setSelectedSignature(firstSignatureUrl);
            }
        } catch (error) {
            console.error("Error loading signatures:", error);
            setPayload({
                type: "error",
                message: "Failed to load signatures from server",
            });
        }
    };

    const loadInvoices = async () => {
        try {
            const {invoices: fetchedInvoices} = await fetchAllInvoices(1, 50);
            setInvoices(fetchedInvoices);
        } catch (error) {
            setPayload({
                type: "error",
                message: "Failed to load invoices. Backend connection required.",
            });
            console.error("Invoice loading error:", error);
        }
    };

    const handleFileUpload = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Check signature limit
        if (signatures.length >= MAX_SIGNATURES) {
            setPayload({
                type: "error",
                message: `You can only have up to ${MAX_SIGNATURES} signatures. Please delete one before uploading a new one.`,
            });
            return;
        }

        // Validate file type
        if (!file.type.startsWith("image/")) {
            setPayload({
                type: "error",
                message: "Please upload an image file (PNG, JPG, etc.)",
            });
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setPayload({
                type: "error",
                message: "File size must be less than 5MB",
            });
            return;
        }

        try {
            setUploading(true);

            // Upload signature to backend
            const uploadResponse = await uploadSignature(file);

            // Reload signatures from backend
            await loadSignatures();

            // Select the newly uploaded signature
            setSelectedSignature(getSignatureDataUrl(uploadResponse));

            setPayload({
                type: "success",
                message: "Signature uploaded successfully!",
            });
        } catch (error) {
            setPayload({
                type: "error",
                message: "Failed to upload signature to server",
            });
            console.error("Signature upload error:", error);
        } finally {
            setUploading(false);
            // Clear the file input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDeleteSignature = async (
        signatureId: string,
        signature: Signature
    ) => {
        if (
            !window.confirm(
                "Are you sure you want to delete this signature? This action cannot be undone."
            )
        ) {
            return;
        }

        try {
            setDeletingSignature(signatureId);

            // Delete signature from backend
            await deleteSignature(signatureId);

            // Reload signatures from backend
            await loadSignatures();

            // Clear selection if deleted signature was selected
            const signatureDataUrl = getSignatureDataUrl(signature);
            if (selectedSignature === signatureDataUrl) {
                const remainingSignatures = signatures.filter(
                    (sig) => sig.id !== signatureId
                );
                setSelectedSignature(
                    remainingSignatures.length > 0
                        ? getSignatureDataUrl(remainingSignatures[0])
                        : ""
                );
            }

            setPayload({
                type: "success",
                message: "Signature deleted successfully",
            });
        } catch (error) {
            setPayload({
                type: "error",
                message: "Failed to delete signature from server",
            });
            console.error("Signature deletion error:", error);
        } finally {
            setDeletingSignature(null);
        }
    };

    const handleSignInvoice = async () => {
        if (!selectedInvoice || !selectedSignature) {
            setPayload({
                type: "error",
                message: "Please select both an invoice and a signature",
            });
            return;
        }

        const invoice = invoices.find(
            (inv) => inv.invoiceNumber === selectedInvoice
        );
        if (!invoice) {
            setPayload({
                type: "error",
                message: "Selected invoice not found",
            });
            return;
        }

        try {
            setLoading(true);
            
            console.log('Starting invoice signing process:', {
                invoiceNumber: selectedInvoice,
                signatureUrl: selectedSignature.substring(0, 50) + '...',
                signaturePosition,
                signatureSize
            });

            // Validate signature URL
            if (!selectedSignature.startsWith('data:image/')) {
                throw new Error('Invalid signature format: must be a data URL');
            }

            const signatureData: SignatureData = {
                signatureUrl: selectedSignature,
                x: signaturePosition.x,
                y: signaturePosition.y,
                width: signatureSize.width,
                height: signatureSize.height,
            };

            console.log('Calling signInvoicePDFLocal with:', { 
                invoiceId: invoice.invoiceNumber,
                signatureDataKeys: Object.keys(signatureData)
            });

            const signedPdfBlob = await signInvoicePDFLocal(
                invoice,
                signatureData
            );

            if (!signedPdfBlob || signedPdfBlob.size === 0) {
                throw new Error('Generated PDF is empty or invalid');
            }

            console.log('PDF generated successfully, size:', signedPdfBlob.size, 'bytes');

            // Create download link
            const url = URL.createObjectURL(signedPdfBlob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `signed-${selectedInvoice}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            console.log('PDF download initiated successfully');

            setPayload({
                type: "success",
                message: "Invoice signed and downloaded successfully!",
            });
        } catch (error) {
            console.error("Invoice signing error:", error);
            
            let errorMessage = "Failed to sign invoice. Please try again.";
            if (error instanceof Error) {
                errorMessage = `Signing failed: ${error.message}`;
            }
            
            setPayload({
                type: "error",
                message: errorMessage,
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePreviewSignedInvoice = async () => {
        if (!selectedInvoice || !selectedSignature) {
            setPayload({
                type: "error",
                message: "Please select both an invoice and a signature",
            });
            return;
        }

        const invoice = invoices.find(
            (inv) => inv.invoiceNumber === selectedInvoice
        );
        if (!invoice) {
            setPayload({
                type: "error",
                message: "Selected invoice not found",
            });
            return;
        }

        try {
            setLoading(true);
            const signatureData: SignatureData = {
                signatureUrl: selectedSignature,
                x: signaturePosition.x,
                y: signaturePosition.y,
                width: signatureSize.width,
                height: signatureSize.height,
            };

            console.log('Generating PDF preview with signature data:', {
                position: signaturePosition,
                size: signatureSize
            });

            // Generate preview PDF with signature using local generation
            const previewPdfBlob = await signInvoicePDFLocal(invoice, signatureData);

            // Clean up previous preview URL
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }

            // Create new preview URL
            const url = URL.createObjectURL(previewPdfBlob);
            setPreviewUrl(url);

            setPayload({
                type: "success",
                message:
                    "PDF preview generated! Review signature placement before downloading.",
            });
        } catch (error) {
            setPayload({
                type: "error",
                message: "Failed to generate preview. Please try again.",
            });
            console.error("Preview generation error:", error);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div>
            {/* Hidden canvas for PDF generation */}
            <canvas ref={canvasRef} style={{display: "none"}}/>


            {/* Signature Management Section */}
            <div className={styles.invoiceForm} style={{marginBottom: "20px"}}>
                <h4 style={{color: "#FAFAFA", marginBottom: "15px"}}>
                    📝 Manage Signatures
                    <span style={{color: "#B0B0B0", fontSize: "0.8rem", marginLeft: "10px"}}>
                        ({signatures.length}/{MAX_SIGNATURES} signatures used)
                        {signatures.length >= MAX_SIGNATURES && (
                            <span style={{color: "#FF6B6B", marginLeft: "5px"}}>
                                ⚠️ Limit reached
                            </span>
                        )}
                    </span>
                </h4>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 2fr",
                        gap: "20px",
                        padding: "20px",
                        backgroundColor: "#121C24",
                        borderRadius: "8px",
                        border: "1px solid white",
                    }}
                >
                    {/* Upload New Signature - Left Side */}
                    <div>
                        <h5 style={{color: "#FAFAFA", marginBottom: "15px"}}>Upload New Signature</h5>
                        <div style={{textAlign: "center", marginBottom: "15px"}}>
                            <p style={{color: "#B0B0B0", margin: 0, fontSize: "0.9rem"}}>
                                Upload your signature or initial image
                            </p>
                            <p
                                style={{
                                    color: "#8B8B8B",
                                    fontSize: "0.8rem",
                                    margin: "5px 0 0 0",
                                }}
                            >
                                PNG, JPG, GIF (Max 5MB)
                            </p>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            style={{display: "none"}}
                        />

                        <div style={{textAlign: "center"}}>
                            <button
                                className={styles.primaryBtn}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading || signatures.length >= MAX_SIGNATURES}
                                style={{
                                    opacity:
                                        uploading || signatures.length >= MAX_SIGNATURES ? 0.6 : 1,
                                    cursor:
                                        uploading || signatures.length >= MAX_SIGNATURES
                                            ? "not-allowed"
                                            : "pointer",
                                }}
                            >
                                {uploading
                                    ? "Uploading..."
                                    : signatures.length >= MAX_SIGNATURES
                                        ? `Max ${MAX_SIGNATURES} reached`
                                        : "📤 Upload Signature"}
                            </button>
                        </div>
                    </div>

                    {/* Signature Library - Right Side */}
                    <div>
                        <h5 style={{color: "#FAFAFA", marginBottom: "15px"}}>📚 Signature Library</h5>
                        {signatures.length > 0 ? (
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                                    gap: "10px",
                                    maxHeight: "400px",
                                    overflowY: "auto",
                                }}
                            >
                                {signatures.map((sig) => (
                                    <div
                                        key={sig.id}
                                        style={{
                                            padding: "10px",
                                            backgroundColor:
                                                selectedSignature === getSignatureDataUrl(sig)
                                                    ? "#3A4F6A"
                                                    : "#1E1E2E",
                                            borderRadius: "8px",
                                            border:
                                                selectedSignature === getSignatureDataUrl(sig)
                                                    ? "2px solid #7B68EE"
                                                    : "1px solid #333",
                                            cursor: "pointer",
                                            transition: "all 0.2s",
                                        }}
                                        onClick={() => setSelectedSignature(getSignatureDataUrl(sig))}
                                    >
                                        <div
                                            style={{
                                                backgroundColor: "#FAFAFA",
                                                padding: "8px",
                                                borderRadius: "4px",
                                                marginBottom: "8px",
                                                textAlign: "center",
                                                minHeight: "60px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <img
                                                src={getSignatureDataUrl(sig)}
                                                alt="Signature"
                                                style={{
                                                    maxWidth: "100%",
                                                    maxHeight: "50px",
                                                    objectFit: "contain",
                                                }}
                                                onError={(e) => {
                                                    console.error("Failed to load signature image:", getSignatureDataUrl(sig));
                                                    (e.target as HTMLImageElement).style.display = "none";
                                                    const parent = (e.target as HTMLImageElement)
                                                        .parentElement;
                                                    if (parent) {
                                                        parent.innerHTML =
                                                            '<div style="color: #666; font-style: italic; font-size: 0.8rem;">Failed to load</div>';
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div
                                            style={{
                                                color: "#FAFAFA",
                                                fontSize: "0.8rem",
                                                marginBottom: "3px",
                                                textAlign: "center",
                                            }}
                                        >
                                            {sig.name}
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "center",
                                                alignItems: "center",
                                            }}
                                        >
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteSignature(sig.id, sig);
                                                }}
                                                disabled={deletingSignature === sig.id}
                                                style={{padding: "2px 6px", fontSize: "0.7rem"}}
                                            >
                                                {deletingSignature === sig.id
                                                    ? "⏳"
                                                    : "🗑️"}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div
                                style={{
                                    textAlign: "center",
                                    padding: "30px",
                                    color: "#B0B0B0",
                                    backgroundColor: "#1E1E2E",
                                    borderRadius: "8px",
                                    border: "1px dashed #333",
                                }}
                            >
                                <div style={{fontSize: "2rem", marginBottom: "10px"}}>📝</div>
                                <p style={{margin: 0}}>No signatures uploaded yet</p>
                                <p style={{margin: "5px 0 0 0", fontSize: "0.8rem", color: "#8B8B8B"}}>
                                    Upload your first signature to get started
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Invoice Selection */}
            <div className={styles.invoiceForm} style={{marginBottom: "20px"}}>
                <h4 style={{color: "#FAFAFA", marginBottom: "15px"}}>
                    📄 Select Invoice to Sign
                </h4>

                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Choose Invoice:</label>
                    <select
                        className={styles.formInput}
                        value={selectedInvoice}
                        onChange={(e) => setSelectedInvoice(e.target.value)}
                    >
                        <option value="">Select an invoice to sign...</option>
                        {invoices.map((invoice) => (
                            <option key={invoice.invoiceNumber} value={invoice.invoiceNumber}>
                                {invoice.invoiceNumber} - {invoice.projectName} -{" "}
                                {invoice.to.name} - {invoice.currency}{" "}
                                {invoice.total.toFixed(2)}
                            </option>
                        ))}
                    </select>
                </div>

                {selectedInvoice && (
                    <div
                        style={{
                            marginTop: "15px",
                            padding: "15px",
                            backgroundColor: "#121C24",
                            borderRadius: "8px",
                            border: "1px solid white",
                        }}
                    >
                        <h5 style={{color: "#FAFAFA", marginBottom: "10px"}}>
                            📋 Invoice Details:
                        </h5>
                        {(() => {
                            const invoice = invoices.find(
                                (inv) => inv.invoiceNumber === selectedInvoice
                            );
                            if (!invoice) return null;
                            return (
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                        gap: "10px",
                                        color: "#B0B0B0",
                                        fontSize: "0.9rem",
                                    }}
                                >
                                    <div>
                                        <strong>Project:</strong> {invoice.projectName}
                                    </div>
                                    <div>
                                        <strong>Client:</strong> {invoice.to.name}
                                    </div>
                                    <div>
                                        <strong>Total:</strong> {invoice.currency}{" "}
                                        {invoice.total.toFixed(2)}
                                    </div>
                                    <div>
                                        <strong>Issue Date:</strong>{" "}
                                        {new Date(invoice.issueDate).toLocaleDateString()}
                                    </div>
                                    <div>
                                        <strong>Due Date:</strong>{" "}
                                        {new Date(invoice.dueDate).toLocaleDateString()}
                                    </div>
                                    <div>
                                        <strong>Status:</strong>
                                        <span
                                            style={{
                                                color:
                                                    invoice.status === "paid"
                                                        ? "#32CD32"
                                                        : invoice.status === "sent"
                                                            ? "#FFD700"
                                                            : "#B0B0B0",
                                                marginLeft: "5px",
                                            }}
                                        >
                      {invoice.status}
                    </span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* Signature Positioning Controls */}
            {selectedInvoice && selectedSignature && (
                <div className={styles.invoiceForm} style={{marginBottom: "20px"}}>
                    <h4 style={{color: "#FAFAFA", marginBottom: "15px"}}>
                        🎯 Signature Positioning & Size
                    </h4>
                    
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "30px",
                            padding: "20px",
                            backgroundColor: "#121C24",
                            borderRadius: "8px",
                            border: "1px solid white",
                        }}
                    >
                        {/* Position Controls */}
                        <div>
                            <h5 style={{color: "#FAFAFA", marginBottom: "15px"}}>📍 Position (mm)</h5>
                            
                            <div className={styles.formGroup} style={{marginBottom: "15px"}}>
                                <label className={styles.formLabel}>
                                    X Position: {signaturePosition.x}mm
                                </label>
                                <input
                                    type="range"
                                    min="10"
                                    max="150"
                                    step="1"
                                    value={signaturePosition.x}
                                    onChange={(e) => setSignaturePosition(prev => ({
                                        ...prev,
                                        x: parseInt(e.target.value)
                                    }))}
                                    style={{
                                        width: "100%",
                                        height: "8px",
                                        backgroundColor: "#1E1E2E",
                                        outline: "none",
                                        borderRadius: "4px",
                                        appearance: "none",
                                        cursor: "pointer"
                                    }}
                                />
                                <div style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    color: "#B0B0B0",
                                    fontSize: "0.8rem",
                                    marginTop: "5px"
                                }}>
                                    <span>10mm</span>
                                    <span>150mm</span>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    Y Position: {signaturePosition.y}mm
                                </label>
                                <input
                                    type="range"
                                    min="10"
                                    max="250"
                                    step="1"
                                    value={signaturePosition.y}
                                    onChange={(e) => setSignaturePosition(prev => ({
                                        ...prev,
                                        y: parseInt(e.target.value)
                                    }))}
                                    style={{
                                        width: "100%",
                                        height: "8px",
                                        backgroundColor: "#1E1E2E",
                                        outline: "none",
                                        borderRadius: "4px",
                                        appearance: "none",
                                        cursor: "pointer"
                                    }}
                                />
                                <div style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    color: "#B0B0B0",
                                    fontSize: "0.8rem",
                                    marginTop: "5px"
                                }}>
                                    <span>10mm</span>
                                    <span>250mm</span>
                                </div>
                            </div>
                        </div>

                        {/* Size Controls */}
                        <div>
                            <h5 style={{color: "#FAFAFA", marginBottom: "15px"}}>📏 Size (mm)</h5>
                            
                            <div className={styles.formGroup} style={{marginBottom: "15px"}}>
                                <label className={styles.formLabel}>
                                    Width: {signatureSize.width}mm
                                </label>
                                <input
                                    type="range"
                                    min="20"
                                    max="100"
                                    step="1"
                                    value={signatureSize.width}
                                    onChange={(e) => setSignatureSize(prev => ({
                                        ...prev,
                                        width: parseInt(e.target.value)
                                    }))}
                                    style={{
                                        width: "100%",
                                        height: "8px",
                                        backgroundColor: "#1E1E2E",
                                        outline: "none",
                                        borderRadius: "4px",
                                        appearance: "none",
                                        cursor: "pointer"
                                    }}
                                />
                                <div style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    color: "#B0B0B0",
                                    fontSize: "0.8rem",
                                    marginTop: "5px"
                                }}>
                                    <span>20mm</span>
                                    <span>100mm</span>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    Height: {signatureSize.height}mm
                                </label>
                                <input
                                    type="range"
                                    min="10"
                                    max="50"
                                    step="1"
                                    value={signatureSize.height}
                                    onChange={(e) => setSignatureSize(prev => ({
                                        ...prev,
                                        height: parseInt(e.target.value)
                                    }))}
                                    style={{
                                        width: "100%",
                                        height: "8px",
                                        backgroundColor: "#1E1E2E",
                                        outline: "none",
                                        borderRadius: "4px",
                                        appearance: "none",
                                        cursor: "pointer"
                                    }}
                                />
                                <div style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    color: "#B0B0B0",
                                    fontSize: "0.8rem",
                                    marginTop: "5px"
                                }}>
                                    <span>10mm</span>
                                    <span>50mm</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Reset to Defaults */}
                    <div style={{textAlign: "center", marginTop: "15px"}}>
                        <button
                            className={styles.secondaryBtn}
                            onClick={() => {
                                setSignaturePosition({x: 20, y: 20});
                                setSignatureSize({width: 50, height: 20});
                            }}
                            style={{
                                padding: "8px 16px",
                                fontSize: "0.9rem"
                            }}
                        >
                            🔄 Reset to Defaults
                        </button>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            {selectedInvoice && selectedSignature && (
                <div className={styles.invoiceForm} style={{marginBottom: "20px"}}>
                    <div
                        style={{
                            display: "flex",
                            gap: "15px",
                            justifyContent: "center",
                            flexWrap: "wrap",
                        }}
                    >
                        <button
                            className={styles.secondaryBtn}
                            onClick={handlePreviewSignedInvoice}
                            disabled={loading}
                            style={{minWidth: "200px"}}
                        >
                            {loading
                                ? "⏳ Generating Preview..."
                                : "👁️ Preview PDF"}
                        </button>
                        
                        <button
                            className={styles.primaryBtn}
                            onClick={handleSignInvoice}
                            disabled={loading}
                            style={{minWidth: "200px"}}
                        >
                            {loading
                                ? "⏳ Signing Document..."
                                : "✍️ Sign & Download Invoice"}
                        </button>
                    </div>
                </div>
            )}

            {/* PDF Preview */}
            {previewUrl && (
                <div className={styles.invoiceForm} style={{marginBottom: "20px"}}>
                    <h4 style={{color: "#FAFAFA", marginBottom: "15px"}}>
                        📄 PDF Preview
                    </h4>
                    
                    <div
                        style={{
                            backgroundColor: "#121C24",
                            borderRadius: "8px",
                            border: "1px solid white",
                            padding: "20px",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "15px",
                                flexWrap: "wrap",
                                gap: "10px"
                            }}
                        >
                            <span style={{color: "#B0B0B0", fontSize: "0.9rem"}}>
                                📍 Position: X={signaturePosition.x}mm, Y={signaturePosition.y}mm | 
                                📏 Size: {signatureSize.width}mm × {signatureSize.height}mm
                            </span>
                            
                            <button
                                className={styles.secondaryBtn}
                                onClick={() => {
                                    if (previewUrl) {
                                        URL.revokeObjectURL(previewUrl);
                                        setPreviewUrl(null);
                                    }
                                }}
                                style={{
                                    padding: "6px 12px",
                                    fontSize: "0.8rem",
                                    minWidth: "auto"
                                }}
                            >
                                ✕ Close Preview
                            </button>
                        </div>
                        
                        <div
                            style={{
                                width: "100%",
                                height: "600px",
                                border: "1px solid #333",
                                borderRadius: "4px",
                                overflow: "hidden"
                            }}
                        >
                            <iframe
                                src={previewUrl}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    border: "none"
                                }}
                                title="PDF Preview"
                            />
                        </div>
                        
                        <div
                            style={{
                                textAlign: "center",
                                marginTop: "15px",
                                color: "#B0B0B0",
                                fontSize: "0.9rem"
                            }}
                        >
                            Review the signature placement above. Adjust position/size using the sliders and regenerate preview if needed.
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default InvoiceSigner;
