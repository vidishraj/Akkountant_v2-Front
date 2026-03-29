import { useState, useRef, useCallback, useEffect } from "react";
import { InvoiceData } from "../../utils/interfaces";
import { generateInvoicePDFLocal } from "../../services/freelanceService";
import placerStyles from "./SignaturePlacer.module.scss";
import styles from "../../pages/Freelance/Freelance.module.scss";

interface SignaturePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SignaturePlacerProps {
  invoiceData?: InvoiceData | null;
  pdfBlobUrl?: string | null;
  signatureUrl: string;
  onPositionChange: (pos: SignaturePosition) => void;
  initialPosition: SignaturePosition;
  currentPage?: number;
}

// A4 dimensions in mm
const A4_WIDTH = 210;
const A4_HEIGHT = 297;

const SignaturePlacer = ({
  invoiceData,
  pdfBlobUrl,
  signatureUrl,
  onPositionChange,
  initialPosition,
  currentPage = 0,
}: SignaturePlacerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfImageUrl, setPdfImageUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [showTooltip, setShowTooltip] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const resizeStartRef = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0 });

  // Generate PDF preview image
  useEffect(() => {
    if (pdfBlobUrl) {
      // Use provided PDF blob URL directly (for document signing)
      setPdfImageUrl(pdfBlobUrl + (currentPage ? `#page=${currentPage + 1}` : ''));
      return;
    }
    if (!invoiceData) return;
    let cancelled = false;

    const generatePreview = async () => {
      try {
        const blob = await generateInvoicePDFLocal(invoiceData);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setPdfImageUrl(url);
      } catch (error) {
        console.error("Failed to generate PDF preview:", error);
      }
    };

    generatePreview();
    return () => {
      cancelled = true;
    };
  }, [invoiceData, pdfBlobUrl, currentPage]);

  // Cleanup URL on unmount (only if we generated it, not if passed via pdfBlobUrl)
  useEffect(() => {
    return () => {
      if (pdfImageUrl && !pdfBlobUrl) URL.revokeObjectURL(pdfImageUrl);
    };
  }, [pdfImageUrl, pdfBlobUrl]);

  // Sync initial position
  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition]);

  const getContainerDimensions = useCallback(() => {
    if (!containerRef.current) return { width: 595, height: 842 };
    const rect = containerRef.current.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, []);

  // Convert mm to container pixels
  const mmToPixels = useCallback(
    (mm: number, axis: "x" | "y") => {
      const dims = getContainerDimensions();
      if (axis === "x") return (mm / A4_WIDTH) * dims.width;
      return (mm / A4_HEIGHT) * dims.height;
    },
    [getContainerDimensions]
  );

  // Convert container pixels to mm
  const pixelsToMm = useCallback(
    (px: number, axis: "x" | "y") => {
      const dims = getContainerDimensions();
      if (axis === "x") return (px / dims.width) * A4_WIDTH;
      return (px / dims.height) * A4_HEIGHT;
    },
    [getContainerDimensions]
  );

  const clampPosition = useCallback(
    (x: number, y: number, w: number, h: number) => {
      return {
        x: Math.max(5, Math.min(x, A4_WIDTH - w - 5)),
        y: Math.max(5, Math.min(y, A4_HEIGHT - h - 5)),
        width: Math.max(15, Math.min(w, A4_WIDTH - 10)),
        height: Math.max(5, Math.min(h, A4_HEIGHT - 10)),
      };
    },
    []
  );

  // Drag handlers (mouse + touch)
  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (isResizing) return;
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
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
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
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
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

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

  const handleReset = () => {
    const defaultPos = { x: 20, y: 250, width: 50, height: 20 };
    setPosition(defaultPos);
    onPositionChange(defaultPos);
  };

  if (!invoiceData && !pdfBlobUrl) {
    return (
      <div className={placerStyles.placerContainer}>
        <div style={{ textAlign: "center", padding: "40px", color: "#B0B0B0" }}>
          {pdfBlobUrl === undefined ? "Select an invoice to see the preview" : "Upload a PDF to see the preview"}
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
        {pdfImageUrl ? (
          <iframe
            src={pdfImageUrl}
            className={placerStyles.pdfPreview}
            title="PDF Preview"
            style={{ pointerEvents: "none" }}
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
