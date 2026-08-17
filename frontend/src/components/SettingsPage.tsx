
import { useState, useEffect } from "react";
import API_BASE from "../api";
import TallyConnectorBillingPage from "./BillingPage";
import { User, Bell, LogOut, CreditCard } from "lucide-react";
import InvoicesPage from "../components/InvoicesPage";

interface SettingsPageProps {
  user: { username: string; company: string };
  onLogout: () => void;
}

export function SettingsPage({ user, onLogout }: SettingsPageProps) {
 
  type SettingsTab =
  | "profile"
  | "notifications"
  | "billing"
  | "invoices";

const [activeTab, setActiveTab] = useState<SettingsTab>("profile");


  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");
const [notificationPrefs, setNotificationPrefs] = useState<Record<string, boolean>>({});
const [reportDay, setReportDay] = useState(1);
const [reportTime, setReportTime] = useState("09:00");

const tabs: { id: SettingsTab; label: string; icon: any }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  ...(role === "ADMIN"
    ? [{ id: "billing" as SettingsTab, label: "Billing", icon: CreditCard }]
    : []),
];

useEffect(() => {
  if (activeTab !== "notifications") return;

  const token = localStorage.getItem("token");

  // 1️⃣ Load notification toggles
  fetch(`${API_BASE}/users/me/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((data) => {
      setNotificationPrefs(data || {});
    });

  // 2️⃣ Load monthly report schedule
  fetch(`${API_BASE}/users/me/monthly-report-schedule`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((data) => {
      if (data) {
        setReportDay(data.day_of_month);
        setReportTime(data.report_time.slice(0, 5)); // HH:mm
      }
    });
}, [activeTab]);



  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.avatar_url) setAvatarUrl(data.avatar_url);
        if (data.role) setRole(data.role);
      });
  }, []);

  const uploadAvatar = async (file: File) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const formData = new FormData();
    formData.append("avatar", file);

    const res = await fetch(`${API_BASE}/users/me/avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) return alert("Avatar upload failed");
    const data = await res.json();
    if (data.avatar_url) {
      setAvatarUrl(data.avatar_url);
      setAvatarPreview(null);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/"))
      return alert("Please select a valid image file");
    if (file.size > 2 * 1024 * 1024)
      return alert("Image must be less than 2MB");

    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);

    await uploadAvatar(file);
  };

  const handleSaveProfile = async () => {
    const token = localStorage.getItem("token");
    const inputs = document.querySelectorAll("input");

    const payload = {
      username: inputs[0]?.value,
      email: inputs[1]?.value,
      company: inputs[2]?.value,
    };

    await fetch(`${API_BASE}/users/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    alert("Profile saved");
  };

 

const handleSaveNotifications = async () => {
  const token = localStorage.getItem("token");

  // 🔁 Convert local time → UTC
  const [h, m] = reportTime.split(":").map(Number);
  const localDate = new Date();
  localDate.setHours(h, m, 0, 0);

  const utcTime = localDate.toISOString().slice(11, 16);

  // 1️⃣ Save notification toggles
  await fetch(`${API_BASE}/users/me/notifications`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(notificationPrefs),
  });

  // 2️⃣ Save monthly report schedule (UTC time)
  await fetch(`${API_BASE}/users/me/monthly-report-schedule`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      report_day: reportDay,
      report_time: utcTime, // ✅ IMPORTANT
      enabled: notificationPrefs.monthly_reports,
    }),
  });

  alert("Notification preferences saved");
};




  return (
    <div className="space-y-8 p-6 bg-gray-100 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 shadow-neumorphic-light dark:shadow-neumorphic-dark">
            <nav className="space-y-3">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${
                      activeTab === tab.id
                        ? "bg-blue-200 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 shadow-inner-neumorphic"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 shadow-neumorphic-light dark:shadow-neumorphic-dark"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
              <button
                onClick={onLogout}
                className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30 shadow-neumorphic-light dark:shadow-neumorphic-dark transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 shadow-neumorphic-light dark:shadow-neumorphic-dark transition-all">
            {/* PROFILE */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Profile Information
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Update your account profile information
                </p>

                {/* AVATAR */}
                <div className="flex items-center gap-6 pb-6 border-b border-gray-300 dark:border-gray-700">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      className="w-20 h-20 rounded-full object-cover shadow-inner-neumorphic"
                    />
                  ) : avatarUrl ? (
                    <img
                      src={`${API_BASE}${avatarUrl}`}
                      className="w-20 h-20 rounded-full object-cover shadow-inner-neumorphic"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-inner-neumorphic">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* 
                  <label className="inline-block cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    <span className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-neumorphic-light hover:bg-blue-700 transition-all text-sm">
                      Change Avatar
                    </span>
                  </label>
                  */}
                </div>

                {/* FORM */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm mb-2">Username</label>
                    <input
                      type="text"
                      defaultValue={user.username}
                      className="w-full px-4 py-2 rounded-xl shadow-inner-neumorphic dark:bg-gray-700 border-none focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Email</label>
                    <input
                      type="email"
                      defaultValue={`${user.username}@gmail.com`}
                      className="w-full px-4 py-2 rounded-xl shadow-inner-neumorphic dark:bg-gray-700 border-none focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Role</label>
                    <select
                      value={role}
                      disabled
                      className="w-full px-4 py-2 rounded-xl shadow-inner-neumorphic dark:bg-gray-700 cursor-not-allowed border-none focus:outline-none"
                    >
                      <option value={role}>{role}</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Role is assigned by administrator
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-300 dark:border-gray-700">
                  <button
                    onClick={handleSaveProfile}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl shadow-neumorphic-light hover:bg-blue-700 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}

{/* BILLING */}
{activeTab === "billing" && (
  <div className="space-y-6">
    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
      Billing & Subscription
    </h2>
    <p className="text-gray-600 dark:text-gray-400 text-sm">
      Manage your subscription and billing details
    </p>

    <div className="-mx-6">
      <TallyConnectorBillingPage setActiveTab={setActiveTab} />
    </div>
  </div>
)}


            {/* NOTIFICATIONS */}
            {activeTab === "notifications" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Notification Preferences
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Manage how you receive notifications
                </p>

                <div className="space-y-4">
                  {[
                   // { label: "New User Created", key: "user_created" }, 
                    { label: "User Deleted", key: "user_deleted" },
                    { label: "Payment Due Reminders", key: "payment_due" },
                    { label: "Low Stock Alerts", key: "low_stock" },
                    { label: "New Voucher Created", key: "new_voucher" },
                      { label: "Bill Created", key: "bill_created" },
                    { label: "Monthly Reports", key: "monthly_reports" },
                  ].map((item) => (

                    <div
  key={item.key}
  className="p-4 bg-gray-100 dark:bg-gray-700 rounded-xl shadow-inner-neumorphic space-y-3"
>
  <div className="flex justify-between items-center">
    <p>{item.label}</p>
    <input
      type="checkbox"
      checked={!!notificationPrefs[item.key]}
      onChange={(e) =>
        setNotificationPrefs((prev) => ({
          ...prev,
          [item.key]: e.target.checked,
        }))
      }
      className="w-5 h-5 accent-blue-600"
    />
  </div>

  {/* 👇 Monthly report schedule UI */}
  {item.key === "monthly_reports" && notificationPrefs.monthly_reports && (
    <div className="flex gap-4 items-center text-sm">
      <div>
        <label className="block text-xs mb-1">Day of Month</label>
        <select
          value={reportDay}
          onChange={(e) => setReportDay(Number(e.target.value))}
          className="px-3 py-2 rounded-lg bg-white dark:bg-gray-800"
        >
          {Array.from({ length: 28 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              Day {i + 1}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs mb-1">Time</label>
        <input
          type="time"
          value={reportTime}
          onChange={(e) => setReportTime(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white dark:bg-gray-800"
        />
      </div>
    </div>
  )}
</div>

                  ))}
                </div>

                <div className="pt-4 border-t border-gray-300 dark:border-gray-700">
                  <button
                    onClick={handleSaveNotifications}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl shadow-neumorphic-light hover:bg-blue-700 transition-all"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            )}

            {/* INVOICES */}
{activeTab === "invoices" && (
  <InvoicesPage setActiveTab={setActiveTab} />
)}

          </div>
        </div>
      </div>

      {/* Neumorphic shadow classes (add in tailwind.config.js under extend if needed) */}
      <style>
        {`
          .shadow-neumorphic-light {
            box-shadow: 8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff;
          }
          .shadow-inner-neumorphic {
            box-shadow: inset 6px 6px 12px #d1d9e6, inset -6px -6px 12px #ffffff;
          }
          .shadow-neumorphic-dark {
            box-shadow: 8px 8px 16px #1e293b, -8px -8px 16px #2c3a5a;
          }
        `}
      </style>
    </div>
  );
}