import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import {
  PageIntro,
  Card,
  Input,
  Button,
  Pill,
  StatCard,
  toast,
} from "../../components/UI";
import { api } from "../../lib/api";
import { isPositiveNumber } from "../../lib/validation.js";
import useStaffContext from "./useStaffContext";

export default function Books() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const refresh = () => {
    setLoading(true);
    api.books
      .list()
      .then(({ data }) => setBooks(data || []))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const list = useMemo(() => {
    const q = search.toLowerCase();
    return (books || []).filter(
      (b) =>
        !q ||
        (b.title || "").toLowerCase().includes(q) ||
        (b.author || "").toLowerCase().includes(q) ||
        (b.isbn || "").toLowerCase().includes(q) ||
        (b.category || "").toLowerCase().includes(q),
    );
  }, [books, search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const copies = Number(fd.get("totalCopies") || 1);
    if (!isPositiveNumber(copies)) {
      toast("Copies must be a positive number", "error");
      return;
    }
    const payload = {
      title: fd.get("title"),
      author: fd.get("author"),
      isbn: fd.get("isbn") || undefined,
      category: fd.get("category") || undefined,
      totalCopies: copies,
    };
    try {
      if (editing) await api.books.update(editing._id, payload);
      else await api.books.create(payload);
      toast(editing ? "Book updated" : "Book added", "success");
      setEditing(null);
      setShowForm(false);
      refresh();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.books.remove(id);
      toast("Book removed", "success");
      refresh();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Librarian Workspace"
        title="Library Catalogue"
        description="Books, copies and availability."
        right={
          !showForm && (
            <Button
              variant="amber"
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              <Plus size={15} /> Add Book
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={null} label="Titles" value={String((books || []).length)} accent="info" />
        <StatCard
          icon={null}
          label="Total Copies"
          value={String((books || []).reduce((s, b) => s + Number(b.totalCopies || 0), 0))}
          accent="amber"
        />
        <StatCard
          icon={null}
          label="Available"
          value={String((books || []).reduce((s, b) => s + Number(b.availableCopies || 0), 0))}
          accent="success"
        />
        <StatCard
          icon={null}
          label="Out of Stock"
          value={String((books || []).filter((b) => Number(b.availableCopies || 0) === 0).length)}
          accent="alert"
        />
      </div>

      {showForm && (
        <Card title={editing ? "Edit Book" : "Add Book"} action={<Pencil size={15} className="text-slate-text/40" />}>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Input name="title" placeholder="Title" defaultValue={editing?.title} required />
            <Input name="author" placeholder="Author" defaultValue={editing?.author} required />
            <Input name="isbn" placeholder="ISBN" defaultValue={editing?.isbn} />
            <Input name="category" placeholder="Category" defaultValue={editing?.category} />
            <Input name="totalCopies" type="number" placeholder="Copies" defaultValue={editing?.totalCopies || 1} required />
            <div className="flex items-end gap-2">
              <Button type="submit">{editing ? "Save Changes" : "Add Book"}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="Books"
        action={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40" />
            <Input placeholder="Search title / author / isbn…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-56" />
          </div>
        }
      >
        {loading ? (
          <p className="text-[13px] text-slate-text py-10 text-center">Loading catalogue…</p>
        ) : list.length === 0 ? (
          <p className="text-[13px] text-slate-text py-10 text-center">No books found.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">Book</th>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 font-semibold">ISBN</th>
                  <th className="px-3 py-2 font-semibold">Copies</th>
                  <th className="px-3 py-2 font-semibold">Available</th>
                  <th className="px-3 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b._id} className="border-t border-black/[0.06] hover:bg-paper/60">
                    <td className="px-5 py-2.5">
                      <p className="font-semibold text-ink">{b.title}</p>
                      <p className="text-[12px] text-slate-text/60">{b.author || "—"}</p>
                    </td>
                    <td className="px-3 py-2.5"><Pill tone="neutral">{b.category || "—"}</Pill></td>
                    <td className="px-3 py-2.5 text-slate-text/80">{b.isbn || "—"}</td>
                    <td className="px-3 py-2.5">{b.totalCopies}</td>
                    <td className="px-3 py-2.5">
                      <Pill tone={Number(b.availableCopies || 0) === 0 ? "alert" : Number(b.availableCopies || 0) < 3 ? "amber" : "success"}>
                        {b.availableCopies || 0}
                      </Pill>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => {
                          setEditing(b);
                          setShowForm(true);
                        }}
                        className="text-info hover:underline text-[12px] font-semibold mr-3"
                      >
                        Edit
                      </button>
                      <button onClick={() => handleDelete(b._id)} className="text-alert hover:underline text-[12px] font-semibold">
                        <Trash2 size={13} className="inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}