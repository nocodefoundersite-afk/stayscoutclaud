/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
export type CalcInput = {
  price: number; occupancy: number; commission: number; opex: number;
  rent: number; depositMonths: number; setup: number;
  purchase: number; downPct: number; stampPct: number; rate: number; years: number; maintenance: number; appreciation: number;
  horizon: number;
};

export const emi = (principal: number, annualRate: number, years: number) => {
  const n = years * 12, r = annualRate / 1200;
  if (principal <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);
};
const balanceAfter = (principal: number, annualRate: number, years: number, months: number) => {
  const r = annualRate / 1200, m = Math.min(months, years * 12), pay = emi(principal, annualRate, years);
  if (principal <= 0) return 0;
  if (r === 0) return Math.max(0, principal - pay * m);
  return Math.max(0, principal * (1 + r) ** m - pay * (((1 + r) ** m - 1) / r));
};

export function compute(i: CalcInput) {
  const nights = 30 * (i.occupancy / 100);
  const revenue = i.price * nights;
  const running = revenue * (i.commission / 100) + revenue * (i.opex / 100);
  const beforeHousing = revenue - running;
  const months = i.horizon * 12;

  // Rent
  const deposit = i.rent * i.depositMonths;
  const rentUpfront = deposit + i.setup;
  const rentMonthly = beforeHousing - i.rent;
  const rentPayback = rentMonthly > 0 ? rentUpfront / rentMonthly : null;
  const rentEnd = rentMonthly * months - rentUpfront + deposit; // deposit returned at the end
  const margin = 1 - (i.commission + i.opex) / 100;
  const rentBreakEvenOcc = margin > 0 && i.price > 0 ? (i.rent / (i.price * 30 * margin)) * 100 : null;

  // Buy
  const down = i.purchase * (i.downPct / 100);
  const loan = i.purchase - down;
  const stamp = i.purchase * (i.stampPct / 100);
  const monthlyEmi = emi(loan, i.rate, i.years);
  const monthlyEmiAt = (m: number) => (m <= i.years * 12 ? monthlyEmi : 0);
  const buyUpfront = down + stamp + i.setup;
  const buyMonthly = beforeHousing - monthlyEmi - i.maintenance / 12;
  let cash = -buyUpfront;
  for (let m = 1; m <= months; m++) cash += beforeHousing - monthlyEmiAt(m) - i.maintenance / 12;
  const value = i.purchase * (1 + i.appreciation / 100) ** i.horizon;
  const equity = value - balanceAfter(loan, i.rate, i.years, months);
  const buyEnd = cash + equity;
  const buyPayback = buyMonthly > 0 ? buyUpfront / buyMonthly : null;
  const buyBreakEvenOcc = margin > 0 && i.price > 0 ? ((monthlyEmi + i.maintenance / 12) / (i.price * 30 * margin)) * 100 : null;

  return {
    nights, revenue, running,
    rent: { upfront: rentUpfront, monthly: rentMonthly, payback: rentPayback, end: rentEnd, breakEven: rentBreakEvenOcc },
    buy: { upfront: buyUpfront, monthly: buyMonthly, emi: monthlyEmi, payback: buyPayback, end: buyEnd, cash, equity, value, breakEven: buyBreakEvenOcc },
  };
}
