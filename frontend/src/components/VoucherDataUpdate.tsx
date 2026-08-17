import axios from "axios";
import API_BASE from "../api";
import { useState, useEffect , useRef} from "react";
import { motion, AnimatePresence } from "framer-motion";


function normalizeDate(d?: string) {
  if (!d) return "";
  if (d.includes("T")) return d.split("T")[0]; // 🔥 FIX
  return d;
}


interface Ledger {
  ledger_guid: string;
  name: string;
  parent_group?: string;
  category?: string;
}


interface LedgerEntry {
  ledger_name: string;
  is_debit: boolean;
  amount: number;
}

interface VoucherDataUpdate {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  voucherGuid?: string;
  defaultType?: string;
  defaultDate?: string;
  defaultEntries?: LedgerEntry[];
}

export function VoucherDataUpdate({
  open,
  onClose,
  mode,
  voucherGuid,
  defaultType = "Journal",
  defaultDate = "",
  defaultEntries = [],
}: VoucherDataUpdate) {
  const [voucherType, setVoucherType] = useState(defaultType);
const getToday = () => new Date().toISOString().split("T")[0];


const [voucherDate, setVoucherDate] = useState(
  defaultDate ? normalizeDate(defaultDate) : getToday()
);

  const [entries, setEntries] = useState<LedgerEntry[]>(
  defaultEntries.length
    ? defaultEntries
    : [{ ledger_name: "", is_debit: true, amount: 0 }]
);


  const [saving, setSaving] = useState(false);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
const [ledgerSearch, setLedgerSearch] = useState("");
const [activeRow, setActiveRow] = useState<number | null>(null);
const modalRef = useRef<HTMLDivElement | null>(null);


useEffect(() => {
  if (mode === "edit") return; // 🔥 REQUIRED

  if (voucherType === "Sales") {
    setEntries([
      { ledger_name: "", is_debit: true, amount: 0 },
      { ledger_name: "Sales", is_debit: false, amount: 0 }
    ]);
    return;
  }

  if (voucherType === "Purchase") {
    setEntries([
      { ledger_name: "Purchase", is_debit: true, amount: 0 },
      { ledger_name: "", is_debit: false, amount: 0 }
    ]);
    return;
  }

  setEntries([{ ledger_name: "", is_debit: true, amount: 0 }]);
}, [voucherType, mode]);



useEffect(() => {
  const fetchLedgers = async () => {
    try {
      const response = await axios.get(`${API_BASE}/ledger`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      setLedgers(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch ledgers", error);
      setLedgers([]);
    }
  };

  fetchLedgers();
}, []);


useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      modalRef.current &&
      !modalRef.current.contains(event.target as Node)
    ) {
      setActiveRow(null);
      setLedgerSearch("");
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () =>
    document.removeEventListener("mousedown", handleClickOutside);
}, []);


  

 useEffect(() => {
  if (mode === "edit") {
    setVoucherType(defaultType || "Journal");
    setVoucherDate(normalizeDate(defaultDate));
    setEntries(defaultEntries || []);
  }
}, [mode, defaultType, defaultDate, defaultEntries]);



  const handleSubmit = async () => {
    setSaving(true);
    try {

        // ================= VALIDATION =================

if (!voucherDate) {
  alert("Please select voucher date");
  setSaving(false);
  return;
}

if (entries.length < 2) {
  alert("At least two ledger entries are required");
  setSaving(false);
  return;
}


if (voucherType === "Sales") {
  const debitCount = entries.filter(e => e.is_debit).length;
  const creditCount = entries.filter(e => !e.is_debit).length;

  if (debitCount !== 1 || creditCount < 1) {
    alert("Sales voucher must have 1 Debit (Customer) and Credit Sales ledgers");
    setSaving(false);
    return;
  }
}

if (voucherType === "Purchase") {
  const debitCount = entries.filter(e => e.is_debit).length;
  const creditCount = entries.filter(e => !e.is_debit).length;

  if (creditCount !== 1 || debitCount < 1) {
    alert("Purchase voucher must have 1 Credit (Supplier) and Debit Purchase ledgers");
    setSaving(false);
    return;
  }
}


let totalDebit = 0;
let totalCredit = 0;

for (const e of entries) {
  if (!e.ledger_name || e.amount <= 0) {
    alert("Ledger name and amount must be filled");
    setSaving(false);
    return;
  }

  if (e.is_debit) totalDebit += Number(e.amount);
  else totalCredit += Number(e.amount);
}

if (totalDebit !== totalCredit) {
  alert("Debit and Credit totals must be equal");
  setSaving(false);
  return;
}

// ================= END VALIDATION =================


      const payload = {
        voucher_type: voucherType,
        voucher_date: voucherDate,
        ledger_entries: entries,
        ...(mode === "edit" ? { voucher_guid: voucherGuid } : {}),
      };

      const url =
        mode === "create"
          ? `${API_BASE}/voucher-command/create`
          : `${API_BASE}/voucher-command/alter`;

      await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
alert("Voucher sent to Tally. It will appear after sync.");
      onClose();
    } catch (err) {
      console.error("Voucher save failed", err);
      alert("Failed to save voucher");
    } finally {
      setSaving(false);
    }
  };

  
   return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-2"
        >
          
          <motion.div
  ref={modalRef}

            initial={{ scale: 0.96, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 20, opacity: 0 }}
            transition={{ duration: 0.25 }}
          className="max-w-3xl w-[95%] bg-white rounded-2xl shadow-2xl border p-6 mx-auto max-h-[90vh] overflow-y-auto"

          >
            {/* Header */}
            <h2 className="text-xl font-semibold mb-6">
              {mode === "create" ? "New Voucher" : "Edit Voucher"}
            </h2>

            {/* Voucher Meta */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <select
                value={voucherType}
                onChange={(e) => setVoucherType(e.target.value)}
                className="md:col-span-2 h-11 rounded-lg border px-3 text-sm"
              >
                <option>Journal</option>
                <option>Payment</option>
                <option>Receipt</option>
                <option>Sales</option>
                <option>Purchase</option>
              </select>

              <input
  type="date"
  value={voucherDate}
  onChange={(e) => setVoucherDate(e.target.value)}
  className="h-11 rounded-lg border px-3 text-sm"
/>

            </div>

            {/* Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 px-2 mb-2">
              <div className="col-span-6">Ledger</div>
              <div className="col-span-3">Debit / Credit</div>
              <div className="col-span-3 text-right">Amount</div>
            </div>

            {/* Ledger Rows */}
            <div className="space-y-2">
              {entries.map((e, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center rounded-lg p-2 hover:bg-gray-50"
                >
                           <div className="relative md:col-span-6">


  <input
    type="text"
    placeholder="Search ledger..."
    value={e.ledger_name}
    onFocus={() => setActiveRow(i)}
    onChange={(ev) => {
      const copy = [...entries];
      copy[i].ledger_name = ev.target.value;
      setEntries(copy);
      setLedgerSearch(ev.target.value);
      setActiveRow(i);
    }}
    className="w-full h-11 rounded-md border px-3 text-sm"
  />

  {activeRow === i && (
  <div
    className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto bg-white border rounded-md shadow-lg"
    onMouseDown={(e) => e.stopPropagation()}
    onClick={(e) => e.stopPropagation()}
  >

      {ledgers
        .filter((l) =>
          l.name
            .toLowerCase()
            .includes((ledgerSearch || "").toLowerCase())
        )
        
        .map((ledger) => (
          <div
            key={ledger.ledger_guid}
            onClick={() => {
              const copy = [...entries];
              copy[i].ledger_name = ledger.name;
              setEntries(copy);
              setActiveRow(null);
              setLedgerSearch("");
            }}
            className="px-3 py-2 cursor-pointer hover:bg-blue-50"
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
          .includes((ledgerSearch || "").toLowerCase())
      ).length === 0 && (
        <div className="px-3 py-2 text-sm text-gray-500">
          No ledger found
        </div>
      )}
    </div>
  )}
</div>

                  <select
                    value={e.is_debit ? "debit" : "credit"}
                    onChange={(ev) => {
                      const copy = [...entries];
                      copy[i].is_debit = ev.target.value === "debit";
                      setEntries(copy);
                    }}
                    className="md:col-span-3 h-11 rounded-md border px-3 text-sm"
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>

                  <input
                    type="number"
                    value={e.amount}
                    onChange={(ev) => {
                      const copy = [...entries];
                      copy[i].amount = Number(ev.target.value);
                      setEntries(copy);
                    }}
                    className="md:col-span-3 h-11 rounded-md border px-3 text-sm text-right"
                  />
                </motion.div>
              ))}
            </div>

            {/* Add Line */}
            <button
              onClick={() =>
                setEntries([
                  ...entries,
                  { ledger_name: "", is_debit: true, amount: 0 },
                ])
              }
              className="mt-3 text-sm font-medium text-blue-600"
            >
              + Add Line
            </button>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-8">
              <button
                onClick={onClose}
                className="px-8 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-200"
              >
                Cancel
              </button>

              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-8 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Voucher"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
// Payment , receipt and journal, Payment ,Purchase  is working  read and create 