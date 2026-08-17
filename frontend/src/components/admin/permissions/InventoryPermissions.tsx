import { useEffect, useState } from "react";
import { Save, AlertTriangle } from "lucide-react";
import API_BASE from "../../../api";

const ALL_COLUMNS = {
  itemCode: false,
  itemName: false,
  opening: false,
  inward: false,
  outward: false,
  closingStock: false,
  rate: false,
  value: false,
  actions: false,
};


export function InventoryPermissions({
  value,
  user,
  onChange,
  onDone,
  refreshCurrentUser,
}: any) {
  const [local, setLocal] = useState({
    columns: {
      ...ALL_COLUMNS,
      ...(value?.columns || {}),
    },
  });

  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setLocal({
      columns: {
        ...ALL_COLUMNS,
        ...(value?.columns || {}),
      },
    });
  }, [value]);

  const toggle = (key: string) => {
    setLocal((prev: any) => ({
      ...prev,
      columns: {
        ...prev.columns,
        [key]: !prev.columns[key],
      },
    }));
  };

  const save = () => setShowConfirm(true);

  const confirmSave = async () => {
    try {
      const res = await fetch(
      `${API_BASE}/users/${user.id}/inventory-permissions`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(local), // ✅ REQUIRED
        }
      );

      if (!res.ok) throw new Error("Failed to save inventory permissions");

      onChange?.(local);
      await refreshCurrentUser();
      setShowConfirm(false);
      onDone?.();
    } catch (err) {
      console.error(err);
      alert("Failed to save inventory permissions");
    }
  };

  return (
    <div className="p-6 space-y-6 w-full bg-white">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-lg font-black uppercase text-slate-900">
            Inventory Permissions
          </h2>
          <p className="text-xs text-slate-500">
            {user?.name} · {user?.company}
          </p>
        </div>

        <button
          type="button"
          onClick={save}
          style={{ backgroundColor: "#059669", color: "#ffffff" }}
          className="flex items-center gap-2 px-6 py-2 rounded-lg
                     text-xs font-black uppercase shadow"
        >
          <Save size={16} color="#ffffff" />
          Save
        </button>
      </div>

      {/* PERMISSIONS LIST */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex justify-between px-4 py-3 bg-slate-50 text-xs font-black uppercase border-b">
          <span className="text-slate-600">Field</span>
          <span className="text-slate-600">Access</span>
        </div>

        {[
          { key: "itemCode", label: "Item Code" },
          { key: "itemName", label: "Item Name" },
          { key: "opening", label: "Opening" },
          { key: "inward", label: "Inward" },
          { key: "outward", label: "Outward" },
          { key: "closingStock", label: "Closing Stock" },
          { key: "rate", label: "Rate" },
          { key: "value", label: "Value" },
          { key: "actions", label: "Action" },
        ].map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between px-4 py-4 border-t"
          >
            <span className="text-sm font-semibold text-slate-700">
              {row.label}
            </span>

          

<button
  type="button"
  onClick={() => toggle(row.key)}
  style={{
    width: "44px",
    height: "24px",
    backgroundColor:
      local.columns[row.key] === true ? "#059669" : "#e5e7eb",
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
      left: local.columns[row.key] === true ? "22px" : "2px",
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


        ))}
      </div>

      {/* CONFIRM MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-96 shadow-2xl">
            <div className="text-center">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="mt-4 text-sm font-black uppercase">
                Confirm Changes?
              </h3>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 rounded-lg text-xs font-bold uppercase border"
              >
                Cancel
              </button>

              <button
                onClick={confirmSave}
                style={{ backgroundColor: "#059669", color: "#ffffff" }}
                className="flex-1 py-2 rounded-lg text-xs font-bold uppercase"
              >
                Yes, Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
