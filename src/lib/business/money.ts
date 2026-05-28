const MONEY_SCALE = 100;

export function toMoney(value: unknown): number {
  if (typeof value === "number") return roundMoney(value);
  if (typeof value !== "string") return 0;

  const cleaned = value
    .replace(/TL/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
}

export function roundMoney(value: unknown): number {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.round(numberValue * MONEY_SCALE) / MONEY_SCALE;
}

export function addMoney(a: unknown, b: unknown): number {
  return roundMoney(toMoney(a) + toMoney(b));
}

export function subtractMoney(a: unknown, b: unknown): number {
  return roundMoney(toMoney(a) - toMoney(b));
}

export function multiplyMoney(a: unknown, b: unknown): number {
  return roundMoney(toMoney(a) * Number(b || 0));
}

export function compareMoney(a: unknown, b: unknown): -1 | 0 | 1 {
  const diff = subtractMoney(a, b);
  if (Math.abs(diff) < 0.01) return 0;
  return diff > 0 ? 1 : -1;
}

export function isZeroMoney(value: unknown): boolean {
  return compareMoney(value, 0) === 0;
}

export function absoluteMoney(value: unknown): number {
  return Math.abs(toMoney(value));
}

export function sumMoney(values: unknown[]): number {
  return values.reduce((sum, value) => addMoney(sum, value), 0);
}
