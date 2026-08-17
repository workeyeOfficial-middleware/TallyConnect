import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { DashboardHome } from "./DashboardHome";
import { LedgerList } from "./LedgerList";
import { LedgerDetailView } from "./LedgerDetailView";
import { VoucherExplorer } from "./VoucherExplorer";
import { OrderBook } from "./OrderBook";
import { MonthlySummary } from "./MonthlySummary";
import { InventoryPage } from "./InventoryPage";
import { SettingsPage } from "./SettingsPage";
import { AdminDashboard } from "./admin/AdminDashboard";
import { useState, useEffect } from "react";
import API_BASE from "../api";
import DeleteHistory from "./DeleteHistory";
import { RequestDetails } from "./RequestMessage";

export type PageType =
  | "dashboard"
  | "admin"
  | "ledgers"
  | "ledger-detail"
  | "vouchers"
  | "orders"
  | "monthly-summary"
  | "inventory"
  | "delete-history"
  | "request-details" 
  | "settings";
  

export function DashboardLayout({
  user: initialUser,
  onLogout,
}: {
  user: {
  id: number;
  username: string;
  role: "ADMIN" | "USER";
  avatar_url?: string;
  avatarUrl?: string;

  ledgerPermissions?: {
    columns: Record<string, boolean>;
  };

  vouchersPermissions?: {
    columns: Record<string, boolean>;
  };

  ordersPermissions?: {
    can_view?: boolean;
    columns?: Record<string, boolean>;
  };

  inventoryPermissions?: {
    can_view?: boolean;
    columns?: Record<string, boolean>;
  };
  
  dashboardPermissions?: {
    widgets: Record<string, boolean>;
  };
};

  onLogout: () => void;
}) {


const [user, setUser] = useState(initialUser);

  const [currentPage, setCurrentPage] = useState<PageType>(
  initialUser.role === "ADMIN" ? "dashboard" : "vouchers"
);

  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

const refreshCurrentUser = async () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return;

    const res = await fetch(`${API_BASE}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      onLogout();
      return;
    }

    const updatedUser = await res.json();

    setUser({
      ...updatedUser,
      avatarUrl: updatedUser.avatar_url || null,
    });
  } catch (err) {
    console.error("Failed to refresh user", err);
  }
};


  useEffect(() => {
    refreshCurrentUser();
  }, []);


console.log("DASHBOARD USER:", user);
const isAdmin = user.role === "ADMIN";

const canAccess = (page: PageType) => {
  if (isAdmin) return true;

  switch (page) {
  case "dashboard":
  return true;

    case "ledgers":
      return true; // handled inside LedgerList

        case "ledger-detail":     // ✅ ADD THIS LINE
      return true;

    case "vouchers":
      return true; // handled inside VoucherExplorer

    case "orders":
      return user.ordersPermissions?.can_view !== false;

    case "inventory":
      return user.inventoryPermissions?.can_view !== false;

 case "monthly-summary":
  return user.dashboardPermissions?.widgets?.monthlySummary !== false;

case "request-details":
   return true;

    case "settings":
      return true;

    default:
      return false;
  }
};

  /* ================================
     MODULE-LEVEL PERMISSIONS
     ================================ */
  const modulePermissions: Partial<Record<PageType, boolean>> = {
    dashboard: true,
    ledgers: true,
    vouchers: true,
    orders: true,
"monthly-summary": true,
    inventory: true,
    settings: true,
  };

  const NoPermission = () => (
  <div className="p-10 text-center text-gray-500">
    <h2 className="text-xl font-semibold mb-2">
      Access Denied
    </h2>
    <p>
      You don’t have permission to view this page.
      Please contact the administrator.
    </p>
  </div>
);

  /* ================================
     PAGE RENDERER
     ================================ */
 const renderPage = () => {
  if (!canAccess(currentPage)) {
    return <NoPermission />;
  }

  switch (currentPage) {

      case "admin":
        return (
        <AdminDashboard
  role={user.role}
  ledgerPermissions={null}
  onLedgerPermissionsChange={() => {}}
  refreshCurrentUser={refreshCurrentUser}
/>



          
        );

      case "dashboard":
  return (
    <DashboardHome
      onNavigate={setCurrentPage}
      user={user}
    />
  );


      case "ledgers":
  return (
    <LedgerList
      onViewLedger={(id) => {
        setSelectedLedgerId(id);
        setCurrentPage("ledger-detail");
      }}
      user={user}   // ✅ THIS FIXES THE CRASH
    />
  );


      case "ledger-detail":
        if (!selectedLedgerId) return null;
        return (
          <LedgerDetailView
            ledgerId={selectedLedgerId}
            onBack={() => setCurrentPage("ledgers")}
          />
        );

    case "vouchers":
  return <VoucherExplorer user={user} />;

      case "orders":
  return <OrderBook user={user} />;


      case "monthly-summary":
        return <MonthlySummary />;

      case "inventory":
  return <InventoryPage user={user} />;

  case "delete-history":
  return <DeleteHistory />; 

  case "request-details":
  return <RequestDetails />;


      case "settings":
        return <SettingsPage
  user={user}
  refreshCurrentUser={refreshCurrentUser}
  onLogout={onLogout}
/>
;

      default:
        return <DashboardHome onNavigate={setCurrentPage} />;
    }
  };

  /* ================================
     LAYOUT
     ================================ */
  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar
  currentPage={currentPage}
  onNavigate={setCurrentPage}
  isOpen={sidebarOpen}
  onClose={() => setSidebarOpen(false)}
  permissions={modulePermissions}
user={{
  username: user.username,
  role: user.role,
  avatarUrl: user.avatarUrl,
}}

/>


        <div className="lg:pl-64">
          <TopBar
            user={user}
            onMenuClick={() => setSidebarOpen(true)}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(!darkMode)}
            onAdminClick={() =>
              setCurrentPage(currentPage === "admin" ? "dashboard" : "admin")
            }
            isAdminView={currentPage === "admin"}
          />

          <main className="p-6">{renderPage()}</main>
        </div>
      </div>
    </div>
  );
}