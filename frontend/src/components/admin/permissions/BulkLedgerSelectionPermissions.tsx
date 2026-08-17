import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import API_BASE from "../../../api";

type LedgerItem = {
  ledger_guid: string;
  name: string;
  email?: string;
  phone?: string;
};

type Props = {
  userIds: string[];
  onApply: (ledgerIds: string[]) => void;
  onCancel: () => void;
};

export function BulkLedgerSelectionPermissions({
  userIds,
  onApply,
  onCancel,
}: Props) {
  const [ledgers, setLedgers] = useState<LedgerItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* ---------------- FETCH LEDGERS (SAME AS SINGLE USER) ---------------- */
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

  /* ---------------- TOGGLE ---------------- */
  const toggleLedger = (ledgerGuid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(ledgerGuid)
        ? next.delete(ledgerGuid)
        : next.add(ledgerGuid);
      return next;
    });
  };

  /* ---------------- SAVE (BULK APPLY) ---------------- */
  const save = async () => {
    try {
      setSaving(true);

      const selectedLedgerIds = Array.from(selected);

      await onApply(selectedLedgerIds);
    } finally {
      setSaving(false);
    }
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

  /* ---------------- UI ---------------- */
  return (
    <div className="bg-white border rounded-xl shadow-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
             Bulk Ledger  Selection 
          </h3>
          <p className="text-sm text-slate-500">
            Assign ledgers to {userIds.length} users
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full 
                md:w-auto md:flex-row md:items-center">
          <input
            type="text"
            placeholder="Search ledgers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 text-sm border rounded-lg"
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
          
        </div>
      </div>

      {/* Ledger List (SAME UI) */}
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
                      ? "font-medium text-blue-700"
                      : "text-slate-700"
                  }`}
                >
                  {l.name}
                </span>

                <span className="text-xs text-slate-500">
                  📧 {l.email || "N/A"} | 📞 {l.phone || "N/A"}
                </span>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={active}
                onClick={() => toggleLedger(l.ledger_guid)}
                className={`relative h-6 w-11 flex-shrink-0 rounded-full border transition
                  ${
                    active
                      ? "bg-blue-600 border-blue-600"
                      : "bg-white border-slate-400"
                  }`}
              >
                <span
                  className={`absolute left-1 top-1/2 h-5 w-5 -translate-y-1/2
                    rounded-full bg-white shadow transition
                    ${
                      active ? "translate-x-5" : "translate-x-0"
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

      {/* Footer */}
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
