import {
  Gauge,
  BookText,
  Receipt,
  ClipboardList,
  BarChart3,
  Boxes,
  SlidersHorizontal,
  X,
  Building2,
  Settings,
  Trash2 ,
  Users,
} from "lucide-react";
import { PageType } from "./DashboardLayout";
import { useState, useRef, useEffect } from "react";
import sidebarAnimation from "../assets/sidebarAnimation.mp4";
import { MessageSquare } from "lucide-react";

import API_BASE from "../api";
type SyncState = "idle" | "syncing" | "completed";






function timeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} mins ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hrs ago`;

  return new Date(dateString).toLocaleString();
}

// Reusable Interactive Button with ripple (same as TopBar)
const InteractiveButton = ({
  onClick,
  children,
  className = "",
  style = {},
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [ripples, setRipples] = useState<
    { x: number; y: number; size: number }[]
  >([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const createRipple = (event: React.MouseEvent | React.TouchEvent) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const x =
      "clientX" in event
        ? event.clientX - rect.left
        : event.touches[0].clientX - rect.left;
    const y =
      "clientY" in event
        ? event.clientY - rect.top
        : event.touches[0].clientY - rect.top;
    const size = Math.max(rect.width, rect.height);
    setRipples((prev) => [...prev, { x, y, size }]);
  };

  const handleAnimationEnd = () => {
    setRipples([]);
  };

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      onMouseDown={(e) => {
        setIsPressed(true);
        createRipple(e);
      }}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={(e) => {
        setIsPressed(true);
        createRipple(e);
      }}
      onTouchEnd={() => setIsPressed(false)}
      className={`${className} relative overflow-hidden transition-transform duration-150`}
      style={{
        transform: isPressed ? "scale(0.97)" : "scale(1)",
        ...style,
      }}
    >
      {children}
      {ripples.map((ripple, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white/30 pointer-events-none animate-ripple"
          style={{
            width: ripple.size,
            height: ripple.size,
            top: ripple.y - ripple.size / 2,
            left: ripple.x - ripple.size / 2,
          }}
          onAnimationEnd={handleAnimationEnd}
        ></span>
      ))}
      <style>{`
        @keyframes rippleEffect {
          0% { transform: scale(0); opacity: 0.5; }
          100% { transform: scale(2); opacity: 0; }
        }
        .animate-ripple { animation: rippleEffect 0.6s linear; }
      `}</style>
    </button>
  );
};

interface SidebarProps {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  isOpen: boolean;
  onClose: () => void;
  permissions?: Record<string, boolean>;
  user?: {
    username: string;
    role: "ADMIN" | "USER";
    avatarUrl?: string;
  };
}

const menuItems = [
  { id: "dashboard" as PageType, label: "Dashboard", icon: Gauge },
  { id: "ledgers" as PageType, label: "Ledger List", icon: BookText },
  { id: "vouchers" as PageType, label: "Voucher Explorer", icon: Receipt },
  { id: "orders" as PageType, label: "Order Book", icon: ClipboardList },
  {
    id: "monthly-summary" as PageType,
    label: "Monthly Summary",
    icon: BarChart3,
  },
  { id: "inventory" as PageType, label: "Inventory", icon: Boxes },
    { id: "delete-history" as PageType, label: "Delete History", icon: Trash2 },
    { id: "request-details" as PageType, label: "Request Details", icon: MessageSquare }, 
  { id: "settings" as PageType, label: "Settings", icon: SlidersHorizontal },
];

export function Sidebar({
  currentPage,
  onNavigate,
  isOpen,
  onClose,
  permissions,
  user,
}: SidebarProps) {

  const [loadingLicense, setLoadingLicense] = useState(true);

  const [licenseFeatures, setLicenseFeatures] = useState<Record<string, any>>({});

useEffect(() => {

  const fetchLicense = async () => {
    try {
      setLoadingLicense(true);

      // ✅ ALWAYS read from localStorage first (most reliable on reload)
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

      let email =
        storedUser?.admin_email ||
        storedUser?.email ||
        (user as any)?.admin_email ||
        (user as any)?.email;

      if (!email) {
        console.warn("No email found yet, retrying...");
        setTimeout(fetchLicense, 500); // retry after 500ms
        return;
      }

      const res = await fetch(
        `https://dashboard.licentic.org/api/external/actve-license/${email}?productId=695902cfc240b17f16c3d716`
      );

      const data = await res.json();

      const features =
        data?.activeLicense?.licenseTypeId?.features || {};

      setLicenseFeatures(features);

    } catch (err) {
      console.error("License fetch failed", err);
    } finally {
      setLoadingLicense(false);
    }
  };

  fetchLicense();

}, []);

  // ✅ ADD FROM HERE
const [lastSync, setLastSync] = useState<string | null>(null);
const [syncState, setSyncState] = useState<SyncState>("idle");
const lastSeenSyncRef = useRef<string | null>(null);

useEffect(() => {
  const fetchSyncStatus = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      // 1️⃣ Get active company from backend
      const activeRes = await fetch(`${API_BASE}/company/active`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const activeData = await activeRes.json();
      const activeCompanyGuid = activeData?.company_guid;

      if (!activeCompanyGuid) {
        setLastSync(null);
        return;
      }

      // 2️⃣ Now fetch sync status
      const res = await fetch(
        `${API_BASE}/agent-status/sync-status?company_guid=${activeCompanyGuid}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      const serverSync = data?.last_sync_at || null;
      const syncing = data?.sync_in_progress === true;
      const prevSync = lastSeenSyncRef.current;

      if (syncing) {
        setSyncState("syncing");
      } else if (prevSync && serverSync && serverSync !== prevSync) {
        setSyncState("completed");
        setTimeout(() => setSyncState("idle"), 4000);
      } else if (serverSync) {
        setSyncState("idle");
      }

      setLastSync(serverSync);
      lastSeenSyncRef.current = serverSync;

    } catch (err) {
      console.error("Sync fetch failed:", err);
      setSyncState("idle");
    }
  };

  fetchSyncStatus();
  const interval = setInterval(fetchSyncStatus, 5000);
  return () => clearInterval(interval);
}, []);





  function timeAgo(dateString: string) {
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);

    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} mins ago`;

    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hrs ago`;

    return new Date(dateString).toLocaleString();
  }
  const displayUser = user || { username: "Guest", role: "USER" };
  const avatarFallback = displayUser.username[0]?.toUpperCase();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 backdrop-blur-md bg-white/70 dark:bg-gray-900/70 border-r border-gray-200 dark:border-gray-700
          transition-transform duration-300 ease-in-out shadow-lg
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100/80 dark:bg-gray-800/80 rounded-full shadow-sm backdrop-blur-sm flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="text-gray-900 dark:text-white font-bold tracking-tight text-lg">
                    Tally Connect
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">
                    Accounting Manager
                  </p>
                </div>
              </div>

              <InteractiveButton
                onClick={onClose}
                className="lg:hidden p-2 rounded-full"
                style={{ background: "transparent" }}
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-300" />
              </InteractiveButton>
            </div>
          </div>

          {/* Tally Status */}
          <div className="px-6 py-4 my-3 mx-4 bg-gray-100/70 dark:bg-gray-800/70 rounded-2xl shadow-inner backdrop-blur-sm transition-colors">
<div className="flex items-center gap-2 text-sm">
  {syncState === "syncing" && (
    <>
      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-blue-600 font-medium">Syncing…</span>
    </>
  )}

  {syncState === "completed" && (
    <>
      <div className="w-2 h-2 bg-green-500 rounded-full" />
      <span className="text-green-700 font-medium">Sync complete</span>
    </>
  )}

  {syncState === "idle" && (
    <>
      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      <span className="text-green-700 font-medium">Tally Connected</span>
    </>
  )}
</div>

<p className="text-xs mt-1 text-gray-600">
  {syncState === "syncing"
    ? "Please wait while data syncs"
    : lastSync
    ? `Last sync: ${timeAgo(lastSync)}`
    : "Last sync: Never synced"}
</p>


          </div>

          {/* Navigation */}
         {/* <nav className="flex-1 px-4 py-6 overflow-y-auto">
  {loadingLicense ? (
    <div className="flex items-center justify-center h-full">
      <video
        src={sidebarAnimation}
        autoPlay
        loop
        muted
        playsInline
        className="w-32 h-32 object-contain"
      />
    </div>
  ) : (
    <ul className="space-y-3">
      {menuItems
        .filter((item) => {
          const role = displayUser.role;

          if (role === "ADMIN") {
            if (item.id === "dashboard" || item.id === "monthly-summary") {
              return true;
            }
          }

          if (
            role !== "ADMIN" &&
            (item.id === "dashboard" || item.id === "monthly-summary")
          ) {
            return false;
          }

          const featureMap: Record<string, string> = {
            dashboard: "interactive-dashboard",
            ledgers: "ledger-list",
            vouchers: "voucher-explorer",
            orders: "order-access-control",
            inventory: "inventory-access-control",
            settings: "settings",
          };

          const requiredFeature = featureMap[item.id];

          if (requiredFeature) {
            if (!licenseFeatures[requiredFeature]) {
              return false;
            }
          }

          if (permissions?.[item.id] === false) {
            return false;
          }

          return true;
        })
        .map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <li key={item.id}>
              <InteractiveButton
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left text-sm font-medium transition-all duration-200
                  ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400 shadow-inner border-l-4 border-blue-600 dark:border-blue-400"
                      : "bg-white/80 dark:bg-gray-900/80 hover:bg-gray-100/90 dark:hover:bg-gray-800/80 text-gray-700 dark:text-gray-300 shadow-sm border-l-4 border-transparent"
                  } backdrop-blur-sm`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </InteractiveButton>
            </li>
          );
        })}
    </ul>
  )}
</nav> */}

<nav className="flex-1 px-4 py-6 overflow-y-auto">
  {loadingLicense ? (
    <div className="flex items-center justify-center h-full">
      <video
        src={sidebarAnimation}
        autoPlay
        loop
        muted
        playsInline
        className="w-32 h-32 object-contain"
      />
    </div>
  ) : (
    <ul className="space-y-3">
      {menuItems
       .filter((item) => {
  const role = displayUser.role;

   if (item.id === "request-details") {
    return role !== "ADMIN";
  }
  
  // ✅ Admin-only pages
  if (
    item.id === "dashboard" ||
    item.id === "monthly-summary" ||
    item.id === "delete-history"
  ) {
    return role === "ADMIN";
  }

  

  const featureMap: Record<string, string> = {
    dashboard: "interactive-dashboard",
    ledgers: "ledger-list",
    vouchers: "voucher-explorer",
    orders: "order-access-control",
    inventory: "inventory-access-control",
    settings: "settings",
  };

  const requiredFeature = featureMap[item.id];

  if (requiredFeature && !licenseFeatures[requiredFeature]) {
    return false;
  }

  if (permissions?.[item.id] === false) {
    return false;
  }

  return true;
})
        .map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <li key={item.id}>
              <InteractiveButton
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left text-sm font-medium transition-all duration-200
                ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400 shadow-inner border-l-4 border-blue-600 dark:border-blue-400"
                    : "bg-white/80 dark:bg-gray-900/80 hover:bg-gray-100/90 dark:hover:bg-gray-800/80 text-gray-700 dark:text-gray-300 shadow-sm border-l-4 border-transparent"
                } backdrop-blur-sm`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </InteractiveButton>
            </li>
          );
        })}
    </ul>
  )}
</nav>


          {/* Profile Section */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 mt-auto">
            <InteractiveButton
              onClick={() => onNavigate("settings")}
              className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-white/80 dark:bg-gray-900/80 shadow-inner backdrop-blur-sm transition-shadow hover:shadow-md w-full"
            >
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                  {displayUser.avatarUrl ? (
                   <img
  src={displayUser.avatarUrl}
  alt={displayUser.username}
  className="w-full h-full object-cover"
  onError={(e) =>
    (e.currentTarget.src = `https://ui-avatars.com/api/?name=${displayUser.username}&background=2563eb&color=fff`)
  }
/>

                  ) : (
                    avatarFallback
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-gray-900 rounded-full shadow-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                  {displayUser.username}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate uppercase tracking-wide font-semibold">
                  {displayUser.role === "ADMIN"
                    ? "Administrator"
                    : "Staff Member"}
                </p>
              </div>
              <Settings className="w-5 h-5 text-gray-400 dark:text-gray-300" />
            </InteractiveButton>
          </div>
        </div>
      </aside>
    </>
  );
}
