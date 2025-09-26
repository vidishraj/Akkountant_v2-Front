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
    const [signaturePosition, setSignaturePosition] = useState({x: 50, y: 80});
    const [signatureSize, setSignatureSize] = useState({
        width: 150,
        height: 60,
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
            const signatureData: SignatureData = {
                signatureUrl: selectedSignature,
                x: signaturePosition.x,
                y: signaturePosition.y,
                width: signatureSize.width,
                height: signatureSize.height,
            };

            // Use local generation with proper formatting
            const invoice = invoices.find(inv => inv.invoiceNumber === selectedInvoice);
            if (!invoice) throw new Error('Invoice not found');
            const signedPdfBlob = await signInvoicePDFLocal(
                invoice,
                signatureData
            );

            // Create download link
            const url = URL.createObjectURL(signedPdfBlob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `signed-${selectedInvoice}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setPayload({
                type: "success",
                message: "Invoice signed and downloaded successfully!",
            });
        } catch (error) {
            setPayload({
                type: "error",
                message: "Failed to sign invoice. Please try again.",
            });
            console.error("Invoice signing error:", error);
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


            {/* Filter Controls */}
            <div className={styles.invoiceForm} style={{marginBottom: "20px"}}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "15px",
                    }}
                >
                    <h3 style={{color: "#FAFAFA", margin: 0}}>
                        ✍️ Invoice Signature Tool
                    </h3>
                    <div style={{display: "flex", alignItems: "center", gap: "15px"}}>
            <span style={{color: "#B0B0B0", fontSize: "0.9rem"}}>
              {signatures.length}/{MAX_SIGNATURES} signature
                {signatures.length !== 1 ? "s" : ""} used
            </span>
                        {signatures.length >= MAX_SIGNATURES && (
                            <span style={{color: "#FF6B6B", fontSize: "0.8rem"}}>
                ⚠️ Limit reached
              </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Signature Management Section */}
            <div className={styles.invoiceForm} style={{marginBottom: "20px"}}>
                <h4 style={{color: "#FAFAFA", marginBottom: "15px"}}>
                    📝 Manage Signatures
                </h4>

                <div
                    style={{
                        padding: "20px",
                        backgroundColor: "#121C24",
                        borderRadius: "8px",
                        border: "1px solid white",
                        marginBottom: "15px",
                    }}
                >
                    <div style={{textAlign: "center", marginBottom: "15px"}}>
                        <p style={{color: "#B0B0B0", margin: 0}}>
                            Upload your signature or initial image
                        </p>
                        <p
                            style={{
                                color: "#8B8B8B",
                                fontSize: "0.8rem",
                                margin: "5px 0 0 0",
                            }}
                        >
                            Supported formats: PNG, JPG, GIF (Max 5MB) • Stored securely on
                            server • Maximum {MAX_SIGNATURES} signatures allowed
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
                                    ? `Max ${MAX_SIGNATURES} signatures reached`
                                    : "📤 Upload New Signature"}
                        </button>
                    </div>
                </div>

                {/* Signature Library */}
                {signatures.length > 0 && (
                    <div>
                        <h4 style={{color: "#FAFAFA", marginBottom: "15px"}}>
                            📚 Signature Library
                        </h4>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                                gap: "15px",
                            }}
                        >
                            {signatures.map((sig) => (
                                <div
                                    key={sig.id}
                                    style={{
                                        padding: "15px",
                                        backgroundColor:
                                            selectedSignature === getSignatureDataUrl(sig)
                                                ? "#3A4F6A"
                                                : "#121C24",
                                        borderRadius: "8px",
                                        border:
                                            selectedSignature === getSignatureDataUrl(sig)
                                                ? "2px solid #7B68EE"
                                                : "1px solid white",
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                    }}
                                    onClick={() => setSelectedSignature(getSignatureDataUrl(sig))}
                                >
                                    <div
                                        style={{
                                            backgroundColor: "#FAFAFA",
                                            padding: "10px",
                                            borderRadius: "4px",
                                            marginBottom: "10px",
                                            textAlign: "center",
                                            minHeight: "80px",
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
                                                maxHeight: "60px",
                                                objectFit: "contain",
                                            }}
                                            onError={(e) => {
                                                console.error("Failed to load signature image:", getSignatureDataUrl(sig));
                                                (e.target as HTMLImageElement).style.display = "none";
                                                const parent = (e.target as HTMLImageElement)
                                                    .parentElement;
                                                if (parent) {
                                                    parent.innerHTML =
                                                        '<div style="color: #666; font-style: italic;">Failed to load signature image</div>';
                                                }
                                            }}
                                            onLoad={() => {
                                            }}
                                        />
                                    </div>
                                    <div
                                        style={{
                                            color: "#FAFAFA",
                                            fontSize: "0.9rem",
                                            marginBottom: "5px",
                                        }}
                                    >
                                        {sig.name}
                                    </div>
                                    <div
                                        style={{
                                            color: "#B0B0B0",
                                            fontSize: "0.8rem",
                                            marginBottom: "10px",
                                        }}
                                    >
                                        Created: {new Date(sig.created_at).toLocaleDateString()}
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                        }}
                                    >
                    <span
                        style={{
                            color: "#B0B0B0",
                            fontSize: "0.75rem",
                        }}
                    >
                      ID: {sig.id}
                    </span>
                                        <button
                                            className={styles.deleteBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteSignature(sig.id, sig);
                                            }}
                                            disabled={deletingSignature === sig.id}
                                            style={{padding: "4px 8px", fontSize: "0.75rem"}}
                                        >
                                            {deletingSignature === sig.id
                                                ? "⏳ Deleting..."
                                                : "🗑️ Delete"}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
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

            {/* Signature Positioning - Only show when both invoice and signature are selected */}
            {selectedInvoice && selectedSignature && (
                <div className={styles.invoiceForm} style={{marginBottom: "20px"}}>
                    <h4 style={{color: "#FAFAFA", marginBottom: "15px"}}>
                        🎯 Position Signature
                    </h4>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>
                                Horizontal Position (%)
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={signaturePosition.x}
                                onChange={(e) =>
                                    setSignaturePosition((prev) => ({
                                        ...prev,
                                        x: parseInt(e.target.value),
                                    }))
                                }
                                className={styles.formInput}
                            />
                            <span style={{color: "#B0B0B0", fontSize: "0.8rem"}}>
                {signaturePosition.x}% from left edge
              </span>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Vertical Position (%)</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={signaturePosition.y}
                                onChange={(e) =>
                                    setSignaturePosition((prev) => ({
                                        ...prev,
                                        y: parseInt(e.target.value),
                                    }))
                                }
                                className={styles.formInput}
                            />
                            <span style={{color: "#B0B0B0", fontSize: "0.8rem"}}>
                {signaturePosition.y}% from top edge
              </span>
                        </div>
                    </div>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Signature Width (px)</label>
                            <input
                                type="number"
                                min="50"
                                max="300"
                                value={signatureSize.width}
                                onChange={(e) =>
                                    setSignatureSize((prev) => ({
                                        ...prev,
                                        width: parseInt(e.target.value) || 150,
                                    }))
                                }
                                className={styles.formInput}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Signature Height (px)</label>
                            <input
                                type="number"
                                min="30"
                                max="150"
                                value={signatureSize.height}
                                onChange={(e) =>
                                    setSignatureSize((prev) => ({
                                        ...prev,
                                        height: parseInt(e.target.value) || 60,
                                    }))
                                }
                                className={styles.formInput}
                            />
                        </div>
                    </div>

                    {/* PDF Preview Section */}
                    <div
                        style={{
                            marginTop: "20px",
                            padding: "20px",
                            backgroundColor: "#121C24",
                            borderRadius: "8px",
                            border: "1px solid white",
                        }}
                    >
                        <h5 style={{color: "#FAFAFA", marginBottom: "15px"}}>
                            👁️ Signature Placement Preview
                        </h5>

                        {/* Preview Controls */}
                        <div
                            style={{
                                marginBottom: "15px",
                                display: "flex",
                                justifyContent: "center",
                                gap: "10px",
                                flexWrap: "wrap",
                            }}
                        >
                            <button
                                className={styles.secondaryBtn}
                                onClick={handlePreviewSignedInvoice}
                                disabled={loading}
                                style={{minWidth: "150px"}}
                            >
                                {loading ? "⏳ Generating..." : "🔄 Generate Preview"}
                            </button>
                            {previewUrl && (
                                <button
                                    className={styles.secondaryBtn}
                                    onClick={() => {
                                        if (previewUrl) {
                                            URL.revokeObjectURL(previewUrl);
                                            setPreviewUrl(null);
                                        }
                                    }}
                                    style={{minWidth: "120px"}}
                                >
                                    🗑️ Clear Preview
                                </button>
                            )}
                        </div>

                        {/* PDF Preview */}
                        {previewUrl ? (
                            <div
                                style={{
                                    backgroundColor: "#1E1E2E",
                                    padding: "15px",
                                    borderRadius: "8px",
                                    border: "1px solid #5B5B7B",
                                }}
                            >
                                <iframe
                                    src={previewUrl}
                                    width="100%"
                                    height="800px"
                                    style={{
                                        border: "1px solid #5B5B7B",
                                        borderRadius: "4px",
                                        backgroundColor: "white",
                                    }}
                                    title="Signed Invoice PDF Preview"
                                />

                                <div
                                    style={{
                                        marginTop: "15px",
                                        padding: "10px",
                                        backgroundColor: "rgba(123, 104, 238, 0.1)",
                                        borderRadius: "4px",
                                        color: "#B0B0B0",
                                        fontSize: "0.9rem",
                                        textAlign: "center",
                                    }}
                                >
                                    💡 This is your signed PDF preview in A4 format. Use browser
                                    zoom controls to adjust view size. Adjust signature position
                                    using the sliders above, then regenerate preview to see
                                    changes.
                                </div>
                            </div>
                        ) : (
                            <div
                                style={{
                                    textAlign: "center",
                                    padding: "40px",
                                    color: "#B0B0B0",
                                    backgroundColor: "#1E1E2E",
                                    borderRadius: "8px",
                                    border: "1px solid #5B5B7B",
                                }}
                            >
                                <div style={{fontSize: "3rem", marginBottom: "15px"}}>📄</div>
                                <h3 style={{marginBottom: "10px", color: "#FAFAFA"}}>
                                    No PDF Preview Generated
                                </h3>
                                <p>
                                    Click "Generate Preview" to create and display your signed
                                    invoice PDF here.
                                </p>
                                <p
                                    style={{
                                        fontSize: "0.85rem",
                                        color: "#8B8B8B",
                                        marginTop: "10px",
                                    }}
                                >
                                    The preview will show the exact A4 PDF format with your
                                    signature placement.
                                </p>
                            </div>
                        )}
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

            {/* Instructions */}
            <div
                style={{
                    marginTop: "30px",
                    padding: "25px",
                    backgroundColor: "#121C24",
                    borderRadius: "10px",
                    border: "1px solid white",
                }}
            >
                <h4 style={{color: "#FAFAFA", marginBottom: "15px"}}>
                    📚 How to Use the Invoice Signature Tool:
                </h4>
                <ol
                    style={{
                        color: "#B0B0B0",
                        fontSize: "0.9rem",
                        lineHeight: "1.8",
                        paddingLeft: "20px",
                    }}
                >
                    <li>
                        <strong>Upload Signatures:</strong> Click "Upload New Signature" to
                        add signature images (PNG/JPG recommended) - Maximum{" "}
                        {MAX_SIGNATURES} signatures allowed
                    </li>
                    <li>
                        <strong>Select Signature:</strong> Choose from your signature
                        library by clicking on the desired signature
                    </li>
                    <li>
                        <strong>Choose Invoice:</strong> Select the invoice you want to sign
                        from the dropdown
                    </li>
                    <li>
                        <strong>Position Signature:</strong> Use the sliders to adjust
                        signature placement and size
                    </li>
                    <li>
                        <strong>Generate Preview:</strong> Click "Generate Preview" to see
                        the exact A4 PDF with your signature
                    </li>
                    <li>
                        <strong>Adjust & Re-preview:</strong> Change position/size and
                        regenerate preview as needed
                    </li>
                    <li>
                        <strong>Sign & Download:</strong> Click to generate and download the
                        final signed PDF
                    </li>
                    <li>
                        <strong>Delete Signatures:</strong> Remove signatures you no longer
                        need by clicking the delete button
                    </li>
                </ol>

                <div
                    style={{
                        marginTop: "20px",
                        padding: "15px",
                        backgroundColor: "rgba(123, 104, 238, 0.1)",
                        borderRadius: "6px",
                        border: "1px solid rgba(123, 104, 238, 0.3)",
                    }}
                >
                    <h5
                        style={{
                            color: "#7B68EE",
                            marginBottom: "10px",
                            fontSize: "0.9rem",
                        }}
                    >
                        💡 Important Notes:
                    </h5>
                    <ul
                        style={{
                            color: "#B0B0B0",
                            fontSize: "0.8rem",
                            lineHeight: "1.6",
                            paddingLeft: "20px",
                            margin: 0,
                        }}
                    >
                        <li>
                            Signatures are stored securely on the server and synced across
                            your devices
                        </li>
                        <li>
                            Maximum {MAX_SIGNATURES} signatures allowed per account - delete
                            unused ones to add new signatures
                        </li>
                        <li>
                            Preview displays the exact A4 PDF format (210 × 297 mm) as used in
                            Invoice Creation
                        </li>
                        <li>
                            Generated PDFs are identical to Invoice Creation tab with added
                            signature
                        </li>
                        <li>
                            Backend processing ensures consistent signature placement and
                            quality
                        </li>
                        <li>Use browser zoom controls to adjust preview display size</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default InvoiceSigner;
