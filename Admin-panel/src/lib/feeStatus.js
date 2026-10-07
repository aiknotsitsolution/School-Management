// Single source of truth for a student's fee status.
//
// Student Database and Online Payment used to answer this differently: the
// student list read `student.feeStatus || "Pending"` (a field the API never
// persists, so it was always "Pending"), while Online Payment derived it from
// invoices and treated "no invoice raised at all" as "Paid". Both screens now
// call deriveFeeStatus() over the same invoice list, so they cannot disagree.

import { api } from "./api";

export const FEE_PAID = "Paid";
export const FEE_PENDING = "Pending";

const outstanding = (invoice) =>
  Math.max(0, Number(invoice?.amount) - Number(invoice?.paidAmount || 0));

/**
 * Derive the fee status shown to the user.
 *
 * @param {Array} invoices  the student's fee invoices (may be empty)
 * @param {string} fallback status to keep when nothing has been invoiced yet —
 *                          the record's own value, i.e. "Pending" straight from
 *                          onboarding. No invoice means nothing is paid, so a
 *                          student with an empty invoice list is never "Paid".
 * @returns {"Paid" | "Pending"}
 */
export function deriveFeeStatus(invoices, fallback = FEE_PENDING) {
  const list = Array.isArray(invoices) ? invoices : [];
  if (list.length === 0) return fallback || FEE_PENDING;
  const pending = list.reduce((sum, invoice) => sum + outstanding(invoice), 0);
  return pending === 0 ? FEE_PAID : FEE_PENDING;
}

// Group a flat invoice list by the student it belongs to, keyed on the
// admission number the fee service stores in `studentId`.
export function groupInvoicesByStudent(invoices) {
  const map = new Map();
  for (const invoice of Array.isArray(invoices) ? invoices : []) {
    const key = String(invoice?.studentId ?? "");
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(invoice);
  }
  return map;
}

// GET /fees is paginated (default 500, max 1000). A single call can silently
// miss a student's invoices and flip them back to "Pending", so walk every
// page — capped, so a runaway collection can never hang the page.
export async function loadAllInvoices(maxPages = 10) {
  const rows = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const response = await api.fees.invoices.list(`limit=1000&page=${page}`);
    const batch = Array.isArray(response?.data) ? response.data : [];
    rows.push(...batch);
    const totalPages = Number(response?.pages);
    if (batch.length < 1000 || (totalPages > 0 && page >= totalPages)) break;
  }
  return rows;
}
