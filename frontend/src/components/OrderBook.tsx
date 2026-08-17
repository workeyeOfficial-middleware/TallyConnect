
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import API_BASE from "../api";
import DataState from "../components/DataState";


import {
  Plus,
  Search,
  Download,
  FileSpreadsheet,
  FileText as PdfIcon,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Order {
  id: string;
  type: "Sales" | "Purchase";
  date: string;
  customer: string;
  amount: number;
  dueDate: string;
  status: "Pending" | "Completed" | "Cancelled";
}

export function OrderBook({
  user,
}: {
  user: {
    username: string;
    role: "ADMIN" | "USER";
    ordersPermissions?: {
      can_view?: boolean;
      columns?: Record<string, boolean>;
    };
  };
}) {
  // 🔐 ACCESS CHECK
  if (user.role !== "ADMIN" && user?.ordersPermissions?.can_view === false) {
    return (
      <div className="p-10 text-center text-gray-500">
        You do not have permission to view orders.
      </div>
    );
  }

  // 🔐 COLUMN PERMISSIONS
  const columns =
    user.role === "ADMIN"
      ? {
          orderNo: true,
          partyName: true,
          type: true,
          date: true,
          amount: true,
          status: true,
          dueDate: true,
          actions: true,
        }
      : {
          orderNo: true,
          partyName: true,
          type: true,
          date: true,
          amount: true,
          status: true,
          dueDate: true,
          actions: true,
          ...(user?.ordersPermissions?.columns || {}),
        };

  const hasAnyColumnAccess =
    user.role === "ADMIN" || Object.values(columns).some((v) => v !== false);

  if (!hasAnyColumnAccess) {
    return (
      <div className="p-10 text-center text-gray-500">
        You do not have access to view order details.
      </div>
    );
  }

  // STATE
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "sales" | "purchase">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [loading, setLoading] = useState(true);


  const neumorphicButtonStyle =
    "px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg active:shadow-inner";

  // FETCH ORDERS
  useEffect(() => {
    const fetchOrders = async () => {
      try {
         
        const res = await axios.get(`${API_BASE}/orders`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

      const formatted: Order[] = res.data.data.map((o: any) => ({
  id: String(o.id ?? "-"),

  // ✅ Ensure only Sales or Purchase
  type:
    o.type === "Purchase"
      ? "Purchase"
      : "Sales",

  // ✅ Format date safely
  date: o.date
    ? new Date(o.date).toISOString().split("T")[0]
    : "-",

  customer: o.customer ?? "-",

  // ✅ Remove negative sign from Tally
  amount: Math.abs(Number(o.amount ?? 0)),

  dueDate: o.due_date
    ? new Date(o.due_date).toISOString().split("T")[0]
    : "-",

  status: o.status ?? "Pending",
}));


        setOrders(formatted);
      } catch (err) {
        console.error("Order fetch failed", err);
      } finally {
      setLoading(false); // ⭐ IMPORTANT
    }
    };

    fetchOrders();
  }, []);

  // FILTER
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "sales" && order.type === "Sales") ||
        (activeTab === "purchase" && order.type === "Purchase");

      const matchesSearch =
        String(order.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesTab && matchesSearch;
    });
  }, [orders, activeTab, searchQuery]);

  // EXPORT CSV
  const exportOrdersCSV = () => {
    if (!filteredOrders.length) return alert("No data to export");

    const visibleColumns = Object.entries(columns)
      .filter(([_, v]) => v !== false && _ !== "actions")
      .map(([k]) => k);

    const labels: Record<string, string> = {
      orderNo: "Order No",
      partyName: "Customer / Supplier",
      type: "Type",
      date: "Date",
      amount: "Amount",
      status: "Status",
      dueDate: "Due Date",
    };

    const header = visibleColumns.map((c) => labels[c]).join(",");

    const rows = filteredOrders.map((o) =>
      visibleColumns
        .map((c) => {
          switch (c) {
            case "orderNo":
              return o.id;
            case "partyName":
              return `"${o.customer}"`;
            case "type":
              return o.type;
            case "date":
              return o.date;
            case "amount":
              return o.amount;
            case "status":
              return o.status;
            case "dueDate":
              return o.dueDate;
            default:
              return "";
          }
        })
        .join(","),
    );

    const blob = new Blob([header + "\n" + rows.join("\n")], {
      type: "text/csv",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "order-book.csv";
    a.click();
  };

  // EXPORT PDF
  const exportOrdersPDF = () => {
    if (!filteredOrders.length) return alert("No data to export");

    const doc = new jsPDF("landscape");
    doc.text("Sales & Purchase Order Book", 14, 15);

    const visibleColumns = Object.entries(columns)
      .filter(([_, v]) => v !== false && _ !== "actions")
      .map(([k]) => k);

    const labels: Record<string, string> = {
      orderNo: "Order No",
      partyName: "Customer / Supplier",
      type: "Type",
      date: "Date",
      amount: "Amount",
      status: "Status",
      dueDate: "Due Date",
    };

    autoTable(doc, {
      startY: 25,
      head: [visibleColumns.map((c) => labels[c])],
      body: filteredOrders.map((o) =>
        visibleColumns.map((c) => {
          switch (c) {
            case "orderNo":
              return o.id;
            case "partyName":
              return o.customer;
            case "type":
              return o.type;
            case "date":
              return o.date;
            case "amount":
              return `₹${o.amount}`;
            case "status":
              return o.status;
            case "dueDate":
              return o.dueDate;
            default:
              return "";
          }
        }),
      ),
    });

    doc.save("order-book.pdf");
  };

  // CLOSE DROPDOWN ON OUTSIDE CLICK
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".export-dropdown")) {
        setShowExport(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const visibleColumnCount = Object.values(columns).filter(
    (c) => c !== false,
  ).length;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl text-gray-900 dark:text-white">
            Sales & Purchase Order Book
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track all your orders in one place
          </p>
        </div>

        {/* EXPORT DROPDOWN - NEUMORPHIC */}
        <div className="relative export-dropdown">
          <button
            onClick={() => setShowExport(!showExport)}
            className={`flex items-center gap-2 bg-blue-600 text-white text-sm ${neumorphicButtonStyle}`}
            style={{
              boxShadow: "4px 4px 10px #d1d1d1, -4px -4px 10px #ffffff",
            }}
          >
            <Download className="w-4 h-4" />
            Export List
          </button>

          {showExport && (
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border rounded-lg shadow-xl z-50">
              <button
                onClick={() => {
                  exportOrdersCSV();
                  setShowExport(false);
                }}
                className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                Excel
              </button>
              <button
                onClick={() => {
                  exportOrdersPDF();
                  setShowExport(false);
                }}
                className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <PdfIcon className="w-4 h-4 text-red-600" />
                PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TABS & SEARCH */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex gap-2 overflow-x-auto">
            {["all", "sales", "purchase"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`${neumorphicButtonStyle} ${
                  activeTab === tab
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                }`}
                style={{
                  boxShadow:
                    activeTab === tab
                      ? "4px 4px 10px #d1d1d1, -4px -4px 10px #ffffff"
                      : "inset 2px 2px 6px #d1d1d1, inset -2px -2px 6px #ffffff",
                }}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order no or customer..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <DataState
  data={filteredOrders}
  loading={loading}
  message={`No ${activeTab} orders found`}
>

      <div className="desktop-only bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                {columns.orderNo !== false && (
                  <th className="px-6 py-4 text-left text-xs uppercase">
                    Order No.
                  </th>
                )}

                {columns.type !== false && (
                  <th className="px-6 py-4 text-left text-xs uppercase">
                    Type
                  </th>
                )}

                {columns.date !== false && (
                  <th className="px-6 py-4 text-left text-xs uppercase">
                    Date
                  </th>
                )}

                {columns.status !== false && (
                  <th className="px-6 py-4 text-center text-xs uppercase">
                    Status
                  </th>
                )}

                {columns.partyName !== false && (
                  <th className="px-6 py-4 text-left text-xs text-gray-600 uppercase">
                    Customer/Supplier
                  </th>
                )}

                {columns.amount !== false && (
                  <th className="px-6 py-4 text-right text-xs uppercase">
                    Amount
                  </th>
                )}

                {columns.dueDate !== false && (
                  <th className="px-6 py-4 text-left text-xs uppercase">
                    Due Date
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  {columns.orderNo !== false && (
                    <td className="px-6 py-4 text-sm">{order.id}</td>
                  )}

                  {columns.type !== false && (
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
                          order.type === "Sales"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {order.type}
                      </span>
                    </td>
                  )}

                  {columns.date !== false && (
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {order.date}
                    </td>
                  )}

                  {columns.partyName !== false && (
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {order.customer}
                    </td>
                  )}

                  {columns.amount !== false && (
                    <td className="px-6 py-4 text-sm text-right">
                      ₹{order.amount}
                    </td>
                  )}

                  {columns.dueDate !== false && (
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {order.dueDate}
                    </td>
                  )}

                  {columns.status !== false && (
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs ${
                          order.status === "Completed"
                            ? "bg-green-100 text-green-800"
                            : order.status === "Pending"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredOrders.length} orders
          </p>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              Previous
            </button>
            <button className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
              1
            </button>
            <button className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              Next
            </button>
          </div>
        </div>
      </div>

            {/* MOBILE VIEW */}
<div className="mobile-only bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
  {filteredOrders.length === 0 ? (
    <p className="p-6 text-center text-gray-500 dark:text-gray-400">
      No orders found.
    </p>
  ) : (
    <div className="space-y-4 p-4 max-h-[500px] overflow-y-auto">
      {filteredOrders.map((order) => (
        <div
          key={order.id}
          className="p-4 rounded-lg border bg-white dark:bg-gray-700 dark:border-gray-600 shadow-sm"
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="text-gray-500 font-semibold">Order No</div>
            <div className="text-gray-900 dark:text-white">{order.id}</div>

            <div className="text-gray-500 font-semibold">Type</div>
            <div>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                  order.type === "Sales"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {order.type}
              </span>
            </div>

            <div className="text-gray-500 font-semibold">Customer</div>
            <div className="text-gray-900 dark:text-white">
              {order.customer}
            </div>

            <div className="text-gray-500 font-semibold">Date</div>
            <div className="text-gray-900 dark:text-white">{order.date}</div>

            <div className="text-gray-500 font-semibold">Amount</div>
            <div className="text-gray-900 dark:text-white font-semibold">
              ₹{order.amount}
            </div>

            <div className="text-gray-500 font-semibold">Due Date</div>
            <div className="text-gray-900 dark:text-white">
              {order.dueDate}
            </div>

            <div className="text-gray-500 font-semibold">Status</div>
            <div>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                  order.status === "Completed"
                    ? "bg-green-100 text-green-800"
                    : order.status === "Pending"
                    ? "bg-orange-100 text-orange-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {order.status}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
</DataState>

    </div>
    
  );
}
