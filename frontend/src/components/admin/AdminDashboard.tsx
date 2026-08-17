
import { useEffect, useState } from "react";
import {
  Search,
  Trash2,
  UserPlus,
  BookOpen,
  BarChart3,
  ShoppingCart,
  Package,
  Ticket,
  Building2,
} from "lucide-react";

import { OrderBookPermissions } from "./permissions/OrderBookPermissions";
import { VoucherPermissions } from "./permissions/VoucherPermissions";

import { MonthlySummaryPermissions } from "./MonthlySummaryControls";
import { CreateUserModal } from "./CreateUserModal";
import { LedgerPermissions } from "./permissions/LedgerPermissions";
import { InventoryPermissions } from "./permissions/InventoryPermissions";
import { DashboardPermissions } from "./permissions/DashboardPermissions";
import { CompanySelectionPermissions } from "./permissions/CompanySelectionPermissions";
import { LedgerSelectionPermissions } from "./permissions/LedgerSelectionPermissions";
import { VoucherSelectionPermissions } from "./permissions/VoucherSelectionPermissions";
import { OrderSelectionPermissions } from "./permissions/OrderSelectionPermissions";
import { InventorySelectionPermissions } from "./permissions/InventorySelectionPermissions";
import API_BASE from "../../api";
import { BulkLedgerSelectionPermissions }
  from "./permissions/BulkLedgerSelectionPermissions";
import { BulkOrderSelectionPermissions }
  from "./permissions/BulkOrderSelectionPermissions";
import { BulkInventorySelectionPermissions }
  from "./permissions/BulkInventorySelectionPermissions";
import { BulkVoucherSelectionPermissions }
  from "./permissions/BulkVoucherSelectionPermissions";

import { BulkOrderBookPermissions } 
  from "./permissions/BulkOrderBookPermissions";

  import { BulkLedgerPermissions } 
  from "./permissions/BulkLedgerPermissions";

  import { BulkInventoryPermissions }
  from "./permissions/BulkInventoryPermissions";

  import { BulkDashboardPermissions } from "./permissions/BulkDashboardPermissions";


/* ================= TYPES ================= */
type PermissionKey =
  | "ledgers"
  | "monthlySummary"
  | "orders"
  | "vouchers"
  | "inventory"
  | "ledgerSelection"
  | "voucherSelection"
  | "orderSelection"
  | "inventorySelection"
  | "voucherAmount";

interface User {
  id: string;
  name: string;
  email: string;
  company: string;
  password?: string;
  inviteStatus?: "pending" | "sent" | "logged_in";
    avatarUrl?: string; // ✅ ADD THIS
  ledgerPermissions: {
    columns: Record<string, boolean>;
  };
  ordersPermissions?: { columns: Record<string, boolean> };
  ledgerSelectionPermissions?: { columns: Record<string, boolean> }; // ✅ ADD
  voucherSelectionPermissions?: { columns: Record<string, boolean> };
  orderSelectionPermissions?: { columns: Record<string, boolean> };
  inventorySelectionPermissions?: { columns: Record<string, boolean> };
  vouchersPermissions?: { columns: Record<string, boolean> };
  inventoryPermissions?: { columns: Record<string, boolean> }; // ✅ ADD
  dashboardPermissions?: { widgets: Record<string, boolean> }; // ✅ ADD
}

interface ActiveLicense {
  licenseType: {
    features: {
      featureSlug: string;
      value?: number;
      limit?: number;
    }[];
  };
}

export function AdminDashboard({
  role,
  ledgerPermissions,
  onLedgerPermissionsChange,
  refreshCurrentUser, // ✅ ADD
}: {
  role: "ADMIN" | "USER";
  ledgerPermissions: any;
  onLedgerPermissionsChange: (p: any) => void;
  refreshCurrentUser: () => void; // ✅ ADD
}) {
  // 🔐 ADMIN GUARD (THIS IS THE ONLY PLACE IT SHOULD EXIST)
  if (role !== "ADMIN") {
    return (
      <div className="p-8 text-center text-slate-600">
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="mt-2">
          You do not have permission to access the Admin Panel.
        </p>
      </div>
    );
  }

  const [users, setUsers] = useState<User[]>([]);

  const currentUserEmail =
  JSON.parse(localStorage.getItem("user") || "{}")?.email;

  const [animatingUserId, setAnimatingUserId] = useState<string | null>(null);

const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

const [inviteCooldowns, setInviteCooldowns] = useState<
  Record<string, number>
>({});
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // ===== BULK MODE STATE (ADD ONLY) =====
const [bulkSelectMode, setBulkSelectMode] = useState(false);
const [bulkMode, setBulkMode] = useState(false);
const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

const resetBulk = () => {
  setBulkMode(false);
  setBulkSelectMode(false);
  setSelectedUserIds([]);
};

  const [allowedUsers, setAllowedUsers] = useState<number | null>(null);
const [requests, setRequests] = useState<any[]>([]);
const [loadingRequests, setLoadingRequests] = useState(false);

  const [view, setView] = useState<"users" | "permissions" | "monthly" | "requests">(
    "users"
  );

  const [activeModule, setActiveModule] = useState<
    | "dashboard"
    | "ledger"
    | "monthly"
    | "orders"
    | "vouchers"
    | "ledgerSelection"
     | "voucherSelection"
  | "orderSelection"
  | "inventorySelection"
    | "inventory"
  >("dashboard");

  /* ================= LOAD USERS FROM DB ================= */

const fetchLicense = async () => {
  try {
    const email =
      JSON.parse(localStorage.getItem("user") || "{}")?.email;

    if (!email) return;

    const res = await fetch(
      `https://dashboard.licentic.org/api/external/actve-license/${email}?productId=695902cfc240b17f16c3d716`
    );
    const data = await res.json();

    const rawFeatures =
      data?.activeLicense?.licenseType?.features ??
      data?.activeLicense?.licenseTypeId?.features;

    console.log("LICENSE FEATURES:", rawFeatures);

    // ✅ OBJECT-BASED FEATURES (your real case)
    if (rawFeatures && typeof rawFeatures === "object") {
      const allowed = rawFeatures["user-limit"];
      setAllowedUsers(typeof allowed === "number" ? allowed : null);
      return;
    }

    // ❌ fallback (array-based, just in case)
    setAllowedUsers(null);
  } catch (err) {
    console.error("Failed to fetch license", err);
    setAllowedUsers(null);
  }
};

  useEffect(() => {
  fetchUsers();
}, []);

  useEffect(() => {
  fetchLicense();
}, [users.length]);

useEffect(() => {
  fetchRequests();
}, []);

  const fetchUsers = async () => {
    try {
const res = await fetch(`${API_BASE}/users`, {  
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await res.json();

      setUsers(
        data.map((u: any) => ({
          id: u.id,
          name: u.username,
          email: u.email,
          company: u.company || "-",
          inviteStatus: u.invite_status || "pending",
              avatarUrl: u.avatar_url || null, // ✅ ADD THIS
          vouchersPermissions: u.vouchers_permissions || { columns: {} },
          ordersPermissions: u.orders_permissions || { columns: {} },
          inventoryPermissions: u.inventory_permissions || { columns: {} }, // ✅ ADD
          dashboardPermissions: u.dashboard_permissions || { widgets: {} },
          voucherSelectionPermissions: u.voucher_selection_permissions || { columns: {} },
orderSelectionPermissions: u.order_selection_permissions || { columns: {} },
inventorySelectionPermissions: u.inventory_selection_permissions || { columns: {} },

          ledgerSelectionPermissions: u.ledger_selection_permissions || {
            columns: {},
          },

          ledgerPermissions: u.ledger_permissions || {
            columns: {
              partyName: true,
              type: true,
              opening: true,
              outstanding: true,
              dueDays: true,
              actions: true,
            },
          },
        }))
      );
    } catch (err) {
      console.error("Failed to load users", err);
    }
  };

const handleSendInvite = async (userId: string) => {
  const user = users.find((u) => u.id === userId);
  if (!user) {
    console.warn("[SEND-INVITE] ❌ User not found in local state, userId:", userId);
    return;
  }

  const now = Date.now();

  if (inviteCooldowns[userId] && inviteCooldowns[userId] > now) {
    console.log("[SEND-INVITE] ⏳ Cooldown active for userId:", userId);
    return;
  }

  try {
    setAnimatingUserId(userId);

    console.log("[SEND-INVITE] 📡 Fetching invite info for userId:", userId);

    const infoRes = await fetch(`${API_BASE}/users/${userId}/invite-info`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const infoData = await infoRes.json();
    console.log("[SEND-INVITE] invite-info response:", {
      status: infoRes.status,
      ok: infoRes.ok,
      email: infoData?.email,
      username: infoData?.username,
      hasPassword: !!infoData?.password,
    });

    if (!infoRes.ok) {
      console.error("[SEND-INVITE] ❌ invite-info fetch failed:", infoData);
      alert("Failed to fetch user info for invite");
      return;
    }

    console.log("[SEND-INVITE] 📤 Sending invite email to:", infoData.email);

    const res = await fetch(`${API_BASE}/send-invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        email: infoData.email,
        username: infoData.username,
        password: infoData.password,
      }),
    });

    const data = await res.json();
    console.log("[SEND-INVITE] send-invite response:", {
      status: res.status,
      ok: res.ok,
      data,
    });

    if (!res.ok) {
      console.error("[SEND-INVITE] ❌ Email send failed:", data);
      alert(data.message || "Email failed");
      return;
    }

    console.log("[SEND-INVITE] ✅ Invite sent successfully to:", infoData.email);

    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, inviteStatus: "sent" } : u
      )
    );

    window.dispatchEvent(new Event("refresh-notifications"));

    setInviteCooldowns((prev) => ({
      ...prev,
      [userId]: Date.now() + RESEND_COOLDOWN_MS,
    }));

  } catch (err) {
    console.error("[SEND-INVITE] 💥 Unexpected error:", err);
    alert("Failed to send invite");
  } finally {
    setAnimatingUserId(null);
  }
};


const handleBulkInvite = async () => {
  const selectedUsers = users.filter((u) =>
    selectedUserIds.includes(u.id)
  );

  if (selectedUsers.length === 0) return;

  try {
    const res = await fetch(`${API_BASE}/send-invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        users: selectedUsers.map((u) => ({
          email: u.email,
          username: u.name,
        })),
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    setUsers((prev) =>
      prev.map((u) =>
        selectedUserIds.includes(u.id)
          ? { ...u, inviteStatus: "sent" }
          : u
      )
    );

    resetBulk();
    alert("Bulk invites sent successfully");
  } catch (err: any) {
    alert(err.message || "Bulk invite failed");
  }
};

  const handleDeleteUser = async (userId: string) => {

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this user?"
    );

    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) {
        throw new Error("Delete failed");
      }

      // Remove user from UI
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      // 🔔 ADD THIS (this is the missing piece)
window.dispatchEvent(new Event("refresh-notifications"));
    } catch (err) {
      alert("Failed to delete user");
    }
  };

  /* ================= CREATE USER ================= */
  const handleCreateUser = async (data: {
    name: string;
    email: string;
    company: string;
    password: string;
  }) => {
    try {
const res = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(data),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message);

      const newUser: User = {
        id: result.user.id,
        name: result.user.username,
        email: result.user.email,
        company: data.company,
         password: data.password,
        ledgerPermissions: { columns: {} },
        ordersPermissions: { columns: {} },
        vouchersPermissions: { columns: {} },
        inventoryPermissions: { columns: {} }, // ✅ ADD
        voucherSelectionPermissions: { columns: {} },
  orderSelectionPermissions: { columns: {} },
  inventorySelectionPermissions: { columns: {} },
      };

      setUsers((prev) => [...prev, newUser]);
      setShowCreate(false);
      window.dispatchEvent(new Event("refresh-notifications"));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const notifyUserPermissionUpdate = async (
  userId: string,
  moduleName: string
) => {
  await fetch(`${API_BASE}/notify-permission-update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({
      userIds: [userId],
      modules: [moduleName],
    }),
  });
};
  /* ================= PERMISSIONS VIEW ================= */
if (view === "permissions" && (selectedUser || bulkMode)) {
  const isBulk = bulkMode;
    return (
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-64 bg-white rounded-xl p-3 border border-slate-200 h-fit">
          {[
          //  { key: "dashboard", label: "Dashboard Layout", icon: BarChart3 },
            { key: "ledger", label: "Ledgers Layout", icon: BookOpen },
            { key: "vouchers", label: "Vouchers Layout", icon: Ticket },
            { key: "orders", label: "Orders Layout", icon: ShoppingCart },
            { key: "inventory", label: "Inventory Layout", icon: Package },
           // { key: "monthly", label: "Monthly Summary", icon: BarChart3 },
            {
              key: "ledgerSelection",
              label: "Ledger Selection",
              icon: BookOpen,
            },
            {
  key: "voucherSelection",
  label: "Voucher Selection",
  icon: Ticket,
},
{
  key: "orderSelection",
  label: "Order Selection",
  icon: ShoppingCart,
},
{
  key: "inventorySelection",
  label: "Inventory Selection",
  icon: Package,
},

            
            

          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveModule(key as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-colors
        ${
          activeModule === key
            ? "bg-blue-50 text-blue-700 font-semibold"
            : "text-slate-600 font-medium hover:bg-slate-50"
        }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1">
{!isBulk && activeModule === "ledger" && selectedUser && (
  <LedgerPermissions
    value={selectedUser.ledgerPermissions}
    user={selectedUser}
    onDone={async () => {
  await notifyUserPermissionUpdate(selectedUser.id, "Ledger Selection");
  setView("users");
}}
  />
)}


          {isBulk && activeModule === "ledgerSelection" && (
  <BulkLedgerSelectionPermissions
    userIds={selectedUserIds}
    onApply={async (ledgerIds) => {
  const res = await fetch(`${API_BASE}/users/bulk-ledger-assign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({
      userIds: selectedUserIds,
      ledgerIds,
      enableLedgerSelection: true,
    }),
  });

  if (res.ok) {
    await fetch(`${API_BASE}/notify-permission-update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        userIds: selectedUserIds,
        modules: ["Ledger Selection"],
      }),
    });
  }

  resetBulk();
  setView("users");
}}
    onCancel={() => {
  resetBulk();
  setView("users");
    }}
  />
)}

{isBulk && activeModule === "ledger" && (
  <BulkLedgerPermissions
    userIds={selectedUserIds}
    onDone={() => {
      resetBulk();
      setView("users");
    }}
  />
)}

{isBulk && activeModule === "dashboard" && (
  <BulkDashboardPermissions
    userIds={selectedUserIds}
    onDone={() => {
      resetBulk();
      setView("users");
    }}
  />
)}

{isBulk && activeModule === "orderSelection" && (
  <BulkOrderSelectionPermissions
    userIds={selectedUserIds}
    onApply={async (orderIds) => {
  const res = await fetch(`${API_BASE}/orders/bulk-user-orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({
      userIds: selectedUserIds,
      orders: orderIds,
    }),
  });

  if (res.ok) {
    await fetch(`${API_BASE}/notify-permission-update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        userIds: selectedUserIds,
        modules: ["Order Selection"],
      }),
    });
  }

  resetBulk();
  setView("users");
}}
    onCancel={() => {
      resetBulk();
      setView("users");
    }}
  />
)}


{isBulk && activeModule === "inventorySelection" && (
  <BulkInventorySelectionPermissions
    userIds={selectedUserIds}
   onApply={async (items) => {
  const res = await fetch(`${API_BASE}/inventory/bulk-user-inventory`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({
      userIds: selectedUserIds,
      items,
    }),
  });

  if (res.ok) {
    await fetch(`${API_BASE}/notify-permission-update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        userIds: selectedUserIds,
        modules: ["Inventory Selection"],
      }),
    });
  }

  resetBulk();
  setView("users");
}}
    onCancel={() => {
      resetBulk();
      setView("users");
    }}
  />
)}

{isBulk && activeModule === "voucherSelection" && (
  <BulkVoucherSelectionPermissions
    userIds={selectedUserIds}
    onApply={async (voucherIds) => {
  const res = await fetch(`${API_BASE}/voucher-entry/bulk-user-vouchers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({
      userIds: selectedUserIds,
      vouchers: voucherIds,
    }),
  });

  if (res.ok) {
    await fetch(`${API_BASE}/notify-permission-update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        userIds: selectedUserIds,
        modules: ["Voucher Selection"],
      }),
    });
  }

  resetBulk();
  setView("users");
}}
    onCancel={() => {
      resetBulk();
      setView("users");
    }}
  />
)}


          {activeModule === "dashboard" && selectedUser && (
            <DashboardPermissions
              value={selectedUser.dashboardPermissions || { widgets: {} }}
              user={selectedUser}
              onDone={async () => {
                await refreshCurrentUser(); // ✅ THIS IS REQUIRED
                setView("users");
              }}
            />
          )}

          {activeModule === "monthly" && selectedUser && (
            <MonthlySummaryPermissions
              value={
                selectedUser.monthlySummaryPermissions || {
                  cards: {},
                  columns: {},
                  charts: {},
                }
              }
              user={selectedUser}
              onChange={(newPermissions) => {
                setUsers((prev) =>
                  prev.map((u) =>
                    u.id === selectedUser.id
                      ? { ...u, monthlySummaryPermissions: newPermissions }
                      : u
                  )
                );
              }}
              onDone={() => setView("users")}
            />
          )}

          {activeModule === "inventory" && selectedUser && (
            <InventoryPermissions
              value={selectedUser.inventoryPermissions || { columns: {} }}
              user={selectedUser}
              onChange={(newPermissions) => {
                setUsers((prev) =>
                  prev.map((u) =>
                    u.id === selectedUser.id
                      ? { ...u, inventoryPermissions: newPermissions }
                      : u
                  )
                );
              }}
              refreshCurrentUser={refreshCurrentUser}
              onDone={() => setView("users")}
            />
          )}

   {/* SINGLE USER */}
{!isBulk && activeModule === "orders" && selectedUser && (
  <OrderBookPermissions
    value={selectedUser.ordersPermissions || { columns: {} }}
    user={selectedUser}
    onChange={(newPermissions) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? { ...u, ordersPermissions: newPermissions }
            : u
        )
      );
    }}
    refreshCurrentUser={refreshCurrentUser}
    onDone={() => setView("users")}
  />
)}


{/* SINGLE USER – Ledger Selection */}
{!isBulk && activeModule === "ledgerSelection" && selectedUser && (
  <LedgerSelectionPermissions
    user={selectedUser}
    value={selectedUser.ledgerSelectionPermissions || { columns: {} }}
    onDone={async () => {
      await fetch(`${API_BASE}/notify-permission-update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          userIds: [selectedUser.id],
          modules: ["Ledger Selection"],
        }),
      });

      setView("users");
    }}
  />
)}


{activeModule === "voucherSelection" && selectedUser && (
  <VoucherSelectionPermissions
    user={selectedUser}
    value={selectedUser.voucherSelectionPermissions || { columns: {} }}
    onDone={async () => {
      await notifyUserPermissionUpdate(
        selectedUser.id,
        "Voucher Selection"
      );
      setView("users");
    }}
  />
)}

{activeModule === "orderSelection" && selectedUser && (
  <OrderSelectionPermissions
    user={selectedUser}
    value={selectedUser.orderSelectionPermissions || { columns: {} }}
    onDone={async () => {
      await notifyUserPermissionUpdate(
        selectedUser.id,
        "Order Selection"
      );
      setView("users");
    }}
  />
)}

{activeModule === "inventorySelection" && selectedUser && (
  <InventorySelectionPermissions
    user={selectedUser}
    value={selectedUser.inventorySelectionPermissions || { columns: {} }}
    onDone={async () => {
      await notifyUserPermissionUpdate(
        selectedUser.id,
        "Inventory Selection"
      );
      setView("users");
    }}
  />
)}

{isBulk && activeModule === "inventory" && (
  <BulkInventoryPermissions
    userIds={selectedUserIds}
    onDone={() => {
      resetBulk();
      setView("users");
    }}
  />
)}

{activeModule === "vouchers" && selectedUser && !isBulk && (
  <VoucherPermissions
    value={selectedUser.vouchersPermissions || { columns: {} }}
    user={selectedUser}
    onChange={(newPermissions) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? { ...u, vouchersPermissions: newPermissions }
            : u
        )
      );
    }}
    refreshCurrentUser={fetchUsers}
    onDone={() => setView("users")}
  />
)}

{isBulk && activeModule === "orders" && (
  <BulkOrderBookPermissions
    userIds={selectedUserIds}
    onDone={() => {
      resetBulk();
      setView("users");
    }}
  />
)}

          {/* BULK – vouchers */}
{isBulk && activeModule === "vouchers" && (
  <VoucherPermissions
    isBulk
    userIds={selectedUserIds}
    onDone={() => {
      resetBulk();
      setView("users");
    }}
  />
)}

        </div>
      </div>
    );
  }

  /* ================= Requests by user VIEW ================= */

if (view === "requests") {
  return (
   <div
  style={{
    minHeight: "100vh",
    padding: "1.5rem",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    
    // ✅ MODERN PROFESSIONAL BACKGROUND
    backgroundColor: "#f8fafc",
    backgroundImage: `
      radial-gradient(at 0% 0%, hsla(210,100%,98%,1) 0, transparent 50%), 
      radial-gradient(at 100% 0%, hsla(220,30%,94%,1) 0, transparent 50%)
    `,
    
    // ✅ REFINED CURVE (Matches modern dashboard trends)
    borderTopLeftRadius: "24px", 
    borderTopRightRadius: "24px",
    border: "1px solid #e2e8f0", // Subtle top border to define the area
    boxShadow: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)",
  }}
>
      <div
        style={{
          width: "100%",
          maxWidth: "1000px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
          borderRadius: "24px",
          padding: "2rem",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <style>{`
          .req-card {
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          .req-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 25px rgba(0,0,0,0.2);
          }
          .back-btn:hover {
            background: #e0e7ff !important;
            color: #4338ca !important;
          }
        `}</style>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "2rem",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "6px",
              }}
            >
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>

              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ffffff", margin: 0 }}>
                User Requests
              </h1>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#cbd5f5", margin: 0 }}>
              {loadingRequests
                ? "Loading..."
                : `${requests.length} request${requests.length !== 1 ? "s" : ""} from your users`}
            </p>
          </div>

          <button
            className="back-btn"
            onClick={() => setView("users")}
            style={{
              padding: "8px 16px",
              borderRadius: "10px",
              border: "1px solid #c7d2fe",
              background: "#ffffff",
              color: "#6366f1",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Back
          </button>
        </div>

        {/* Empty */}
        {!loadingRequests && requests.length === 0 && (
          <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
            <h3 style={{ color: "#ffffff", marginBottom: "6px" }}>No requests yet</h3>
            <p style={{ color: "#cbd5f5", fontSize: "0.9rem" }}>
              When users send requests, they will appear here.
            </p>
          </div>
        )}

        {/* Cards */}
        {!loadingRequests && requests.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              maxWidth: "600px",
            }}
          >
            {requests.map((req) => (
              <div
                key={req.id}
                className="req-card"
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  padding: "1.25rem",
                }}
              >
                <p style={{ fontWeight: 600, marginBottom: "2px" }}>
                  {req.user_name}
                </p>

                <p style={{ color: "#64748b", fontSize: "0.8rem", marginBottom: "8px" }}>
                  {req.user_email}
                </p>

                <p style={{ color: "#374151", fontSize: "0.9rem", margin: 0 }}>
                  {req.message}
                </p>
                <button
  onClick={() => {
    const user = users.find((u) => u.email === req.user_email);

    if (!user) {
      alert("User not found");
      return;
    }

    setSelectedUser(user);
    setView("permissions");
    setActiveModule("ledgerSelection");
  }}
  style={{
    marginTop: "10px",
    padding: "6px 12px",
    borderRadius: "8px",
    background: "#2563eb",
    color: "#fff",
    fontSize: "12px",
    fontWeight: "600",
    border: "none",
    cursor: "pointer",
  }}
>
  Configure
</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

  /* ================= USERS LIST ================= */
  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.company.toLowerCase().includes(search.toLowerCase())
  );

  /* =================  Request By users ================= */
const fetchRequests = async () => {
  try {
    setLoadingRequests(true);

    const res = await fetch(`${API_BASE}/admin/requests`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const data = await res.json();
    setRequests(data || []);
  } catch (err) {
    console.error("Failed to fetch requests", err);
  } finally {
    setLoadingRequests(false);
  }
};






  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
          <p className="text-sm text-slate-500">
            Manage company access and permissions
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full md:w-auto">
 

  {/* Buttons row — wraps cleanly on mobile */}
  <div className="flex flex-col gap-3 w-full md:w-auto">
  {/* Search bar */}
  <div className="relative w-full">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
    <input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Search..."
      className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-white w-full md:w-64 text-sm outline-none"
    />
  </div>

  {/* Buttons — 2 columns on mobile, auto on desktop */}
  <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
    {bulkSelectMode && selectedUserIds.length > 0 ? (
      <button
        onClick={() => {
          setBulkMode(true);
          setSelectedUser(null);
          setView("permissions");
          setActiveModule("ledgerSelection");
        }}
        className="col-span-2 px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition text-sm"
        style={{ backgroundColor: "#0f172a", color: "#ffffff" }}
      >
        Bulk Configure ({selectedUserIds.length})
      </button>
    ) : (
      <>
        {role === "ADMIN" && (
          <button
            onClick={() => {
              setBulkSelectMode(true);
              setSelectedUserIds([]);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 text-sm"
          >
            Bulk Selection
          </button>
        )}

        {role === "ADMIN" && (
          <button
            onClick={() => {
              if (allowedUsers !== null && users.length >= allowedUsers) {
                alert("Upgrade your plan to create more users");
                return;
              }
              setShowCreate(true);
            }}
            style={{ backgroundColor: "#0f172a" }}
            className="flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            Create User
          </button>
        )}

        <button
          onClick={() => {
            setView("requests");
            fetchRequests();
          }}
          className="col-span-2 px-4 py-2 text-white rounded-lg text-sm font-semibold transition"
          style={{ backgroundColor: "#e5467e" }}
        >
          View Requests ({requests.length})
        </button>
      </>
    )}
  </div>
</div>
</div>
      </div>

     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {filtered.map((user) => (
    <div
      key={user.id}
      className="
  bg-white
  rounded-2xl
  p-6
  shadow-sm
  border border-slate-100
  hover:shadow-xl
  hover:-translate-y-1
  transition-all
  duration-300
"
    >
      {/* Top Section */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">

          {bulkSelectMode && (
            <input
              type="checkbox"
              checked={selectedUserIds.includes(user.id)}
              onChange={() =>
                setSelectedUserIds((prev) =>
                  prev.includes(user.id)
                    ? prev.filter((id) => id !== user.id)
                    : [...prev, user.id]
                )
              }
              className="w-4 h-4 accent-blue-600"
            />
          )}

          {user.avatarUrl ? (
            <img
              src={`${API_BASE}${user.avatarUrl}`}
              alt={user.name}
              className="w-10 h-10 rounded-full object-cover border"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold uppercase"
              style={{
                backgroundColor: [
                  "#f87171",
                  "#fbbf24",
                  "#34d399",
                  "#60a5fa",
                  "#a78bfa",
                  "#f472b6",
                  "#fb923c",
                ][user.name.charCodeAt(0) % 7],
              }}
            >
              {user.name[0]}
            </div>
          )}

          <div>
            <p className="font-semibold text-slate-800">
              {user.name}
            </p>
            <p className="text-xs text-slate-500">
              {user.email}
            </p>
          </div>
        </div>

        {user.email !== currentUserEmail && (
  <button
    onClick={() => handleDeleteUser(user.id)}
    className="text-red-500 hover:text-red-600 transition"
  >
    <Trash2 className="w-4 h-4" />
  </button>
)}
      </div>

      {/* Status */}
      {/* Status + Configure in One Line */}
<div className="mt-4 flex items-center gap-2">
 {false && (
  <span
    className="text-xs px-2 py-1 rounded-full font-medium"
    style={{
      backgroundColor:
        user.inviteStatus === "logged_in"
          ? "#16a34a"
          : user.inviteStatus === "sent"
          ? "#2563eb"
          : "#f97316",
      color: "#ffffff",
    }}
  >
    {user.inviteStatus === "logged_in"
      ? "Active"
      : user.inviteStatus === "sent"
      ? "Invite Sent"
      : "Pending"}
  </span>
)}

  {!bulkSelectMode && role === "ADMIN" && user.email !== currentUserEmail && (
    <button
      onClick={() => {
        setSelectedUser(user);
        setView("permissions");
        setActiveModule("ledgerSelection");
      }}
      className="flex-1 text-xs font-semibold py-2 rounded-lg transition"
style={{
  backgroundColor: "#2563eb",
  color: "#ffffff",
  border: "none",
}}
    >
      Configure
    </button>
  )}
</div>

      {/* Actions */}
{!bulkSelectMode && role === "ADMIN" && user.email !== currentUserEmail && (
        <div className="mt-1 flex gap-1">
          {user.inviteStatus !== "logged_in" && (
            <button
              onClick={() => handleSendInvite(user.id)}
              disabled={
                animatingUserId === user.id ||
                (inviteCooldowns[user.id] &&
                  inviteCooldowns[user.id] > Date.now())
              }
className="flex-1 text-xs font-semibold py-2 rounded-lg transition"
style={{
  backgroundColor: "#0f172a",
  color: "#ffffff",
  border: "none",
}}            >
              {animatingUserId === user.id
                ? "Sending..."
                : user.inviteStatus === "sent"
                ? "Resend Invite"
                : "Send Invite"}
            </button>
          )}

          
        </div>
      )}
    </div>
  ))}
</div>

      {showCreate && (
  <CreateUserModal
    onClose={() => setShowCreate(false)}
    onCreate={handleCreateUser}
    currentUserCount={users.length}
    allowedUserCount={allowedUsers}
  />
)}
    </div>
  );
}




























