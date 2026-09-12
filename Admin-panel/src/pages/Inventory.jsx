import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  Plus,
  Boxes,
  AlertTriangle,
  PackageCheck,
  X,
  Save,
  Search,
  Pencil,
  Trash2,
  Minus,
  ArrowUpRight,
  PackagePlus,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Select,
  Pill,
  StatCard,
} from "../components/UI";
const initialInventory = [];

const CATEGORIES = [
  "Books",
  "Lab Equipment",
  "Sports",
  "Stationery",
  "IT Equipment",
  "Medical",
  "Furniture",
  "Other",
];
const UNITS = ["Pieces", "Sets", "Boxes", "Units", "Reams", "Kits", "Pairs"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm() {
  const n = initialInventory.length + 1;
  return {
    item: "",
    category: "Stationery",
    stock: 10,
    reorderLevel: 5,
    unit: "Pieces",
    lastRestocked: todayISO(),
    id: `INV${String(n).padStart(3, "0")}`,
  };
}

function normalizeItem(item) {
  return {
    ...item,
    id: item._id || item.id,
    item: item.itemName || item.item || "Unnamed item",
    stock: Number(item.quantity ?? item.stock ?? 0),
    reorderLevel: Number(item.reorderLevel ?? 0),
    lastRestocked: item.purchaseDate || item.lastRestocked || todayISO(),
  };
}

function nextId(current) {
  const max = current.reduce((m, i) => {
    const num = parseInt(i.id.replace(/\D/g, ""), 10);
    return Number.isFinite(num) && num > m ? num : m;
  }, 0);
  return `INV${String(max + 1).padStart(3, "0")}`;
}

export default function Inventory() {
  const [items, setItems] = useState(initialInventory);
  useEffect(() => {
    api.inventory
      .list()
      .then(({ data }) => setItems((data || []).map(normalizeItem)))
      .catch(() => {});
  }, []);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);

  const cats = useMemo(
    () => ["All", ...new Set(items.map((i) => i.category))],
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((i) => {
      const matchCat =
        categoryFilter === "All" || i.category === categoryFilter;
      const matchQuery =
        !q ||
        i.item.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [items, query, categoryFilter]);

  const stats = useMemo(() => {
    const low = items.filter((i) => i.stock < i.reorderLevel);
    const totalUnits = items.reduce((a, i) => a + i.stock, 0);
    return {
      total: items.length,
      low: low.length,
      categories: new Set(items.map((i) => i.category)).size,
      units: totalUnits,
    };
  }, [items]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (i) => {
    setEditId(i.id);
    setForm({
      item: i.item,
      category: i.category,
      stock: i.stock,
      reorderLevel: i.reorderLevel,
      unit: i.unit,
      lastRestocked: i.lastRestocked,
      id: i.id,
    });
    setShowModal(true);
  };

  const updateForm = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.item.trim()) return;
    const payload = {
      itemName: form.item.trim(),
      category: form.category,
      quantity: Number(form.stock) || 0,
      reorderLevel: Number(form.reorderLevel) || 0,
      unit: form.unit,
      purchaseDate: form.lastRestocked,
    };
    try {
      const response = editId
        ? await api.inventory.update(editId, payload)
        : await api.inventory.create(payload);
      const savedItem = normalizeItem(response.data);
      setItems((prev) =>
        editId
          ? prev.map((item) => (item.id === editId ? savedItem : item))
          : [...prev, savedItem],
      );
      setShowModal(false);
      setForm(emptyForm());
      setEditId(null);
    } catch (requestError) {
      window.alert(requestError.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.inventory.remove(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (requestError) {
      window.alert(requestError.message);
    }
  };

  const restock = async (id, qty) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    try {
      const response = await api.inventory.update(id, {
        itemName: item.item,
        category: item.category,
        quantity: Math.max(0, item.stock + qty),
        reorderLevel: item.reorderLevel,
        unit: item.unit,
        purchaseDate: todayISO(),
      });
      const updated = normalizeItem(response.data);
      setItems((prev) =>
        prev.map((entry) => (entry.id === id ? updated : entry)),
      );
    } catch (requestError) {
      window.alert(requestError.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Operations"
        title="Inventory Management"
        description="Track school supplies, lab equipment, sports gear and IT assets."
        right={
          <Button variant="amber" onClick={openAdd}>
            <Plus size={15} /> Add Item
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Boxes}
          label="Total Items Tracked"
          value={String(stats.total)}
          sub="All categories"
          accent="amber"
        />
        <StatCard
          icon={AlertTriangle}
          label="Below Reorder Level"
          value={String(stats.low)}
          sub="Needs restocking"
          accent="alert"
        />
        <StatCard
          icon={PackageCheck}
          label="Categories"
          value={String(stats.categories)}
          sub="Active types"
          accent="info"
        />
        <StatCard
          icon={PackagePlus}
          label="Total Units"
          value={String(stats.units)}
          sub="Across all items"
          accent="success"
        />
      </div>

      <Card
        title="Inventory List"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
              />
              <Input
                placeholder="Search item..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 w-48"
              />
            </div>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="min-w-[150px]"
            >
              {cats.map((c) => (
                <option key={c} value={c}>
                  {c === "All" ? "All Categories" : c}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Boxes size={36} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">No items found</p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              Try changing filters or add a new item.
            </p>
            <Button variant="amber" className="mt-4" onClick={openAdd}>
              <Plus size={15} /> Add Item
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                  <th className="px-5 py-2.5 font-semibold">Item</th>
                  <th className="px-5 py-2.5 font-semibold">Category</th>
                  <th className="px-5 py-2.5 font-semibold">Current Stock</th>
                  <th className="px-5 py-2.5 font-semibold">Reorder Level</th>
                  <th className="px-5 py-2.5 font-semibold">Last Restocked</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const lowStock = i.stock < i.reorderLevel;
                  const pct = Math.min(
                    100,
                    Math.round((i.stock / (i.reorderLevel * 2)) * 100),
                  );
                  return (
                    <tr
                      key={i.id}
                      className="border-b border-black/[0.04] hover:bg-paper/60"
                    >
                      <td className="px-5 py-3">
                        <p className="font-semibold text-ink">{i.item}</p>
                        <p className="text-[11.5px] text-slate-text/50 font-mono">
                          {i.id}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-slate-text">
                        {i.category}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${lowStock ? "bg-alert" : "bg-success"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-slate-text text-[12px]">
                            {i.stock} {i.unit}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-text">
                        {i.reorderLevel} {i.unit}
                      </td>
                      <td className="px-5 py-3 text-slate-text whitespace-nowrap">
                        {i.lastRestocked}
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={lowStock ? "alert" : "success"}>
                          {lowStock ? "Reorder Now" : "In Stock"}
                        </Pill>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => restock(i.id, 1)}
                            className="p-1.5 rounded-lg hover:bg-paper text-success hover:text-success transition-colors"
                            title="Add stock"
                          >
                            <ArrowUpRight size={14} />
                          </button>
                          <button
                            onClick={() => restock(i.id, -1)}
                            className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-alert transition-colors"
                            title="Reduce stock"
                          >
                            <Minus size={14} />
                          </button>
                          <button
                            onClick={() => openEdit(i)}
                            className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-info transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(i.id)}
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
        )}
      </Card>

      {/* ========== ADD / EDIT ITEM MODAL ========== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  {editId ? "Edit Item" : "Add Item"}
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  {editId
                    ? "Update item details."
                    : "Add a new inventory item."}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Item Name *
                </label>
                <Input
                  placeholder="e.g. Science Lab — Beakers 250ml"
                  value={form.item}
                  onChange={(e) => updateForm("item", e.target.value)}
                />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Category
                </label>
                <Select
                  value={form.category}
                  onChange={(e) => updateForm("category", e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Stock
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.stock}
                    onChange={(e) =>
                      updateForm("stock", Number(e.target.value))
                    }
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Reorder Level
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.reorderLevel}
                    onChange={(e) =>
                      updateForm("reorderLevel", Number(e.target.value))
                    }
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Unit
                  </label>
                  <Select
                    value={form.unit}
                    onChange={(e) => updateForm("unit", e.target.value)}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Last Restocked
                </label>
                <Input
                  type="date"
                  value={form.lastRestocked}
                  onChange={(e) => updateForm("lastRestocked", e.target.value)}
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-between gap-2">
              <div>
                {editId && (
                  <Button
                    variant="outline"
                    className="text-alert border-alert/30 hover:bg-alert/5"
                    onClick={() => {
                      handleDelete(editId);
                      setShowModal(false);
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="amber"
                  onClick={handleSave}
                  disabled={!form.item.trim()}
                >
                  <Save size={15} /> {editId ? "Update" : "Add"} Item
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
