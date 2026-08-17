import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import API_BASE from "../../../api";

type InventoryItem = {
  name: string;
};


export function BulkInventorySelectionPermissions({
  userIds,
  onApply,
  onCancel,
}: {
  userIds: string[];
  onApply: (orderIds: string[]) => Promise<void>;
  onCancel: () => void;
})
 {
const [items, setItems] = useState<InventoryItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

/* ---------------- FETCH INVENTORY ---------------- */
useEffect(() => {
  const fetchInventory = async () => {
    const res = await axios.get(`${API_BASE}/inventory`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    setItems(
      (res.data.data || []).map((i: any) => ({
        name: i.name,
      }))
    );
  };

  fetchInventory();
}, []);



  /* ---------------- TOGGLE SINGLE ---------------- */
const toggleItem = (name: string) => {
  setSelected((prev) => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });
};


  /* ---------------- SAVE ---------------- */
const save = async () => {
  setSaving(true);
  await onApply(Array.from(selected));
  setSaving(false);
};




  /* ---------------- SEARCH ---------------- */
const filtered = useMemo(() => {
  return items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );
}, [items, search]);


  /* ---------------- PAGINATION ---------------- */
  const totalPages = Math.ceil(filtered.length / pageSize);
  const start = (page - 1) * pageSize;
const paginatedItems = filtered.slice(start, start + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  /* ---------------- SELECT ALL (VISIBLE PAGE ONLY) ---------------- */
const allVisibleSelected =
  paginatedItems.length > 0 &&
  paginatedItems.every((i) => selected.has(i.name));


const toggleAllVisible = () => {
  setSelected((prev) => {
    const next = new Set(prev);

    paginatedItems.forEach((i) => {
      allVisibleSelected
        ? next.delete(i.name)
        : next.add(i.name);
    });

    return next;
  });
};


  /* ---------------- UI ---------------- */
  return (
    <div className="bg-white border rounded-xl shadow-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            Bulk Inventory Selection 
          </h3>
          <p className="text-sm text-slate-500">
            Manage user Inventory Bulk  permissions
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full 
                md:w-auto md:flex-row md:items-center">
          <input
            type="text"
            placeholder="Search Inventory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-3 py-2 text-sm border rounded-lg"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>

         <button
  onClick={save}
  disabled={saving || selected.size === 0}
  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg disabled:opacity-60"
>
  {saving ? "Applying..." : `Apply to ${userIds.length} Users`}
</button>

<button
  onClick={onCancel}
  className="px-4 py-2 text-sm font-medium border rounded-lg"
>
  Cancel
</button>


          <button
  onClick={toggleAllVisible}
  className={`px-4 py-2 text-sm font-medium rounded-lg border transition
    ${
      allVisibleSelected
      ? "bg-red-600 text-white border border-red-700 hover:bg-red-700"
: "bg-blue-600 text-white border border-blue-700 hover:bg-blue-700"    }
  `}
>
  {allVisibleSelected ? "Unselect All" : "Select All"}
</button>
        </div>
      </div>

      {/* List */}
      <div className="border rounded-lg divide-y">
     {paginatedItems.map((i) => {
  const active = selected.has(i.name);

  return (
    <div
      key={i.name}
      className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
    >
      <span className="text-sm text-slate-700">
        {i.name}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={active}
        onClick={() => toggleItem(i.name)}
        className={`relative h-6 w-11 rounded-full border transition
          ${
            active
              ? "bg-blue-600 border-blue-600"
              : "bg-white border-slate-400"
          }`}
      >
        <span
          className={`absolute left-1 top-1/2 h-5 w-5 -translate-y-1/2
            rounded-full bg-white transition
            ${active ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
})}

{paginatedItems.length === 0 && (
  <div className="py-6 text-center text-sm text-slate-400">
    No inventory items found
  </div>
)}

      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          Page {page} of {totalPages || 1}
        </span>

        <div className="flex gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Prev
          </button>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <div className="text-sm text-slate-600">
        Selected Inventory: <span className="font-medium">{selected.size}</span>
      </div>
    </div>
  );
}
