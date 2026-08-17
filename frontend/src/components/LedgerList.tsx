import { useState, useEffect, useRef } from "react";
import { Search, Filter, Eye, Download } from "lucide-react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useMemo } from "react";
import API_BASE from "../api";
import DataState from "../components/DataState";


import { motion, AnimatePresence } from "framer-motion";


interface Ledger {
  ledger_guid: string;
  name: string;
  type: "Dr" | "Cr" | string;
  parent_group?: string;
  opening_balance: number;
  debit: number;
  credit: number;
  closing_balance: number;
  date?: string;
  voucher_type?: string;
  reference_no?: string;
  category?: "Customer" | "Supplier" | string;
}

interface LedgerListProps {
  onViewLedger: (ledgerId: string) => void;
  user: {
    ledgerPermissions?: {
      columns: Record<string, boolean>;
    };
  };
}




export function LedgerList({ onViewLedger, user }: LedgerListProps) {
const defaultColumns = {
  partyName: true,
  type: true,
  opening: true,
  outstanding: true,
  dueDays: true,
  actions: true, 
};

const columns = {
  ...defaultColumns,
  ...(user.ledgerPermissions?.columns || {}),
};


  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "Dr" | "Cr">("all");
  const [selectedGroup, setSelectedGroup] = useState("All Groups");
  const [showFilters, setShowFilters] = useState(false);
 const [loading, setLoading] = useState(true);

const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(10); // default = 10
const [activeCompanyGuid, setActiveCompanyGuid] = useState<string | null>(null);

const [showAddBill, setShowAddBill] = useState(false);

const [ledgerSearch, setLedgerSearch] = useState("");
const [showLedgerDropdown, setShowLedgerDropdown] = useState(false);
const [selectedLedgerName, setSelectedLedgerName] = useState("");

const ledgerRef = useRef<HTMLDivElement | null>(null);

const [billForm, setBillForm] = useState({
  ledgerGuid: "",
  billNo: "",
  billDate: "",
  dueDate: "",
  amount: "",
});

const closeAddBill = () => {
  setShowAddBill(false);
  setBillForm({
    ledgerGuid: "",
    billNo: "",
    billDate: "",
    dueDate: "",
    amount: "",
  });
};

const saveBill = async () => {
  try {
    if (!activeCompanyGuid) {
      alert("No active company");
      return;
    }

    await axios.post(
      `${API_BASE}/bill/push-to-tally`,
      {
        company_guid: activeCompanyGuid,
        ledger_guid: billForm.ledgerGuid,
        bill_name: billForm.billNo,
        bill_date: billForm.billDate,
        due_date: billForm.dueDate || null,
        amount: Number(billForm.amount),
        voucher_type: "Sales" // or make it dynamic later
      },
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );
window.dispatchEvent(new Event("refresh-notifications"));
    alert("Bill pushed to Tally successfully");
    closeAddBill();
  } catch (err: any) {
    console.error(err);
    alert(
      err?.response?.data?.message ||
      "Failed to push bill to Tally"
    );
  }
};


useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      ledgerRef.current &&
      !ledgerRef.current.contains(event.target as Node)
    ) {
      setShowLedgerDropdown(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);

  return () =>
    document.removeEventListener("mousedown", handleClickOutside);
}, []);


useEffect(() => {
  if (!showAddBill) {
    setLedgerSearch("");
    setSelectedLedgerName("");
    setShowLedgerDropdown(false);
  }
}, [showAddBill]);


useEffect(() => {
  const fetchActiveCompany = async () => {
    try {
      const res = await axios.get(`${API_BASE}/company/active`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      setActiveCompanyGuid(res.data.company_guid || null);
    } catch (err) {
      console.error("Failed to fetch active company", err);
    }
  };

  fetchActiveCompany();
}, []);

useEffect(() => {
  if (!activeCompanyGuid) return;

  const fetchLedgers = async () => {
    try {
      setLoading(true);

      const response = await axios.get(`${API_BASE}/ledger`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      setLedgers(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch ledgers:", error);
      setLedgers([]);
    } finally {
      setLoading(false);
    }
  };

  fetchLedgers();
}, [activeCompanyGuid]);

  // ✅ MUST BE DEFINED FIRST (before use)
  const getLedgerNature = (ledger: Ledger): "Dr" | "Cr" => {
    const group = (ledger.parent_group || "").toLowerCase();

    if (
      group.includes("capital") ||
      group.includes("income") ||
      group.includes("liability")
    ) {
      return "Cr";
    }

    if (
      group.includes("asset") ||
      group.includes("expense") ||
      group.includes("debtor")
    ) {
      return "Dr";
    }

    return "Dr";
  };


  // Enrich data
const enrichedLedgers = useMemo(() => {
  return ledgers.map((ledger) => {
    const outstanding = Number(ledger.closing_balance) || 0;

    return {
      ...ledger,
      outstanding, // ✅ TRUST TALLY
      dueDays: ledger.date
        ? Math.ceil(
            (Date.now() - new Date(ledger.date).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0,
    };
  });
}, [ledgers]);

const groups = useMemo(() => {
  return [
    "All Groups",
    ...Array.from(
      new Set(
        ledgers
          .map((l) => l.parent_group)
          .filter(Boolean)
      )
    ).sort(),
  ];
}, [ledgers]);

const handleViewLedger = (ledgerId: string) => {
  onViewLedger(ledgerId);
};



  // ✅ FILTER USING SAME LOGIC AS BADGE
const filteredLedgers = useMemo(() => {
  return enrichedLedgers.filter((ledger) => {
    const matchesSearch = ledger.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const nature = getLedgerNature(ledger);

    const matchesType =
      filterType === "all" ||
      nature === filterType;

    const matchesGroup =
      selectedGroup === "All Groups" ||
      ledger.parent_group === selectedGroup;

    return (
      matchesSearch &&
      matchesType &&
      matchesGroup
    );
  });
}, [
  enrichedLedgers,
  searchQuery,
  filterType,
  selectedGroup,
]);

const totalRecords = filteredLedgers.length;
const totalPages = Math.ceil(totalRecords / pageSize);

const paginatedLedgers = useMemo(() => {
  const start = (currentPage - 1) * pageSize;
  return filteredLedgers.slice(start, start + pageSize);
}, [filteredLedgers, currentPage, pageSize]);


useEffect(() => {
  setCurrentPage(1);
}, [
  searchQuery,
  filterType,
  selectedGroup,
  pageSize,
]);

  const exportLedgerCSV = () => {
const dataToExport = [...filteredLedgers];

  if (!dataToExport.length) {
    alert("No data to export");
    return;
  }

  const visibleColumns = Object.entries(columns)
    .filter(([_, v]) => v !== false && _ !== "actions")
    .map(([k]) => k);

  const columnLabels: Record<string, string> = {
    partyName: "Party Name",
    type: "Type",
    opening: "Opening Balance",
    outstanding: "Outstanding",
    dueDays: "Due Days",
  };

  const header = visibleColumns
    .map(col => columnLabels[col] ?? col)
    .join(",");

  const rows = dataToExport.map(ledger =>
    visibleColumns.map(col => {
      switch (col) {
        case "partyName":
          return `"${ledger.name}"`;
        case "type":
          return getLedgerNature(ledger);
        case "opening":
          return ledger.opening_balance;
        case "outstanding":
          return ledger.outstanding;
        case "dueDays":
          return ledger.dueDays;
        default:
          return "";
      }
    }).join(",")
  );

  const csvContent = [header, ...rows].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "ledger-list.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
const exportLedgerPDF = () => {
const dataToExport = [...filteredLedgers];

  if (!dataToExport.length) {
    alert("No data to export");
    return;
  }

  const doc = new jsPDF("landscape");

  doc.setFontSize(14);
  doc.text("Ledger List Report", 14, 15);

  const visibleColumns = Object.entries(columns)
    .filter(([_, v]) => v !== false && _ !== "actions")
    .map(([k]) => k);

  const columnLabels: Record<string, string> = {
    partyName: "Party Name",
    type: "Type",
    opening: "Opening Balance",
    outstanding: "Outstanding",
    dueDays: "Due Days",
  };

  const tableHead = [
    visibleColumns.map(col => columnLabels[col] ?? col),
  ];

  const tableBody = dataToExport.map(ledger =>
    visibleColumns.map(col => {
      switch (col) {
        case "partyName":
          return ledger.name;
        case "type":
          return getLedgerNature(ledger) === "Dr" ? "Debit" : "Credit";
        case "opening":
  return `Rs. ${ledger.opening_balance.toLocaleString("en-IN")}`;

case "outstanding":
  return `Rs. ${ledger.outstanding.toLocaleString("en-IN")}`;
        case "dueDays":
          return `${ledger.dueDays} days`;
        default:
          return "";
      }
    })
  );

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: 25,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] }, // blue header
  });

  doc.save("ledger-list.pdf");
};



  return (
      <div className="max-w-7xl mx-auto px-6 py-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl text-gray-900 dark:text-white">Ledger List</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View and manage all party ledgers
          </p>
        </div>
       <div className="flex flex-wrap gap-2">

          

  <button
    onClick={exportLedgerCSV}
    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
  >
    <Download className="w-4 h-4" />
    Export CSV
  </button>

  <button
    onClick={exportLedgerPDF}
    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
  >
    <Download className="w-4 h-4" />
    Export PDF
  </button>
</div>

      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by party name..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type Filter */}
          <div className="flex flex-wrap items-center gap-2">
          {/* Group Filter */}
<select
  value={selectedGroup}
  onChange={(e) =>
    setSelectedGroup(e.target.value)
  }
className="w-full sm:w-auto min-w-[180px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
  {groups.map((group) => (
    <option
      key={group}
      value={group}
    >
      {group}
    </option>
  ))}
</select>
            <button
              onClick={() => setFilterType("all")}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterType === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("Dr")}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterType === "Dr"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              Debit
            </button>
            <button
              onClick={() => setFilterType("Cr")}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterType === "Cr"
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              Credit
            </button>
          </div>

          
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                Date Range
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                Amount Range
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Max"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Categories</option>
                <option>Customer</option>
                <option>Supplier</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Ledger Table */}
      <DataState
  data={paginatedLedgers}
  loading={loading}
  message="No ledgers found"
>
      
<div className="desktop-only bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <p className="p-6 text-center text-gray-500 dark:text-gray-400">
            Loading ledgers...
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  {columns.partyName !== false && (
  <th className="px-6 py-4 text-left text-xs uppercase">Party Name</th>
)}

{columns.type !== false && (
  <th className="px-6 py-4 text-left text-xs uppercase">Type</th>
)}

{columns.opening !== false && (
  <th className="px-6 py-4 text-right text-xs uppercase">Opening Balance</th>
)}

{columns.outstanding !== false && (
  <th className="px-6 py-4 text-right text-xs uppercase">Outstanding</th>
)}

{columns.dueDays !== false && (
  <th className="px-6 py-4 text-center text-xs uppercase">Due Days</th>
)}

{columns.actions !== false && (
  <th className="px-6 py-4 text-center text-xs uppercase">Actions</th>
)}

                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
{paginatedLedgers.map((ledger) => (
                  <tr
  key={ledger.ledger_guid}
  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
>
  {columns.partyName !== false && (
    <td className="px-6 py-4">
      <div>
        <p className="text-gray-900 dark:text-white">{ledger.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {ledger.category || ledger.parent_group}
        </p>
      </div>
    </td>
  )}

  {columns.type !== false && (
    <td className="px-6 py-4">
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
          ledger.type === "Dr"
            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
            : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
        }`}
      >
{getLedgerNature(ledger) === "Dr" ? "Debit" : "Credit"}
      </span>
    </td>
  )}

  {columns.opening !== false && (
    <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
      ₹{ledger.opening_balance.toLocaleString()}
    </td>
  )}

  {columns.outstanding !== false && (
    <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
      ₹{ledger.outstanding.toLocaleString()}
    </td>
  )}

  {columns.dueDays !== false && (
    <td className="px-6 py-4 text-center">
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
          ledger.dueDays <= 7
            ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
            : ledger.dueDays <= 15
            ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400"
            : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
        }`}
      >
        {ledger.dueDays} days
      </span>
    </td>
  )}

  {columns.actions !== false && (
    <td className="px-6 py-4 text-center">
       
      <button
          onClick={() => handleViewLedger(ledger.ledger_guid)}

        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Eye className="w-4 h-4" />
        View Details
      </button>
       
    </td>
  )}
  
</tr>

                ))}
              </tbody>
            </table>
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-4 border-t bg-gray-50 dark:bg-gray-800">

  {/* Left side */}
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

  {/* Right side */}
  <div className="flex items-center gap-2">
    <button
      disabled={currentPage === 1}
      onClick={() => setCurrentPage(p => p - 1)}
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
      onClick={() => setCurrentPage(p => p + 1)}
      className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
    >
      Next
    </button>
  </div>
</div>
        

          </div>
        )}
      </div>
        
</DataState>



      
{/* MOBILE VIEW */}
<DataState
  data={paginatedLedgers}
  loading={loading}
  message="No ledgers found"
>
<div className="mobile-only bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
  {loading ? (
    <p className="p-6 text-center text-gray-500 dark:text-gray-400">
      Loading ledgers...
    </p>
  ) : paginatedLedgers.length === 0 ? (
    <p className="p-6 text-center text-gray-500 dark:text-gray-400">
      No ledgers found.
    </p>
  ) : (
    <div className="max-h-[500px] overflow-y-auto space-y-4 p-4">
      {paginatedLedgers.map((ledger) => {
        const nature = getLedgerNature(ledger);
        return (
          <div
            key={ledger.ledger_guid}
            className="p-4 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600"
          >
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
              <div className="text-gray-500 font-bold">Party</div>
              <div className="text-gray-900 dark:text-white font-semibold">
                {ledger.name}
              </div>

              <div className="text-gray-500 font-bold">Type</div>
              <div>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                    nature === "Dr"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                      : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                  }`}
                >
                  {nature === "Dr" ? "Debit" : "Credit"}
                </span>
              </div>

              {columns.opening !== false && (
                <>
                  <div className="text-gray-500 font-bold">Opening</div>
                  <div className="text-gray-900 dark:text-white">
                    ₹{ledger.opening_balance.toLocaleString("en-IN")}
                  </div>
                </>
              )}

              {columns.outstanding !== false && (
                <>
                  <div className="text-gray-500 font-bold">Outstanding</div>
                  <div className="text-gray-900 dark:text-white font-semibold">
                    ₹{ledger.outstanding.toLocaleString("en-IN")}
                  </div>
                </>
              )}

              {columns.dueDays !== false && (
                <>
                  <div className="text-gray-500 font-bold">Due Days</div>
                  <div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        ledger.dueDays <= 7
                          ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                          : ledger.dueDays <= 15
                          ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400"
                          : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                      }`}
                    >
                      {ledger.dueDays} days
                    </span>
                  </div>
                </>
              )}
            </div>

            {columns.actions !== false && (
              <div className="pt-4">
                <button
                  onClick={() => handleViewLedger(ledger.ledger_guid)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  <Eye className="w-4 h-4" />
                  View Details
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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
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

      <div className="flex items-center gap-2">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => p - 1)}
          className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
        >
          Prev
        </button>

        <span className="px-3 py-1.5 text-sm rounded-lg border bg-white dark:bg-gray-700">
          {currentPage} / {totalPages}
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
  )}
  </div>
</DataState>


<AnimatePresence>
  {showAddBill && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-2"
    >
      <motion.div
        initial={{ scale: 0.96, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 20, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="max-w-md w-[95%] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border p-6 mx-auto max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
          Add New Bill
        </h2>

        {/* Ledger Search Dropdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Ledger (Party)</label>

            <div ref={ledgerRef} className="relative">
              <input
                type="text"
                placeholder="Search ledger..."
                value={selectedLedgerName || ledgerSearch}
                onFocus={() => setShowLedgerDropdown(true)}
                onChange={(e) => {
                  setLedgerSearch(e.target.value);
                  setSelectedLedgerName("");
                  setShowLedgerDropdown(true);
                }}
                className="w-full h-11 rounded-lg border px-3 text-sm dark:bg-gray-700"
              />

              {showLedgerDropdown && (
                <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto bg-white border rounded-md shadow-lg">
                  {ledgers
                    .filter((l) =>
                      l.name.toLowerCase().includes(ledgerSearch.toLowerCase())
                    )
                    .map((ledger) => (
                      <div
                        key={ledger.ledger_guid}
                        onClick={() => {
                          setBillForm({
                            ...billForm,
                            ledgerGuid: ledger.ledger_guid,
                          });
                          setSelectedLedgerName(ledger.name);
                          setLedgerSearch("");
                          setShowLedgerDropdown(false);
                        }}
                        className="px-3 py-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-600"
                      >
                        <div className="text-sm font-medium">
                          {ledger.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {ledger.category || ledger.parent_group}
                        </div>
                      </div>
                    ))}

                  {ledgers.filter((l) =>
                    l.name
                      .toLowerCase()
                      .includes(ledgerSearch.toLowerCase())
                  ).length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No ledger found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bill No */}
          <div>
            <label className="block text-sm mb-1">Bill Number</label>
            <input
              type="text"
              value={billForm.billNo}
              onChange={(e) =>
                setBillForm({ ...billForm, billNo: e.target.value })
              }
              className="w-full h-11 rounded-lg border px-3 text-sm dark:bg-gray-700"
            />
          </div>

          {/* Bill Date */}
          <div>
            <label className="block text-sm mb-1">Bill Date</label>
            <input
              type="date"
              value={billForm.billDate}
              onChange={(e) =>
                setBillForm({ ...billForm, billDate: e.target.value })
              }
              className="w-full h-11 rounded-lg border px-3 text-sm dark:bg-gray-700"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm mb-1">Due Date</label>
            <input
              type="date"
              value={billForm.dueDate}
              onChange={(e) =>
                setBillForm({ ...billForm, dueDate: e.target.value })
              }
              className="w-full h-11 rounded-lg border px-3 text-sm dark:bg-gray-700"
            />
          </div>
        </div>

        {/* Amount */}
        <div className="mb-6">
          <label className="block text-sm mb-1">Amount</label>
          <input
            type="number"
            value={billForm.amount}
            onChange={(e) =>
              setBillForm({ ...billForm, amount: e.target.value })
            }
            className="w-full h-11 rounded-lg border px-3 text-sm dark:bg-gray-700"
          />
        </div>

        {/* Buttons */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-8">
          <button
            onClick={closeAddBill}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm "
          >
            Cancel
          </button>

          <button
            onClick={saveBill}
            disabled={
              !billForm.ledgerGuid ||
              !billForm.billNo ||
              !billForm.billDate ||
              !billForm.amount
            }
            className="px-8 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Save Bill
          </button>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

    </div>
  );
}