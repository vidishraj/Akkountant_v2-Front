import { useState, useRef, useCallback, useEffect } from "react";
import { InvoiceData } from "../../utils/interfaces";
import { generateInvoicePDFLocal } from "../../services/freelanceService";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import placerStyles from "./SignaturePlacer.module.scss";
import styles from "../../pages/Freelance/Freelance.module.scss";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface SignaturePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextBox {
  id: string;
  text: string;
  x: number;       // mm
  y: number;       // mm
  fontSize: number; // pt
}

interface SignaturePlacerProps {
  invoiceData?: InvoiceData | null;
  pdfBlobUrl?: string | null;
  signatureUrl: string;
  onPositionChange: (pos: SignaturePosition) => void;
  initialPosition: SignaturePosition;
  currentPage?: number;
  textBoxes?: TextBox[];
  onTextBoxChange?: (id: string, updates: Partial<TextBox>) => void;
}

const SignaturePlacer = ({
  invoiceData,
  pdfBlobUrl,
  signatureUrl,
  onPositionChange,
  initialPosition,
  currentPage = 0,
  textBoxes = [],
  onTextBoxChange,
}: SignaturePlacerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewImgUrl, setPreviewImgUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [showTooltip, setShowTooltip] = useState(false);
  const [draggingTextBoxId, setDraggingTextBoxId] = useState<string | null>(null);
  const textDragRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });
  // Actual PDF page dimensions in mm (detected from the PDF)
  const [pageDims, setPageDims] = useState({ width: 210, height: 297 });
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const resizeStartRef = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0 });

  // Render a PDF page to a data URL image using pdfjs
  const renderPdfPage = useCallback(async (pdfData: ArrayBuffer | string, pageNum: number) => {
    try {
      const loadingTask = typeof pdfData === "string"
        ? pdfjsLib.getDocument(pdfData)
        : pdfjsLib.getDocument({ data: pdfData });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(Math.min(pageNum, pdf.numPages));
      const viewport = page.getViewport({ scale: 2 }); // 2x for sharpness

      // Store actual page dimensions in mm (PDF points / 72 * 25.4)
      const ptToMm = 25.4 / 72;
      setPageDims({
        width: page.getViewport({ scale: 1 }).width * ptToMm,
        height: page.getViewport({ scale: 1 }).height * ptToMm,
      });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      return canvas.toDataURL("image/png");
    } catch (e) {
      console.error("Failed to render PDF page:", e);
      return null;
    }
  }, []);

  // Generate preview when data changes
  useEffect(() => {
    let cancelled = false;

    const generate = async () => {
      let imgUrl: string | null = null;

      if (pdfBlobUrl) {
        // Document signing: fetch blob and render
        try {
          const resp = await fetch(pdfBlobUrl);
          const buf = await resp.arrayBuffer();
          imgUrl = await renderPdfPage(buf, currentPage + 1);
        } catch (e) {
          console.error("Failed to fetch PDF blob:", e);
        }
      } else if (invoiceData) {
        // Invoice signing: generate PDF then render
        try {
          const blob = await generateInvoicePDFLocal(invoiceData);
          const buf = await blob.arrayBuffer();
          imgUrl = await renderPdfPage(buf, 1);
        } catch (e) {
          console.error("Failed to generate invoice preview:", e);
        }
      }

      if (!cancelled && imgUrl) {
        setPreviewImgUrl(imgUrl);
      }
    };

    generate();
    return () => { cancelled = true; };
  }, [invoiceData, pdfBlobUrl, currentPage, renderPdfPage]);

  // Sync initial position
  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition]);

  const getContainerDimensions = useCallback(() => {
    if (!containerRef.current) return { width: 595, height: 842 };
    const rect = containerRef.current.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, []);

  // Convert mm to container pixels (using actual page dims)
  const mmToPixels = useCallback(
    (mm: number, axis: "x" | "y") => {
      const dims = getContainerDimensions();
      if (axis === "x") return (mm / pageDims.width) * dims.width;
      return (mm / pageDims.height) * dims.height;
    },
    [getContainerDimensions, pageDims]
  );

  // Convert container pixels to mm (using actual page dims)
  const pixelsToMm = useCallback(
    (px: number, axis: "x" | "y") => {
      const dims = getContainerDimensions();
      if (axis === "x") return (px / dims.width) * pageDims.width;
      return (px / dims.height) * pageDims.height;
    },
    [getContainerDimensions, pageDims]
  );

  const clampPosition = useCallback(
    (x: number, y: number, w: number, h: number) => {
      return {
        x: Math.max(2, Math.min(x, pageDims.width - w - 2)),
        y: Math.max(2, Math.min(y, pageDims.height - h - 2)),
        width: Math.max(15, Math.min(w, pageDims.width - 4)),
        height: Math.max(5, Math.min(h, pageDims.height - 4)),
      };
    },
    [pageDims]
  );

  // Drag handlers
  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (isResizing) return;
      e.preventDefault();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      setIsDragging(true);
      setShowTooltip(true);
      dragStartRef.current = {
        mouseX: clientX,
        mouseY: clientY,
        posX: position.x,
        posY: position.y,
      };
    },
    [position, isResizing]
  );

  const handleResizePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      setIsResizing(true);
      setShowTooltip(true);
      resizeStartRef.current = {
        mouseX: clientX,
        mouseY: clientY,
        w: position.width,
        h: position.height,
      };
    },
    [position]
  );

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      if (isDragging) {
        const dx = pixelsToMm(clientX - dragStartRef.current.mouseX, "x");
        const dy = pixelsToMm(clientY - dragStartRef.current.mouseY, "y");
        const newPos = clampPosition(
          dragStartRef.current.posX + dx,
          dragStartRef.current.posY + dy,
          position.width,
          position.height
        );
        setPosition((prev) => ({ ...prev, x: newPos.x, y: newPos.y }));
      }

      if (isResizing) {
        const dx = pixelsToMm(clientX - resizeStartRef.current.mouseX, "x");
        const newW = Math.max(15, resizeStartRef.current.w + dx);
        const aspectRatio = resizeStartRef.current.h / resizeStartRef.current.w;
        const newH = newW * aspectRatio;
        const clamped = clampPosition(position.x, position.y, newW, newH);
        setPosition((prev) => ({
          ...prev,
          width: clamped.width,
          height: clamped.height,
        }));
      }
    };

    const handleEnd = () => {
      if (isDragging || isResizing) {
        setIsDragging(false);
        setIsResizing(false);
        setShowTooltip(false);
        setPosition((current) => {
          onPositionChange(current);
          return current;
        });
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, isResizing, position, pixelsToMm, clampPosition, onPositionChange]);

  // Text box drag handlers
  const handleTextBoxPointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent, boxId: string, box: TextBox) => {
      e.preventDefault();
      e.stopPropagation();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      setDraggingTextBoxId(boxId);
      textDragRef.current = { mouseX: clientX, mouseY: clientY, startX: box.x, startY: box.y };
    },
    []
  );

  useEffect(() => {
    if (!draggingTextBoxId) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const dx = pixelsToMm(clientX - textDragRef.current.mouseX, "x");
      const dy = pixelsToMm(clientY - textDragRef.current.mouseY, "y");
      const newX = Math.max(2, Math.min(textDragRef.current.startX + dx, pageDims.width - 10));
      const newY = Math.max(2, Math.min(textDragRef.current.startY + dy, pageDims.height - 5));
      onTextBoxChange?.(draggingTextBoxId, { x: newX, y: newY });
    };

    const handleEnd = () => setDraggingTextBoxId(null);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [draggingTextBoxId, pixelsToMm, pageDims, onTextBoxChange]);

  const handleReset = () => {
    const defaultPos = { x: 20, y: 250, width: 50, height: 20 };
    setPosition(defaultPos);
    onPositionChange(defaultPos);
  };

  if (!invoiceData && !pdfBlobUrl) {
    return (
      <div className={placerStyles.placerContainer}>
        <div style={{ textAlign: "center", padding: "40px", color: "#B0B0B0" }}>
          {pdfBlobUrl === undefined
            ? "Select an invoice to see the preview"
            : "Upload a PDF to see the preview"}
        </div>
      </div>
    );
  }

  const sigLeft = mmToPixels(position.x, "x");
  const sigTop = mmToPixels(position.y, "y");
  const sigWidth = mmToPixels(position.width, "x");
  const sigHeight = mmToPixels(position.height, "y");

  return (
    <div className={placerStyles.placerContainer}>
      <div className={placerStyles.pdfPreviewWrapper} ref={containerRef}>
        {previewImgUrl ? (
          <img
            src={previewImgUrl}
            className={placerStyles.pdfPreview}
            alt="PDF Preview"
            draggable={false}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#B0B0B0",
            }}
          >
            Generating preview...
          </div>
        )}

        {/* Draggable signature overlay */}
        {signatureUrl && (
          <div
            className={`${placerStyles.signatureOverlay} ${
              isDragging ? placerStyles.dragging : ""
            }`}
            style={{
              left: `${sigLeft}px`,
              top: `${sigTop}px`,
              width: `${sigWidth}px`,
              height: `${sigHeight}px`,
            }}
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
          >
            {(showTooltip || isDragging || isResizing) && (
              <div className={placerStyles.coordsTooltip}>
                x: {position.x.toFixed(0)}mm, y: {position.y.toFixed(0)}mm |{" "}
                {position.width.toFixed(0)}x{position.height.toFixed(0)}mm
              </div>
            )}
            <img src={signatureUrl} alt="Signature" />
            <div
              className={placerStyles.resizeHandle}
              onMouseDown={handleResizePointerDown}
              onTouchStart={handleResizePointerDown}
            />
          </div>
        )}

        {/* Draggable text box overlays */}
        {textBoxes.map((box) => (
          <div
            key={box.id}
            className={`${placerStyles.textBoxOverlay} ${draggingTextBoxId === box.id ? placerStyles.dragging : ""}`}
            style={{
              left: `${mmToPixels(box.x, "x")}px`,
              top: `${mmToPixels(box.y, "y")}px`,
              fontSize: `${box.fontSize * (getContainerDimensions().width / (pageDims.width * 2.8346))}px`,
            }}
            onMouseDown={(e) => handleTextBoxPointerDown(e, box.id, box)}
            onTouchStart={(e) => handleTextBoxPointerDown(e, box.id, box)}
          >
            {box.text || "Text"}
          </div>
        ))}
      </div>

      {/* Coordinate display */}
      <div className={placerStyles.coordDisplay}>
        <span>
          X: <strong>{position.x.toFixed(0)}mm</strong>
        </span>
        <span>
          Y: <strong>{position.y.toFixed(0)}mm</strong>
        </span>
        <span>
          W: <strong>{position.width.toFixed(0)}mm</strong>
        </span>
        <span>
          H: <strong>{position.height.toFixed(0)}mm</strong>
        </span>
      </div>

      {/* Controls */}
      <div className={placerStyles.placerControls}>
        <button
          className={styles.secondaryBtn}
          onClick={handleReset}
          style={{ padding: "6px 14px", fontSize: "0.85rem" }}
        >
          Reset Position
        </button>
      </div>
    </div>
  );
};

export default SignaturePlacer;
