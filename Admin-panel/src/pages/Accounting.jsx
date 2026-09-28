import { useCallback, useEffect, useState } from "react";
import { PermissionGate } from "../lib/permissions";
import { Plus, X, Trash2, Pencil, BookOpen, RefreshCw } from "lucide-react";
import { PageIntro, Card, Button, Input, Select, Pill, toast } from "../components/UI";
import { api } from "../lib/api";

const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => new Date().toISOString().slice(0, 7) + "-01";

const ACCOUNT_TYPES = ["Asset", "Liability", "Equity", "Income", "Expense"];

const SOURCE_TONE = { manual: "primary", fee: "info", payroll: "warning", system: "neutral" };

const blankLine = () => ({ accountCode: "", debit: "", credit: "" });

function lineTotals(lines) {
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    debit += Number(line.debit) || 0;
    credit += Number(line.credit) || 0;
  }
  return {
    debit: Math.round(debit * 100) / 100,
    credit: Math.round(credit * 100) / 100,
    balanced:
      lines.length >= 2 &&
      debit > 0 &&
      Math.abs(debit - credit) < 0.005 &&
      lines.every((l) => (Number(l.debit) > 0) !== (Number(l.credit) > 0) && (l.accountCode || "").trim()),
  };
}

export default function Accounting() {
  const [tab, setTab] = useState("journal");

  // ── shared ──
  const [accounts, setAccounts] = useState([]);

  // ── journal ──
  const [entries, setEntries] = useState([]);
  const [journalFrom, setJournalFrom] = useState("");
  const [journalTo, setJournalTo] = useState("");
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState({ date: today(), memo: "", lines: [blankLine(), blankLine()] });

  // ── accounts ──
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState({ code: "", name: "", type: "Asset" });
  const [editAccountId, setEditAccountId] = useState(null);

  // ── reports ──
  const [reportFrom, setReportFrom] = useState(monthStart());
  const [reportTo, setReportTo] = useState(today());
  const [reports, setReports] = useState(null);

  const loadAccounts = useCallback(() => {
    api.accounting.accounts
      .list()
      .then((res) => setAccounts(res.data || []))
      .catch((err) => toast(err.message || "Failed to load accounts", "error"));
  }, []);

  const loadJournal = useCallback(() => {
    const params = new URLSearchParams();
    if (journalFrom) params.set("from", journalFrom);
    if (journalTo) params.set("to", journalTo);
    const qs = params.toString();
    api.accounting.journal
      .list(qs)
      .then((res) => setEntries(res.data || []))
      .catch((err) => toast(err.message || "Failed to load journal", "error"));
  }, [journalFrom, journalTo]);

  const loadReports = useCallback(() => {
    const params = new URLSearchParams();
    if (reportFrom) params.set("from", reportFrom);
    if (reportTo) params.set("to", reportTo);
    const qs = params.toString();
    Promise.all([
      api.accounting.reports.trialBalance(qs),
      api.accounting.reports.incomeExpense(qs),
      api.accounting.reports.balanceSheet(`asOf=${reportTo || today()}`),
    ])
      .then(([trialBalance, incomeExpense, balanceSheet]) =>
        setReports({ trialBalance, incomeExpense, balanceSheet }),
      )
      .catch((err) => toast(err.message || "Failed to load reports", "error"));
  }, [reportFrom, reportTo]);

  useEffect(() => {
    loadAccounts();
    loadJournal();
  }, [loadAccounts, loadJournal]);

  useEffect(() => {
    if (tab === "reports" && !reports) loadReports();
  }, [tab, reports, loadReports]);

  // ── journal entry modal ──────────────────────────────────────────────────
  const totals = lineTotals(entryForm.lines);

  const updateLine = (index, patch) => {
    setEntryForm((form) => {
      const lines = form.lines.map((line, i) => (i === index ? { ...line, ...patch } : line));
      return { ...form, lines };
    });
  };

  const submitEntry = async () => {
    if (!totals.balanced) {
      toast("Entry must have at least two lines with equal debits and credits", "error");
      return;
    }
    try {
      await api.accounting.journal.create({
        date: entryForm.date,
        memo: entryForm.memo,
        lines: entryForm.lines.map((l) => ({
          accountCode: l.accountCode,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })),
      });
      toast("Journal entry posted");
      setShowEntryModal(false);
      setEntryForm({ date: today(), memo: "", lines: [blankLine(), blankLine()] });
      loadJournal();
    } catch (err) {
      toast(err.message || "Failed to post entry", "error");
    }
  };

  const deleteEntry = async (id) => {
    if (!window.confirm("Delete this manual journal entry?")) return;
    try {
      await api.accounting.journal.remove(id);
      toast("Entry deleted");
      loadJournal();
    } catch (err) {
      toast(err.message || "Failed to delete entry", "error");
    }
  };

  // ── accounts ─────────────────────────────────────────────────────────────
  const openAccountModal = (account = null) => {
    setEditAccountId(account ? account._id : null);
    setAccountForm(
      account
        ? { code: account.code, name: account.name, type: account.type }
        : { code: "", name: "", type: "Asset" },
    );
    setShowAccountModal(true);
  };

  const submitAccount = async () => {
    if (!accountForm.code.trim() || !accountForm.name.trim()) {
      toast("Code and name are required", "error");
      return;
    }
    try {
      if (editAccountId) {
        await api.accounting.accounts.update(editAccountId, accountForm);
        toast("Account updated");
      } else {
        await api.accounting.accounts.create(accountForm);
        toast("Account created");
      }
      setShowAccountModal(false);
      loadAccounts();
    } catch (err) {
      toast(err.message || "Failed to save account", "error");
    }
  };

  const deleteAccount = async (account) => {
    if (!window.confirm(`Delete account ${account.code} — ${account.name}?`)) return;
    try {
      await api.accounting.accounts.remove(account._id);
      toast("Account deleted");
      loadAccounts();
    } catch (err) {
      toast(err.message || "Failed to delete account", "error");
    }
  };

  const TABS = [
    { id: "journal", label: "Journal" },
    { id: "accounts", label: "Chart of Accounts" },
    { id: "reports", label: "Reports" },
  ];

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Finance"
        title="Accounting"
        description="Double-entry ledger — journal, chart of accounts, trial balance and financial statements."
      />

      {/* ── tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition ${
              tab === t.id
                ? "bg-primary text-white shadow"
                : "bg-white text-slate-text border border-slate-200 hover:bg-paper"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── JOURNAL ── */}
      {tab === "journal" && (
        <Card
          title="Journal"
          action={
            <div className="flex items-center gap-2">
              <div className="w-36">
                <Input
                  type="date"
                  value={journalFrom}
                  onChange={(e) => setJournalFrom(e.target.value)}
                />
              </div>
              <div className="w-36">
                <Input
                  type="date"
                  value={journalTo}
                  onChange={(e) => setJournalTo(e.target.value)}
                />
              </div>
              <PermissionGate permission="accounting:journal">
                <Button onClick={() => setShowEntryModal(true)}>
                  <Plus size={15} /> New entry
                </Button>
              </PermissionGate>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/70 border-b border-slate-200">
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Memo / Lines</th>
                  <th className="py-2 pr-3 font-semibold">Source</th>
                  <th className="py-2 pr-3 font-semibold text-right">Debit</th>
                  <th className="py-2 pr-3 font-semibold text-right">Credit</th>
                  <th className="py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-text/70">
                      No journal entries yet. Fee receipts and paid payroll appear
                      automatically; post manual entries with “New entry”.
                    </td>
                  </tr>
                )}
                {entries.map((entry) => {
                  const debit = (entry.lines || []).reduce((s, l) => s + (l.debit || 0), 0);
                  const credit = (entry.lines || []).reduce((s, l) => s + (l.credit || 0), 0);
                  return (
                    <tr key={entry._id} className="border-b border-slate-100 align-top">
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-ink">{entry.memo || "—"}</div>
                        <div className="text-[11.5px] text-slate-text/70 mt-0.5">
                          {(entry.lines || [])
                            .map(
                              (l) =>
                                `${l.accountCode} ${l.debit ? `Dr ${money(l.debit)}` : `Cr ${money(l.credit)}`}`,
                            )
                            .join(" · ")}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Pill tone={SOURCE_TONE[entry.source] || "neutral"}>{entry.source}</Pill>
                      </td>
                      <td className="py-2.5 pr-3 text-right whitespace-nowrap">{money(debit)}</td>
                      <td className="py-2.5 pr-3 text-right whitespace-nowrap">{money(credit)}</td>
                      <td className="py-2.5 text-right">
                        {entry.source === "manual" && (
                          <PermissionGate permission="accounting:journal">
                            <button
                              onClick={() => deleteEntry(entry._id)}
                              className="p-1.5 rounded-lg hover:bg-alert/10 text-alert"
                              title="Delete entry"
                            >
                              <Trash2 size={15} />
                            </button>
                          </PermissionGate>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── ACCOUNTS ── */}
      {tab === "accounts" && (
        <Card
          title="Chart of Accounts"
          action={
            <PermissionGate permission="accounting:journal">
              <Button onClick={() => openAccountModal()}>
                <Plus size={15} /> Add account
              </Button>
            </PermissionGate>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/70 border-b border-slate-200">
                  <th className="py-2 pr-3 font-semibold">Code</th>
                  <th className="py-2 pr-3 font-semibold">Name</th>
                  <th className="py-2 pr-3 font-semibold">Type</th>
                  <th className="py-2 pr-3 font-semibold">System</th>
                  <th className="py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account._id} className="border-b border-slate-100">
                    <td className="py-2.5 pr-3 font-mono">{account.code}</td>
                    <td className="py-2.5 pr-3 font-medium text-ink">{account.name}</td>
                    <td className="py-2.5 pr-3">{account.type}</td>
                    <td className="py-2.5 pr-3">
                      {account.isSystem ? <Pill tone="info">system</Pill> : null}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {!account.isSystem && (
                        <PermissionGate permission="accounting:journal">
                          <button
                            onClick={() => openAccountModal(account)}
                            className="p-1.5 rounded-lg hover:bg-paper text-slate-text mr-1"
                            title="Edit account"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => deleteAccount(account)}
                            className="p-1.5 rounded-lg hover:bg-alert/10 text-alert"
                            title="Delete account"
                          >
                            <Trash2 size={15} />
                          </button>
                        </PermissionGate>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── REPORTS ── */}
      {tab === "reports" && (
        <div className="space-y-6">
          <Card
            title="Period"
            action={
              <div className="flex items-center gap-2">
                <div className="w-36">
                  <Input
                    type="date"
                    value={reportFrom}
                    onChange={(e) => setReportFrom(e.target.value)}
                  />
                </div>
                <div className="w-36">
                  <Input
                    type="date"
                    value={reportTo}
                    onChange={(e) => setReportTo(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={loadReports}>
                  <RefreshCw size={15} /> Refresh
                </Button>
              </div>
            }
          >
            <p className="text-[13px] text-slate-text/80">
              Trial balance for the selected period, income &amp; expense for the
              period, and the balance sheet as of the period end.
            </p>
          </Card>

          {!reports && (
            <Card>
              <p className="text-sm text-slate-text/70 py-6 text-center">Loading reports…</p>
            </Card>
          )}

          {reports && (
            <>
              {/* Trial balance */}
              <Card
                title="Trial Balance"
                action={
                  <Pill tone={reports.trialBalance.balanced ? "success" : "alert"}>
                    {reports.trialBalance.balanced ? "Balanced" : "Out of balance"}
                  </Pill>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-slate-text/70 border-b border-slate-200">
                        <th className="py-2 pr-3 font-semibold">Code</th>
                        <th className="py-2 pr-3 font-semibold">Account</th>
                        <th className="py-2 pr-3 font-semibold">Type</th>
                        <th className="py-2 pr-3 font-semibold text-right">Debit</th>
                        <th className="py-2 font-semibold text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.trialBalance.rows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-text/70">
                            No activity in this period.
                          </td>
                        </tr>
                      )}
                      {reports.trialBalance.rows.map((row) => (
                        <tr key={row.code} className="border-b border-slate-100">
                          <td className="py-2 pr-3 font-mono">{row.code}</td>
                          <td className="py-2 pr-3">{row.name}</td>
                          <td className="py-2 pr-3">{row.type}</td>
                          <td className="py-2 pr-3 text-right">{row.debit ? money(row.debit) : "—"}</td>
                          <td className="py-2 text-right">{row.credit ? money(row.credit) : "—"}</td>
                        </tr>
                      ))}
                      <tr className="font-semibold text-ink">
                        <td colSpan={3} className="py-2.5 pr-3 text-right">
                          Total
                        </td>
                        <td className="py-2.5 pr-3 text-right">{money(reports.trialBalance.totalDebit)}</td>
                        <td className="py-2.5 text-right">{money(reports.trialBalance.totalCredit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Income & expense */}
              <Card
                title="Income & Expense"
                action={
                  <span className="text-[13px] font-semibold text-ink">
                    Net: {money(reports.incomeExpense.net)}
                  </span>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-slate-text/70 border-b border-slate-200">
                        <th className="py-2 pr-3 font-semibold">Code</th>
                        <th className="py-2 pr-3 font-semibold">Account</th>
                        <th className="py-2 pr-3 font-semibold">Type</th>
                        <th className="py-2 font-semibold text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.incomeExpense.rows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-text/70">
                            No income or expense in this period.
                          </td>
                        </tr>
                      )}
                      {reports.incomeExpense.rows.map((row) => (
                        <tr key={row.code} className="border-b border-slate-100">
                          <td className="py-2 pr-3 font-mono">{row.code}</td>
                          <td className="py-2 pr-3">{row.name}</td>
                          <td className="py-2 pr-3">{row.type}</td>
                          <td className="py-2 text-right">{money(row.amount)}</td>
                        </tr>
                      ))}
                      <tr className="font-semibold text-ink border-t border-slate-200">
                        <td colSpan={3} className="py-2.5 pr-3 text-right">
                          Income
                        </td>
                        <td className="py-2.5 text-right">{money(reports.incomeExpense.totalIncome)}</td>
                      </tr>
                      <tr className="font-semibold text-ink">
                        <td colSpan={3} className="py-2.5 pr-3 text-right">
                          Expense
                        </td>
                        <td className="py-2.5 text-right">{money(reports.incomeExpense.totalExpense)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Balance sheet */}
              <Card
                title="Balance Sheet"
                action={
                  <Pill tone={reports.balanceSheet.balanced ? "success" : "alert"}>
                    Assets {money(reports.balanceSheet.totalAssets)} = Liabilities + Equity{" "}
                    {money(reports.balanceSheet.totalLiabilitiesEquity)}
                  </Pill>
                }
              >
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-[13px] font-semibold text-ink mb-2">Assets</h4>
                    {reports.balanceSheet.assets.map((row) => (
                      <div
                        key={row.code}
                        className="flex justify-between py-1.5 border-b border-slate-100 text-[13px]"
                      >
                        <span>
                          {row.name} <span className="text-slate-text/60 font-mono">{row.code}</span>
                        </span>
                        <span>{money(row.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-semibold text-ink text-[13px]">
                      <span>Total Assets</span>
                      <span>{money(reports.balanceSheet.totalAssets)}</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[13px] font-semibold text-ink mb-2">Liabilities & Equity</h4>
                    {reports.balanceSheet.liabilities.map((row) => (
                      <div
                        key={row.code}
                        className="flex justify-between py-1.5 border-b border-slate-100 text-[13px]"
                      >
                        <span>
                          {row.name} <span className="text-slate-text/60 font-mono">{row.code}</span>
                        </span>
                        <span>{money(row.amount)}</span>
                      </div>
                    ))}
                    {reports.balanceSheet.equity.map((row) => (
                      <div
                        key={row.code}
                        className="flex justify-between py-1.5 border-b border-slate-100 text-[13px]"
                      >
                        <span>
                          {row.name} <span className="text-slate-text/60 font-mono">{row.code}</span>
                        </span>
                        <span>{money(row.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-1.5 border-b border-slate-100 text-[13px]">
                      <span>Retained Earnings</span>
                      <span>{money(reports.balanceSheet.retainedEarnings)}</span>
                    </div>
                    <div className="flex justify-between py-2 font-semibold text-ink text-[13px]">
                      <span>Total</span>
                      <span>{money(reports.balanceSheet.totalLiabilitiesEquity)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ========== NEW JOURNAL ENTRY MODAL ========== */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowEntryModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">New Journal Entry</h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Every line posts to exactly one side; total debits must equal total credits.
                </p>
              </div>
              <button
                onClick={() => setShowEntryModal(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Date *</label>
                  <Input
                    type="date"
                    value={entryForm.date}
                    onChange={(e) => setEntryForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Memo</label>
                  <Input
                    placeholder="e.g. Electricity bill — May"
                    value={entryForm.memo}
                    onChange={(e) => setEntryForm((f) => ({ ...f, memo: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Lines *</label>
                <div className="space-y-2">
                  {entryForm.lines.map((line, index) => (
                    <div key={index} className="grid grid-cols-[1fr_120px_120px_36px] gap-2 items-center">
                      <Select
                        value={line.accountCode}
                        onChange={(e) => updateLine(index, { accountCode: e.target.value })}
                      >
                        <option value="">Select account…</option>
                        {accounts
                          .filter((a) => a.active !== false)
                          .map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.code} — {a.name}
                            </option>
                          ))}
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Debit"
                        value={line.debit}
                        onChange={(e) =>
                          updateLine(index, { debit: e.target.value, credit: e.target.value ? "" : line.credit })
                        }
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Credit"
                        value={line.credit}
                        onChange={(e) =>
                          updateLine(index, { credit: e.target.value, debit: e.target.value ? "" : line.debit })
                        }
                      />
                      <button
                        onClick={() =>
                          setEntryForm((f) => ({
                            ...f,
                            lines: f.lines.filter((_, i) => i !== index),
                          }))
                        }
                        className="p-2 rounded-lg hover:bg-alert/10 text-alert"
                        disabled={entryForm.lines.length <= 2}
                        title={entryForm.lines.length <= 2 ? "An entry needs at least two lines" : "Remove line"}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setEntryForm((f) => ({ ...f, lines: [...f.lines, blankLine()] }))}
                  className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
                >
                  <Plus size={14} /> Add line
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-[13px]">
                <div className="flex gap-4">
                  <span className="text-slate-text/70">
                    Debit: <strong className="text-ink">{money(totals.debit)}</strong>
                  </span>
                  <span className="text-slate-text/70">
                    Credit: <strong className="text-ink">{money(totals.credit)}</strong>
                  </span>
                </div>
                <Pill tone={totals.balanced ? "success" : "alert"}>
                  {totals.balanced ? "Balanced" : "Not balanced"}
                </Pill>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEntryModal(false)}>
                Cancel
              </Button>
              <Button onClick={submitEntry} disabled={!totals.balanced}>
                <BookOpen size={15} /> Post entry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========== ADD / EDIT ACCOUNT MODAL ========== */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowAccountModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-display font-semibold text-ink text-[17px]">
                {editAccountId ? "Edit Account" : "Add Account"}
              </h3>
              <button
                onClick={() => setShowAccountModal(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Code *</label>
                <Input
                  placeholder="e.g. 5200"
                  value={accountForm.code}
                  onChange={(e) => setAccountForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Name *</label>
                <Input
                  placeholder="e.g. Electricity Expense"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Type *</label>
                <Select
                  value={accountForm.type}
                  onChange={(e) => setAccountForm((f) => ({ ...f, type: e.target.value }))}
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAccountModal(false)}>
                Cancel
              </Button>
              <Button onClick={submitAccount}>{editAccountId ? "Save" : "Create"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
