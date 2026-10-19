// The few Node APIs the reports use (src/sim/*.bench.ts), typed here
// instead of pulling in @types/node for the browser build.
declare module 'node:fs' {
  export function writeFileSync(path: string, data: string): void;
}
declare module 'node:process' {
  export const env: Readonly<Record<string, string | undefined>>;
}
