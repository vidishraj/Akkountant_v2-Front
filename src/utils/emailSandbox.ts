// ak-36mz: harden the email-body iframe.
//
// The body HTML is rendered via srcDoc in an iframe sandboxed without
// scripts. Without a CSP, remote images / tracking pixels / remote CSS and
// fonts still load, which leaks "opened at <time> from <IP>" to senders and
// third parties. This injects a CSP meta so only inline styles and inline
// (data:/cid:) images are allowed. Nothing remote loads.

export const EMAIL_BODY_CSP = "default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'";

const META = `<meta http-equiv="Content-Security-Policy" content="${EMAIL_BODY_CSP}">`;

/**
 * ak-36mz review fix: NEVER locate <head> by text search. Sender HTML can
 * defeat that with decoys (a "<head>" inside a comment, an attribute value,
 * or after body content), which leaves the CSP unhonoured. Instead the
 * output always starts with a standards doctype immediately followed by the
 * CSP meta, so the parser's implied <head> receives it before ANY sender
 * byte. A sender's own leading doctype is dropped (a later one is ignored by
 * the parser anyway); its <html>/<head> tags are merged or ignored as usual.
 */
export function withEmailBodyCsp(html: string): string {
    const body = html.replace(/^\uFEFF?\s*<!doctype[^>]*>/i, "");
    return `<!doctype html>${META}${body}`;
}
