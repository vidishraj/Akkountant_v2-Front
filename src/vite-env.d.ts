/// <reference types="vite/client" />

// Explicit CSS-module declarations. `vite/client` already provides these, but only
// resolves when node_modules is present with devDependencies installed — a checkout
// missing them reports "Cannot find module './Foo.module.scss'" for every component
// (77 errors at time of writing), drowning out real type errors. Declaring them here
// makes `tsc` meaningful in that state; it is a no-op when vite's types do resolve.
declare module "*.module.scss" {
    const classes: {readonly [key: string]: string};
    export default classes;
}

declare module "*.module.css" {
    const classes: {readonly [key: string]: string};
    export default classes;
}

// Plain-CSS side-effect imports (ak-nnzg). Covers `./styles/nocturne.css`,
// `./index.css`, and the pre-existing baseline of other plain-CSS imports
// (NotificationBanner.css, ReactToastify.css, dotsStyle.css, slick-carousel's
// CSS, etc.) so tsc -b doesn't gate the build on their absence.
declare module "*.css";

// Phosphor Icons web subpath imports (ak-abic, FE-0). The package ships the
// stylesheets without matching .d.ts for the bare-subpath specifiers tsc
// needs to resolve; the shims are the lightweight, package-version-agnostic
// close.
declare module "@phosphor-icons/web/regular";
declare module "@phosphor-icons/web/fill";
