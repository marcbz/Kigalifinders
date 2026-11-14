/** Pure helpers for the public property-management calculator. */

export const MANAGEMENT_RATE = 0.1;
export const MIN_MONTHLY_MANAGEMENT_FEE = 75;
export const SUGGESTED_RENT_MIN = 350;
export const SUGGESTED_RENT_MAX = 4000;
export const DEFAULT_RENT = 600;

export const DEFAULT_COMPREHENSIVE_EXPENSES = {
  cleaning: 40,
  security: 60,
  water: 15,
  electricity: 25,
  wifi: 30,
  buffer: 5,
} as const;

export type ComprehensiveExpenses = {
  cleaning: number;
  security: number;
  water: number;
  electricity: number;
  wifi: number;
  buffer: number;
};

export type PackageId = "standard" | "comprehensive";

/** Monthly KigaliRent management fee: 10% of rent, minimum $75. */
export function monthlyManagementFee(monthlyRent: number): number {
  const rent = Math.max(0, Number.isFinite(monthlyRent) ? monthlyRent : 0);
  return Math.max(MIN_MONTHLY_MANAGEMENT_FEE, roundMoney(rent * MANAGEMENT_RATE));
}

/** One-time tenant placement commission: 10% of first month's rent. */
export function placementCommission(monthlyRent: number): number {
  const rent = Math.max(0, Number.isFinite(monthlyRent) ? monthlyRent : 0);
  return roundMoney(rent * MANAGEMENT_RATE);
}

export function comprehensivePackageTotal(
  managementFee: number,
  expenses: ComprehensiveExpenses,
): number {
  return roundMoney(
    managementFee +
      safeAmount(expenses.cleaning) +
      safeAmount(expenses.security) +
      safeAmount(expenses.water) +
      safeAmount(expenses.electricity) +
      safeAmount(expenses.wifi) +
      safeAmount(expenses.buffer),
  );
}

export function scaleByPropertyCount(amount: number, propertyCount: number): number {
  const count = Math.max(1, Math.floor(safeAmount(propertyCount) || 1));
  return roundMoney(amount * count);
}

export function formatUsd(amount: number): string {
  const n = roundMoney(amount);
  return n % 1 === 0
    ? `$${n.toLocaleString("en-US")}`
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function safeAmount(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function roundMoney(value: number): number {
  return Math.round(safeAmount(value) * 100) / 100;
}
