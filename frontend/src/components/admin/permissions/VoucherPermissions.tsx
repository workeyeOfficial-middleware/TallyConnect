import { useEffect, useState } from "react";
import { Save, AlertTriangle } from "lucide-react";
import API_BASE from "../../../api";

export function VoucherPermissions({
  value,
  user,
  onChange,
    userIds,        // 👈 ADD
  isBulk = false, // 👈 ADD
  onDone,
  refreshCurrentUser,
}: any) {
const [local, setLocal] = useState({
  can_view: value?.can_view ?? true,
  columns: value?.columns || {},
});
const bulkMode = isBulk && Array.isArray(userIds) && userIds.length > 0;

  const [showConfirm, setShowConfirm] = useState(false);

useEffect(() => {
  setLocal({
    can_view: value?.can_view ?? true,
    columns: value?.columns || {},
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


  /* CLICK SAVE → SHOW CONFIRM */
  const save = () => {
    setShowConfirm(true);
  };

  /* CONFIRM SAVE */
const confirmSave = async () => {
  try {
    const url = bulkMode
      ? `${API_BASE}/users/bulk-voucher-permissions`
      : `${API_BASE}/users/${user.id}/voucher-permissions`;

    const body = bulkMode
      ? {
          userIds,
          permissions: local,
        }
      : local;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error("Failed to save permissions");

    // refresh only needed for single user
    if (!bulkMode) {
      await refreshCurrentUser?.();
    }

    setShowConfirm(false);
    onDone?.();
  } catch (err) {
    console.error("Error saving voucher permissions:", err);
    alert("Failed to save voucher permissions");
  }
};



  // 🔥 THIS IS THE KEY PART
  //await refreshCurrentUser(); // same as ledger







  return (
    <div className="p-6 space-y-6 w-full bg-white">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-lg font-black uppercase text-slate-900">
            Voucher Permissions
          </h2>
          <p className="text-xs text-slate-500">
            {user?.name} · {user?.company}
          </p>
        </div>
        

        {/* SAVE BUTTON */}
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

      {/* TABLE */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {/* MASTER ACCESS TOGGLE */}
<div className="flex items-center justify-between px-4 py-3 border-b">
  <span className="text-sm font-bold text-slate-700">
    Allow Voucher Access
  </span>
  

<button
  type="button"
  onClick={() =>
    setLocal((prev: any) => ({
      ...prev,
      can_view: !prev.can_view,
    }))
  }
  style={{
    width: "44px",
    height: "24px",
    backgroundColor:
      local.can_view !== false ? "#059669" : "#e5e7eb",
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
      left: local.can_view !== false ? "22px" : "2px",
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

        <div
          className="flex justify-between px-4 py-3 bg-slate-50
                     text-xs font-black uppercase border-b"
        >
          <span className="text-slate-600">Voucher Field</span>
          <span className="text-slate-600">Access</span>
        </div>

        {[
  { key: "date", label: "Date" },
  { key: "type", label: "Voucher Type" },
  { key: "refNo", label: "Reference No." },
  { key: "party", label: "Party" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions" },
]
.map((row) => (
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
      local.columns[row.key] !== false
        ? "#059669"
        : "#e5e7eb",
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
      left:
        local.columns[row.key] !== false ? "22px" : "2px",
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
              <p className="mt-2 text-xs text-slate-500">
                Are you sure you want to update voucher permissions for{" "}
              <b>
  {bulkMode
    ? `${userIds.length} users`
    : user?.name}
</b>?

              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                style={{
                  backgroundColor: "#ffffff",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                }}
                className="flex-1 py-2 rounded-lg
                           text-xs font-bold uppercase"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmSave}
                style={{ backgroundColor: "#059669", color: "#ffffff" }}
                className="flex-1 py-2 rounded-lg
                           text-xs font-bold uppercase"
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