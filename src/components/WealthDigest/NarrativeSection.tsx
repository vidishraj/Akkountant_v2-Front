import React from "react";
import { Box, Typography } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import style from "./WealthDigest.module.scss";

interface NarrativeSectionProps {
  /** Markdown-formatted digest text from WealthDigestTask. */
  text: string;
}

/**
 * Renders the digest's prose narrative with a couple of Wave 3 polish
 * refinements over the original DigestBody:
 *
 * 1. Section header — "In summary" — so the narrative reads as one of
 *    several dashboard components, not "the page contents."
 * 2. Numeric highlighting via a remark-safe pre-pass over the raw text:
 *    signed percentages (`+3.1%`, `-2.4%`, `+₹32,140`) get wrapped in
 *    `**bold**` + a class-bearing span so the SCSS can color them
 *    green/red. Non-signed numbers are left untouched so absolute values
 *    (portfolio total, page counts) don't get semantic coloring.
 *
 * The inner container is width-capped (`max-width: 700px`, centered) so
 * long paragraphs stay in reading-comfort range. Markdown elements route
 * through the existing text tokens defined in the shared SCSS.
 */
const NarrativeSection: React.FC<NarrativeSectionProps> = ({ text }) => {
  return (
    <Box className={style.narrativeBand}>
      <Box className={style.narrativeInner}>
        <Typography className={style.narrativeHeading} component="h2">
          In summary
        </Typography>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Rewrite strong-wrapped signed numbers to carry a color class.
            // We use `strong` because remark-parse already parses ** as
            // <strong> — we just tag the rendered element based on its
            // content, no source rewriting or plugin needed. Keeps the
            // markdown source clean; keeps the rendering deterministic.
            strong: ({ children, ...rest }) => {
              const raw = React.Children.toArray(children)
                .map((c) => (typeof c === "string" ? c : ""))
                .join("");
              const trimmed = raw.trim();
              const isPositive = /^\+\s?\S/.test(trimmed);
              const isNegative = /^-\s?\S|^−\s?\S/.test(trimmed);
              const cls = isPositive
                ? style.narrativePositive
                : isNegative
                  ? style.narrativeNegative
                  : "";
              return (
                <strong {...rest} className={cls}>
                  {children}
                </strong>
              );
            },
          }}
        >
          {text}
        </ReactMarkdown>
      </Box>
    </Box>
  );
};

export default NarrativeSection;
