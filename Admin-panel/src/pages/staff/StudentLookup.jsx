import { useState } from "react";
import { Search, UserRound, MapPin, Phone, UserCheck } from "lucide-react";
import { PageIntro, Card, Input, Pill, toast } from "../../components/UI";
import { api } from "../../lib/api";

export default function StudentLookup() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const run = () => {
    if (!query.trim()) return;
    setLoading(true);
    api.students
      .list(`q=${encodeURIComponent(query.trim())}&limit=30`)
      .then(({ data }) => {
        setResults(data || []);
        setSearched(true);
      })
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Reception Workspace"
        title="Student Lookup"
        description="Find a student by name or admission number."
      />

      <Card>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="Name or admission number…"
              className="pl-9 w-full"
            />
          </div>
          <button
            onClick={run}
            className="px-4 py-2.5 rounded-lg bg-ink text-white text-[13px] font-semibold hover:bg-ink-light"
          >
            Search
          </button>
        </div>
      </Card>

      {loading ? (
        <p className="text-[13px] text-slate-text py-10 text-center">Searching…</p>
      ) : searched && results.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <UserRound size={40} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[15px] font-semibold text-ink">No students found</p>
            <p className="text-[13px] text-slate-text/70 mt-1">Try a different name or admission number.</p>
          </div>
        </Card>
      ) : results.length > 0 ? (
        <Card title={`${results.length} result${results.length === 1 ? "" : "s"}`}>
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">Student</th>
                  <th className="px-3 py-2 font-semibold">Admission No</th>
                  <th className="px-3 py-2 font-semibold">Class</th>
                  <th className="px-3 py-2 font-semibold">Parent</th>
                  <th className="px-3 py-2 font-semibold">Contact</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((s) => (
                  <tr key={s._id} className="border-t border-black/[0.06]">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-paper flex items-center justify-center text-slate-text shrink-0">
                          <UserCheck size={15} />
                        </div>
                        <p className="font-semibold text-ink">{s.name}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-text/80">{s.admissionNo}</td>
                    <td className="px-3 py-2.5">
                      Class {s.class || "—"}
                      {s.section ? `-${s.section}` : ""}
                    </td>
                    <td className="px-3 py-2.5">{s.parentName || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-text/80">{s.parentContact || "—"}</td>
                    <td className="px-3 py-2.5">
                      <Pill tone={s.status === "Active" ? "success" : "neutral"}>{s.status || "—"}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}