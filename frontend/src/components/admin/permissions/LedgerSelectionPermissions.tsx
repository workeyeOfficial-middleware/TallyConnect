
import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import API_BASE from "../../../api";

type LedgerItem = {
  ledger_guid: string;
  name: string;
   email?: string;
  phone?: string;
};

export function LedgerSelectionPermissions({
  user,
  onDone,
}: {
  user: any;
  onDone: () => void;
}) {
  const [ledgers, setLedgers] = useState<LedgerItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
const [dirty, setDirty] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* ---------------- FETCH LEDGERS ---------------- */
  useEffect(() => {
    const fetchLedgers = async () => {
      const res = await axios.get(`${API_BASE}/ledger`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const formatted: LedgerItem[] = (res.data.data || []).map(
        (l: any) => ({
          ledger_guid: l.ledger_guid,
          name: l.name,
             email: l.email,      
    phone: l.phone,
        })
      );

      setLedgers(formatted);
    };

    fetchLedgers();
  }, []);

  /* ---------------- FETCH USER LEDGERS ---------------- */
  useEffect(() => {
    const fetchUserLedgers = async () => {
      const res = await fetch(
          `${API_BASE}/users/${user.id}/ledgers`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!res.ok) {
        setSelected(new Set());
        return;
      }

      const data = await res.json();

      // map backend ledger_name → ledger_guid
const selectedIds = ledgers
  .filter((l) =>
    data.some(
      (d: any) => d.ledger_guid === l.ledger_guid
    )
  )
  .map((l) => l.ledger_guid);


      setSelected(new Set(selectedIds));
    };

    if (ledgers.length) fetchUserLedgers();
  }, [user.id, ledgers]);

  /* ---------------- TOGGLE SINGLE ---------------- */
const toggleLedger = (ledgerGuid: string) => {
  setSelected((prev) => {
    const next = new Set(prev);

    next.has(ledgerGuid)
      ? next.delete(ledgerGuid)
      : next.add(ledgerGuid);

    setDirty(true);
    return next;
  });
};



  /* ---------------- SAVE ---------------- */
const save = async () => {
  setSaving(true);

  await fetch(`${API_BASE}/ledger/user-ledgers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({
      userId: user.id,
      ledgers: Array.from(selected),
    }),
  });

  setSaving(false);
  setDirty(false); // ✅ hide Save button
  onDone();
};

  /* ---------------- SEARCH ---------------- */
 const filtered = useMemo(() => {
  return ledgers.filter((l) =>
    `${l.name} ${l.email ?? ""} ${l.phone ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
}, [ledgers, search]);


  /* ---------------- PAGINATION ---------------- */
  const totalPages = Math.ceil(filtered.length / pageSize);
  const start = (page - 1) * pageSize;
  const paginatedLedgers = filtered.slice(start, start + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  /* ---------------- SELECT ALL (VISIBLE PAGE ONLY) ---------------- */
  const allVisibleSelected =
    paginatedLedgers.length > 0 &&
    paginatedLedgers.every((l) =>
      selected.has(l.ledger_guid)
    );

const toggleAllVisible = () => {
  setSelected((prev) => {
    const next = new Set(prev);

    paginatedLedgers.forEach((l) => {
      allVisibleSelected
        ? next.delete(l.ledger_guid)
        : next.add(l.ledger_guid);
    });

    setDirty(true);
    return next;
  });
};





  /* ---------------- UI ---------------- */
  return (

 


    <div className="bg-white border rounded-xl shadow-sm 
                p-4 sm:p-6 
                space-y-5 
                w-full 
                max-w-6xl 
                mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row 
                lg:items-center 
                lg:justify-between 
                gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            Ledger Access
          </h3>
          <p className="text-sm text-slate-500">
            Manage user ledger permissions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search ledgers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 
           px-4 py-2 
           text-sm border rounded-lg 
           focus:ring-2 focus:ring-green-500"
          />

          <select
            value={pageSize}
            onChange={(e) =>
              setPageSize(Number(e.target.value))
            }
            className="px-3 py-2 text-sm border rounded-lg"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>

          {dirty && (
  <button
    onClick={save}
    disabled={saving}
    className="px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg"
  >
    {saving ? "Saving..." : "Save"}
  </button>
)}


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
        {paginatedLedgers.map((l) => {
          const active = selected.has(l.ledger_guid);

          return (
            <div
              key={l.ledger_guid}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
            >
              <div className="flex flex-col">
  <span
    className={`text-sm ${
      active
        ? "font-medium text-green-700"
        : "text-slate-700"
    }`}
  >
    {l.name}
  </span>

  <span className="text-xs text-slate-500">
    📧 {l.email || "N/A"} | 📞 {l.phone || "N/A"}
  </span>
</div>


              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={active}
                onClick={() =>
                  toggleLedger(l.ledger_guid)
                }
                className={`relative h-6 w-11 flex-shrink-0 rounded-full border transition
                  ${
                    active
                      ? "bg-green-600 border-green-600"
                      : "bg-white border-slate-400"
                  }`}
              >
                <span
                  className={`absolute left-1 top-1/2 h-5 w-5 -translate-y-1/2
                    rounded-full bg-white shadow transition
                    ${
                      active
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                />
              </button>
            </div>
          );
        })}

        {paginatedLedgers.length === 0 && (
          <div className="py-6 text-center text-sm text-slate-400">
            No ledgers found
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
        Selected Ledgers:{" "}
        <span className="font-medium">
          {selected.size}
        </span>
      </div>
    </div>
  );
}
