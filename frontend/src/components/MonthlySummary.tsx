import { useState, useEffect, useRef } from "react";
import API_BASE from "../api";
import { ReferenceLine } from "recharts";

import {
  Download,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface MonthlyData {
  month: string;
  turnover: number;
  expense: number;
  profit: number;
}

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

const formatCompactINR = (value: number) => {
  if (Math.abs(value) >= 1_00_00_000)
    return `₹${(value / 1_00_00_000).toFixed(1)}Cr`;
  if (Math.abs(value) >= 1_00_000)
    return `₹${(value / 1_00_000).toFixed(1)}L`;
  if (Math.abs(value) >= 1_000)
    return `₹${(value / 1_000).toFixed(1)}K`;
  return `₹${value}`;
};


export function MonthlySummary() {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(false);

  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);


  const currentYear = new Date().getFullYear().toString();
const [selectedYear, setSelectedYear] = useState(currentYear);
const [activeCompanyGuid, setActiveCompanyGuid] = useState<string | null>(null);

const [previousYearTotals, setPreviousYearTotals] = useState<{
  turnover: number;
  expense: number;
  profit: number;
} | null>(null);

useEffect(() => {
  const fetchActiveCompany = async () => {
    try {
      const res = await fetch(`${API_BASE}/company/active`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await res.json();
      setActiveCompanyGuid(data.company_guid || null);
    } catch (err) {
      console.error("Failed to fetch active company", err);
    }
  };

  fetchActiveCompany();
}, []);

  /* ================= FETCH DATA ================= */


  useEffect(() => {
  if (!activeCompanyGuid) return;
  fetchMonthlySummary();
  fetchPreviousYearSummary();
}, [selectedYear, activeCompanyGuid]);

const fetchPreviousYearSummary = async () => {
  try {
    const prevYear = String(Number(selectedYear) - 1);

    const res = await fetch(
      `${API_BASE}/api/reports/monthly-summary?year=${prevYear}&company_guid=${activeCompanyGuid}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    if (!res.ok) return;

    const data: MonthlyData[] = await res.json();

    const totals = data.reduce(
      (acc, m) => {
        acc.turnover += m.turnover;
        acc.expense += m.expense;
        acc.profit += m.profit;
        return acc;
      },
      { turnover: 0, expense: 0, profit: 0 }
    );

    setPreviousYearTotals(totals);
  } catch {
    setPreviousYearTotals(null);
  }
};

const fetchMonthlySummary = async () => {
  if (!activeCompanyGuid) return;

  try {
    setLoading(true);

    const res = await fetch(
      `${API_BASE}/api/reports/monthly-summary?year=${selectedYear}&company_guid=${activeCompanyGuid}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Monthly summary API error:", err);
      setMonthlyData([]);
      return;
    }

    const data = await res.json();
    setMonthlyData(data || []);
  } catch (err) {
    console.error("Error fetching monthly summary:", err);
    setMonthlyData([]);
  } finally {
    setLoading(false);
  }
};


  /* ================= OUTSIDE CLICK ================= */
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* ================= EXPORT ================= */
  const exportCSV = () => {
    const headers = ["Month", "Turnover", "Expense", "Profit", "Margin %"];
    const rows = monthlyData.map((m) => {
      const margin =
        m.turnover > 0 ? ((m.profit / m.turnover) * 100).toFixed(2) : "0.00";
      return [
        `${m.month} ${selectedYear}`,
        m.turnover,
        m.expense,
        m.profit,
        margin,
      ];
    });
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Monthly_Summary_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  };

  const exportPDF = () => {
    window.print();
    setShowExport(false);
  };

  /* ================= TOTALS ================= */
  const totalTurnover = monthlyData.reduce((s, m) => s + m.turnover, 0);
  const totalExpense = monthlyData.reduce((s, m) => s + m.expense, 0);
  const totalProfit = monthlyData.reduce((s, m) => s + m.profit, 0);
  const profitMargin = totalTurnover
    ? ((totalProfit / totalTurnover) * 100).toFixed(2)
    : "0.00";

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-600 dark:text-gray-300">
        Loading monthly summary...
      </div>
    );
  }
const currentYearNum = new Date().getFullYear();
const years = Array.from(
  { length: 50 },
  (_, i) => String(currentYearNum - i)
);

  return (
    <div className="space-y-6">
      {/* ================= HEADER ================= */}
     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
  {/* Left: Title */}
  <div>
    <h1 className="text-3xl text-gray-900 dark:text-white">
      Monthly Summary Of voucheres
    </h1>
    <p className="text-gray-600 dark:text-gray-400 mt-1">
      Analyze your financial performance month-wise
    </p>
  </div>

  {/* Right: Year + Export */}
  <div className="flex items-center gap-3">
    {/* Year Selector */}
    <select
      value={selectedYear}
      onChange={(e) => setSelectedYear(e.target.value)}
      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
    >
      {years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>

    {/* Export Button */}
    <div className="relative" ref={exportRef}>
      <button
        onClick={() => setShowExport(!showExport)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
                   rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm"
      >
        <Download className="w-4 h-4" />
        Export Report
      </button>

      {showExport && (
        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800
                        border border-gray-200 dark:border-gray-700
                        rounded-lg shadow-lg z-50 overflow-hidden">
          <button onClick={exportCSV} className="w-full px-4 py-2 text-sm">
            Excel
          </button>
          <button onClick={exportPDF} className="w-full px-4 py-2 text-sm">
            PDF
          </button>
        </div>
      )}
    </div>
  </div>
</div>


      {/* ================= SUMMARY CARDS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryCard
          title="Total Turnover"
          value={totalTurnover}
          icon={TrendingUp}
          color="blue"
        />
        <SummaryCard
          title="Total Expense"
          value={totalExpense}
          icon={TrendingDown}
          color="red"
        />
        <SummaryCard
          title="Total Profit"
          value={totalProfit}
          icon={TrendingUp}
          color="green"
        />
        <SummaryCard
          title="Profit Margin"
          value={Number(profitMargin)}
          icon={TrendingUp}
          color="orange"
          isPercentage
        />
      </div>

      {/* ================= CHARTS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Monthly Turnover vs Expense">
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis dataKey="month" />
           <YAxis
  axisLine={false}
  tickLine={false}
  width={80}
  domain={[
    (dataMin: number) => Math.min(0, dataMin),
    (dataMax: number) => dataMax * 1.2,
  ]}
  tickFormatter={(value) => formatCompactINR(value)}
/>

<Tooltip
  formatter={(value: number) => `₹${value.toLocaleString()}`}
/>
            <Legend />
            <Bar dataKey="turnover" fill="#3B82F6" name="Turnover" />
            <Bar dataKey="expense" fill="#EF4444" name="Expense" />
            <Bar dataKey="profit" fill="#10B981" name="Profit" />
          </BarChart>
        </ChartCard>

        <ChartCard title="Profit Trend">
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis dataKey="month" />
            <YAxis
  axisLine={false}
  tickLine={false}
  width={80}
  domain={[
    (dataMin: number) => Math.min(0, dataMin),
    (dataMax: number) => dataMax * 1.2,
  ]}
  tickFormatter={(value) => formatCompactINR(value)}
/>

<Tooltip
  formatter={(value: number) => `₹${value.toLocaleString()}`}
/>
            <Legend />
            <Line dataKey="profit" stroke="#10B981" strokeWidth={3} />
          </LineChart>
        </ChartCard>
      </div>

      {/* ================= TABLE ================= */}
  <div className="desktop-only bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-4 text-left text-xs uppercase">Month</th>
              <th className="px-6 py-4 text-right text-xs uppercase">
                Turnover
              </th>
              <th className="px-6 py-4 text-right text-xs uppercase">
                Expense
              </th>
              <th className="px-6 py-4 text-right text-xs uppercase">Profit</th>
              <th className="px-6 py-4 text-right text-xs uppercase">
                Margin %
              </th>
            </tr>
          </thead>
          <tbody>
            {monthlyData.map((m) => {
              const margin =
                m.turnover > 0
                  ? ((m.profit / m.turnover) * 100).toFixed(2)
                  : "0.00";
              return (
                <tr key={m.month} className="border-t">
                  <td className="px-6 py-4">
                    {m.month} 
                  </td>
                  <td className="px-6 py-4 text-right">
                    ₹{m.turnover.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    ₹{m.expense.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    ₹{m.profit.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">{margin}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>


            {/* ================= TABLE – MOBILE ================= */}
<div className="mobile-only bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
  {monthlyData.length === 0 ? (
    <p className="p-6 text-center text-gray-500 dark:text-gray-400">
      No data available.
    </p>
  ) : (
    <div className="space-y-4 p-4">
      {monthlyData.map((m) => {
        const margin =
          m.turnover > 0
            ? ((m.profit / m.turnover) * 100).toFixed(2)
            : "0.00";

        return (
          <div
            key={m.month}
            className="p-4 rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
          >
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
              <div className="text-gray-500 font-semibold">Month</div>
              <div className="text-gray-900 dark:text-white">
                {m.month} 
              </div>

              <div className="text-gray-500 font-semibold">Turnover</div>
              <div className="text-gray-900 dark:text-white">
                ₹{m.turnover.toLocaleString()}
              </div>

              <div className="text-gray-500 font-semibold">Expense</div>
              <div className="text-gray-900 dark:text-white">
                ₹{m.expense.toLocaleString()}
              </div>

              <div className="text-gray-500 font-semibold">Profit</div>
              <div
                className={`font-semibold ${
                  m.profit >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                ₹{m.profit.toLocaleString()}
              </div>

              <div className="text-gray-500 font-semibold">Margin</div>
              <div className="text-gray-900 dark:text-white">
                {margin}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  )}
</div>
    </div>
  );
}

/* =================== HELPERS =================== */
function SummaryCard({ title, value, icon: Icon, color, isPercentage }: any) {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-gray-800 shadow-neumorphic flex items-center justify-between transition-transform hover:scale-[1.02]">
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
          {isPercentage ? `${value}%` : `₹${(value / 100000).toFixed(2)}L`}
        </p>
      </div>
      <div
        className={`p-4 rounded-full flex items-center justify-center ${colorClasses[color].bg} shadow-neu-icon transition-transform hover:scale-110`}
      >
        <Icon className={`w-6 h-6 ${colorClasses[color].icon}`} />
      </div>
    </div>
  );
}

function ChartCard({ title, children }: any) {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-gray-800 shadow-neumorphic transition-transform hover:scale-[1.02]">
      <h3 className="mb-4 text-gray-900 dark:text-white font-semibold">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}