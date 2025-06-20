declare module 'mathjs' {
  export function evaluate(expr: string | string[]): any;
  export function mean(values: number[]): number;
  export function std(values: number[]): number;
  export function median(values: number[]): number;
  export function min(values: number[]): number;
  export function max(values: number[]): number;
  export function sum(values: number[]): number;
  export function round(value: number, precision?: number): number;
  export function abs(value: number): number;
  export function sqrt(value: number): number;
  export function pow(base: number, exponent: number): number;
  export function log(value: number): number;
  export function exp(value: number): number;
  export function floor(value: number): number;
  export function ceil(value: number): number;
  export const pi: number;
  export const e: number;
}
