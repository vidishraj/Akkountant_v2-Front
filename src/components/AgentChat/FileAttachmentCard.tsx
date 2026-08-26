import React, { useState } from "react";
import { auth } from "../FirebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { API_BASE_URL } from "../../services/AxiosConfig.tsx";
import styles from "./AgentChat.module.scss";

/**
 * Agent-produced file attachment metadata. Shape is emitted by the backend
 * on a new SSE event; matches the MCP `file_attachment` content-block. The
 * `url` is server-controlled (never client-supplied) and is fetched with the
 * same X-Firebase-ID header pattern as other user-scoped endpoints — the
 * backend cross-user check returns 404 on wrong user, which FE degrades to
 * the "no longer available" state.
 */
export interface AgentFileAttachment {
  type: "file_attachment";
  url: string;
  name: string;
  size_bytes: number;
  mime_type: string;
  uuid: string;
}

interface FileAttachmentCardProps {
  attachment: AgentFileAttachment;
}

// mime prefix → icon glyph. Matches the bead's list; unknown falls back to
// a generic doc glyph. Kept as text emoji rather than icon-fonts so the
// card stays lightweight and dark-mode-safe without extra CSS.
function iconFor(mime: string): string {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return "🖼️";
  if (m === "application/pdf" || m.endsWith("/pdf")) return "📕";
  if (
    m === "text/csv" ||
    m === "text/tab-separated-values" ||
    m.endsWith("/csv") ||
    m.endsWith("/tsv")
  ) {
    return "📄";
  }
  if (
    m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    m === "application/vnd.ms-excel" ||
    m.includes("spreadsheet")
  ) {
    return "📊";
  }
  return "📃";
}

/**
 * Whether a browser tab can natively preview this mime type. Used to decide
 * whether the "Open in new tab" secondary action shows. Downloadable types
 * (CSVs, xlsx) still get a card — just no preview button.
 */
function isPreviewable(mime: string): boolean {
  const m = (mime || "").toLowerCase();
  return m.startsWith("image/") || m === "application/pdf";
}

/** Humanizes byte count to "12.4 KB" / "1.2 MB" style. */
function humanBytes(n: number | undefined): string {
  if (typeof n !== "number" || !isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * The backend emits the attachment URL as a path (e.g. `/api/user-files/{uuid}`).
 * We prepend API_BASE_URL when the URL doesn't already look absolute so the
 * fetch resolves against the deployed backend regardless of dev/prod host.
 */
function resolveUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  // API_BASE_URL ends with a trailing slash; url starts with a slash.
  // Strip the leading slash off the path to avoid a double-slash.
  const path = url.startsWith("/api/") ? url.slice(5) : url.replace(/^\//, "");
  return `${API_BASE_URL}${path}`;
}

async function getFirebaseUID(): Promise<string> {
  const user = auth.currentUser;
  if (user) return user.uid;
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (loggedInUser) => {
      unsubscribe();
      if (loggedInUser) resolve(loggedInUser.uid);
      else reject(new Error("User not authenticated"));
    });
  });
}

/**
 * Fetches the attachment as a blob with auth headers (browser's default
 * `<a href download>` can't attach custom headers), then hands it to the
 * browser via a synthesized `<a>` click. The Content-Disposition attachment
 * header the backend sends still drives the "Save as…" prompt where the
 * browser honours it. Object URL is revoked after the click fires.
 */
async function downloadWithAuth(url: string, filename: string): Promise<void> {
  const uid = await getFirebaseUID();
  const res = await fetch(resolveUrl(url), {
    headers: { "X-Firebase-ID": uid },
  });
  if (!res.ok) {
    // Bubble up so the caller can flip the card to the not-available state.
    throw new Error(`download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Small delay before revoke so Safari has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/**
 * Opens the attachment in a new tab for previewable types. Same auth path
 * as download — fetch the blob, wrap in object URL, `window.open`. The
 * object URL is intentionally NOT revoked here because the new tab still
 * owns the reference; browser cleans up on tab close.
 */
async function previewWithAuth(url: string): Promise<void> {
  const uid = await getFirebaseUID();
  const res = await fetch(resolveUrl(url), {
    headers: { "X-Firebase-ID": uid },
  });
  if (!res.ok) throw new Error(`preview failed: ${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
}

/**
 * Card that renders an agent-produced file attachment inline in a chat
 * message. Click anywhere on the body → download via browser (blob path
 * so auth headers can attach); "Open in new tab" for image/PDF preview.
 *
 * When the backend has cleaned the file up or returns 404 for any reason
 * (wrong-user cross-isolation, deleted attachment), the card flips to an
 * un-clickable "no longer available" state — never disappears silently,
 * matches the archive modal's inline "no digest for {date}" pattern.
 */
const FileAttachmentCard: React.FC<FileAttachmentCardProps> = ({ attachment }) => {
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const previewable = isPreviewable(attachment.mime_type);
  const sizeLabel = humanBytes(attachment.size_bytes);
  const displayName = attachment.name || "Attachment";

  const handleDownload = async () => {
    if (gone || busy) return;
    setBusy(true);
    try {
      await downloadWithAuth(attachment.url, displayName);
    } catch (err) {
      // 404 or any transport failure — treat as gone for this session.
      // Non-404 could recover on refresh; user can retry via reload.
      if (err instanceof Error && err.message.includes("404")) {
        setGone(true);
      } else {
        // eslint-disable-next-line no-console
        console.error("FileAttachmentCard download failed:", err);
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (gone || busy) return;
    setBusy(true);
    try {
      await previewWithAuth(attachment.url);
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) {
        setGone(true);
      } else {
        // eslint-disable-next-line no-console
        console.error("FileAttachmentCard preview failed:", err);
      }
    } finally {
      setBusy(false);
    }
  };

  if (gone) {
    return (
      <div
        className={`${styles.fileAttachmentCard} ${styles.fileAttachmentCardGone}`}
        role="note"
        aria-label={`${displayName} — no longer available`}
      >
        <span className={styles.fileAttachmentIcon} aria-hidden>
          {iconFor(attachment.mime_type)}
        </span>
        <span className={styles.fileAttachmentBody}>
          <span className={styles.fileAttachmentName}>{displayName}</span>
          <span className={styles.fileAttachmentMeta}>
            This file is no longer available
          </span>
        </span>
      </div>
    );
  }

  return (
    <div
      className={styles.fileAttachmentCard}
      role="button"
      tabIndex={0}
      onClick={handleDownload}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void handleDownload();
        }
      }}
      aria-label={`Download ${displayName}${sizeLabel ? `, ${sizeLabel}` : ""}`}
    >
      <span className={styles.fileAttachmentIcon} aria-hidden>
        {iconFor(attachment.mime_type)}
      </span>
      <span className={styles.fileAttachmentBody}>
        <span className={styles.fileAttachmentName}>{displayName}</span>
        {sizeLabel && (
          <span className={styles.fileAttachmentMeta}>{sizeLabel}</span>
        )}
      </span>
      {previewable && (
        <button
          type="button"
          className={styles.fileAttachmentPreviewBtn}
          onClick={handlePreview}
          disabled={busy}
          aria-label={`Open ${displayName} in new tab`}
        >
          Open ↗
        </button>
      )}
    </div>
  );
};

export default FileAttachmentCard;
