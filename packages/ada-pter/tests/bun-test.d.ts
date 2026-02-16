declare module "bun:test" {
  // Minimal type shim for editor/typecheckers.
  // Runtime is provided by Bun; this file exists to avoid TS "cannot find module" errors.
  export const describe: (...args: any[]) => any;
  export const test: (...args: any[]) => any;
  export const expect: any;
  export const mock: (...args: any[]) => any;
  export const beforeEach: (...args: any[]) => any;
  export const afterEach: (...args: any[]) => any;
}
