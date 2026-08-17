import { useEffect, useState, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import API_BASE from "../api";
import DataState from "../components/DataState";


import axios from "axios";
import { ArrowLeft, Download, Printer,  } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
   Cell,

} from "recharts";


interface LedgerDetailViewProps {
  ledgerId: string;
  onBack: () => void;
}

interface Ledger {
  name: string;
  type: "Dr" | "Cr";
  opening_balance: number;
  closing_balance: number;
}

interface Voucher {
  id: string;
  voucher_date: string;
  voucher_type: string;
  reference_no: string;
  debit: number;
  credit: number;
  balance: number;
  status?: string;
}


interface Ageing {
  period: string;
  amount: number;
}




export function LedgerDetailView({ ledgerId, onBack }: LedgerDetailViewProps) {
  const [activeTab, setActiveTab] = useState<
    "vouchers" | "invoices" | "bills" | "ageing"

  >("vouchers");

  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [ageing, setAgeing] = useState<Ageing[]>([]);

const chartRef = useRef<HTMLDivElement>(null);
const [chartWidth, setChartWidth] = useState(600);

const [showExportMenu, setShowExportMenu] = useState(false);
const exportRef = useRef<HTMLDivElement>(null);



const handlePdfExport = () => {
  const doc = new jsPDF();

  // ✅ Title
  doc.setFontSize(16);
  doc.text(`${ledger?.name} - ${activeTab.toUpperCase()}`, 14, 15);

  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

  let columns: string[] = [];
  let rows: any[] = [];

  switch (activeTab) {
    case "vouchers":
      columns = ["Date", "Type", "Ref No", "Debit", "Credit"];
      rows = vouchers.map(v => [
       v.voucher_date?.split("T")[0],
        v.voucher_type,
        v.reference_no,
        v.debit ? `₹${v.debit}` : "-",
        v.credit ? `₹${v.credit}` : "-"
      ]);
      break;

    case "invoices":
      columns = ["Date", "Invoice No", "Type", "Party", "Amount"];
      rows = invoices.map(i => [
        i.invoice_date?.split("T")[0],
        i.invoice_no,
        i.invoice_type,
        i.party_name,
        `₹${i.total_amount}`
      ]);
      break;

    case "bills":
      columns = ["Bill Name", "Ledger", "Due Date", "Amount"];
      rows = bills.map(b => [
        b.bill_name,
        b.ledger_name,
        b.due_date?.split("T")[0],
        `₹${b.amount}`
      ]);
      break;

    case "ageing":
      columns = ["Period", "Amount"];
      rows = ageing.map(a => [
        a.period,
        `₹${a.amount}`
      ]);
      break;

    default:
      return;
  }

  // ✅ Table
  autoTable(doc, {
    startY: 28,
    head: [columns],
    body: rows,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [37, 99, 235], // blue-600
      textColor: 255,
    },
  });

  // ✅ Download
  doc.save(`${ledger?.name}-${activeTab}.pdf`);
};

useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (
      exportRef.current &&
      !exportRef.current.contains(e.target as Node)
    ) {
      setShowExportMenu(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);


useEffect(() => {
  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setError("You are not logged in.");
        return;
      }

      const ledgerRes = await axios.get(
        `${API_BASE}/ledger/${ledgerId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLedger(ledgerRes.data);

      const voucherRes = await axios.get(
  `${API_BASE}/voucher-entry/ledger/${ledgerId}`,
  { headers: { Authorization: `Bearer ${token}` } }
);

      setVouchers(voucherRes.data || []);

      const invoiceRes = await axios.get(
        `${API_BASE}/invoice/ledger/${ledgerId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInvoices(invoiceRes.data || []);

      const billRes = await axios.get(
        `${API_BASE}/bill/ledger/${ledgerId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBills(billRes.data || []);

      const ageingRes = await axios.get(
        `${API_BASE}/ageing/ledger/${ledgerId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAgeing(
        (ageingRes.data || []).map((a: any) => ({
          period: String(a.period),
          amount: Number(a.amount),
        }))
      );

    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("Access denied. You do not have permission to view this ledger.");
      } else if (err.response?.status === 401) {
        setError("Session expired. Please login again.");
      } else {
        setError("Failed to load ledger details.");
      }
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, [ledgerId]);



useEffect(() => {
  if (activeTab === "ageing" && chartRef.current) {
    setChartWidth(chartRef.current.offsetWidth);
  }
}, [activeTab]);
  



  if (loading) {
    return <p className="p-6 text-center">Loading ledger details...</p>;
  }

if (error) {
  return (
    <div className="p-10 flex flex-col items-center gap-4">
      <p className="text-red-600 font-medium text-lg">
        {error}
      </p>

      <button
        onClick={onBack}
        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
      >
        Go Back
      </button>
    </div>
  );
}


  if (!ledger) return null;

  const totalDebit = vouchers.reduce(
  (sum, v) => sum + Number(v.debit || 0),
  0
);

const totalCredit = vouchers.reduce(
  (sum, v) => sum + Number(v.credit || 0),
  0
);
const barColors: Record<string, string> = {
  "0-30": "#4f9cf9",
  "31-60": "#22c55e",
  "61-90": "#facc15",
  "90+": "#fb7185",
};




  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1">
          <h1 className="text-3xl font-semibold">{ledger.name}</h1>
          <p className="text-gray-500">Ledger Account Details</p>
        </div>

        <div className="flex gap-2">
          <button className="px-4 py-2 bg-gray-200 rounded-lg flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print
          </button>
        <div className="relative" ref={exportRef}>
  <button
    onClick={() => setShowExportMenu(prev => !prev)}
    className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"
  >
    <Download className="w-4 h-4" />
    Export
  </button>

  {showExportMenu && (
    <div className="absolute right-0 mt-2 w-40 bg-white border rounded-lg shadow-lg z-50">
      <button
        onClick={() => {
          handlePdfExport();
          setShowExportMenu(false);
        }}
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
      >
        📄 Export as PDF
      </button>

      {/* future options */}
      {/* 
      <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100">
        📊 Export as CSV
      </button>
      */}
    </div>
  )}
</div>


        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 bg-white rounded-xl border">
          <p className="text-sm text-gray-500">Account Type</p>
          <p className="text-2xl font-semibold mt-2">
            {ledger.type === "Dr" ? "Debit" : "Credit"}
          </p>
        </div>

        <div className="p-6 bg-white rounded-xl border">
          <p className="text-sm text-gray-500">Opening Balance</p>
          <p className="text-2xl mt-2">
            ₹{ledger.opening_balance.toLocaleString()}
          </p>
        </div>

        <div className="p-6 bg-white rounded-xl border">
          <p className="text-sm text-gray-500">Total Debit</p>
          <p className="text-2xl text-green-600 mt-2">
            ₹{totalDebit.toLocaleString()}
          </p>
        </div>

        <div className="p-6 bg-white rounded-xl border">
          <p className="text-sm text-gray-500">Total Credit</p>
          <p className="text-2xl text-red-600 mt-2">
            ₹{totalCredit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border">
     <div className="border-b flex overflow-x-auto whitespace-nowrap">

          {["vouchers", "invoices", "bills" , "ageing"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
          className={`px-4 py-3 w-1/2 md:w-auto
text-sm font-medium border-b-2 flex-shrink-0 transition-colors ${
  activeTab === tab
    ? "border-blue-600 text-blue-600"
    : "border-transparent text-gray-500 hover:text-gray-700"
}`}

            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "vouchers" && (
              <DataState
    data={vouchers}
    loading={loading}
    message="No vouchers found"
  >
            <div className="desktop-only bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Ref No</th>
                    <th className="px-4 py-2 text-right">Debit</th>
                    <th className="px-4 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v) => (
                    <tr key={v.id} className="border-t">
                      <td className="px-4 py-2">
  {v.voucher_date?.split("T")[0]}
</td>
                      <td className="px-4 py-2">{v.voucher_type}</td>
                      <td className="px-4 py-2">{v.reference_no}</td>
                      <td className="px-4 py-2 text-right text-green-600">
                        {v.debit ? `₹${v.debit.toLocaleString()}` : "-"}
                      </td>
                      <td className="px-4 py-2 text-right text-red-600">
                        {v.credit ? `₹${v.credit.toLocaleString()}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
              </DataState>
          )}


                   {/* VOUCHERS – MOBILE */}
  {activeTab === "vouchers" && (
    <div className="mobile-only space-y-4">
      {vouchers.length === 0 ? (
        <p className="p-4 text-center text-gray-500">
          No vouchers found.
        </p>
      ) : (
        vouchers.map((v) => (
          <div
            key={v.id}
            className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
          >
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-gray-500 font-semibold">Date</div>
              <div>{v.voucher_date?.split("T")[0]}</div>

              <div className="text-gray-500 font-semibold">Type</div>
              <div>{v.voucher_type}</div>

              <div className="text-gray-500 font-semibold">Ref No</div>
              <div>{v.reference_no}</div>

              <div className="text-gray-500 font-semibold">Debit</div>
              <div className="text-green-600">
                {v.debit ? `₹${v.debit.toLocaleString()}` : "-"}
              </div>

              <div className="text-gray-500 font-semibold">Credit</div>
              <div className="text-red-600">
                {v.credit ? `₹${v.credit.toLocaleString()}` : "-"}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )}


   {activeTab === "invoices" && (

    <DataState
    data={invoices}
    loading={loading}
    message="No invoices found"
  >
    
          <div className=" desktop-only bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full border-collapse">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left">Date</th>
          <th className="px-4 py-2 text-left">Invoice No</th>
          <th className="px-4 py-2 text-left">Type</th>
          <th className="px-4 py-2 text-left">Party</th>
          <th className="px-4 py-2 text-right">Amount</th>
        </tr>
      </thead>

      <tbody>
        {invoices.map((inv) => (
          <tr key={inv.id} className="border-t">
            <td className="px-4 py-2">
             {inv.invoice_date?.split("T")[0]}
            </td>

            <td className="px-4 py-2">
              {inv.invoice_no}
            </td>

            <td className="px-4 py-2">
              {inv.invoice_type}
            </td>

            <td className="px-4 py-2">
              {inv.party_name}
            </td>

            <td className="px-4 py-2 text-right">
              ₹{inv.total_amount}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
    </div>
      </DataState>
)}



        {/* INVOICES – MOBILE */}
  {activeTab === "invoices" && (
    <div className="mobile-only space-y-4">
      {invoices.length === 0 ? (
        <p className="p-4 text-center text-gray-500">
          No invoices found.
        </p>
      ) : (
        invoices.map((inv) => (
          <div
            key={inv.id}
            className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
          >
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-gray-500 font-semibold">Date</div>
              <div>{inv.invoice_date?.split("T")[0]}</div>

              <div className="text-gray-500 font-semibold">Invoice No</div>
              <div>{inv.invoice_no}</div>

              <div className="text-gray-500 font-semibold">Type</div>
              <div>{inv.invoice_type}</div>

              <div className="text-gray-500 font-semibold">Party</div>
              <div>{inv.party_name}</div>

              <div className="text-gray-500 font-semibold">Amount</div>
              <div className="font-semibold text-blue-600">
                ₹{Number(inv.total_amount).toLocaleString()}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )}

{activeTab === "bills" && (

  <DataState
    data={bills}
    loading={loading}
    message="No bills found"
  >
  <div className="desktop-only bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full border-collapse">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left">Bill Name</th>
          <th className="px-4 py-2 text-left">Ledger</th>
          <th className="px-4 py-2 text-left">Due Date</th>
          <th className="px-4 py-2 text-right">Amount</th>
        </tr>
      </thead>

      <tbody>
     {bills.map((b) => (
  <tr key={`${b.bill_name}-${b.due_date}`} className="border-t">

            <td className="px-4 py-2">
              {b.bill_name}
            </td>

            <td className="px-4 py-2">
              {b.ledger_name}
            </td>

            <td className="px-4 py-2">
              {b.due_date?.split("T")[0]}
            </td>

            <td className="px-4 py-2 text-right">
              ₹{Number(b.pending_amount || 0).toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  </div>
  </DataState>
)}



        {/* BILLS – MOBILE */}
    {activeTab === "bills" && (
    <div className="mobile-only space-y-4">
      {bills.length === 0 ? (
        <p className="p-4 text-center text-gray-500">
          No bills found.
        </p>
      ) : (
        bills.map((b) => (
          <div
            key={`${b.bill_name}-${b.due_date}`}
            className="p-4 rounded-lg bg-white dark:bg-gray-800
                      border border-gray-200 dark:border-gray-700 shadow-sm"
          >
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-gray-500 font-semibold">Bill Name</div>
              <div>{b.bill_name}</div>

              <div className="text-gray-500 font-semibold">Ledger</div>
              <div>{b.ledger_name}</div>

              <div className="text-gray-500 font-semibold">Due Date</div>
              <div>{b.due_date?.split("T")[0]}</div>

              <div className="text-gray-500 font-semibold">Amount</div>
              <div className="font-semibold text-blue-600">
                ₹{Number(b.pending_amount || 0).toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )}

{activeTab === "ageing" && (
  <DataState
    data={ageing}
    loading={loading}
    message="No ageing data found"
  >
   <div className="desktop-only">
  <div ref={chartRef} className="w-full h-72">

    <BarChart
      width={chartWidth}
      height={300}
      data={ageing}
      barCategoryGap="25%"
    >
      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
      <XAxis dataKey="period" />
      <YAxis />
      <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />

<Bar dataKey="amount" radius={[6, 6, 0, 0]}>
  {ageing.map((entry, index) => (
    <Cell
      key={index}
      fill={barColors[entry.period] || "#2563eb"}
    />
  ))}
</Bar>
    </BarChart>

  </div>
  </div>
  </DataState>

)}

{/* AGEING – MOBILE */}
  {activeTab === "ageing" && (
         
  <DataState
    data={ageing}
    loading={loading}
    message="No ageing data found"
  >
    <div className="mobile-only overflow-x-auto">
      <div className="min-w-[320px]">
        <BarChart
          width={320}
          height={220}
          data={ageing}
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />

          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
            {ageing.map((entry, index) => (
              <Cell
                key={index}
                fill={barColors[entry.period] || "#2563eb"}
              />
            ))}
          </Bar>
        </BarChart>
      </div>
    </div>
   </DataState> 
  )}




    {/* AGEING TABLE
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left">Period</th>
            <th className="px-4 py-2 text-right">Amount</th>
          </tr>
        </thead>
      <tbody>
  {ageing.map((a) => (
    <tr key={a.period} className="border-t">

              <td className="px-4 py-2">{a.period}</td>
              <td className="px-4 py-2 text-right">
                ₹{Number(a.amount).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

  </div>
)} */}




        </div>
      </div>
    </div>
  );
}


// hi