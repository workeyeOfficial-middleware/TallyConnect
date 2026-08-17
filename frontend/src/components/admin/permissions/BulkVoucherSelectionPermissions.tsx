import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import API_BASE from "../../../api";

type VoucherItem = {
  voucher_guid: string;
  reference_no?: string;
  voucher_type?: string;
  party_name?: string;
  party?: string;
};

export function BulkVoucherSelectionPermissions({
  userIds,
  onApply,
  onCancel,
}: {
  userIds: string[];
  onApply: (voucherIds: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* ---------------- FETCH VOUCHERS ---------------- */
  useEffect(() => {
    const fetchVouchers = async () => {
      const res = await axios.get(`${API_BASE}/voucher-entry`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      setVouchers(res.data.data || []);
    };

    fetchVouchers();
  }, []);

  /* ---------------- TOGGLE SINGLE ---------------- */
  const toggleVoucher = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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
    const q = search.toLowerCase();

    return vouchers.filter((v) =>
      [
        v.reference_no,
        v.voucher_type,
        v.party_name,
        v.party,
      ]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q))
    );
  }, [vouchers, search]);

  /* ---------------- PAGINATION ---------------- */
  const totalPages = Math.ceil(filtered.length / pageSize);
  const start = (page - 1) * pageSize;
  const paginatedVouchers = filtered.slice(start, start + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  /* ---------------- SELECT ALL (VISIBLE PAGE) ---------------- */
  const allVisibleSelected =
    paginatedVouchers.length > 0 &&
    paginatedVouchers.every((v) =>
      selected.has(v.voucher_guid)
    );

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);

      paginatedVouchers.forEach((v) => {
        allVisibleSelected
          ? next.delete(v.voucher_guid)
          : next.add(v.voucher_guid);
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
      Bulk Voucher Selection
    </h3>
    <p className="text-sm text-slate-500">
      Manage user Voucher Bulk permissions
    </p>
  </div>

  <div
    className="flex flex-col gap-3 w-full 
               md:w-auto md:flex-row md:items-center"
  >
    <input
      type="text"
      placeholder="Search vouchers..."
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

      <div className="border rounded-lg divide-y">
        {paginatedVouchers.map((v) => {
          const active = selected.has(v.voucher_guid);

          return (
            <div
              key={v.voucher_guid}
              className="flex justify-between px-4 py-3 hover:bg-slate-50"
            >
              <span className="text-sm">
                {v.party_name || v.party || "-"} •{" "}
                {v.reference_no || v.voucher_type}
              </span>

              <button
                onClick={() => toggleVoucher(v.voucher_guid)}
                className={`h-6 w-11 rounded-full border transition ${
                  active
                    ? "bg-blue-600 border-blue-600"
                    : "bg-white"
                }`}
              >
                <span
                  className={`block h-5 w-5 bg-white rounded-full transition ${
                    active ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          );
        })}

        {paginatedVouchers.length === 0 && (
          <div className="py-6 text-center text-sm text-slate-400">
            No vouchers found
          </div>
        )}
      </div>

      <div className="text-sm text-slate-600">
        Selected Vouchers: {selected.size}
      </div>
    </div>
  );
}
