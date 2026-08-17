
import { useState, useEffect } from "react";
import {
  Edit,
  Trash2,
  Search,
  Download,
  FileSpreadsheet,
  FileText as PdfIcon,
} from "lucide-react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import API_BASE from "../api";
import { VoucherDataUpdate } from "./VoucherDataUpdate";
import DataState from "../components/DataState";

interface Voucher {
  id: string;
  date: string;
  type: string;
  amount: number;
  refNo: string;
  party: string;
  status: string;
}

interface VoucherExplorerProps {
  user: {
    role?: string;
    vouchersPermissions?: {
      can_view?: boolean;
      columns: Record<string, boolean>;
    };
  };
}

const voucherTypes = [
  "All",
  "Sales",
  "Purchase",
  "Payment",
  "Receipt",
  "Journal",
];

const statusTypes = ["All Status", "Approved", "Cancelled"];
export function VoucherExplorer({ user }: VoucherExplorerProps) {
  // 🔐 PERMISSION CHECK
  if (user.role !== "ADMIN" && user?.vouchersPermissions?.can_view === false) {
    return (
      <div className="p-10 text-center text-gray-500">
        You do not have permission to view vouchers.
      </div>
    );
  }

  const columns = {
    date: true,
    type: true,
    refNo: true,
    party: true,
    amount: true,
    status: true,
    actions: true,
    ...user?.vouchersPermissions?.columns,
  };

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showExport, setShowExport] = useState(false);
const [showModal, setShowModal] = useState(false);
const [editVoucherId, setEditVoucherId] = useState<string | null>(null);
const [editVoucherData, setEditVoucherData] = useState<any | null>(null);

  // **ADD THESE STATES FOR PAGINATION**
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // default 10 rows per page

const handleDeleteVoucher = async (voucherGuid: string) => {
  if (!window.confirm("Are you sure you want to delete this voucher?")) return;

  await axios.delete(`${API_BASE}/voucher-entry/${voucherGuid}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  setVouchers((prev) => prev.filter((v) => v.id !== voucherGuid));
};

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedType, selectedStatus, fromDate, toDate, pageSize]);



  const [allowedVoucherIds, setAllowedVoucherIds] =
  useState<Set<string> | null>(null);

useEffect(() => {
  const loadAllowedVouchers = async () => {
    if (user?.role === "ADMIN") {
      setAllowedVoucherIds(null);
      return;
    }

    const res = await axios.get(
      `${API_BASE}/voucher-entry/user-vouchers/${user.id}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    setAllowedVoucherIds(new Set(res.data.vouchers || []));
  };

  loadAllowedVouchers();
}, [user?.id, user?.role]);

  // ================= FILTER VOUCHERS =================
const filteredVouchers = vouchers.filter((v) => {
  // 🔐 ENFORCE USER-WISE ACCESS
  if (allowedVoucherIds && !allowedVoucherIds.has(v.id)) {
    return false;
  }

 const matchesSearch = (
  (v.refNo?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
  (v.party?.toLowerCase() || "").includes(searchQuery.toLowerCase())
);

  const matchesType =
    selectedType === "All" ||
    v.type?.toLowerCase() === selectedType.toLowerCase();

  const matchesStatus =
    selectedStatus === "All Status" || v.status === selectedStatus;

  const matchesFromDate =
    !fromDate || new Date(v.date) >= new Date(fromDate);

  const matchesToDate =
    !toDate || new Date(v.date) <= new Date(toDate);

  return (
    matchesSearch &&
    matchesType &&
    matchesStatus &&
    matchesFromDate &&
    matchesToDate
  );
});


  const neumorphicButtonStyle =
    "px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg active:shadow-inner";

  // FETCH DATA
  useEffect(() => {
    const fetchVouchers = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE}/voucher-entry`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });

        const formatted = (res.data.data || []).map((v: any) => ({
          id: v.voucher_guid,
          date: v.voucher_date,
          type: v.voucher_type,
          refNo: v.reference_no || "",
          party: v.party_name || v.party,
          amount: Number(v.amount),
          status: v.is_active ? "Approved" : "Cancelled",
        }));

        setVouchers(formatted);
      } finally {
        setLoading(false);
      }
    };
    fetchVouchers();
  }, []);

  // FILTER
  const totalRecords = filteredVouchers.length;
  const totalPages = Math.ceil(totalRecords / pageSize);

  const paginatedVouchers = filteredVouchers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // EXPORT CSV
  const exportVoucherCSV = () => {
    if (!filteredVouchers.length) return alert("No data to export");

    const header = "Date,Type,Reference No,Party,Amount,Status\n";
    const rows = filteredVouchers
      .map(
        (v) =>
          `${v.date},${v.type},${v.refNo},${v.party},${v.amount},${v.status}`
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "voucher-list.csv";
    a.click();
  };

  // EXPORT PDF
  const exportVoucherPDF = () => {
    if (!filteredVouchers.length) return alert("No data to export");

    const doc = new jsPDF("landscape");
    doc.text("Voucher List Report", 14, 15);

    autoTable(doc, {
      startY: 25,
      head: [["Date", "Type", "Ref No", "Party", "Amount", "Status"]],
      body: filteredVouchers.map((v) => [
        v.date,
        v.type,
        v.refNo,
        v.party,
        `₹${v.amount}`,
        v.status,
      ]),
    });

    doc.save("voucher-list.pdf");
  };

  // CLOSE EXPORT ON OUTSIDE CLICK
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".export-dropdown")) {
        setShowExport(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const visibleColumnCount = Object.values(columns).filter(Boolean).length;




  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl dark:text-white">Voucher Explorer</h1>
          <p className="text-gray-500">
            Manage all your vouchers and transactions
          </p>
        </div>

        {/* EXPORT */}
        <div className="flex items-center gap-3">
  {/* EXPORT */}
  <div className="relative export-dropdown">
    <button
      onClick={() => setShowExport(!showExport)}
      className={`flex items-center gap-2 bg-blue-600 text-white text-sm ${neumorphicButtonStyle}`}
    >
      <Download className="w-4 h-4" />
      Export List
    </button>

    {showExport && (
      <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border rounded-lg shadow-xl z-50">
        <button
          onClick={() => {
            exportVoucherCSV();
            setShowExport(false);
          }}
          className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <FileSpreadsheet className="w-4 h-4 text-green-600" />
          Excel
        </button>

        <button
          onClick={() => {
            exportVoucherPDF();
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

  {/* NEW VOUCHER */}
  {/* NEW VOUCHER (ADMIN ONLY) */}
{user.role === "ADMIN" && (
  <button
    onClick={() => {
      setEditVoucherId(null);
      setEditVoucherData(null);
      setShowModal(true);
    }}
    className="bg-blue-600 text-white px-4 py-2 rounded-lg"
  >
    + New Voucher
  </button>
)}
</div>


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
              placeholder="Search by reference number or party..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto">
            {voucherTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`${neumorphicButtonStyle} ${
                  selectedType === type
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                }`}
                style={{
                  boxShadow:
                    selectedType === type
                      ? "4px 4px 10px #d1d1d1, -4px -4px 10px #ffffff"
                      : "inset 2px 2px 6px #d1d1d1, inset -2px -2px 6px #ffffff",
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {statusTypes.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Voucher Table */}
      <DataState
  data={paginatedVouchers}
  loading={loading}
  message="No vouchers found"
>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <p className="p-6 text-center text-gray-500 dark:text-gray-400">
            Loading vouchers...
          </p>
        ) : (
         <div className="overflow-x-auto w-full max-w-full desktop-only">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  {columns.date && (
                    <th className="px-6 py-4 text-left text-xs uppercase">
                      Date
                    </th>
                  )}
                  {columns.type && (
                    <th className="px-6 py-4 text-left text-xs uppercase">
                      Voucher Type
                    </th>
                  )}
                  {columns.refNo && (
                    <th className="px-6 py-4 text-left text-xs uppercase">
                      Reference No.
                    </th>
                  )}
                  {columns.party && (
                    <th className="px-6 py-4 text-left text-xs uppercase">
                      Party
                    </th>
                  )}
                  {columns.amount && (
                    <th className="px-6 py-4 text-right text-xs uppercase">
                      Amount
                    </th>
                  )}
                  {columns.status && (
                    <th className="px-6 py-4 text-center text-xs uppercase">
                      Status
                    </th>
                  )}
                  {columns.actions && (
                    <th className="px-6 py-4 text-center text-xs uppercase">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedVouchers.map((voucher) => (
                  <tr
                    key={voucher.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    {columns.date && (
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {new Date(voucher.date).toLocaleDateString("en-IN")}
                      </td>
                    )}
                    {columns.type && (
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
                            voucher.type === "Sales" ||
                            voucher.type === "Receipt"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                              : voucher.type === "Purchase" ||
                                voucher.type === "Payment"
                              ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                          }`}
                        >
                          {voucher.type}
                        </span>
                      </td>
                    )}
                    {columns.refNo && (
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {voucher.refNo}
                      </td>
                    )}
                    {columns.party && (
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {voucher.party}
                      </td>
                    )}
                    {columns.amount && (
                      <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                        ₹{voucher.amount.toLocaleString()}
                      </td>
                    )}
                    {columns.status && (
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
                            voucher.status === "Approved"
                              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                              : voucher.status === "Cancelled"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400"
                          }`}
                        >
                          {voucher.status}
                        </span>
                      </td>
                    )}
                   {columns.actions && (
  <td className="px-6 py-4">
    <div className="flex items-center justify-center gap-2">
      

      {user.role === "ADMIN" && (
        <button
          onClick={() => handleDeleteVoucher(voucher.id)}
          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
        >
          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
        </button>
      )}
    </div>
  </td>
)}

                  </tr>
                ))}
                {filteredVouchers.length === 0 && (
                  <tr>
                    <td
                      colSpan={visibleColumnCount || 1}
                      className="px-6 py-4 text-center text-gray-500 dark:text-gray-400"
                    >
                      No vouchers found.
                    </td>
                  </tr>
                )}
              </tbody>
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
                  {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalRecords)} of {totalRecords}
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
        )}
        </div>


      {/* MOBILE VIEW */}

<div className="mobile-only bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
  {loading ? (
    <p className="p-6 text-center text-gray-500 dark:text-gray-400">
      Loading vouchers...
    </p>
  ) : paginatedVouchers.length === 0 ? (
    <p className="p-6 text-center text-gray-500 dark:text-gray-400">
      No vouchers found.
    </p>
  ) : (
   <div className="max-h-[500px] overflow-y-auto space-y-4 p-4">
      {paginatedVouchers.map((voucher) => (
        <div
          key={voucher.id}
          className="p-4 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600"
        >
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
            <div className="text-gray-500 font-bold">Date</div>
            <div className="text-gray-900 dark:text-white font-semibold">
              {new Date(voucher.date).toLocaleDateString("en-IN")}
            </div>

            <div className="text-gray-500 font-bold">Type</div>
            <div>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                  voucher.type === "Sales" || voucher.type === "Receipt"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                    : voucher.type === "Purchase" || voucher.type === "Payment"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                }`}
              >
                {voucher.type}
              </span>
            </div>

            <div className="text-gray-500 font-bold">Reference No.</div>
            <div className="text-gray-900 dark:text-white font-semibold">
              {voucher.refNo}
            </div>

            <div className="text-gray-500 font-bold">Party</div>
            <div className="text-gray-900 dark:text-white">{voucher.party}</div>

            <div className="text-gray-500 font-bold">Amount</div>
            <div className="text-gray-900 dark:text-white font-semibold">
              ₹{voucher.amount.toLocaleString()}
            </div>

            <div className="text-gray-500 font-bold">Status</div>
            <div>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                  voucher.status === "Approved"
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                    : voucher.status === "Cancelled"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400"
                }`}
              >
                {voucher.status}
              </span>
            </div>
          </div>

          {user.role === "ADMIN" && (
            <div className="flex justify-start pt-3">
             
            </div>
          )}
        </div>
      ))}
    </div>
  )}

  {/* Pagination */}
  {totalPages > 1 && (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <span>Rows:</span>
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
        <span>
          {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalRecords)} of {totalRecords}
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
          {currentPage} / {totalPages || 1}
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


      <VoucherDataUpdate
  open={showModal}
  onClose={() => {
    setShowModal(false);
    setEditVoucherId(null);
    setEditVoucherData(null);
    // 🔥 refetch vouchers
    axios.get(`${API_BASE}/voucher-entry`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    }).then(res => {
      const formatted = (res.data.data || []).map((v: any) => ({
        id: v.voucher_guid,
        date: v.voucher_date,
        type: v.voucher_type,
        refNo: v.reference_no || "",
        party: v.party_name || v.party,
        amount: Number(v.amount),
        status: v.is_active ? "Approved" : "Cancelled",
      }));
      setVouchers(formatted);
    });
  }}
  mode={editVoucherId ? "edit" : "create"}
  voucherGuid={editVoucherId || undefined}
  defaultType={editVoucherData?.type}
  defaultDate={editVoucherData?.date}
  defaultEntries={editVoucherData?.ledger_entries}
/>


    </div>
  );
}

