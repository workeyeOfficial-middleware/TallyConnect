import { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import API_BASE from "../api";
type DeleteHistoryItem = {
  id: number;
  company_guid: string;
  entity_type: "ledger" | "voucher";
  deleted_at: string;
  entity_data?: any;
};

export default function DeleteHistory() {
  const [history, setHistory] = useState<DeleteHistoryItem[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    try {
      console.log("Fetching delete history...");

      const token = localStorage.getItem("token");

      const res = await axios.get(
        `${API_BASE}/ledger/deleted/history`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("DELETE HISTORY RESPONSE:", res.data);

      setHistory(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch delete history", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const toggleSelect = (id: number) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((item) => item !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  const rollbackSelected = async () => {
    if (!selected.length) return;

    try {
      setLoading(true);

      const token = localStorage.getItem("token");

      await Promise.all(
        selected.map(async (id) => {
          const record = history.find((h) => h.id === id);
          if (!record) return;

          const url =
            record.entity_type === "voucher"
              ? `${API_BASE}/voucher-entry/deleted/restore-voucher/${id}`
              : `${API_BASE}/ledger/deleted/restore/${id}`;

          return axios.post(
            url,
            {},
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
        })
      );

      alert("Selected records restored successfully");

      setSelected([]);
      fetchHistory();
    } catch (err) {
      console.error("Rollback failed", err);
      alert("Rollback failed");
    }

    setLoading(false);
  };

  const getEntityName = (item: DeleteHistoryItem) => {
    try {
      const data =
        typeof item.entity_data === "string"
          ? JSON.parse(item.entity_data)
          : item.entity_data;

      if (!data) return "Unknown";

      if (item.entity_type === "ledger") {
        return data.name || "Unknown Ledger";
      }

      if (item.entity_type === "voucher") {
        return (
          data?.voucher?.reference_no ||
          data?.voucher?.voucher_type ||
          "Voucher"
        );
      }

      return "Unknown";
    } catch {
      return "Invalid Data";
    }
  };

  return (
    <motion.div
  className="p-4 sm:p-6 lg:p-8"
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
      <h1 className="text-lg sm:text-xl lg:text-2xl font-bold">Delete History</h1>

      <p className="text-gray-500 mt-2 mb-6">
        Here you can see deleted ledgers and vouchers and restore them back to Tally.
      </p>

      <div className="mb-4">
        <motion.button
  whileTap={{ scale: 0.95 }}
  whileHover={{ scale: 1.05 }}
          onClick={rollbackSelected}
          disabled={!selected.length || loading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? "Restoring..." : "Rollback Selected"}
        </motion.button>
      </div>


{/* MOBILE CARD VIEW */}
<div className="md:hidden space-y-4 mb-6">
  {history.length === 0 && (
    <div className="text-center text-gray-500">
      No deleted records found
    </div>
  )}

  {history.map((item) => (
    <motion.div
  key={item.id}
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  whileHover={{ scale: 1.02 }}
  transition={{ duration: 0.3 }}
  className={`rounded-xl p-4 border transition shadow-md hover:shadow-xl ${
  selected.includes(item.id)
    ? "bg-blue-50 border-blue-400 shadow-lg"
    : "bg-white border-gray-100"
}`}
>
      <div className="flex justify-between items-center mb-2">
       <span
  className={`text-xs px-3 py-1 rounded-full font-medium ${
    item.entity_type === "ledger"
      ? "bg-blue-100 text-blue-700"
      : "bg-green-100 text-green-700"
  }`}
>
          {item.entity_type}
        </span>

        <button
  type="button"
  onClick={() => toggleSelect(item.id)}
  style={{
    width: "44px",
    height: "24px",
    backgroundColor: selected.includes(item.id) ? "#1694f4" : "#e5e7eb",
    borderRadius: "999px",
    position: "relative",
    border: "1px solid #cbd5e1",
    cursor: "pointer",
  }}
>
  <span
    style={{
      position: "absolute",
      top: "2px",
      left: selected.includes(item.id) ? "22px" : "2px",
      width: "18px",
      height: "18px",
      backgroundColor: "#ffffff",
      borderRadius: "50%",
      transition: "left 0.25s ease",
      boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
    }}
  />
</button>
      </div>

      <p className="text-sm">
        <span className="font-medium">Name:</span>{" "}
        {getEntityName(item)}
      </p>

      <p className="text-sm">
        <span className="font-medium">Company:</span>{" "}
        {item.company_guid}
      </p>

      <p className="text-sm">
        <span className="font-medium">Deleted:</span>{" "}
        {new Date(item.deleted_at).toLocaleString()}
      </p>
    </motion.div>
 
 ))}
</div>

      <div className="hidden md:block bg-white shadow rounded">
  <div className="overflow-x-auto">
    <table className="min-w-[700px] w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left whitespace-nowrap">Select</th>
<th className="p-3 text-left whitespace-nowrap">Type</th>
<th className="p-3 text-left whitespace-nowrap">Name / Reference</th>
<th className="p-3 text-left whitespace-nowrap">Company</th>
<th className="p-3 text-left whitespace-nowrap">Deleted At</th>
            </tr>
          </thead>

          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  No deleted records found
                </td>
              </tr>
            )}

            {history.map((item) => (
              <tr key={item.id} className="border-t">
               <td className="p-3 whitespace-nowrap">
                  <button
  type="button"
  onClick={() => toggleSelect(item.id)}
  style={{
    width: "40px",
    height: "22px",
    backgroundColor: selected.includes(item.id) ? "#1694f4" : "#e5e7eb",
    borderRadius: "999px",
    position: "relative",
    border: "1px solid #cbd5e1",
    cursor: "pointer",
  }}
>
  <span
    style={{
      position: "absolute",
      top: "2px",
      left: selected.includes(item.id) ? "20px" : "2px",
      width: "16px",
      height: "16px",
      backgroundColor: "#ffffff",
      borderRadius: "50%",
      transition: "left 0.25s ease",
      boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
    }}
  />
</button>
                </td>

                <td className="p-3 whitespace-nowrap capitalize">{item.entity_type}</td>

<td className="p-3 whitespace-nowrap">{getEntityName(item)}</td>

<td className="p-3 whitespace-nowrap">{item.company_guid}</td>

<td className="p-3 whitespace-nowrap">
                  {new Date(item.deleted_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
   </motion.div>
 
);
}