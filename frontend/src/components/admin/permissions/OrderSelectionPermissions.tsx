import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import API_BASE from "../../../api";

type OrderItem = {
  order_id: string;
  order_no: string;
  party: string;
  amount: number;
  date: string;
  status: string;
};

export function OrderSelectionPermissions({
  user,
  onDone,
}: {
  user: any;
  onDone: () => void;
}) {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* ---------------- FETCH ORDERS ---------------- */
  useEffect(() => {
    const fetchOrders = async () => {
const res = await axios.get(`${API_BASE}/orders`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const formatted: OrderItem[] = (res.data.data || []).map((o: any) => ({
        order_id: String(o.id), // ✅ stable unique ID
        order_no: String(o.id),
        party: o.customer || "-",
        amount: Number(o.amount ?? 0),
        date: o.date,
        status: o.status ?? "Pending",
      }));

      setOrders(formatted);
    };

    fetchOrders();
  }, []);

  /* ---------------- FETCH USER ORDERS ---------------- */
  useEffect(() => {
    const fetchUserOrders = async () => {
      const res = await fetch(
  `${API_BASE}/orders/user-orders/${user.id}`,
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
setSelected(new Set((data.orders || []).map((id: string) => String(id))));    };

    fetchUserOrders();
  }, [user.id]);

  /* ---------------- TOGGLE SINGLE ---------------- */
  const toggleOrder = (orderId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  };

  /* ---------------- SAVE ---------------- */
  const save = async () => {
    setSaving(true);

await fetch(`${API_BASE}/orders/user-orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        userId: user.id,
        orders: [...selected],
      }),
    });

    setSaving(false);
    onDone();
  };

  /* ---------------- SEARCH ---------------- */
  const filtered = useMemo(() => {
    return orders.filter(
      (o) =>
        o.order_no.toLowerCase().includes(search.toLowerCase()) ||
        o.party.toLowerCase().includes(search.toLowerCase())
    );
  }, [orders, search]);

  /* ---------------- PAGINATION ---------------- */
  const totalPages = Math.ceil(filtered.length / pageSize);
  const start = (page - 1) * pageSize;
  const paginatedOrders = filtered.slice(start, start + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  /* ---------------- SELECT ALL (VISIBLE PAGE ONLY) ---------------- */
  const allVisibleSelected =
    paginatedOrders.length > 0 &&
    paginatedOrders.every((o) => selected.has(o.order_id));

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      paginatedOrders.forEach((o) => {
        allVisibleSelected
          ? next.delete(o.order_id)
          : next.add(o.order_id);
      });
      return next;
    });
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="
  bg-white border rounded-xl shadow-sm
  p-4 sm:p-6
  space-y-5
  w-full
  max-w-6xl
  mx-auto
">
      {/* Header */}
      <div className="
  flex flex-col lg:flex-row
  lg:items-center
  lg:justify-between
  gap-4
">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            Order Access
          </h3>
          <p className="text-sm text-slate-500">
            Manage user order permissions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
  w-full sm:w-64
  px-4 py-2
  text-sm border rounded-lg
  focus:ring-2 focus:ring-green-500
"
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
        {paginatedOrders.map((o) => {
          const active = selected.has(o.order_id);

          return (
            <div
              key={o.order_id}
              className="flex items-start sm:items-center justify-between gap-2 px-2 py-2 hover:bg-slate-50"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-slate-700 min-w-0">

  <span className="font-medium truncate">
    {o.order_no}
  </span>

  <span className="text-slate-500 truncate">
    {o.party}
  </span>

  <span className="text-slate-500">
    ₹{o.amount}
  </span>

  <span className="text-slate-500">
    {o.date?.split("T")[0] ?? "-"}
  </span>

<span
  style={{
    display: "inline-block",   // 🔥 important (NOT inline-flex)
    padding: "4px 12px",
    borderRadius: "9999px",
    fontSize: "12px",
    fontWeight: 500,
    backgroundColor:
      o.status === "Completed"
        ? "#16a34a"
        : o.status === "Pending"
        ? "#f59e0b"
        : "#dc2626",
    color: "#ffffff",
    width: "fit-content",      // 🔥 prevents stretching
    alignSelf: "flex-start",   // 🔥 prevents full-width in column
  }}
>
  {o.status}
</span>

</div>

              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={active}
                onClick={() => toggleOrder(o.order_id)}
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

        {paginatedOrders.length === 0 && (
          <div className="py-6 text-center text-sm text-slate-400">
            No orders found
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="
  flex flex-col sm:flex-row
  sm:items-center
  sm:justify-between
  gap-3
  text-sm text-slate-600
">
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
        Selected Orders: <span className="font-medium">{selected.size}</span>
      </div>
    </div>
  );
}
