import { useState, useEffect, useRef } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import DataState from "../components/DataState";

import {
  Plus,
  Search,
  Edit,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  Package,
  DollarSign,
  TrendingUp,
    TrendingDown,
} from "lucide-react";
import API_BASE from "../api";


const formatCurrency = (amount: number) => {
  const formatted = Math.abs(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return amount < 0 ? `(${formatted})` : formatted;
};






/* ================= COLOR CLASSES ================= */
const colorClasses: Record<string, { bg: string; icon: string }> = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-900",
    icon: "text-blue-600 dark:text-blue-400",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-900",
    icon: "text-red-600 dark:text-red-400",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-900",
    icon: "text-green-600 dark:text-green-400",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-900",
    icon: "text-orange-600 dark:text-orange-400",
  },
};

/* ===================== SUMMARY CARD ===================== */
function SummaryCard({ title, value, icon: Icon, color, isText }: any) {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-gray-800 shadow-neumorphic flex items-center justify-between transition-transform hover:scale-[1.02]">
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
        <p className={`text-2xl font-bold mt-2 ${
  !isText && Number(value) < 0
    ? "text-red-600"
    : "text-gray-900 dark:text-white"
}`}>
          {isText ? value : formatCurrency(Number(value))}
        </p>
      </div>
      <div
        className={`p-4 rounded-full flex items-center justify-center ${colorClasses[color].bg} shadow-inner-neu`}
      >
        <Icon className={`w-6 h-6 ${colorClasses[color].icon}`} />
      </div>
    </div>
  );
}

/* ================= INVENTORY PAGE ================= */
export function InventoryPage({ user }: { user: any }) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(10);


useEffect(() => {
  setCurrentPage(1);
}, [searchQuery, showLowStock, pageSize]);


const columns =
  user.role === "ADMIN"
    ? {
        itemCode: true,
        itemName: true,
        opening: true,
        inward: true,
        outward: true,
        closingStock: true,
        rate: true,
        value: true,
        actions: true,
      }
    : user.inventoryPermissions?.columns ?? {
        itemCode: true,
        itemName: true,
        opening: true,
        inward: true,
        outward: true,
        closingStock: true,
        rate: true,
        value: true,
        actions: true,
      };


  const visibleColumnCount = Object.values(columns).filter(
    (v) => v !== false,
  ).length;

  useEffect(() => {
    axios
      .get(`${API_BASE}/inventory`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then((res) =>
        setInventory(Array.isArray(res.data?.data) ? res.data.data : []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (loading)
    return (
      <div className="flex justify-center items-center py-20 text-gray-600 dark:text-gray-300">
        Loading inventory...
      </div>
    );

  if (user.role !== "ADMIN" && user?.inventoryPermissions?.can_view === false) {
    return (
      <div className="p-10 text-center text-gray-500">
        You do not have permission to view inventory.
      </div>
    );
  }

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      (item.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.id || "").toLowerCase().includes(searchQuery.toLowerCase());
    const minStock = Number(item.minStock ?? 0);
    const matchesLowStock = !showLowStock || item.closing < minStock;
    return matchesSearch && matchesLowStock;
  });

  const totalRecords = filteredInventory.length;
const totalPages = Math.ceil(totalRecords / pageSize);

const paginatedInventory = filteredInventory.slice(
  (currentPage - 1) * pageSize,
  currentPage * pageSize
);


const totalValue = inventory.reduce((sum, item) => {
  const value =
    item.value !== undefined
      ? Number(item.value)
      : Number(item.closing) * Number(item.rate);

  return sum + value;
}, 0);



  const lowStockItems = inventory.filter(
    (item) => item.closing < item.minStock,
  ).length;

  const exportCSV = () => {
    const visibleCols = Object.entries(columns)
      .filter(([_, v]) => v !== false && _ !== "actions")
      .map(([k]) => k);

    const labels: Record<string, string> = {
      itemCode: "Item Code",
      itemName: "Item Name",
      opening: "Opening",
      inward: "Inward",
      outward: "Outward",
      closingStock: "Closing Stock",
      rate: "Rate",
      value: "Value",
    };

const header = visibleCols
  .map((c) => labels[c] ?? c)
  .join(",");
      const rows = filteredInventory.map((item) =>
      visibleCols
        .map((c) =>
          c === "itemCode"
            ? item.id
            : c === "itemName"
              ? `"${item.name}"`
              : c === "value"
                ? item.closing * item.rate
                : item[c === "closingStock" ? "closing" : c],
        )
        .join(","),
    );

    const blob = new Blob([header, ...rows].join("\n"), { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory-report.csv";
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  };



const exportInventoryPDF = () => {
  const dataToExport = filteredInventory;

  if (!dataToExport.length) {
    alert("No data to export");
    return;
  }

  const doc = new jsPDF("landscape");
  doc.setFontSize(14);
  doc.text("Inventory Report", 14, 15);

  const visibleColumns = Object.entries(columns)
    .filter(([_, value]) => value !== false && _ !== "actions")
    .map(([key]) => key);

  const columnLabels: Record<string, string> = {
    itemCode: "Item Code",
    itemName: "Item Name",
    opening: "Opening",
    inward: "Inward",
    outward: "Outward",
    closingStock: "Closing Stock",
    rate: "Rate",
    value: "Value",
  };

  autoTable(doc, {
    head: [visibleColumns.map((c) => columnLabels[c] ?? c)],
    body: dataToExport.map((item) =>
      visibleColumns.map((c) =>
        c === "itemCode"
          ? item.id
          : c === "itemName"
          ? item.name
          : c === "value"
          ? item.closing * item.rate
          : item[c === "closingStock" ? "closing" : c]
      )
    ),
    startY: 25,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [255, 115, 0] },
  });

  doc.save(`inventory-report-${user.role.toLowerCase()}.pdf`);
};

const exportPDF = () => {
  exportInventoryPDF();
  setShowExport(false);
};
  const tableColumns = [
    { key: "itemCode", label: "Item Code" },
    { key: "itemName", label: "Item Name" },
    { key: "opening", label: "Opening" },
    { key: "inward", label: "Inward" },
    { key: "outward", label: "Outward" },
    { key: "closingStock", label: "Closing Stock" },
    { key: "rate", label: "Rate" },
    { key: "value", label: "Value" },
    { key: "actions", label: "Action" },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Export */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl text-gray-900 dark:text-white">
            Inventory Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track and manage stock
          </p>
        </div>

        {(user.role === "ADMIN" || user.inventoryPermissions?.can_view !== false) && (
  <div className="relative" ref={exportRef}>
    <button
      onClick={() => setShowExport(!showExport)}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm"
    >
      <Download className="w-4 h-4" /> Export
    </button>

    {showExport && (
      <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
        <button
          onClick={exportCSV}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel
        </button>
        <button
          onClick={exportPDF}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <FileText className="w-4 h-4 text-red-600" /> PDF
        </button>
      </div>
    )}
  </div>
)}

      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryCard
          title="Total Items"
          value={inventory.length}
          icon={Package}
          color="orange"
        />
        <SummaryCard
  title="Total Stock Value"
  value={-Math.abs(totalValue)}
  icon={DollarSign}
  color="blue"
/>

        <SummaryCard
          title="Low Stock Alerts"
          value={lowStockItems}
          icon={AlertTriangle}
          color="red"
        />
        <SummaryCard
          title="Stock Movement"
          value="Active"
          icon={TrendingUp}
          color="green"
          isText
        />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by item name or code..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setShowLowStock(!showLowStock)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showLowStock
                ? "bg-red-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            <AlertTriangle className="w-4 h-4" /> Low Stock Only
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <DataState
  data={paginatedInventory}
  loading={loading}
  message="No inventory found"
>
  <div className="desktop-only bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                {tableColumns.map(
                  (col) =>
                    columns[col.key] !== false && (
                      <th
                        key={col.key}
                        className="px-6 py-4 text-left text-xs uppercase"
                      >
                        {col.label}
                      </th>
                    ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedInventory.map((item) => {
                const isLowStock = item.closing < item.minStock;
                const value = item.value ?? (item.closing * item.rate);
                return (
                  <tr
                    key={`${item.id ?? "no-id"}-${item.name}`}

                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      isLowStock ? "bg-red-50 dark:bg-red-900/10" : ""
                    }`}
                  >
                    {columns.itemCode !== false && (
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {item.id}
                      </td>
                    )}
                    {columns.itemName !== false && (
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {item.name}
                          </p>
                          {isLowStock && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                              <AlertTriangle className="w-3 h-3" />
                              Low Stock Alert
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                    {columns.opening !== false && (
                      <td className="px-6 py-4 text-right">{item.opening}</td>
                    )}
                    {columns.inward !== false && (
                      <td className="px-6 py-4 text-right">+{item.inward}</td>
                    )}
                    {columns.outward !== false && (
  <td className="px-6 py-4 text-right text-red-600">
    {Number(item.outward).toLocaleString()}
  </td>
)}

                    {columns.closingStock !== false && (
                      <td className="px-6 py-4 text-right">{item.closing}</td>
                    )}
                    {columns.rate !== false && (
                      <td className="px-6 py-4 text-right">{formatCurrency(Number(item.rate))}</td>
                    )}
                    {columns.value !== false && (
                      <td
  className={`px-6 py-4 text-right ${
    Number(value) < 0
      ? "text-red-600"
      : Number(value) > 0
      ? "text-green-600"
      : ""
  }`}
>
  {formatCurrency(Number(value))}
</td>
                    )}
                    {columns.actions !== false && (
                      <td className="px-6 py-4 text-center">
                        <button className="p-1.5 rounded shadow-inner-neu">
                          <Edit className="w-4 h-4 text-blue-600" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t-2 border-gray-300 dark:border-gray-600">
              <tr>
                <td colSpan={Math.max(1, visibleColumnCount - 2)}>
                  Total Inventory Value
                </td>
                {columns.value !== false && (
                  <td className="px-6 py-4 text-sm text-right">
                    {formatCurrency(-Math.abs(totalValue))}

                  </td>
                )}
                {columns.actions !== false && <td></td>}
              </tr>
            </tfoot>
          </table>

{/* PAGINATION */}
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-4 border-t bg-gray-50 dark:bg-gray-800">
  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
    <div className="flex items-center gap-2">
      <span>Rows</span>
      <select
        value={pageSize}
        onChange={(e) => setPageSize(Number(e.target.value))}
        className="px-2 py-1 rounded-md border bg-white dark:bg-gray-700 dark:border-gray-600"
      >
        <option value={5}>5</option>
        <option value={10}>10</option>
        <option value={15}>15</option>
        <option value={100}>100</option>
      </select>
    </div>

    <span className="hidden sm:inline">
      {(currentPage - 1) * pageSize + 1}–
      {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords}
    </span>
  </div>

  <div className="flex items-center gap-2">
    <button
      disabled={currentPage === 1}
      onClick={() => setCurrentPage((p) => p - 1)}
      className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
    >
      Prev
    </button>

    <span className="px-3 py-1.5 text-sm rounded-lg border bg-white dark:bg-gray-700">
      {currentPage}
      <span className="text-gray-400"> / {totalPages || 1}</span>
    </span>

    <button
      disabled={currentPage === totalPages}
      onClick={() => setCurrentPage((p) => p + 1)}
      className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
    >
      Next
    </button>
  </div>
</div>

        </div>

       
      </div>

            {/* Inventory – MOBILE VIEW */}
<div className="mobile-only bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
  {paginatedInventory.length === 0 ? (
    <p className="p-6 text-center text-gray-500 dark:text-gray-400">
      No inventory found.
    </p>
  ) : (
    <div className="space-y-4 p-4 max-h-[500px] overflow-y-auto">
      {paginatedInventory.map((item) => {
        const isLowStock = item.closing < item.minStock;
        const value = item.closing * item.rate;

        return (
          <div
            key={item.id}
            className={`p-4 rounded-lg border shadow-sm ${
              isLowStock
                ? "border-red-300 bg-red-50 dark:bg-red-900/10"
                : "bg-white dark:bg-gray-700 dark:border-gray-600"
            }`}
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="text-gray-500 font-semibold">Item Code</div>
              <div className="text-gray-900 dark:text-white">{item.id}</div>

              <div className="text-gray-500 font-semibold">Item Name</div>
              <div className="text-gray-900 dark:text-white font-semibold">
                {item.name}
              </div>

              <div className="text-gray-500 font-semibold">Closing Stock</div>
              <div className="text-gray-900 dark:text-white">
                {item.closing}
              </div>

              <div className="text-gray-500 font-semibold">Rate</div>
              <div className="text-gray-900 dark:text-white">
                ₹{item.rate}
              </div>

              <div className="text-gray-500 font-semibold">Value</div>
              <div className="text-gray-900 dark:text-white font-semibold">
                ₹{value.toLocaleString()}
              </div>

              {isLowStock && (
                <>
                  <div className="text-gray-500 font-semibold">Status</div>
                  <div className="text-red-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Low Stock
                  </div>
                </>
              )}
            </div>

            {columns.actions !== false && (
              <div className="pt-4">
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                  <Edit className="w-4 h-4" />
                  Edit Item
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  )}

  {/* MOBILE PAGINATION */}
  {totalPages > 1 && (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 dark:bg-gray-800">
      <button
        disabled={currentPage === 1}
        onClick={() => setCurrentPage((p) => p - 1)}
        className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40"
      >
        Prev
      </button>

      <span className="text-sm">
        {currentPage} / {totalPages}
      </span>

      <button
        disabled={currentPage === totalPages}
        onClick={() => setCurrentPage((p) => p + 1)}
        className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40"
      >
        Next
      </button>
    </div>
  )}
</div>  
</DataState>
    </div>
    
  );
}
