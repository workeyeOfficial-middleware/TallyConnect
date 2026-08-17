import { useEffect, useState } from "react";
import { FileText, Download, X, Loader2, ArrowLeft, Receipt } from "lucide-react";
import type { SettingsTab } from "../components/SettingsPage";

const LMS_BASE = "https://dashboard.licentic.org";
const PRODUCT_ID = "695902cfc240b17f16c3d716";


interface InvoicesPageProps {
  setActiveTab: React.Dispatch<React.SetStateAction<SettingsTab>>;
}
interface Invoice {
  id: string;
  date: string;
  plan: string;
  cycle: string;
  amount: number;
  status: string;
}

export default function InvoicesPage({
  setActiveTab,
}: InvoicesPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const token = localStorage.getItem("token");

  const getEmailFromToken = () => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.email;
    } catch {
      return null;
    }
  };

  const email =
    JSON.parse(localStorage.getItem("user") || "{}")?.email ||
    getEmailFromToken();

  useEffect(() => {
    (async () => {
      try {
        if (!email) {
          setError("User not found. Please log in again.");
          return;
        }

        let lmsUserId = "";

        try {
          const licRes = await fetch(
            `${LMS_BASE}/api/external/actve-license/${encodeURIComponent(email)}?productId=${PRODUCT_ID}`
          );
          if (licRes.ok) {
            const licData = await licRes.json();
            const lic =
              licData.activeLicense ?? licData.license ?? licData.data ?? licData;
            lmsUserId =
              (typeof lic.ownerUserId === "string"
                ? lic.ownerUserId
                : lic.ownerUserId?._id) ?? "";
          }
        } catch {
          // active-license call failed
        }

        if (!lmsUserId) {
          setError("No active license found. Purchase a plan to see invoices here.");
          return;
        }

        const res = await fetch(
          `${LMS_BASE}/api/payment/my-transactions?userId=${lmsUserId}`
        );
        const data = await res.json();
        const list: any[] = data?.transactions ?? [];

        setInvoices(
          list.map((t: any) => ({
            id: t._id,
            date: t.createdAt ?? "",
            plan: t.plan ?? "Plan",
            cycle: t.billingCycle ?? "monthly",
            amount: t.amount ?? 0,
            status: t.status ?? "paid",
          }))
        );
      } catch (e: any) {
        setError("Failed to load invoices. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handlePreview(id: string) {
    setPreviewing(true);
    setPreviewId(id);
    try {
      const res = await fetch(`${LMS_BASE}/api/payment/invoice/${id}`);
      if (!res.ok) throw new Error("Failed to fetch invoice");
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      setPreviewId(null);
    } finally {
      setPreviewing(false);
    }
  }

  function handleClosePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewId(null);
  }

  function handleDownload(id: string) {
    window.open(`${LMS_BASE}/api/payment/invoice/${id}`, "_blank");
  }

  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <>
      {/* ── Preview Modal ── */}
      {previewId && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleClosePreview}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="pointer-events-auto bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden border border-slate-200"
              style={{ maxHeight: "90vh" }}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-slate-400" />
                  <h2 className="font-semibold text-slate-800">Invoice Preview</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(previewId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </button>
                  <button
                    onClick={handleClosePreview}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal body */}
              <div
                className="flex-1 flex items-center justify-center bg-slate-50"
                style={{ minHeight: 520 }}
              >
                {previewing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-sm text-slate-400">Loading invoice…</p>
                  </div>
                ) : previewUrl ? (
                  <iframe
                    src={previewUrl}
                    title="Invoice Preview"
                    className="w-full"
                    style={{ minHeight: 520, height: "100%" }}
                  />
                ) : (
                  <p className="text-sm text-slate-400">Failed to load preview.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Main page ── */}
      <div className="space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
  Billing & Invoices
</h2>
              <p className="text-sm text-slate-500 mt-1">
                View your payment history and download invoices anytime.
              </p>
            </div>
            <button
              onClick={() =>setActiveTab("billing")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-sm font-medium transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-24">
              <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && invoices.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm">
              <div className="flex justify-center mb-4">
                <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-slate-400" />
                </div>
              </div>
              <h3 className="font-semibold text-slate-800 text-lg">No invoices yet</h3>
              <p className="text-slate-500 mt-2 text-sm max-w-xs mx-auto">
                Once you purchase or upgrade a plan, invoices will appear here.
              </p>
              <button
                onClick={() =>setActiveTab("billing")}
                className="mt-6 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                View Plans
              </button>
            </div>
          )}

          {/* ── Invoice List ── */}
{!loading && !error && invoices.length > 0 && (
  <div className="rounded-xl bg-white dark:bg-gray-700 overflow-hidden">

    {/* Desktop Table */}
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            {["Sr.No.", "Plan", "Billing Cycle", "Date", "Amount", "Status", "Actions"].map(
              (h, i) => (
                <th
                  key={h}
                  className={`px-5 py-3 text-xs font-semibold uppercase text-gray-500 dark:text-gray-300 ${
                    i === 6 ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {invoices.map((inv, i) => (
            <tr
              key={inv.id}
              className="hover:bg-gray-100 dark:hover:bg-gray-600 transition"
            >
              <td className="px-5 py-4 text-xs font-mono text-slate-400">
                {String(i + 1).padStart(2, "0")}
              </td>

              <td className="px-5 py-4 font-semibold text-slate-800 capitalize">
                {inv.plan}
              </td>

              <td className="px-5 py-4 capitalize text-slate-600">
                {inv.cycle}
              </td>

              <td className="px-5 py-4 text-slate-600">
                {inv.date
                  ? new Date(inv.date).toLocaleDateString("en-IN")
                  : "—"}
              </td>

              <td className="px-5 py-4 font-bold text-slate-900">
                ₹{Number(inv.amount).toLocaleString("en-IN")}
              </td>

              <td className="px-5 py-4">
                <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                  Paid
                </span>
              </td>

              <td className="px-5 py-4">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handlePreview(inv.id)}
                    className="px-3 py-1 text-xs border rounded-lg"
                  >
                    View
                  </button>

                  <button
                    onClick={() => handleDownload(inv.id)}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg"
                  >
                    Download
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Mobile Cards */}
    <div className="md:hidden space-y-4 p-4">
      {invoices.map((inv, i) => (
        <div
          key={inv.id}
          className="border rounded-xl p-4 shadow-sm bg-white dark:bg-gray-800"
        >
          <div className="flex justify-between items-center mb-2">
            <p className="font-semibold">{inv.plan}</p>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              Paid
            </span>
          </div>

          <p className="text-sm text-gray-500">
            Billing: <span className="capitalize">{inv.cycle}</span>
          </p>

          <p className="text-sm text-gray-500">
            Date:{" "}
            {inv.date
              ? new Date(inv.date).toLocaleDateString("en-IN")
              : "—"}
          </p>

          <p className="text-lg font-bold mt-2">
            ₹{Number(inv.amount).toLocaleString("en-IN")}
          </p>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => handlePreview(inv.id)}
              className="flex-1 border rounded-lg py-2 text-sm"
            >
              View
            </button>

            <button
              onClick={() => handleDownload(inv.id)}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm"
            >
              Download
            </button>
          </div>
        </div>
      ))}
    </div>

    {/* Footer */}
    <div className="px-5 py-3 bg-gray-100 dark:bg-gray-700 border-t flex justify-between text-xs">
      <p>
        Showing {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
      </p>
      <p className="font-bold">
        Total Paid: ₹{totalPaid.toLocaleString("en-IN")}
      </p>
    </div>
  </div>
)}
        </div>
    </>
  );
}
