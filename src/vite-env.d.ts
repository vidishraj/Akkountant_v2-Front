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
