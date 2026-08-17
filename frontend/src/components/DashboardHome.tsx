import { useEffect, useMemo, useState } from "react";
import { WelcomeBanner } from "./WelcomeBanner";
import API_BASE from "../api";

import axios from "axios";

import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Calendar,
  ArrowUpRight,
  BookOpen,
  FileText,
  ShoppingCart,
  Package,
  Download,
  FileSpreadsheet, // Added for UI consistency
  FileText as PdfIcon, // Added for UI consistency
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { PageType } from "./DashboardLayout";

// Import for export functionality
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

  const formatCompactINR = (value: number) => {
  const abs = Math.abs(value);

  if (abs >= 1_00_00_000)
    return `₹${(value / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000)
    return `₹${(value / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000)
    return `${Math.round(value / 1_000)}K`; // 👈 no ₹ for counts
  return `${value}`;
};

interface DashboardHomeProps {
  onNavigate: (page: PageType) => void;
  user: any;
}




export function DashboardHome({ onNavigate, user }: DashboardHomeProps) {

    // 🔒 1️⃣ Block non-admin immediately
  if (!user || user.role !== "ADMIN") {
    return null; // or show Unauthorized message
  }

  const [showExport, setShowExport] = useState(false);
 const [summary, setSummary] = useState<any>(null);
const [overviewData, setOverviewData] = useState<any[]>([]);
const [outstandingData, setOutstandingData] = useState<any[]>([]);
const [upcomingDues, setUpcomingDues] = useState<any[]>([]);


  const dashboardPerms = user?.dashboardPermissions?.widgets || {};

  const isAdmin = user?.role === "ADMIN";

  const canShow = (key: string) => isAdmin || dashboardPerms[key] !== false;

  /* ================= EXPORT LOGIC (UNCHANGED) ================= */

  const exportExcel = () => {
    const statsData = stats.map((s) => ({
      Metric: s.label,
Value: s.value.replace(/[^\d.,-]/g, ""),
      Change: s.change,
      Trend: s.trend,
    }));
    const wsStats = XLSX.utils.json_to_sheet(statsData);
    const overviewReportData = overviewData.map((d) => ({
      Month: d.name,
      Income: d.income,
      Expense: d.expense,
      Net: d.income - d.expense,
    }));
    const wsOverview = XLSX.utils.json_to_sheet(overviewReportData);
    const outstandingReportData = outstandingData.map((d) => ({
      Month: d.month,
      Outstanding: d.outstanding,
    }));
    const wsOutstanding = XLSX.utils.json_to_sheet(outstandingReportData);
    const upcomingDuesReportData = upcomingDues.map((d) => ({
      "Party Name": d.party,
      Amount: d.amount,
      "Due Date": d.dueDate,
      "Days Left": d.days,
    }));
    const wsDues = XLSX.utils.json_to_sheet(upcomingDuesReportData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsStats, "Key Metrics");
    XLSX.utils.book_append_sheet(wb, wsOverview, "Income_Expense");
    XLSX.utils.book_append_sheet(wb, wsOutstanding, "Outstanding_Trend");
    XLSX.utils.book_append_sheet(wb, wsDues, "Upcoming Dues");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "Dashboard_Report.xlsx",
    );
    setShowExport(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    let finalY = 15;
    doc.text("Dashboard Summary Report", 14, finalY);
    finalY += 10;

    autoTable(doc, {
      startY: finalY,
      head: [["Metric", "Value", "Change", "Trend"]],
      body: stats.map((s) => [s.label, s.value, s.change, s.trend]),
      headStyles: { fillColor: [59, 130, 246] },
      didDrawPage: (data) => {
        finalY = data.cursor.y + 10;
      },
    });

    autoTable(doc, {
      startY: finalY,
      head: [["Month", "Income", "Expense", "Net"]],
      body: overviewData.map((d) => [
        d.name,
          formatINR(d.income),
  formatINR(d.expense),
  formatINR(d.income - d.expense),
      ]),
      headStyles: { fillColor: [16, 185, 129] },
      didDrawPage: (data) => {
        finalY = data.cursor.y + 10;
      },
    });

    doc.save("Dashboard_Report.pdf");
    setShowExport(false);
  };
useEffect(() => {

   if (!user || user.role !== "ADMIN") return;
   
  const loadDashboard = async () => {
    try {
      const token = localStorage.getItem("token");

      const companyRes = await axios.get(`${API_BASE}/company/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const companyGuid = companyRes.data.company_guid;
      if (!companyGuid) return;

      const [summaryRes, incomeRes, billsRes] = await Promise.all([
  axios.get(`${API_BASE}/dashboard/summary`, {
    params: { company_guid: companyGuid },
    headers: { Authorization: `Bearer ${token}` },
  }),
  axios.get(`${API_BASE}/dashboard/income-expense`, {
    params: { company_guid: companyGuid },
    headers: { Authorization: `Bearer ${token}` },
  }),
  axios.get(`${API_BASE}/dashboard/bills`, {
    params: { company_guid: companyGuid },
    headers: { Authorization: `Bearer ${token}` },
  }),
]);


      setSummary(summaryRes.data);

      setOverviewData(
        incomeRes.data.map((r: any) => ({
          name: new Date(r.month).toLocaleString("default", { month: "short" }),
          income: Number(r.income),
          expense: Number(r.expense),
        }))
      );

      setOutstandingData(
        billsRes.data.slice(0, 10).map((b: any) => ({
          month: b.ledger_name,
          outstanding: Number(b.pending_amount),
        }))
      );

      setUpcomingDues(
        billsRes.data.slice(0, 5).map((b: any) => ({
          party: b.ledger_name,
          amount: Number(b.pending_amount),
          dueDate: b.due_date,
          days: Math.max(
            0,
            Math.ceil(
              (new Date(b.due_date).getTime() - Date.now()) / 86400000
            )
          ),
        }))
      );
    } catch (err) {
      console.error("Dashboard load failed", err);
    }
  };

  loadDashboard();
}, []);

 


const stats = [
  {
    label: "Total Receivables",
    value: formatCompactINR(summary?.receivables || 0),
    icon: TrendingUp,
    color: "blue",
    permissionKey: "totalReceivables",
  },
  {
    label: "Total Payables",
    value: formatCompactINR(summary?.payables || 0),
    icon: TrendingDown,
    color: "orange",
    permissionKey: "totalPayables",
  },
  {
    label: "Pending Bills",
    value: formatCompactINR(summary?.pending_bills || 0),
    icon: AlertCircle,
    color: "red",
    permissionKey: "pendingBills",
  },
  {
    label: "Cleared Bills",
    value: formatCompactINR(summary?.cleared_bills || 0),
    icon: CheckCircle,
    color: "green",
    permissionKey: "clearedBills",
  },
];




 




  const quickLinks = [
    { label: "Ledger List", icon: BookOpen, page: "ledgers", color: "blue" },
    {
      label: "Voucher Explorer",
      icon: FileText,
      page: "vouchers",
      color: "purple",
    },
    {
      label: "Order Book",
      icon: ShoppingCart,
      page: "orders",
      color: "orange",
    },
    { label: "Inventory", icon: Package, page: "inventory", color: "green" },
  ];
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [loadingLedgers, setLoadingLedgers] = useState(true);

  const quickLinkPermissionMap: Record<string, string> = {
    "Ledger List": "ledgers",
    "Voucher Explorer": "vouchers",
    "Order Book": "orders",
    Inventory: "inventory",
  };

  return (
    <div className="space-y-6">
      <WelcomeBanner userName={user?.name} />
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Dashboard Overview
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Welcome back! Here's what's happening today.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>December 8, 2025</span>
          </div>

          {/* UPDATED EXPORT UI */}
          <div className="relative">
            {canShow("incomeExpenseChart") && (
              <button
                onClick={() => setShowExport(!showExport)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export Report
              </button>
            )}

            {canShow("incomeExpenseChart") && showExport && (
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <button
                  onClick={exportExcel}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  Excel
                </button>
                <button
                  onClick={exportPDF}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors"
                >
                  <PdfIcon className="w-4 h-4 text-red-600" />
                  PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rest of the UI remains exactly the same... */}
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats
  .filter((stat) => canShow(stat.permissionKey))
  .map((stat, index) => {

          const Icon = stat.icon;
          const bgColorMap: Record<string, string> = {
            blue: "bg-blue-200 dark:bg-blue-700",
            orange: "bg-orange-200 dark:bg-orange-700",
            red: "bg-red-200 dark:bg-red-700",
            green: "bg-green-200 dark:bg-green-700",
          };
          const iconColorMap: Record<string, string> = {
            blue: "text-blue-600 dark:text-white",
            orange: "text-orange-600 dark:text-white",
            red: "text-red-600 dark:text-white",
            green: "text-green-600 dark:text-white",
          };

          return (
            <div
              key={index}
              className="p-6 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-between transition-transform hover:scale-105"
              style={{
                boxShadow:
                  "8px 8px 15px rgba(0,0,0,0.1), -8px -8px 15px rgba(255,255,255,0.7)",
              }}
            >
              <div className="flex-1 min-w-0">
  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
    {stat.label}
  </p>

  <p className="font-bold text-gray-900 dark:text-white mt-2
                text-lg sm:text-xl md:text-2xl
                whitespace-nowrap overflow-hidden text-ellipsis">
    {stat.value}
  </p>
</div>

              {/* Inset Icon */}
              <div
                className={`p-4 rounded-full flex items-center justify-center ${bgColorMap[stat.color]}`}
                style={{
                  boxShadow:
                    "inset 4px 4px 8px rgba(0,0,0,0.2), inset -4px -4px 8px rgba(255,255,255,0.7)",
                }}
              >
                <Icon className={`w-6 h-6 ${iconColorMap[stat.color]}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {canShow("incomeExpenseChart") && (
          <div
            className="bg-gray-100 dark:bg-gray-800 rounded-xl p-6 transition-transform hover:scale-105"
            style={{
              boxShadow:
                "8px 8px 15px rgba(0,0,0,0.1), -8px -8px 15px rgba(255,255,255,0.7)",
            }}
          >
            <h3 className="text-gray-900 dark:text-white font-semibold mb-4">
              Monthly Income & Expense
            </h3>
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={overviewData}>
    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.08} />

    <XAxis dataKey="name" axisLine={false} tickLine={false} />
<YAxis
  axisLine={false}
  tickLine={false}
  type="number"
  allowDecimals={false}
  width={80}
  domain={[0, "dataMax + 100000"]}
  tickFormatter={(value) => formatCompactINR(Number(value))}
/>


    <Tooltip formatter={(value: number) => formatINR(value)} />
    <Legend />

    <Bar dataKey="income" fill="#10B981" name="Income" />
    <Bar dataKey="expense" fill="#EF4444" name="Expense" />
  </BarChart>
</ResponsiveContainer>

          </div>
        )}

        {canShow("outstandingTrends") && (
          <div
            className="bg-gray-100 dark:bg-gray-800 rounded-xl p-6 transition-transform hover:scale-105"
            style={{
              boxShadow:
                "8px 8px 15px rgba(0,0,0,0.1), -8px -8px 15px rgba(255,255,255,0.7)",
            }}
          >
            <h3 className="text-gray-900 dark:text-white font-semibold mb-4">
              Outstanding Trends
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={outstandingData}>
                <defs>
                  <linearGradient
                    id="colorOutstanding"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  opacity={0.1}
                />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis
  axisLine={false}
  tickLine={false}
  width={80}
  domain={[0, "dataMax + 1000"]}
  tickFormatter={(value) => formatCompactINR(Number(value))}
/>
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="outstanding"
                  stroke="#3B82F6"
                  fillOpacity={1}
                  fill="url(#colorOutstanding)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Links Card */}
        <div
          className="p-6 rounded-2xl bg-gray-100 dark:bg-gray-800 transition-transform hover:scale-105"
          style={{
            boxShadow:
              "8px 8px 15px rgba(0,0,0,0.1), -8px -8px 15px rgba(255,255,255,0.7)",
          }}
        >
          <h3 className="text-gray-900 dark:text-white font-semibold mb-6">
            Quick Links
          </h3>

          <div className="grid grid-cols-1 gap-4">
            {quickLinks
              .filter((link) => canShow(quickLinkPermissionMap[link.label]))
              .map((link, index) => {
                const Icon = link.icon;
                return (
                  <button
                    key={index}
                    onClick={() => onNavigate(link.page)}
                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-100 dark:bg-gray-700/40
                       transition-transform hover:scale-105 hover:shadow-neumorphic-hover focus:outline-none"
                    style={{
                      boxShadow:
                        "4px 4px 8px rgba(0,0,0,0.08), -4px -4px 8px rgba(255,255,255,0.7)",
                    }}
                  >
                    {/* Neumorphic Icon Circle */}
                    <div
                      className="p-3 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center"
                      style={{
                        boxShadow:
                          "inset 4px 4px 6px rgba(0,0,0,0.15), inset -4px -4px 6px rgba(255,255,255,0.7)",
                      }}
                    >
                      <Icon
                        className={`w-5 h-5 text-${link.color}-600 dark:text-${link.color}-400`}
                      />
                    </div>

                    {/* Link Label */}
                    <span className="text-gray-800 dark:text-gray-200 font-medium group-hover:text-blue-600 transition-colors">
                      {link.label}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Upcoming Due Dates */}
        {canShow("upcomingDueDates") && (
          <div
            className="lg:col-span-2 p-6 rounded-2xl bg-gray-100 dark:bg-gray-800 transition-transform hover:scale-105"
            style={{
              boxShadow:
                "8px 8px 15px rgba(0,0,0,0.1), -8px -8px 15px rgba(255,255,255,0.7)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 dark:text-white font-semibold">
                Upcoming Due Dates
              </h3>
              <button
  onClick={() => onNavigate("ledgers")}
  className="text-sm text-blue-600 hover:underline"
>
  View All
</button>
            </div>

            <div className="space-y-3">
              {upcomingDues.map((due, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-xl bg-gray-100 dark:bg-gray-700/30 shadow-neumorphic-inner"
                  style={{
                    boxShadow:
                      "inset 4px 4px 6px rgba(0,0,0,0.1), inset -4px -4px 6px rgba(255,255,255,0.7)",
                  }}
                >
                  <div>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {due.party}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Due: {due.dueDate}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-gray-900 dark:text-white font-bold">
  {formatINR(due.amount)}
</p>

                    <p className="text-xs mt-1 text-orange-500">
                      {due.days} days left
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


