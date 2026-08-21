import React from "react";
import { Box } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import style from "./WealthDigest.module.scss";

interface DigestBodyProps {
  /** Markdown-formatted digest text from WealthDigestTask. */
  text: string;
}

/**
 * The digest's prose narrative. Rendered via react-markdown + remark-gfm to
 * pick up tables, task-lists, and autolinks alongside standard markdown.
 *
 * The inner container is width-capped (`max-width: 700px`, centered) so long
 * paragraphs stay in the reading-comfort range regardless of viewport size.
 * The outer band is full-width so the surface visually flows with the tile
 * row above.
 *
 * All markdown elements route through the app's existing text tokens (styled
 * in WealthDigest.module.scss) so headings, lists, and links inherit the
 * same dark-theme treatment as the rest of the app.
 */
const DigestBody: React.FC<DigestBodyProps> = ({ text }) => {
  return (
    <Box className={style.bodyBand}>
      <Box className={style.bodyInner}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </Box>
    </Box>
  );
};

export default DigestBody;
