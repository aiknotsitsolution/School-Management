import { useEffect, useState } from "react";
import { Download, FileBarChart, CalendarDays, ArrowDown } from "lucide-react";
import { api } from "../../lib/api";
import { Button, Card, Input, PageIntro, Select, toast } from "../../components/UI";

const fmtValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date) return value.toLocaleDateString("en-IN");
  const date = new Date(value);
  if (!Number.isNaN(date.getTime()) && typeof value === "string" && value.includes("T")) {
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  return String(value);
};

const toCsv = (rows) => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(","));
  return lines.join("\n");
};

export default function PlatformReports() {
  const [catalog, setCatalog] = useState([]);
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState(1);
  const [maxRows, setMaxRows] = useState(100);

  useEffect(() => {
    api.platform.reports
      .catalog()
      .then(({ data }) => {
        setCatalog(data || []);
        if (data?.length) setType(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const run = async (nextType = type) => {
    if (!nextType) return;
    setGenerating(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      const { data } = await api.platform.reports.generate(nextType, params.toString());
      setReport(data);
      setSortKey("");
      setSortDir(1);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setGenerating(false);
    }
  };

  let rows = (report?.rows || []).slice();
  if (query.trim()) {
    const needle = query.trim().toLowerCase();
    rows = rows.filter((row) =>
      Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(needle)),
    );
  }
  if (sortKey) {
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av instanceof Date || (typeof av === "string" && !Number.isNaN(new Date(av).getTime()))) {
        return (new Date(av) - new Date(bv)) * sortDir;
      }
      return String(av ?? "").localeCompare(String(bv ?? "")) * sortDir;
    });
  }
  const limitedRows = rows.slice(0, maxRows);
  const columns = report?.columns || [];

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => -d);
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const download = () => {
    const csv = toCsv(limitedRows);
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${report?.meta?.type || "report"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl">
      <PageIntro
        eyebrow="Platform Owner · Insights"
        title="Reports"
        description="Generate reports on demand from live platform data. No fabricated figures — every row comes from schools, users, subscriptions or invoices."
      />

      <div className="grid lg:grid-cols-4 gap-5">
        <Card title="Report catalog" className="lg:col-span-1" bodyClassName="p-3">
          {loading ? (
            <p className="p-3 text-[13px] text-slate-text/70">Loading catalog…</p>
          ) : (
            <div className="space-y-1">
              {catalog.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setType(item.id); setReport(null); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                    type === item.id ? "bg-amber/10 text-ink" : "hover:bg-paper text-slate-text"
                  }`}
                >
                  <p className="text-[13px] font-semibold flex items-center gap-2">
                    <FileBarChart size={14} className={type === item.id ? "text-amber-dark" : "text-slate-text/60"} />
                    {item.title}
                  </p>
                  <p className="text-[11px] text-slate-text/60 mt-0.5 px-6">{item.category}</p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="lg:col-span-3 space-y-5">
          <Card title="Generate" bodyClassName="p-5">
            <div className="flex flex-wrap items-end gap-3">
              <Select
                value={type}
                onChange={(e) => { setType(e.target.value); setReport(null); }}
                className="min-w-[200px]"
              >
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>{item.title}</option>
                ))}
              </Select>
              <label className="text-[12px] font-semibold text-slate-text/70">
                From
                <Input type="date" className="mt-1 block" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="text-[12px] font-semibold text-slate-text/70">
                To
                <Input type="date" className="mt-1 block" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              <Button variant="amber" onClick={() => run()} disabled={generating || !type}>
                <CalendarDays size={15} /> {generating ? "Generating…" : "Generate"}
              </Button>
              {report && (
                <Button variant="outline" onClick={download}>
                  <Download size={15} /> CSV
                </Button>
              )}
            </div>
            {report && (
              <p className="text-[11.5px] text-slate-text/60 mt-3">
                {report.meta.title} · {report.meta.rowCount} rows · generated{" "}
                {new Date(report.meta.generatedAt).toLocaleString("en-IN")}
              </p>
            )}
          </Card>

          {report ? (
            <Card bodyClassName="p-5">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <Input
                  placeholder="Filter rows…"
                  className="max-w-xs"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <Select value={String(maxRows)} onChange={(e) => setMaxRows(Number(e.target.value))} className="w-28">
                  <option value="50">50 rows</option>
                  <option value="100">100 rows</option>
                  <option value="500">500 rows</option>
                  <option value="100000">All</option>
                </Select>
                <span className="text-[12px] text-slate-text/60 ml-auto">
                  showing {limitedRows.length} of {rows.length}
                </span>
              </div>

              {limitedRows.length === 0 ? (
                <p className="text-[13px] text-slate-text/70 py-8 text-center">No rows to display.</p>
              ) : (
                <div className="overflow-x-auto max-h-[520px] overflow-y-auto scrollbar-thin rounded-lg border border-black/[0.06]">
                  <table className="w-full text-left text-[12.5px]">
                    <thead className="sticky top-0 bg-paper">
                      <tr className="border-b border-black/[0.06]">
                        {columns.map((column) => (
                          <th
                            key={column}
                            onClick={() => toggleSort(column)}
                            className="py-2.5 px-3 font-semibold text-slate-text cursor-pointer select-none uppercase tracking-wide text-[11px] whitespace-nowrap hover:text-ink"
                          >
                            <span className="inline-flex items-center gap-1">
                              {column}
                              {sortKey === column && <ArrowDown size={11} className={sortDir === 1 ? "" : "rotate-180"} />}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {limitedRows.map((row, index) => (
                        <tr key={index} className="hover:bg-paper/60">
                          {columns.map((column) => (
                            <td key={column} className="py-2 px-3 text-slate-text whitespace-nowrap">
                              {fmtValue(row[column])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <p className="text-[13px] text-slate-text/70">
                Choose a report from the catalog and press Generate. Results appear here and can be exported to CSV.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}