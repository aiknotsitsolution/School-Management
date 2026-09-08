import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  BookOpen,
  LibraryBig,
  X,
  Save,
  Search,
  Pencil,
  Trash2,
  BookPlus,
  RotateCcw,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Select,
  Pill,
  StatCard,
  toast,
} from "../components/UI";
import { api } from "../lib/api";
const seed = [];
const seedIssues = [];

const CATEGORIES = [
  "Textbook",
  "Fiction",
  "Finance",
  "Biography",
  "History",
  "Self-Help",
  "Science",
  "Reference",
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function inDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function nextId(list, prefix) {
  const max = list.reduce((m, it) => {
    const num = parseInt(String(it.id).replace(/\D/g, ""), 10);
    return Number.isFinite(num) && num > m ? num : m;
  }, 0);
  return `${prefix}${max + 1}`;
}

function emptyBookForm() {
  return {
    title: "",
    author: "",
    isbn: "",
    category: "Fiction",
    copies: 1,
    addedOn: todayISO(),
  };
}

function normalizeBook(book) {
  return {
    ...book,
    id: book._id || book.id,
    copies: Number(book.totalCopies ?? book.copies ?? 0),
    available: Number(book.availableCopies ?? book.available ?? 0),
  };
}

function normalizeIssue(issue) {
  const book =
    issue.bookId && typeof issue.bookId === "object" ? issue.bookId : {};
  return {
    ...issue,
    id: issue._id || issue.id,
    bookId: book._id || issue.bookId,
    title: book.title || issue.title || "Unknown book",
    borrower: issue.borrower || issue.borrowerId || "Unknown borrower",
    borrowerId: issue.borrowerId || "—",
    dueOn: issue.dueDate || issue.dueOn,
    issuedOn: issue.issueDate || issue.issuedOn,
  };
}

export default function Library() {
  const [books, setBooks] = useState(seed);
  const [issues, setIssues] = useState(seedIssues);
  useEffect(() => {
    Promise.all([api.books.list(), api.issues.list()])
      .then(([bookResponse, issueResponse]) => {
        setBooks((bookResponse.data || []).map(normalizeBook));
        setIssues((issueResponse.data || []).map(normalizeIssue));
      })
      .catch(() => {});
  }, []);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [tab, setTab] = useState("books");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyBookForm());
  const [editId, setEditId] = useState(null);
  // issue book
  const [issueModal, setIssueModal] = useState(false);
  const [issueForm, setIssueForm] = useState({
    bookId: books[0]?.id || "",
    borrower: "",
    borrowerId: "",
    studentClass: "",
    dueOn: inDays(14),
  });

  const cats = useMemo(
    () => ["All", ...new Set(books.map((b) => b.category))],
    [books],
  );

  const filteredBooks = useMemo(() => {
    const q = query.toLowerCase();
    return books.filter((b) => {
      const matchCat = catFilter === "All" || b.category === catFilter;
      const matchQuery =
        !q ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        (b.isbn || "").toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [books, query, catFilter]);

  const filteredIssues = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return issues;
    return issues.filter(
      (i) =>
        i.borrower.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        i.borrowerId.toLowerCase().includes(q),
    );
  }, [issues, query]);

  const stats = useMemo(() => {
    const totalTitles = books.length;
    const totalCopies = books.reduce((a, b) => a + b.copies, 0);
    const avail = books.reduce((a, b) => a + (b.available ?? 0), 0);
    const issued = issues.filter((i) => i.status === "Issued").length;
    const overdue = issues.filter((i) => i.status === "Overdue").length;
    return { totalTitles, totalCopies, avail, issued, overdue };
  }, [books, issues]);

  const openAddBook = () => {
    setEditId(null);
    setForm(emptyBookForm());
    setShowModal(true);
  };
  const openEditBook = (b) => {
    setEditId(b.id);
    setForm({ ...b });
    setShowModal(true);
  };
  const saveBook = async () => {
    if (!form.title.trim() || !form.author.trim()) return;
    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      isbn: form.isbn,
      category: form.category,
      totalCopies: Number(form.copies) || 1,
      availableCopies: editId ? form.available : Number(form.copies) || 1,
      addedOn: form.addedOn,
    };
    try {
      const response = editId
        ? await api.books.update(editId, payload)
        : await api.books.create(payload);
      const savedBook = normalizeBook(response.data);
      setBooks((prev) =>
        editId
          ? prev.map((book) => (book.id === editId ? savedBook : book))
          : [savedBook, ...prev],
      );
      setShowModal(false);
      setForm(emptyBookForm());
      setEditId(null);
      toast(editId ? "Book updated" : "Book added to library");
    } catch (requestError) {
      toast(requestError.message, "error");
    }
  };
  const deleteBook = async (id) => {
    try {
      await api.books.remove(id);
      setBooks((prev) => prev.filter((book) => book.id !== id));
      toast("Book deleted", "error");
    } catch (requestError) {
      toast(requestError.message, "error");
    }
  };

  const issueBook = async () => {
    const book = books.find((b) => b.id === issueForm.bookId);
    if (!book || !issueForm.borrower.trim()) return;
    const currentAvail = book.available ?? book.copies;
    if (currentAvail <= 0) {
      toast("No available copies", "error");
      return;
    }
    try {
      const response = await api.issues.issue({
        bookId: book.id,
        borrowerId: issueForm.borrowerId || issueForm.borrower.trim(),
        borrowerType: "student",
        dueDate: issueForm.dueOn,
      });
      setBooks((prev) =>
        prev.map((entry) =>
          entry.id === book.id
            ? { ...entry, available: entry.available - 1 }
            : entry,
        ),
      );
      setIssues((prev) => [
        normalizeIssue({ ...response.data, bookId: book }),
        ...prev,
      ]);
      setIssueModal(false);
      setIssueForm({
        bookId: books[0]?.id || "",
        borrower: "",
        borrowerId: "",
        studentClass: "",
        dueOn: inDays(14),
      });
      toast("Book issued successfully");
    } catch (requestError) {
      toast(requestError.message, "error");
    }
  };

  const returnBook = async (id) => {
    const issue = issues.find((i) => i.id === id);
    try {
      await api.issues.return(id);
      setBooks((prev) =>
        prev.map((book) =>
          book.id === issue?.bookId
            ? { ...book, available: book.available + 1 }
            : book,
        ),
      );
      setIssues((prev) =>
        prev.map((entry) =>
          entry.id === id ? { ...entry, status: "Returned" } : entry,
        ),
      );
      toast("Book returned", "info");
    } catch (requestError) {
      toast(requestError.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Library Management"
        description="Catalogue, issue and manage library books and borrowers."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={LibraryBig}
          label="Total Titles"
          value={String(stats.totalTitles)}
          sub={`${stats.totalCopies} total copies`}
          accent="amber"
        />
        <StatCard
          icon={BookOpen}
          label="Available"
          value={String(stats.avail)}
          sub="Ready to issue"
          accent="success"
        />
        <StatCard
          icon={BookPlus}
          label="Issued"
          value={String(stats.issued)}
          sub="Currently with students"
          accent="info"
        />
        <StatCard
          icon={RotateCcw}
          label="Overdue"
          value={String(stats.overdue)}
          sub="Needs return follow-up"
          accent="alert"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {[
            { key: "books", label: "Books Catalogue" },
            { key: "issues", label: "Issued / Returns" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${
                tab === t.key
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-slate-text border-black/10 hover:border-ink/30"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "books" ? (
          <Button variant="amber" onClick={openAddBook}>
            <Plus size={15} /> Add Book
          </Button>
        ) : (
          <Button variant="amber" onClick={() => setIssueModal(true)}>
            <BookPlus size={15} /> Issue Book
          </Button>
        )}
      </div>

      <Card
        title={tab === "books" ? "Books Catalogue" : "Issued / Returns"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
              />
              <Input
                placeholder={
                  tab === "books"
                    ? "Search title, author..."
                    : "Search borrower..."
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 w-56"
              />
            </div>
            {tab === "books" && (
              <Select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="min-w-[140px]"
              >
                {cats.map((c) => (
                  <option key={c} value={c}>
                    {c === "All" ? "All Categories" : c}
                  </option>
                ))}
              </Select>
            )}
          </div>
        }
      >
        {tab === "books" ? (
          filteredBooks.length === 0 ? (
            <EmptyState
              icon={LibraryBig}
              text="No books found"
              action={openAddBook}
              actionLabel="Add Book"
            />
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                    <th className="px-5 py-2.5 font-semibold">Book</th>
                    <th className="px-5 py-2.5 font-semibold">ISBN</th>
                    <th className="px-5 py-2.5 font-semibold">Category</th>
                    <th className="px-5 py-2.5 font-semibold">Copies</th>
                    <th className="px-5 py-2.5 font-semibold">Available</th>
                    <th className="px-5 py-2.5 font-semibold">Status</th>
                    <th className="px-5 py-2.5 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {filteredBooks.map((b) => {
                    const lowAvail = (b.available ?? b.copies) <= 1;
                    return (
                      <tr
                        key={b.id}
                        className="border-b border-black/[0.04] hover:bg-paper/60"
                      >
                        <td className="px-5 py-3">
                          <p className="font-semibold text-ink">{b.title}</p>
                          <p className="text-[11.5px] text-slate-text/50">
                            by {b.author} · {b.id}
                          </p>
                        </td>
                        <td className="px-5 py-3 font-mono text-[12px] text-slate-text">
                          {b.isbn}
                        </td>
                        <td className="px-5 py-3 text-slate-text">
                          {b.category}
                        </td>
                        <td className="px-5 py-3 text-slate-text">
                          {b.copies}
                        </td>
                        <td className="px-5 py-3 text-slate-text">
                          {b.available ?? b.copies}
                        </td>
                        <td className="px-5 py-3">
                          <Pill tone={lowAvail ? "alert" : "success"}>
                            {lowAvail ? "Low / Out" : "In Stock"}
                          </Pill>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditBook(b)}
                              className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-info transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => deleteBook(b.id)}
                              className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-alert transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : filteredIssues.length === 0 ? (
          <EmptyState
            icon={BookPlus}
            text="No books currently issued"
            action={() => setIssueModal(true)}
            actionLabel="Issue Book"
          />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                  <th className="px-5 py-2.5 font-semibold">Book</th>
                  <th className="px-5 py-2.5 font-semibold">Borrower</th>
                  <th className="px-5 py-2.5 font-semibold">Class</th>
                  <th className="px-5 py-2.5 font-semibold">Issued</th>
                  <th className="px-5 py-2.5 font-semibold">Due</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {filteredIssues.map((i) => (
                  <tr
                    key={i.id}
                    className="border-b border-black/[0.04] hover:bg-paper/60"
                  >
                    <td className="px-5 py-3 font-medium text-ink">
                      {i.title}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-ink font-medium">{i.borrower}</p>
                      <p className="text-[11px] text-slate-text/50 font-mono">
                        {i.borrowerId}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-slate-text">
                      {i.studentClass}
                    </td>
                    <td className="px-5 py-3 text-slate-text">{i.issuedOn}</td>
                    <td className="px-5 py-3 text-slate-text">{i.dueOn}</td>
                    <td className="px-5 py-3">
                      <Pill tone={i.status === "Overdue" ? "alert" : "info"}>
                        {i.status}
                      </Pill>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => returnBook(i.id)}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-success hover:underline"
                        title="Return book"
                      >
                        <RotateCcw size={13} /> Return
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ADD/EDIT BOOK MODAL */}
      {showModal && (
        <BaseModal
          title={editId ? "Edit Book" : "Add Book"}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="amber"
                onClick={saveBook}
                disabled={!form.title.trim() || !form.author.trim()}
              >
                <Save size={15} /> {editId ? "Update" : "Add"} Book
              </Button>
            </>
          }
        >
          <Field label="Title *">
            <Input
              placeholder="Book title"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Author *">
              <Input
                value={form.author}
                onChange={(e) =>
                  setForm((f) => ({ ...f, author: e.target.value }))
                }
              />
            </Field>
            <Field label="ISBN">
              <Input
                value={form.isbn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isbn: e.target.value }))
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Copies">
              <Input
                type="number"
                min={1}
                value={form.copies}
                onChange={(e) =>
                  setForm((f) => ({ ...f, copies: Number(e.target.value) }))
                }
              />
            </Field>
          </div>
        </BaseModal>
      )}

      {/* ISSUE BOOK MODAL */}
      {issueModal && (
        <BaseModal
          title="Issue Book"
          onClose={() => setIssueModal(false)}
          footer={
            <>
              <Button variant="outline" onClick={() => setIssueModal(false)}>
                Cancel
              </Button>
              <Button
                variant="amber"
                onClick={issueBook}
                disabled={!issueForm.borrower.trim()}
              >
                <BookPlus size={15} /> Issue
              </Button>
            </>
          }
        >
          <Field label="Book">
            <Select
              value={issueForm.bookId}
              onChange={(e) =>
                setIssueForm((f) => ({ ...f, bookId: e.target.value }))
              }
            >
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} ({b.id})
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Borrower Name *">
              <Input
                value={issueForm.borrower}
                onChange={(e) =>
                  setIssueForm((f) => ({ ...f, borrower: e.target.value }))
                }
              />
            </Field>
            <Field label="Student ID">
              <Input
                value={issueForm.borrowerId}
                onChange={(e) =>
                  setIssueForm((f) => ({ ...f, borrowerId: e.target.value }))
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Class">
              <Input
                value={issueForm.studentClass}
                onChange={(e) =>
                  setIssueForm((f) => ({ ...f, studentClass: e.target.value }))
                }
              />
            </Field>
            <Field label="Due Date">
              <Input
                type="date"
                value={issueForm.dueOn}
                onChange={(e) =>
                  setIssueForm((f) => ({ ...f, dueOn: e.target.value }))
                }
              />
            </Field>
          </div>
        </BaseModal>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[12px] font-semibold text-ink mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}

function BaseModal({ title, onClose, footer, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
          <h3 className="font-display font-semibold text-ink text-[17px]">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-paper text-slate-text"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
        <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
          {footer}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text, action, actionLabel }) {
  return (
    <div className="py-14 text-center">
      <Icon size={36} className="mx-auto text-slate-text/30 mb-3" />
      <p className="text-[14px] font-medium text-ink">{text}</p>
      <p className="text-[13px] text-slate-text/60 mt-1">
        Adjust filters or add a new entry.
      </p>
      {action && (
        <Button variant="amber" className="mt-4" onClick={action}>
          <Plus size={15} /> {actionLabel}
        </Button>
      )}
    </div>
  );
}
