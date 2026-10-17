// The one Node API the balance report uses (src/sim/balance.bench.ts), typed here
// instead of pulling in @types/node for the browser build.
declare module 'node:fs' {
  export function writeFileSync(path: string, data: string): void;
}
