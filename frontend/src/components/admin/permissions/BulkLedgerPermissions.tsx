import { useState } from "react";
import API_BASE from "../../../api";

const DEFAULT_COLUMNS = {
  partyName: true,
  type: true,
  opening: true,
  outstanding: true,
  dueDays: true,
  actions: true,
};

type LedgerColumnKey = keyof typeof DEFAULT_COLUMNS;


export function BulkLedgerPermissions({
  userIds,
  onDone,
}: {
  userIds: string[];
  onDone: () => void;
}) {
const [local, setLocal] = useState<{
  columns: Record<LedgerColumnKey, boolean>;
}>({
  columns: DEFAULT_COLUMNS,
});

  const [saving, setSaving] = useState(false);

 const toggle = (key: LedgerColumnKey) => {

    setLocal((prev) => ({
      ...prev,
      columns: {
        ...prev.columns,
        [key]: !prev.columns[key],
      },
    }));
  };

  const save = async () => {
    setSaving(true);
    await fetch(`${API_BASE}/users/bulk-ledger-permissions`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        userIds,
        permissions: local,
      }),
    });
    setSaving(false);
    onDone();
  };

  return (
    <div className="bg-white border rounded-xl shadow-sm p-6 space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            Bulk Ledger Layout Access  Management
          </h3>
          <p className="text-sm text-slate-500">
            Apply column visibility to selected users
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="
               px-4 py-2
    bg-blue-600 text-white
    rounded-lg text-sm font-semibold
    hover:bg-blue-700
    disabled:opacity-50
            "
          >
            Apply to {userIds.length} Users
          </button>

          <button
            onClick={onDone}
            className="
              px-4 py-2
              border rounded-lg
              text-sm font-medium
              hover:bg-slate-50
            "
          >
            Cancel
          </button>
        </div>
      </div>

      {/* LIST */}
      <div className="border rounded-lg divide-y">
        {(Object.keys(local.columns) as LedgerColumnKey[]).map((key) => {
  const value = local.columns[key];

  return (

          <div
            key={key}
            className="flex items-center justify-between px-4 py-3"
          >
            <span className="text-sm font-medium capitalize text-slate-700">
              {key}
            </span>
<button
  type="button"
  onClick={() => toggle(key)}
  style={{
    width: "44px",
    height: "24px",
    backgroundColor: value ? "#1694f4" : "#e5e7eb",
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
      left: value ? "22px" : "2px",
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
        );
})}
      </div>
    </div>
  );
}
