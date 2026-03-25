/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// Minimal ambient shims used during production builds where some dev-only
// type packages may be missing in the build environment.

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare module 'react' {
  // Event types are used explicitly in some components.
  export type FormEvent<T = any> = {
    preventDefault(): void;
    currentTarget: T;
    target: T;
  };
  export type ChangeEvent<T = any> = {
    target: T;
  };

  export type SetStateAction<S> = S | ((prevState: S) => S);
  export type Dispatch<A> = (value: A) => void;

  // These are intentionally minimal: they exist so `tsc` can type-check
  // generic hook usages (e.g. `useState<Lesson[]>`) and avoid implicit `any`
  // errors when @types/react is not installed.
  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps?: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps?: any[]): T;

  export const StrictMode: any;
}

declare module 'react-dom/client' {
  export function createRoot(container: Element | DocumentFragment | null): {
    render(children: any): void;
  };
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
  export const Fragment: any;
}

interface ImportMeta {
  env: Record<string, any>;
}

declare module '*.css' {
  const css: any;
  export default css;
}

