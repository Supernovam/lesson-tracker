/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// Minimal ambient shims used during production builds where some dev-only
// type packages may be missing in the build environment.
//
// This avoids hard failures like:
// - "JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists."
// - "Could not find a declaration file for module 'react' ..."

declare module 'react' {
  const React: any;
  export = React;
}

declare module 'react-dom/client' {
  export const createRoot: any;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

declare global {
  interface ImportMeta {
    env: Record<string, any>;
  }
}

declare module '*.css' {
  const css: any;
  export default css;
}

export {};

