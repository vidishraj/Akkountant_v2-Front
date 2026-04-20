import {useState, useEffect, useRef, useCallback} from "react";
import {PDFDocument, rgb, StandardFonts} from "pdf-lib";
import {fetchUserSignatures, uploadSignature, deleteSignature, setDefaultSignature} from "../../services/freelanceService";
import {Signature} from "../../utils/interfaces";
import {useMessage} from "../../contexts/MessageContext";
import styles from "../../pages/Freelance/Freelance.module.scss";
import ownStyles from "../InvoiceSigner/InvoiceSigner.module.scss";
import SignaturePlacer, {TextBox} from "../InvoiceSigner/SignaturePlacer";

const DocumentSigner = () => {
    const [signatures, setSignatures] = useState<Signature[]>([]);
    const [selectedSignature, setSelectedSignature] = useState<string>("");
    const [signaturePosition, setSignaturePosition] = useState({x: 20, y: 250, width: 50, height: 20});
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [deletingSignature, setDeletingSignature] = useState<string | null>(null);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
    const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
    const [pageCount, setPageCount] = useState(1);
    const [targetPage, setTargetPage] = useState(0);
    const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
    const sigFileInputRef = useRef<HTMLInputElement>(null);
    const pdfFileInputRef = useRef<HTMLInputElement>(null);
    const {setPayload} = useMessage();

    const addTextBox = () => {
        const id = `tb_${Date.now()}`;
        setTextBoxes(prev => [...prev, {id, text: "", x: 20, y: 200, fontSize: 10}]);
    };

    const updateTextBox = (id: string, updates: Partial<TextBox>) => {
        setTextBoxes(prev => prev.map(b => b.id === id ? {...b, ...updates} : b));
    };

    const removeTextBox = (id: string) => {
        setTextBoxes(prev => prev.filter(b => b.id !== id));
    };

    const MAX_SIGNATURES = 3;

    const getSignatureDataUrl = (signature: Signature): string => {
        if (signature.signature_data.startsWith('data:')) return signature.signature_data;
        // Detect JPEG by base64 magic bytes (/9j/ = FFD8FF)
        const isJpeg = signature.signature_data.startsWith('/9j/');
        const mime = isJpeg ? 'image/jpeg' : 'image/png';
        return `data:${mime};base64,${signature.signature_data}`;
    };

    useEffect(() => {
        loadSignatures();
    }, []);

    useEffect(() => {
        return () => {
            if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
        };
    }, [pdfBlobUrl]);

    const loadSignatures = async () => {
        try {
            const fetched = await fetchUserSignatures();
            setSignatures(fetched);
            if (fetched.length > 0 && !selectedSignature) {
                const defaultSig = fetched.find(s => s.is_default);
                setSelectedSignature(getSignatureDataUrl(defaultSig || fetched[0]));
            }
        } catch {
            setPayload({type: "error", message: "Failed to load signatures"});
        }
    };

    const handleSigUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (signatures.length >= MAX_SIGNATURES) {
            setPayload({type: "error", message: `Max ${MAX_SIGNATURES} signatures. Delete one first.`});
            return;
        }
        if (!file.type.startsWith("image/")) {
            setPayload({type: "error", message: "Upload an image file (PNG, JPG, etc.)"});
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setPayload({type: "error", message: "File size must be less than 5MB"});
            return;
        }
        try {
            setUploading(true);
            const resp = await uploadSignature(file);
            await loadSignatures();
            setSelectedSignature(getSignatureDataUrl(resp));
            setPayload({type: "success", message: "Signature uploaded!"});
        } catch {
            setPayload({type: "error", message: "Failed to upload signature"});
        } finally {
            setUploading(false);
            if (sigFileInputRef.current) sigFileInputRef.current.value = "";
        }
    };

    const handleDeleteSig = async (id: string, sig: Signature) => {
        if (!window.confirm("Delete this signature?")) return;
        try {
            setDeletingSignature(id);
            await deleteSignature(id);
            await loadSignatures();
            if (selectedSignature === getSignatureDataUrl(sig)) {
                const remaining = signatures.filter(s => s.id !== id);
                setSelectedSignature(remaining.length > 0 ? getSignatureDataUrl(remaining[0]) : "");
            }
            setPayload({type: "success", message: "Signature deleted"});
        } catch {
            setPayload({type: "error", message: "Failed to delete signature"});
        } finally {
            setDeletingSignature(null);
        }
    };

    const handleSetDefault = async (id: string) => {
        try {
            await setDefaultSignature(id);
            await loadSignatures();
            setPayload({type: "success", message: "Default signature updated"});
        } catch {
            setPayload({type: "error", message: "Failed to set default"});
        }
    };

    const handlePdfUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.type !== "application/pdf") {
            setPayload({type: "error", message: "Please upload a PDF file"});
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            setPayload({type: "error", message: "File size must be less than 50MB"});
            return;
        }
        try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            const pdfDoc = await PDFDocument.load(bytes);
            const pages = pdfDoc.getPageCount();

            if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
            const url = URL.createObjectURL(file);

            setPdfFile(file);
            setPdfBytes(bytes);
            setPdfBlobUrl(url);
            setPageCount(pages);
            setTargetPage(pages - 1); // Default to last page
            setPayload({type: "success", message: `PDF loaded: ${pages} page${pages > 1 ? 's' : ''}`});
        } catch {
            setPayload({type: "error", message: "Failed to read PDF file"});
        }
    }, [pdfBlobUrl, setPayload]);

    const handleSignAndDownload = async () => {
        if (!pdfBytes || !selectedSignature) {
            setPayload({type: "error", message: "Select a PDF and a signature"});
            return;
        }
        try {
            setLoading(true);

            // Load the PDF
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const pages = pdfDoc.getPages();
            const page = pages[targetPage] || pages[pages.length - 1];
            const {height: pageHeight} = page.getSize();

            // Convert mm position to PDF points (1mm = 2.8346pt)
            const mmToPt = 2.8346;
            const sigX = signaturePosition.x * mmToPt;
            // PDF y-axis is bottom-up, our position is top-down
            const sigY = pageHeight - (signaturePosition.y * mmToPt) - (signaturePosition.height * mmToPt);
            const sigW = signaturePosition.width * mmToPt;
            const sigH = signaturePosition.height * mmToPt;

            // Embed signature image
            const sigDataUrl = selectedSignature;
            const base64 = sigDataUrl.split(',')[1];
            const sigBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            const isPng = sigDataUrl.includes('image/png');
            const sigImage = isPng
                ? await pdfDoc.embedPng(sigBytes)
                : await pdfDoc.embedJpg(sigBytes);

            page.drawImage(sigImage, {
                x: sigX,
                y: sigY,
                width: sigW,
                height: sigH,
            });

            // Embed text boxes on the same page
            if (textBoxes.length > 0) {
                const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                for (const box of textBoxes) {
                    if (!box.text.trim()) continue;
                    const txX = box.x * mmToPt;
                    const txY = pageHeight - (box.y * mmToPt) - (box.fontSize);
                    page.drawText(box.text, {
                        x: txX,
                        y: txY,
                        size: box.fontSize,
                        font,
                        color: rgb(0, 0, 0),
                    });
                }
            }

            // Save and download
            const signedBytes = await pdfDoc.save();
            const blob = new Blob([signedBytes], {type: 'application/pdf'});
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `signed-${pdfFile?.name || 'document.pdf'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setPayload({type: "success", message: "Document signed and downloaded!"});
        } catch (err) {
            console.error("Signing error:", err);
            setPayload({type: "error", message: "Failed to sign document"});
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            {/* Signature Management */}
            <div className={styles.invoiceForm} style={{marginBottom: "20px"}}>
                <h4 style={{color: "#FAFAFA", marginBottom: "15px"}}>
                    Manage Signatures
                    <span style={{color: "#B0B0B0", fontSize: "0.8rem", marginLeft: "10px"}}>
                        ({signatures.length}/{MAX_SIGNATURES} used)
                    </span>
                </h4>
                <div className={ownStyles.signatureManagementGrid}>
                    <div>
                        <h5 style={{color: "#FAFAFA", marginBottom: "15px"}}>Upload Signature</h5>
                        <div style={{textAlign: "center", marginBottom: "15px"}}>
                            <p style={{color: "#B0B0B0", margin: 0, fontSize: "0.9rem"}}>Upload your signature image</p>
                            <p style={{color: "#8B8B8B", fontSize: "0.8rem", margin: "5px 0 0 0"}}>PNG, JPG (Max 5MB)</p>
                        </div>
                        <input ref={sigFileInputRef} type="file" accept="image/*" onChange={handleSigUpload} style={{display: "none"}} />
                        <div style={{textAlign: "center"}}>
                            <button
                                className={styles.primaryBtn}
                                onClick={() => sigFileInputRef.current?.click()}
                                disabled={uploading || signatures.length >= MAX_SIGNATURES}
                                style={{opacity: uploading || signatures.length >= MAX_SIGNATURES ? 0.6 : 1}}
                            >
                                {uploading ? "Uploading..." : "Upload Signature"}
                            </button>
                        </div>
                    </div>
                    <div>
                        <h5 style={{color: "#FAFAFA", marginBottom: "15px"}}>Signature Library</h5>
                        {signatures.length > 0 ? (
                            <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px", maxHeight: "400px", overflowY: "auto"}}>
                                {signatures.map((sig) => (
                                    <div
                                        key={sig.id}
                                        style={{
                                            padding: "10px",
                                            backgroundColor: selectedSignature === getSignatureDataUrl(sig) ? "#3A4F6A" : "#1E1E2E",
                                            borderRadius: "8px",
                                            border: selectedSignature === getSignatureDataUrl(sig) ? "2px solid #7B68EE" : "1px solid #333",
                                            cursor: "pointer",
                                        }}
                                        onClick={() => setSelectedSignature(getSignatureDataUrl(sig))}
                                    >
                                        <div style={{backgroundColor: "#FAFAFA", padding: "8px", borderRadius: "4px", marginBottom: "8px", textAlign: "center", minHeight: "60px", display: "flex", alignItems: "center", justifyContent: "center"}}>
                                            <img src={getSignatureDataUrl(sig)} alt="Signature" style={{maxWidth: "100%", maxHeight: "50px", objectFit: "contain"}} />
                                        </div>
                                        <div style={{display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "6px"}}>
                                            <span style={{color: "#FAFAFA", fontSize: "0.8rem"}}>{sig.name}</span>
                                            {sig.is_default && <span className={styles.defaultBadge}>Default</span>}
                                        </div>
                                        <div style={{display: "flex", justifyContent: "center", gap: "4px"}}>
                                            {!sig.is_default && (
                                                <button className={styles.secondaryBtn} onClick={(e) => { e.stopPropagation(); handleSetDefault(sig.id); }} style={{padding: "2px 8px", fontSize: "0.7rem"}}>
                                                    Set Default
                                                </button>
                                            )}
                                            <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); handleDeleteSig(sig.id, sig); }} disabled={deletingSignature === sig.id} style={{padding: "2px 6px", fontSize: "0.7rem"}}>
                                                {deletingSignature === sig.id ? "..." : "Delete"}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{textAlign: "center", padding: "30px", color: "#B0B0B0", backgroundColor: "#1E1E2E", borderRadius: "8px", border: "1px dashed #333"}}>
                                <p style={{margin: 0}}>No signatures uploaded yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* PDF Upload */}
            <div className={styles.invoiceForm} style={{marginBottom: "20px"}}>
                <h4 style={{color: "#FAFAFA", marginBottom: "15px"}}>Upload Document</h4>
                <input ref={pdfFileInputRef} type="file" accept=".pdf" onChange={handlePdfUpload} style={{display: "none"}} />
                <div style={{display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap"}}>
                    <button className={styles.primaryBtn} onClick={() => pdfFileInputRef.current?.click()}>
                        Choose PDF
                    </button>
                    {pdfFile && (
                        <span style={{color: "#B0B0B0", fontSize: "0.9rem"}}>
                            {pdfFile.name} ({pageCount} page{pageCount > 1 ? 's' : ''}, {(pdfFile.size / 1024 / 1024).toFixed(1)}MB)
                        </span>
                    )}
                </div>
                {pageCount > 1 && pdfFile && (
                    <div className={styles.formGroup} style={{marginTop: "15px", maxWidth: "300px"}}>
                        <label className={styles.formLabel}>Place signature on page:</label>
                        <select className={styles.formInput} value={targetPage} onChange={(e) => setTargetPage(Number(e.target.value))}>
                            {Array.from({length: pageCount}, (_, i) => (
                                <option key={i} value={i}>Page {i + 1}{i === pageCount - 1 ? ' (last)' : ''}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Signature & Text Placement */}
            {pdfBlobUrl && selectedSignature && (
                <div className={styles.invoiceForm} style={{marginBottom: "20px"}}>
                    <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "8px"}}>
                        <h4 style={{color: "#FAFAFA", margin: 0}}>Place Signature & Text</h4>
                        <button className={styles.secondaryBtn} onClick={addTextBox} style={{padding: "5px 12px", fontSize: "0.8rem"}}>
                            + Add Text
                        </button>
                    </div>

                    {textBoxes.length > 0 && (
                        <div style={{display: "flex", flexDirection: "column", gap: "8px", marginBottom: "15px"}}>
                            {textBoxes.map((box) => (
                                <div key={box.id} style={{display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap"}}>
                                    <input
                                        className={styles.formInput}
                                        value={box.text}
                                        onChange={(e) => updateTextBox(box.id, {text: e.target.value})}
                                        placeholder="Enter text (e.g. date, address)"
                                        style={{flex: 1, minWidth: "150px"}}
                                    />
                                    <select
                                        className={styles.formInput}
                                        value={box.fontSize}
                                        onChange={(e) => updateTextBox(box.id, {fontSize: Number(e.target.value)})}
                                        style={{width: "70px"}}
                                    >
                                        {[7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24].map(s => (
                                            <option key={s} value={s}>{s}pt</option>
                                        ))}
                                    </select>
                                    <button
                                        className={styles.dangerBtn}
                                        onClick={() => removeTextBox(box.id)}
                                        style={{padding: "4px 8px", fontSize: "0.8rem"}}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <SignaturePlacer
                        pdfBlobUrl={pdfBlobUrl}
                        signatureUrl={selectedSignature}
                        onPositionChange={(pos) => setSignaturePosition(pos)}
                        initialPosition={signaturePosition}
                        currentPage={targetPage}
                        textBoxes={textBoxes}
                        onTextBoxChange={updateTextBox}
                    />
                </div>
            )}

            {/* Action Button */}
            {pdfBlobUrl && selectedSignature && (
                <div className={styles.invoiceForm} style={{marginBottom: "20px"}}>
                    <div style={{display: "flex", justifyContent: "center"}}>
                        <button className={styles.primaryBtn} onClick={handleSignAndDownload} disabled={loading} style={{minWidth: "200px"}}>
                            {loading ? "Signing..." : "Sign & Download"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentSigner;
