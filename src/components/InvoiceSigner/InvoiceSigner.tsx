import {useState, useEffect, useRef} from "react";
import {
    fetchAllInvoices,
    fetchUserSignatures,
    uploadSignature,
    deleteSignature,
    signInvoicePDF,
} from "../../services/freelanceService";
import {SignatureData, InvoiceData, Signature} from "../../utils/interfaces";
import {useMessage} from "../../contexts/MessageContext";
import styles from "../../pages/Freelance/Freelance.module.scss";
import {jsPDF} from "jspdf";

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
            const fetchedSignatures = await fetchUserSignatures(true);
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

    const generateSignedPDF = async (
        invoiceData: InvoiceData,
        signatureData: SignatureData
    ): Promise<Blob> => {
        // Create a new jsPDF instance with same settings as the original
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
        });

        // Recreate the PDF content exactly as in generateInvoicePDFLocal but with signature
        await recreateInvoicePDFWithSignature(doc, invoiceData, signatureData);

        return Promise.resolve(doc.output("blob"));
    };

    const recreateInvoicePDFWithSignature = async (
        doc: any,
        invoiceData: InvoiceData,
        signatureData: SignatureData
    ) => {
        // This recreates the exact same PDF as generateInvoicePDFLocal but adds signature

        // Set up colors (same as in generateInvoicePDFLocal)
        const primaryColor = [123, 104, 238]; // #7B68EE
        const textColor = [51, 51, 51]; // #333
        const grayColor = [102, 102, 102]; // #666

        // Currency symbols
        const currencySymbols: Record<string, string> = {
            USD: "$",
            INR: "₹",
            GBP: "£",
            EUR: "€",
            AUD: "A$",
        };
        const currencySymbol = currencySymbols[invoiceData.currency] || "$";

        // Page dimensions
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        let yPosition = margin;

        // Helper function to add text with automatic line breaks
        const addText = (text: string, x: number, y: number, maxWidth?: number) => {
            if (maxWidth) {
                const lines = doc.splitTextToSize(text, maxWidth);
                doc.text(lines, x, y);
                return y + lines.length * 5; // 5mm line height
            } else {
                doc.text(text, x, y);
                return y + 7; // Single line height
            }
        };

        // Header - Invoice Title
        doc.setFontSize(28);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("INVOICE", pageWidth / 2, yPosition, {align: "center"});

        yPosition += 12;
        doc.setFontSize(16);
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        doc.text(`#${invoiceData.invoiceNumber}`, pageWidth / 2, yPosition, {
            align: "center",
        });

        yPosition += 8;
        if (invoiceData.projectName) {
            doc.setFontSize(12);
            doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
            doc.text(
                `Project: ${invoiceData.projectName}`,
                pageWidth / 2,
                yPosition,
                {align: "center"}
            );
            yPosition += 8;
        }

        yPosition += 12;

        // Dates section
        doc.setFontSize(10);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(
            `Issue Date: ${new Date(invoiceData.issueDate).toLocaleDateString()}`,
            margin,
            yPosition
        );
        doc.text(
            `Due Date: ${new Date(invoiceData.dueDate).toLocaleDateString()}`,
            margin,
            yPosition + 5
        );

        yPosition += 20;

        // From and To sections
        const leftColWidth = (pageWidth - 3 * margin) / 2;
        const rightColStart = margin + leftColWidth + margin;

        // From section
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("From:", margin, yPosition);

        doc.setFontSize(10);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        let fromY = yPosition + 7;
        doc.setFont("helvetica", "bold");
        fromY = addText(invoiceData.from.name, margin, fromY, leftColWidth);
        doc.setFont("helvetica", "normal");
        fromY = addText(invoiceData.from.email, margin, fromY, leftColWidth);
        fromY = addText(invoiceData.from.address, margin, fromY, leftColWidth);
        if (invoiceData.from.phone) {
            fromY = addText(invoiceData.from.phone, margin, fromY, leftColWidth);
        }

        // To section
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("To:", rightColStart, yPosition);

        doc.setFontSize(10);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        let toY = yPosition + 7;
        doc.setFont("helvetica", "bold");
        toY = addText(invoiceData.to.name, rightColStart, toY, leftColWidth);
        doc.setFont("helvetica", "normal");
        if (invoiceData.to.company) {
            doc.setFont("helvetica", "italic");
            toY = addText(invoiceData.to.company, rightColStart, toY, leftColWidth);
            doc.setFont("helvetica", "normal");
        }
        toY = addText(invoiceData.to.email, rightColStart, toY, leftColWidth);
        toY = addText(invoiceData.to.address, rightColStart, toY, leftColWidth);

        yPosition = Math.max(fromY, toY) + 15;

        // Custom Fields section (only non-hidden fields)
        const visibleCustomFields =
            invoiceData.customFields?.filter((field) => !field.hidden) || [];
        if (visibleCustomFields.length > 0) {
            doc.setFontSize(12);
            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.text("Additional Information:", margin, yPosition);

            yPosition += 8;
            doc.setFontSize(10);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);

            // Create a grid layout for custom fields
            const fieldsPerRow = 2;
            const fieldWidth = (pageWidth - 3 * margin) / fieldsPerRow;

            visibleCustomFields.forEach((field, index) => {
                const row = Math.floor(index / fieldsPerRow);
                const col = index % fieldsPerRow;
                const fieldX = margin + col * (fieldWidth + margin);
                const fieldY = yPosition + row * 12;

                doc.setFont("helvetica", "bold");
                doc.text(`${field.key}:`, fieldX, fieldY);
                doc.setFont("helvetica", "normal");
                doc.text(field.value || "-", fieldX, fieldY + 4, {
                    maxWidth: fieldWidth - 10,
                });
            });

            yPosition +=
                Math.ceil(visibleCustomFields.length / fieldsPerRow) * 12 + 10;
        }

        // Items table
        const tableStartY = yPosition;
        const colWidths = [70, 25, 35, 35]; // Description, Qty, Rate, Amount
        const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
        const tableStartX = margin;

        // Table header
        doc.setFillColor(245, 245, 245);
        doc.rect(tableStartX, yPosition, tableWidth, 8, "F");

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);

        let xPos = tableStartX + 2;
        doc.text("Description", xPos, yPosition + 5.5);
        xPos += colWidths[0];
        doc.text("Qty", xPos, yPosition + 5.5, {align: "right"});
        xPos += colWidths[1] - 2;
        doc.text("Rate", xPos, yPosition + 5.5, {align: "right"});
        xPos += colWidths[2] - 2;
        doc.text("Amount", xPos, yPosition + 5.5, {align: "right"});

        yPosition += 8;

        // Table rows
        doc.setFont("helvetica", "normal");
        invoiceData.items.forEach((item, index) => {
            const rowHeight = 8;

            // Alternate row background
            if (index % 2 === 1) {
                doc.setFillColor(250, 250, 250);
                doc.rect(tableStartX, yPosition, tableWidth, rowHeight, "F");
            }

            xPos = tableStartX + 2;
            doc.text(item.description, xPos, yPosition + 5.5, {
                maxWidth: colWidths[0] - 4,
            });
            xPos += colWidths[0];
            doc.text(item.quantity.toString(), xPos - 2, yPosition + 5.5, {
                align: "right",
            });
            xPos += colWidths[1];
            doc.text(
                `${currencySymbol}${item.rate.toFixed(2)}`,
                xPos - 2,
                yPosition + 5.5,
                {align: "right"}
            );
            xPos += colWidths[2];
            doc.text(
                `${currencySymbol}${item.amount.toFixed(2)}`,
                xPos - 2,
                yPosition + 5.5,
                {align: "right"}
            );

            yPosition += rowHeight;
        });

        // Table border
        doc.setDrawColor(221, 221, 221);
        doc.rect(tableStartX, tableStartY, tableWidth, yPosition - tableStartY);

        // Vertical lines for table
        let currentX = tableStartX;
        for (let i = 0; i < colWidths.length - 1; i++) {
            currentX += colWidths[i];
            doc.line(currentX, tableStartY, currentX, yPosition);
        }

        yPosition += 15;

        // Totals section
        const totalsX = pageWidth - margin - 60;

        doc.setFontSize(10);
        doc.text(`Subtotal:`, totalsX, yPosition);
        doc.text(
            `${currencySymbol}${invoiceData.subtotal.toFixed(2)}`,
            pageWidth - margin,
            yPosition,
            {align: "right"}
        );

        if (invoiceData.tax && invoiceData.tax.rate > 0) {
            yPosition += 6;
            doc.text(`Tax (${invoiceData.tax.rate}%):`, totalsX, yPosition);
            doc.text(
                `${currencySymbol}${invoiceData.tax.amount.toFixed(2)}`,
                pageWidth - margin,
                yPosition,
                {align: "right"}
            );
        }

        yPosition += 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

        // Total line
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setLineWidth(0.5);
        doc.line(totalsX, yPosition - 2, pageWidth - margin, yPosition - 2);

        doc.text(`Total:`, totalsX, yPosition + 3);
        doc.text(
            `${currencySymbol}${invoiceData.total.toFixed(2)}`,
            pageWidth - margin,
            yPosition + 3,
            {align: "right"}
        );

        yPosition += 20;

        // Add signature BEFORE notes and terms
        await addSignatureToInvoicePDF(doc, signatureData, pageWidth, pageHeight);

        // Notes and Terms
        if (invoiceData.notes || invoiceData.terms) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);

            if (invoiceData.notes) {
                doc.setFont("helvetica", "bold");
                doc.text("Notes:", margin, yPosition);
                doc.setFont("helvetica", "normal");
                yPosition = addText(
                    invoiceData.notes,
                    margin,
                    yPosition + 6,
                    pageWidth - 2 * margin
                );
                yPosition += 5;
            }

            if (invoiceData.terms) {
                doc.setFont("helvetica", "bold");
                doc.text("Terms & Conditions:", margin, yPosition);
                doc.setFont("helvetica", "normal");
                yPosition = addText(
                    invoiceData.terms,
                    margin,
                    yPosition + 6,
                    pageWidth - 2 * margin
                );
            }
        }

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        const footerY = pageHeight - 15;
        doc.setDrawColor(238, 238, 238);
        doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
        doc.text(
            `Invoice generated on ${new Date().toLocaleDateString()} • Thank you for your business!`,
            pageWidth / 2,
            footerY,
            {align: "center"}
        );
    };

    const addSignatureToInvoicePDF = async (
        doc: any,
        signatureData: SignatureData,
        pageWidth: number,
        pageHeight: number
    ) => {
        try {
            // Convert signature position from percentage to actual mm coordinates
            const sigX = (signatureData.x / 100) * pageWidth;
            const sigY = (signatureData.y / 100) * pageHeight;

            // Convert signature size from pixels to mm (roughly 1px = 0.264mm)
            const sigWidth = signatureData.width * 0.264;
            const sigHeight = signatureData.height * 0.264;

            // Add signature image to PDF
            doc.addImage(
                signatureData.signatureUrl,
                "PNG",
                sigX - sigWidth / 2, // Center horizontally
                sigY - sigHeight / 2, // Center vertically
                sigWidth,
                sigHeight
            );
        } catch (error) {
            console.error("Error adding signature to PDF:", error);
            // Continue without signature if there's an error
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

            // Use backend API to sign invoice
            const signedPdfBlob = await signInvoicePDF(
                selectedInvoice,
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

            // Generate preview PDF with signature using backend API
            let previewPdfBlob: Blob;
            try {
                previewPdfBlob = await signInvoicePDF(selectedInvoice, signatureData);
            } catch (backendError) {
                // Fallback to local generation if backend fails
                console.warn(
                    "Backend signing failed, using local generation:",
                    backendError
                );
                previewPdfBlob = await generateSignedPDF(invoice, signatureData);
            }

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
                        backgroundColor: "#29384D",
                        borderRadius: "8px",
                        border: "1px solid #5B5B7B",
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
                                                : "#29384D",
                                        borderRadius: "8px",
                                        border:
                                            selectedSignature === getSignatureDataUrl(sig)
                                                ? "2px solid #7B68EE"
                                                : "1px solid #5B5B7B",
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
                            backgroundColor: "#29384D",
                            borderRadius: "8px",
                            border: "1px solid #5B5B7B",
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
                            backgroundColor: "#29384D",
                            borderRadius: "8px",
                            border: "1px solid #5B5B7B",
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
                    backgroundColor: "#29384D",
                    borderRadius: "10px",
                    border: "1px solid #5B5B7B",
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
