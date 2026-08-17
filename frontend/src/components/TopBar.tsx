import { useState, useEffect } from "react";
import axios from "axios";
import { useRef } from "react";
import { CheckCircle } from "lucide-react";
import { Lock } from "lucide-react";

import notificationSound from "../sound/notification.mp3";

import {
  Search,
  Bell,
  Menu,
  Moon,
  Sun,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Building2,
} from "lucide-react";
import API_BASE from "../api";

interface TopBarProps {
  user: {
    username: string;
    company: string;
    role: "ADMIN" | "USER";
  };
  onMenuClick: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onAdminClick: () => void;
  isAdminView?: boolean;
}

interface Company {
  company_guid: string;
  name: string;
}

export function TopBar({
  user,
  onMenuClick,
  darkMode,
  onToggleDarkMode,
  onAdminClick,
  isAdminView = false,
}: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const isAdmin = user.role === "ADMIN";

  const [companies, setCompanies] = useState<Company[]>([]);
  const [showCompanies, setShowCompanies] = useState(false);
  const [activeCompanyGuid, setActiveCompanyGuid] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] =
    useState<string>("Select Company");
  const [showNotifications, setShowNotifications] = useState(false);
const [notifications, setNotifications] = useState<any[]>([]);
const [unreadCount, setUnreadCount] = useState(0);
const [activeNotification, setActiveNotification] = useState<any>(null);
const notificationsRef = useRef<HTMLDivElement>(null);
const lastPopupIdRef = useRef<number | null>(null);
const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
const [selectionError, setSelectionError] = useState<string | null>(null);


const notificationSoundRef = useRef<HTMLAudioElement | null>(null);

useEffect(() => {
  notificationSoundRef.current = new Audio(notificationSound);
  notificationSoundRef.current.volume = 0.7;
}, []);

useEffect(() => {
  if (!selectionError) return;

  const timer = setTimeout(() => {
    setSelectionError(null);
  }, 3000);

  return () => clearTimeout(timer);
}, [selectionError]);


  const [showBanner, setShowBanner] = useState(false);
  const [greeting, setGreeting] = useState<{ text: string; icon: string }>({
    text: "",
    icon: "",
  });

const fetchNotifications = async () => {
  try {
    const token = localStorage.getItem("token");

    const res = await axios.get(`${API_BASE}/admin/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    setNotifications(res.data);
    setUnreadCount(res.data.filter((n: any) => !n.is_read).length);

    const latestUnread = res.data.find((n: any) => !n.is_read);

  if (
  latestUnread &&
  latestUnread.id !== lastPopupIdRef.current &&
  !showNotifications
) {
  setActiveNotification(latestUnread);
  lastPopupIdRef.current = latestUnread.id;

  // 🔔 PLAY SOUND
  if (notificationSoundRef.current) {
    notificationSoundRef.current.currentTime = 0;
    notificationSoundRef.current.play().catch(err => {
      console.log("Sound play blocked by browser:", err);
    });
  }
}

  } catch (err) {
    console.error("Notification fetch failed", err);
  }
};


const markAllAsRead = async () => {
  try {
    const token = localStorage.getItem("token");
    
    await axios.post(
      `${API_BASE}/admin/notifications/mark-all-read`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    
    // Update local state
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  } catch (err) {
    console.error("Failed to mark notifications as read", err);
  }
};




useEffect(() => {
  const enableSound = () => {
    if (notificationSoundRef.current) {
      notificationSoundRef.current.play().then(() => {
        notificationSoundRef.current?.pause();
        notificationSoundRef.current.currentTime = 0;
      }).catch(() => {});
    }
    window.removeEventListener("click", enableSound);
  };

  window.addEventListener("click", enableSound);
}, []);

useEffect(() => {
  const handler = () => {
    fetchNotifications();
  };

  window.addEventListener("refresh-notifications", handler);

  return () => {
    window.removeEventListener("refresh-notifications", handler);
  };
}, []);


  // Greeting banner
  useEffect(() => {
    const hour = new Date().getHours();
    let text = "Hello";
    let icon = "👋";

    if (hour >= 5 && hour < 12) {
      text = "Good Morning";
      icon = "☀️";
    } else if (hour >= 12 && hour < 17) {
      text = "Good Afternoon";
      icon = "🌤️";
    } else if (hour >= 17 && hour < 21) {
      text = "Good Evening";
      icon = "🌙";
    } else {
      text = "Good Night";
      icon = "🌌";
    }

    setGreeting({ text, icon });
    setShowBanner(true);

    const timer = setTimeout(() => setShowBanner(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Load companies
  useEffect(() => {
    async function loadCompanies() {
      try {
        const token = localStorage.getItem("token");

        const [companiesRes, activeRes, selectedRes] = await Promise.all([
  axios.get(`${API_BASE}/company`, {
    headers: { Authorization: `Bearer ${token}` },
  }),
  axios.get(`${API_BASE}/company/active`, {
    headers: { Authorization: `Bearer ${token}` },
  }),
  axios.get(`${API_BASE}/company/selected`, {
    headers: { Authorization: `Bearer ${token}` },
  }),
]);

if (selectedRes.data.success) {
  const selected = selectedRes.data.data.map(
    (c: Company) => c.company_guid
  );
  setSelectedCompanies(selected);
}


        if (companiesRes.data.success) {
          const companies = companiesRes.data.data;
          setCompanies(companies);

          const activeGuid = activeRes.data.company_guid;
          setActiveCompanyGuid(activeGuid);

          const activeCompany = companies.find(
            (c: Company) => c.company_guid === activeGuid
          );

          if (activeCompany) {
            setActiveCompanyName(activeCompany.name);
          }
        }
      } catch (err) {
        console.error("Failed to load companies", err);
      }
    }

    loadCompanies();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest(".company-dropdown")) {
        setShowCompanies(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
  
  fetchNotifications();
  const interval = setInterval(fetchNotifications, 10000); // every 10s
  return () => clearInterval(interval);
}, []);

useEffect(() => {
  if (!activeNotification) return;

  const timer = setTimeout(() => {
    setActiveNotification(null);
  }, 5000);

  return () => clearTimeout(timer);
}, [activeNotification]);

useEffect(() => {
  function handleOutsideClick(e: MouseEvent) {
    if (
      notificationsRef.current &&
      !notificationsRef.current.contains(e.target as Node)
    ) {
      setShowNotifications(false);
    }
  }

  if (showNotifications) {
    document.addEventListener("mousedown", handleOutsideClick);
  }

  return () => {
    document.removeEventListener("mousedown", handleOutsideClick);
  };
}, [showNotifications]);

  const activeRed = "#f43f5e";
  const activeGreen = "#10b981";

  return (
    <>
      {/* Animations (UI only) */}
      <style>
        {`
          @keyframes slide-fade {
            0% { opacity: 0; transform: translateY(-20px); }
            10% { opacity: 1; transform: translateY(0); }
            90% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-20px); }
          }
          .animate-slide-fade {
            animation: slide-fade 5s ease-in-out forwards;
          }

          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }
          .animate-bounce {
            animation: bounce 1.2s infinite ease-in-out;
          }
            @keyframes slideDown {
  0% { 
    opacity: 0; 
    transform: translateY(-10px) scale(0.95); 
  }
  100% { 
    opacity: 1; 
    transform: translateY(0) scale(1); 
  }
}
.animate-slideDown {
  animation: slideDown 0.2s ease-out;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: ${darkMode ? '#4B5563' : '#D1D5DB'};
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: ${darkMode ? '#6B7280' : '#9CA3AF'};
}
        `}
      </style>

    <header
  className="relative sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4 transition-all duration-500"
>
        {showBanner && (
  <div
    className={`absolute -top-14 left-1/2 -translate-x-1/2
      flex items-center gap-3 px-6 py-3 rounded-xl shadow-lg
      text-sm z-50 animate-slide-fade
      ${darkMode
        ? "bg-gray-900 text-white border border-white/10"
        : "bg-white text-gray-900 border border-gray-200"
      }
    `}
  >
    <span className="text-lg animate-bounce">{greeting.icon}</span>
    <span className="font-medium">
      {greeting.text}, {user.username}!
    </span>
  </div>
)}


        <div className="flex items-center justify-between gap-4">
          {/* LEFT */}
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>

            <div className="relative flex-1 max-w-md hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>


                     {selectionError && (
  <div
    className={`px-3 py-2 rounded-lg text-sm font-medium shadow-md
      ${darkMode
        ? "bg-red-900/40 text-red-300 border border-red-700"
        : "bg-red-50 text-red-600 border border-red-200"
      }`}
    style={{
      animation: "fadeSlide 0.3s ease"
    }}
  >
    {selectionError}
  </div>
)}

          {/* RIGHT */}
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={onAdminClick}
                style={{
                  backgroundColor: isAdminView ? activeRed : activeGreen,
                  color: "white",
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-transform active:scale-95 shadow-lg"
              >
                {isAdminView ? (
                  <>
                    <LogOut className="w-4 h-4" />
                    Exit Admin
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    User Management
                  </>
                )}
              </button>
            )}
 


            {isAdmin && (
  <div className="relative company-dropdown">
 <button
  onClick={() => setShowCompanies(!showCompanies)}
  className={`
    group relative flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl
    font-medium text-sm transition-all duration-300 shadow-md
    ${darkMode 
      ? 'bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-750 hover:to-gray-650 text-white border border-gray-600' 
      : 'bg-gradient-to-r from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 text-gray-800 border border-gray-200'
    }
    hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
  `}
>
  <div className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} hidden sm:block`}>
    <Building2 className="w-4 h-4" />
  </div>
  <Building2 className="w-4 h-4 sm:hidden" />
  <span className="max-w-[80px] sm:max-w-[140px] truncate">
    {activeCompanyName}
  </span>
  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showCompanies ? 'rotate-180' : ''}`} />
</button>
{showCompanies && (
  <>
    {/* Backdrop */}
    <div 
      className="fixed inset-0 z-40" 
      onClick={() => setShowCompanies(false)}
    />
    
<div 
  style={{
    position: 'absolute',
    right: 0,
    marginTop: '12px',
    width: '400px',
    maxWidth: '90vw',
    borderRadius: '16px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    zIndex: 50,
    overflow: 'hidden',
    border: darkMode ? '1px solid #374151' : '1px solid #E5E7EB',
    backgroundColor: darkMode ? '#1F2937' : '#FFFFFF'
  }}
  className="animate-slideDown"
> 
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: darkMode ? '1px solid #374151' : '1px solid #E5E7EB',
        backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : 'rgba(249, 250, 251, 0.8)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building2 style={{ width: '20px', height: '20px', color: darkMode ? '#60A5FA' : '#2563EB' }} />
          <h3 style={{ 
            fontWeight: 600,
            margin: 0,
            color: darkMode ? '#FFFFFF' : '#111827'
          }}>
            Select Company
          </h3>
        </div>
      </div>

      {/* Companies List */}
      <div style={{
        maxHeight: '384px',
        overflowY: 'auto'
      }} className="custom-scrollbar">
        {/* companies map here */}
        {companies.map((c) => (
  <button
    key={c.company_guid}
    onClick={async () => {
      const token = localStorage.getItem("token");

     try {

  if (!selectedCompanies.includes(c.company_guid)) {
    await axios.post(
      `${API_BASE}/company/select`,
      { company_guid: c.company_guid },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    setSelectedCompanies(prev => [...prev, c.company_guid]);
  }

  await axios.post(
    `${API_BASE}/company/set-active`,
    { company_guid: c.company_guid },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  setActiveCompanyGuid(c.company_guid);
  setActiveCompanyName(c.name);
  setSelectionError(null);
  setShowCompanies(false);

} catch (err: any) {
  const message =
    err.response?.data?.message ||
    "Company selection limit exceeded.";
  setSelectionError(message);
}

    }}
    style={{
      width: '100%',
      textAlign: 'left',
      padding: '12px 16px',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      transition: 'all 0.2s',
      backgroundColor: activeCompanyGuid === c.company_guid 
        ? (darkMode ? 'rgba(37, 99, 235, 0.2)' : '#EFF6FF')
        : 'transparent',
      borderLeft: activeCompanyGuid === c.company_guid 
        ? `4px solid ${darkMode ? '#3B82F6' : '#2563EB'}`
        : 'none',
      border: 'none',
      cursor: 'pointer'
    }}
    onMouseEnter={(e) => {
      if (activeCompanyGuid !== c.company_guid) {
        e.currentTarget.style.backgroundColor = darkMode ? 'rgba(55, 65, 81, 0.5)' : '#F9FAFB';
      }
    }}
    onMouseLeave={(e) => {
      if (activeCompanyGuid !== c.company_guid) {
        e.currentTarget.style.backgroundColor = 'transparent';
      }
    }}
  >

  <div style={{
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontWeight: 'bold',
    fontSize: '14px',
    transition: 'all 0.2s',
    backgroundColor: activeCompanyGuid === c.company_guid
      ? '#2563EB'
      : selectedCompanies.includes(c.company_guid)
        ? (darkMode ? '#374151' : '#F3F4F6')
        : (darkMode ? '#374151' : '#F3F4F6'),
    color: activeCompanyGuid === c.company_guid
      ? '#FFFFFF'
      : selectedCompanies.includes(c.company_guid)
        ? (darkMode ? '#D1D5DB' : '#4B5563')
        : (darkMode ? '#9CA3AF' : '#6B7280'),
    boxShadow: activeCompanyGuid === c.company_guid ? '0 10px 15px -3px rgba(37, 99, 235, 0.3)' : 'none'
  }}>
    {c.name.charAt(0).toUpperCase()}
  </div>
  
  <div style={{
    flex: 1,
    minWidth: 0,
    overflow: 'hidden'
  }}>
    <div 
      style={{
        fontWeight: 500,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'block',
        color: activeCompanyGuid === c.company_guid
          ? (darkMode ? '#93C5FD' : '#1D4ED8')
          : (darkMode ? '#FFFFFF' : '#111827')
      }}
      title={c.name}
    >
      {c.name}
    </div>
    {activeCompanyGuid === c.company_guid && (
      <div style={{
        fontSize: '12px',
        color: '#10B981',
        fontWeight: 500,
        marginTop: '2px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        Active now
      </div>
    )}
    {!selectedCompanies.includes(c.company_guid) && (
      <div style={{
        fontSize: '12px',
        marginTop: '2px',
        color: darkMode ? '#6B7280' : '#9CA3AF',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        Click to select
      </div>
    )}
  </div>

  {selectedCompanies.includes(c.company_guid) ? (
    <CheckCircle 
      style={{
        width: '20px',
        height: '20px',
        flexShrink: 0,
        transition: 'all 0.2s',
        color: activeCompanyGuid === c.company_guid ? '#10B981' : '#16A34A',
        opacity: activeCompanyGuid === c.company_guid ? 1 : 0.6,
        transform: activeCompanyGuid === c.company_guid ? 'scale(1.1)' : 'scale(1)'
      }}
    />
  ) : (
    <Lock style={{
      width: '16px',
      height: '16px',
      color: '#9CA3AF',
      opacity: 0.5,
      flexShrink: 0
    }} />
  )}
</button>
))}
      </div>

      {/* Footer Info */}
      <div style={{
        padding: '12px 16px',
        borderTop: darkMode ? '1px solid #374151' : '1px solid #E5E7EB',
        fontSize: '12px',
        backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : 'rgba(249, 250, 251, 0.8)',
        color: darkMode ? '#9CA3AF' : '#6B7280'
      }}>
        {selectedCompanies.length} of {companies.length} companies selected
      </div>
    </div>
  </>
)}

    {/* 👇 ADD THIS BLOCK EXACTLY HERE */}
    {/* {selectionError && (
      <div className="mt-2 w-56 px-3 py-2 text-sm rounded-lg bg-red-100 text-red-600 border border-red-300">
        {selectionError}
      </div>
    )} */}
  </div>
)}


            
  
            <div className="relative">
              <button
    onClick={() => {
      setShowNotifications((v) => !v);
      setActiveNotification(null);
    }}
    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 relative"
  >
    <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />

    {unreadCount > 0 && (
      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-purple-500 text-black text-[10px] flex items-center justify-center">
        {unreadCount}
      </span>
    )}
  </button>

{showNotifications && (
  <div ref={notificationsRef} className="notification-panel">

    {/* Header */}
  {/* Header */}
<div className="notification-header" style={{ 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: darkMode ? '1px solid #374151' : '1px solid #E5E7EB'
}}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <div className="notification-title" style={{ 
      fontSize: '16px', 
      fontWeight: 600,
      color: darkMode ? '#FFFFFF' : '#111827'
    }}>
      Notifications
    </div>
    {unreadCount > 0 && (
      <div style={{
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
        backgroundColor: '#8B5CF6',
        color: '#FFFFFF'
      }}>
        {unreadCount} New
      </div>
    )}
  </div>
  
  <div style={{ display: 'flex', gap: '8px' }}>
    
    
    {notifications.length > 0 && (
      <button
      onClick={async () => {

        if (window.confirm('Clear all notifications?')) {
  try {
    const token = localStorage.getItem("token");

    await axios.delete(
      `${API_BASE}/admin/notifications/clear-all`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    setNotifications([]);
    setUnreadCount(0);
  } catch (err) {
    console.error("Failed to clear notifications", err);
  }
}

        }}
        style={{
          fontSize: '12px',
          padding: '4px 8px',
          borderRadius: '6px',
          backgroundColor: 'transparent',
          color: darkMode ? '#9CA3AF' : '#6B7280',
          border: darkMode ? '1px solid #4B5563' : '1px solid #D1D5DB',
          cursor: 'pointer',
          fontWeight: 500
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#EF4444';
          e.currentTarget.style.borderColor = '#EF4444';
          e.currentTarget.style.color = '#FFFFFF';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.borderColor = darkMode ? '#4B5563' : '#D1D5DB';
          e.currentTarget.style.color = darkMode ? '#9CA3AF' : '#6B7280';
        }}
      >
        Clear all
      </button>
    )}
  </div>
</div>
    {/* Empty State */}
    {notifications.length === 0 && (
      <div style={{ textAlign: "center", padding: "20px", fontSize: "14px", color: "#6b7280" }}>
    No Notifications
      </div>
    )}

    {/* List */}
    <div className="notification-list">
      {notifications.map((n) => (
       <div
  key={n.id}
  className={`notification-item ${
    !n.is_read ? "notification-unread" : ""
  }`}
  onClick={async () => {
    if (!n.is_read) {
      try {
        const token = localStorage.getItem("token");
        await axios.post(
         `${API_BASE}/admin/notifications/${n.id}/read`,

          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        setNotifications(prev =>
          prev.map(item =>
            item.id === n.id ? { ...item, is_read: true } : item
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Failed to mark as read", err);
      }
    }
  }}
  style={{ cursor: !n.is_read ? 'pointer' : 'default' }}
>
          
        
          <CheckCircle size={18} color="#8b5cf6" />

          <div className="notification-content">
            <div className="notification-message">
              {n.message}
            </div>

            <div className="notification-time">
              {new Date(n.created_at).toLocaleString()}
            </div>

            {n.type === "MONTHLY_REPORT" && n.meta?.file && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();

                  const token = localStorage.getItem("token");

                  const res = await axios.get(
                    `${API_BASE}/admin/notifications/download/${n.meta.file}`,
                    {
                      headers: {
                        Authorization: `Bearer ${token}`,
                      },
                      responseType: "blob",
                    }
                  );

                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = n.meta.file;
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                }}
                style={{
                  fontSize: "12px",
                  marginTop: "6px",
                  color: "#6366f1",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0
                }}
              >
                Download Report
              </button>
            )}
          </div>
        </div>
      ))}
    </div>

  </div>
)}




            </div>
          </div>
        </div>

     

      </header>



       {activeNotification && (
  <div
    style={{
      position: "fixed",
      bottom: "40px",
      right: "40px",
      width: "320px",
      padding: "16px",
      borderRadius: "12px",
      backgroundColor: "#f5f3ff",
      borderLeft: "4px solid #8b5cf6",
      boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
      zIndex: 9999
    }}
  >
    <div style={{ display: "flex", gap: "8px" }}>
      <CheckCircle size={20} color="#8b5cf6" />
      <div>
        <p style={{ fontWeight: 600, margin: 0 }}>
          {activeNotification.message}
        </p>
        <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
          {new Date(activeNotification.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  </div>
)}
    </>
  );
}