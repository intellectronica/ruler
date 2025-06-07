/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '@iarna/toml' {
  /** Serialize a JavaScript object to a TOML-formatted string. */
  export function stringify(input: any): string;
}
