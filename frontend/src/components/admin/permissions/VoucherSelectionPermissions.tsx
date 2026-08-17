
import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import API_BASE from "../../../api";

type VoucherItem = {
  voucher_guid: string;
  reference_no?: string;
  voucher_type?: string;
  party_name?: string;
  party?: string;
};

export function VoucherSelectionPermissions({
  user,
  userIds,
  isBulk = false,
  onDone,
}: any) {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* ---------------- LOAD SAVED SELECTION ---------------- */
useEffect(() => {
  if (!user?.id) return;

  const loadSavedSelection = async () => {
    try {
      const res = await axios.get(
  `${API_BASE}/voucher-entry/user-vouchers/${user.id}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const saved = res.data.vouchers || [];
      setSelected(new Set(saved));
    } catch (err) {
      console.error("Failed to load voucher permissions", err);
    }
  };

  loadSavedSelection();
}, [user?.id]);

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

  /* ---------------- ADMIN DEFAULT ---------------- */
  useEffect(() => {
    if (user?.role === "ADMIN") {
      setSelected(new Set());
    }
  }, [user?.role]);

  /* ---------------- TOGGLE SINGLE ---------------- */
  const toggleVoucher = (voucherId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(voucherId)
        ? next.delete(voucherId)
        : next.add(voucherId);
      return next;
    });
  };

  /* ---------------- SAVE ---------------- */
 const save = async () => {
  setSaving(true);

  try {
    const bulkMode =
      isBulk && Array.isArray(userIds) && userIds.length > 0;

    const url = bulkMode
      ? `${API_BASE}/voucher-entry/bulk-user-vouchers`
      : `${API_BASE}/voucher-entry/user-vouchers`;

    const body = bulkMode
      ? {
          userIds,
          vouchers: [...selected],
        }
      : {
          userId: user.id,
          vouchers: [...selected],
        };

    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(body),
    });

    onDone();
  } catch (err) {
    console.error("Voucher save error:", err);
    alert("Failed to save voucher permissions");
  }

  setSaving(false);
};

  /* ---------------- SEARCH ---------------- */
  const filtered = useMemo(() => {
    return vouchers.filter((v) =>
      (v.reference_no ||
        v.voucher_type ||
        v.party_name ||
        v.party ||
        "")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [vouchers, search]);

  /* ---------------- PAGINATION ---------------- */
  const totalPages = Math.ceil(filtered.length / pageSize);
  const start = (page - 1) * pageSize;
  const paginatedVouchers = filtered.slice(start, start + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  /* ---------------- SELECT ALL (VISIBLE PAGE ONLY) ---------------- */
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
            Voucher Access
          </h3>
          <p className="text-sm text-slate-500">
            Manage user voucher permissions
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full 
                md:w-auto md:flex-row md:items-center">
          <input
            type="text"
            placeholder="Search vouchers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-green-500"
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
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
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
        {paginatedVouchers.map((v) => {
          const active = selected.has(v.voucher_guid);

          return (
            <div
              key={v.voucher_guid}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
            >
              <div className="text-sm flex flex-wrap items-center gap-3 text-slate-700">
                <span className="font-medium">
                  {v.party_name || v.party || "—"}
                </span>
                <span className="text-slate-400">•</span>
                <span>
                  {v.reference_no || v.voucher_type || "-"}
                </span>
              </div>

              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={active}
                onClick={() => toggleVoucher(v.voucher_guid)}
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

        {paginatedVouchers.length === 0 && (
          <div className="py-6 text-center text-sm text-slate-400">
            No vouchers found
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
        Selected Vouchers:{" "}
        <span className="font-medium">{selected.size}</span>
      </div>
    </div>
  );
}
