import { useState, useEffect } from "react";
import type { JSX } from "react";
import API_BASE from "../api";
import loginVideo from "../assets/login-bg.mp4";

import {
  Building2,
  Lock,
  User,
  Mail,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  XCircle,
  DollarSign,
  TrendingUp,
  PieChart,
  CreditCard,
  ArrowRight,
} from "lucide-react";

// ==================== TYPES ====================
interface LoginPageProps {
  onLogin: (data: { user: any; token: string }) => void;
}

interface LoginAlertProps {
  message: string;
  type?: "success" | "error" | "warning";
  duration?: number;
  onClose: () => void;
}

// ==================== ALERT COMPONENT ====================
function LoginAlert({
  message,
  type = "success",
  duration = 3000,
  onClose,
}: LoginAlertProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor =
    type === "error"
      ? "bg-red-500"
      : type === "warning"
        ? "bg-yellow-500"
        : "bg-green-500";
  const Icon =
    type === "error"
      ? XCircle
      : type === "warning"
        ? AlertTriangle
        : CheckCircle;

  return (
    <>
      <style>
        {`
          @keyframes slideInLeft {
            from { opacity: 0; transform: translateX(-80px) scale(0.95); }
            to { opacity: 1; transform: translateX(0) scale(1); }
          }
          @keyframes slideInRight {
            from { opacity: 0; transform: translateX(80px) scale(0.95); }
            to { opacity: 1; transform: translateX(0) scale(1); }
          }
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.85); }
            to { opacity: 1; transform: scale(1); }
          }
        `}
      </style>

      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div
          className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-white ${bgColor} alert-animate pointer-events-auto`}
        >
          <Icon className="w-6 h-6" />
          <span className="font-semibold text-base">{message}</span>
        </div>
      </div>
    </>
  );
}


// ==================== INPUT FIELD COMPONENT ====================
const InputField = ({
  label,
  placeholder,
  value,
  onChange,
  icon,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  icon: JSX.Element;
  type?: string;
}) => (
  <div className="space-y-2">
    <label className="block text-sm font-medium text-gray-700">{label}</label>
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        {icon}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-60 
focus:border-blue-500 transition-all"

        required
      />
    </div>
  </div>
);

// ==================== PASSWORD FIELD COMPONENT ====================
const PasswordField = ({
  label,
  value,
  onChange,
  showPassword,
  toggleShow,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  showPassword: boolean;
  toggleShow: () => void;
}) => (
  <div className= "space-y-2 mb-4">
    <label className="block text-sm font-medium text-gray-700">{label}</label>
    <div className="relative">
      <Lock
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        size={18}
      />
      <input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your password"
        className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
        required
      />
      <button
  type="button"
  aria-label={showPassword ? "Hide password" : "Show password"}
  onClick={toggleShow}
  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-blue-600 z-10"
>
  {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
</button>


    </div>
  </div>
);


// ==================== FORGOT PASSWORD MODAL (BACKGROUND VISIBLE) ====================
// const ForgotPasswordModal = ({
//   email,
//   setEmail,
//   adminEmail,
//   setAdminEmail,
//   onClose,
//   onSubmit,
//   loading,
// }: {
//   email: string;
//   setEmail: (val: string) => void;
//   adminEmail: string;
//   setAdminEmail: (val: string) => void;
//   onClose: () => void;
//   onSubmit: () => void;
//   loading: boolean;
// }) => (
//   <div className="fixed inset-0 z-50 flex items-center justify-center">
    
//     {/* ===== Semi-transparent Blur Backdrop (BACKGROUND VISIBLE) ===== */}
//     <div
//       onClick={onClose}
//       className="absolute inset-0 bg-white"
//     />

//     {/* ===== Compact Modal (UNCHANGED) ===== */}
//     <div className="relative w-[440px] sm:w-[500px] animate-scale z-10">
//       <div
//         className="
//           relative rounded-3xl p-8
//           bg-white/10
//           backdrop-blur-2xl
//           border border-white/20
//           shadow-[10px_10px_24px_rgba(0,0,0,0.15),-10px_-10px_24px_rgba(255,255,255,0.35)]
//         "
//       >

//         {/* Icon */}
//         <div className="flex justify-center mb-4">
//           <div
//             className="
//               w-16 h-16 rounded-2xl
//               bg-white/90
//               shadow-[6px_6px_12px_rgba(0,0,0,0.15),-6px_-6px_12px_rgba(255,255,255,0.8)]
//               flex items-center justify-center
//             "
//           >
//             <Lock className="w-7 h-7 text-blue-600" />
//           </div>
//         </div>

//         <h3 className="text-xl font-bold text-white text-center">
//           Reset Password
//         </h3>
//         <p className="text-sm text-white text-center mt-1 mb-5">
//           Enter your email and admin email
//         </p>

//         {/* Inputs */}
//         <div className="space-y-4">
//           <div>
//             <label className="text-xs font-semibold text-white ml-1">
//               Your Email
//             </label>
//             <div className="mt-1 flex items-center gap-2 rounded-xl bg-white/75 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.12),inset_-4px_-4px_8px_rgba(255,255,255,0.9)]">
//               <Mail className="ml-4 mr-3 w-5 h-5 text-white" />
//               <input
//                 type="email"
//                 value={email}
//                 onChange={(e) => setEmail(e.target.value)}
//                 placeholder="you@company.com"
//                 className="w-full bg-transparent px-4 py-4 text-sm text-gray-900 outline-none"
//               />
//             </div>
//           </div>

//           <div>
//             <label className="text-xs font-semibold text-white ml-1">
//               Admin Email
//             </label>
//             <div className="mt-1 flex items-center gap-2 rounded-xl bg-white/75 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.12),inset_-4px_-4px_8px_rgba(255,255,255,0.9)]">
//               <Mail className="ml-4 mr-3 w-5 h-5 text-white" />
//               <input
//                 type="email"
//                 value={adminEmail}
//                 onChange={(e) => setAdminEmail(e.target.value)}
//                 placeholder="admin@company.com"
//                 className="w-full bg-transparent px-4 py-4 text-sm text-gray-900 outline-none"
//               />
//             </div>
//           </div>
//         </div>

//         {/* Buttons */}
//         <div className="flex gap-3 mt-6">
//           <button
//             onClick={onClose}
//             type="button"
//             className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-blue-500 to-blue-700 active:scale-[0.96]"
//           >
//             Cancel
//           </button>

//           <button
//             onClick={onSubmit}
//             disabled={loading}
//             type="button"
//             className={`flex-1 py-3 rounded-xl text-sm font-semibold text-white ${
//               loading
//                 ? "bg-gray-400 cursor-not-allowed"
//                 : "bg-gradient-to-br from-blue-500 to-blue-700 active:scale-[0.96]"
//             }`}
//           >
//             {loading ? "Sending..." : "Send Request"}
//           </button>
//         </div>
//       </div>
//     </div>

//     {/* Animation */}
//     <style>
//       {`
//         @keyframes scaleIn {
//           from { opacity: 0; transform: scale(0.9); }
//           to { opacity: 1; transform: scale(1); }
//         }
//         .animate-scale {
//           animation: scaleIn 0.25s ease-out;
//         }
//       `}
//     </style>
//   </div>
// );
const ForgotPasswordModal = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    if (!email.trim()) return alert("Enter email");

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      
      });
  console.log("send")
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setStep("reset");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!otp || !newPassword || !confirmPassword)
      return alert("All fields required");

    if (newPassword !== confirmPassword)
      return alert("Passwords do not match");

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          otp,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      alert("Password updated successfully");
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-blue-950/40 backdrop-blur-[80px]"
      />

      <div className="relative w-full max-w-md mx-4 sm:mx-6 animate-scale z-10">
        <div className="rounded-3xl p-8 bg-white border border-white/20 shadow-2xl">

          <h3 className="text-xl font-bold text-black text-center mb-6">
            {step === "email" ? "Send OTP" : "Reset Password"}
          </h3>

          {step === "email" ? (
            <>
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full px-4 py-3 rounded-xl bg-white/80 mb-4"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <button
                onClick={sendOtp}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold"
              >
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="Enter OTP"
                className="w-full px-4 py-3 rounded-xl bg-white/80 mb-4"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />

              <input
                type="password"
                placeholder="New Password"
                className="w-full px-4 py-3 rounded-xl bg-white/80 mb-4"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <input
                type="password"
                placeholder="Confirm Password"
                className="w-full px-4 py-3 rounded-xl bg-white/80 mb-4"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              <button
                onClick={resetPassword}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== MAIN LOGIN PAGE ====================
export function LoginPage({ onLogin }: LoginPageProps) {

  const [isRegister, setIsRegister] = useState(false);
const [isAdmin, setIsAdmin] = useState(false);
  // Form fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password fields
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotAdminEmail, setForgotAdminEmail] = useState("");

  const [loginAlert, setLoginAlert] = useState<{
    message: string;
    type?: "success" | "error" | "warning";
  } | null>(null);

  const [loading, setLoading] = useState(false);

  // ---------- Helper: show alert ----------
  const showAlert = (
    message: string,
    type?: "success" | "error" | "warning"
  ) => {
    setLoginAlert({ message, type });
  };

  // ---------- Forgot Password ----------
// const handleForgotPassword = async () => {
//   if (!forgotEmail.trim()) {
//     showAlert("Please enter your email address", "warning");
//     return;
//   }

//   setLoading(true);
//   try {
//     const res = await fetch(`${API_BASE}/auth/forgot-password`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         email: forgotEmail.trim(),
//       }),
//     });

//     const data = await res.json();
//     if (!res.ok) throw new Error(data.message || "Something went wrong");

//     showAlert("Password reset link sent to your email!", "success");

//     setShowForgotPassword(false);
//     setForgotEmail("");
//   } catch (err: any) {
//     showAlert(err.message, "error");
//   } finally {
//     setLoading(false);
//   }
// };

  // ---------- Admin Registration ----------
  const registerAdmin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
          isAdmin: true,
          companyName: companyName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      showAlert(
        `Admin ${username.trim()} from ${companyName.trim()} successfully registered!`
      );
      setIsRegister(false);
      setUsername("");
      setEmail("");
      setPassword("");
      setCompanyName("");
    } catch (err: any) {
      showAlert(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Login ----------
  const loginUser = async () => {
  setLoading(true);
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.trim(),
        password,
        loginType: isAdmin ? "ADMIN" : "USER",
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    // ✅ 1. Save token
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user)); // ✅ ADD THIS


    // ✅ 2. TOUCH notifications API (THIS IS WHAT YOU ASKED WHERE TO ADD)
    try {
      await fetch(`${API_BASE}/admin/notifications`, {
        headers: {
          Authorization: `Bearer ${data.token}`,
        },
      });
    } catch (e) {
      console.warn("Notifications API not reachable (ignored)");
    }

    // ✅ 3. Continue normal login
    onLogin({ user: data.user, token: data.token });

    showAlert(
      isAdmin
        ? `Welcome Admin ${data.user.username} from ${data.user.company}!`
        : `Welcome ${data.user.username} from ${data.user.company || "your company"}!`
    );
  } catch (err: any) {
    showAlert(err.message, "error");
  } finally {
    setLoading(false);
  }
};


  // ---------- Form Submit ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister && isAdmin) await registerAdmin();
    else await loginUser();
  };

  return (
    <>
      <style>
        {`
          @keyframes slideInLeft {
            from { opacity: 0; transform: translateX(-50px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes slideInRight {
            from { opacity: 0; transform: translateX(50px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
          }
          .animate-slide-left {
            animation: slideInLeft 0.6s ease-out;
          }
          .animate-slide-right {
            animation: slideInRight 0.6s ease-out;
          }
          .animate-scale {
            animation: scaleIn 0.4s ease-out;
          }
          
        `}
      </style>

      <div className="relative min-h-screen overflow-hidden flex items-center justify-center">

  <video
    autoPlay
    loop
    muted
    playsInline
    preload="auto"
    className="
      fixed
      top-0 left-0
      min-w-full
      min-h-full
      w-auto
      h-auto
      object-cover
      z-[-1]
    "
  >
    <source src={loginVideo} type="video/mp4" />
  </video>

 <div
  className={`relative z-10 w-full h-full flex items-center justify-center transition-all duration-300 ${
    showForgotPassword
      ? "blur-md scale-[0.97] brightness-75"
      : ""
  }`}
>

        {/* Alert */}
        {loginAlert && (
          <LoginAlert
            message={loginAlert.message}
            type={loginAlert.type}
            duration={3000}
            onClose={() => setLoginAlert(null)}
          />
        )}

        {/* Main Card */}
        <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 min-h-[700px]">


       


{/*============================= LEFT PANEL - Professional Glassmorphism with KPI Cards =================================*/}
<div
  className="relative overflow-hidden animate-slide-left"
  style={{
    background: `
      linear-gradient(120deg,
        #0b1e9b,
        #142b87,
        #144be9,
        #1e63ff
      )
    `,
    backgroundSize: "300% 300%",
    animation: "gradientFlow 14s ease infinite",
  }}
>
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    <div className="absolute -inset-[50%] bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.08),transparent_40%)] animate-waveSlow" />
    <div className="absolute -inset-[50%] bg-[radial-gradient(circle_at_70%_70%,rgba(255,255,255,0.05),transparent_40%)] animate-waveReverse" />
  </div>

  {/* Gradient overlay */}
  <div
    className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-80"
    style={{
      background:
        "radial-gradient(1200px 600px at 10% 10%, rgba(255,255,255,0.03), transparent 10%), radial-gradient(900px 800px at 85% 80%, rgba(255,255,255,0.02), transparent 10%)",
      backdropFilter: "blur(6px) saturate(120%)",
      animation: "slowRotate 30s linear infinite",
    }}
  />

  {/* Particle grid */}
  <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.02) 1px,transparent 1px)] bg-[length:60px_60px] opacity-5" />

  {/* ================= Premium iOS Glass Logo (LEFT PANEL) ================= */}
  <div className="relative z-10 flex flex-col items-center justify-center h-full px-12 text-center">

    {/* Only Logo Icon - no outer square */}
    <Building2
      className="relative w-24 h-24 text-white drop-shadow-[0_6px_12px_rgba(0,0,0,0.35)]"
      strokeWidth={1.8}
    />

    {/* Brand Name */}
<h1
  className="mt-8 text-6xl sm:text-7xl md:text-8xl lg:text-9xl text-white font-extrabold tracking-tight"
  style={{ fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif" }}
>
  Tally Connect
</h1>

<p className="mt-4 text-lg sm:text-xl md:text-2xl lg:text-3xl text-white max-w-sm leading-relaxed">
  Secure. Simple. Connected accounting.
</p>

    {/* Divider */}
    <div className="mt-10 w-24 h-[3px] rounded-full bg-white/25" />
  </div>


  {/* Animations */}
  <style>
    {`
      @keyframes slowRotate {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @keyframes floatLogo {
        0% { transform: rotateY(-15deg) rotateX(8deg) translateY(0px); }
        50% { transform: rotateY(-15deg) rotateX(8deg) translateY(-8px); }
        100% { transform: rotateY(-15deg) rotateX(8deg) translateY(0px); }
      }

      @keyframes floatCardA {
        0% { transform: translateY(0px) rotateX(1deg) rotateY(-1deg); }
        50% { transform: translateY(-8px) rotateX(2deg) rotateY(0deg); }
        100% { transform: translateY(0px) rotateX(1deg) rotateY(-1deg); }
      }

      @keyframes floatCardB {
        0% { transform: translateY(0px) rotateX(-1deg) rotateY(1deg); }
        50% { transform: translateY(-6px) rotateX(-2deg) rotateY(0deg); }
        100% { transform: translateY(0px) rotateX(-1deg) rotateY(1deg); }
      }

      .animate-floatCardA { animation: floatCardA 7s ease-in-out infinite; }
      .animate-floatCardB { animation: floatCardB 8s ease-in-out infinite; }

      @media (prefers-reduced-motion: reduce){
        .animate-slide-left, .floatLogo, .animate-floatCardA, .animate-floatCardB { animation: none !important; transform: none !important; }
       }

     @keyframes gradientFlow {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}



@keyframes waveSlow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes waveReverse {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

.animate-waveSlow {
  animation: waveSlow 40s linear infinite;
}

.animate-waveReverse {
  animation: waveReverse 60s linear infinite;
}





    `}
  </style>
</div>




{/* ============================================= RIGHT PANEL - FORM ============================================= */}

<div className="relative w-full max-w-lg mx-auto">
  {/* Glass + Neumorphic Container */}
  <div
    className="
      relative rounded-3xl
      bg-white/75 backdrop-blur-xl
      shadow-[12px_12px_40px_rgba(2,6,23,0.08),-12px_-12px_30px_rgba(255,255,255,0.85)]
      p-8 sm:p-10
    "
  >
    {/* ================= HEADER ================= */}
    <div className="flex items-center gap-6 mb-8 min-h-[104px]">
      {/* LEFT: Premium iOS-style Glass + Depth Logo (keeps original icon) */}
      <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
        {/* BACK PLATE: deeper, colored layer (shifted slightly for depth) */}
        <div
          className="
            absolute -right-[6px] -bottom-[6px] rounded-3xl
            w-[86%] h-[86%]
            bg-gradient-to-br from-blue-600 to-blue-700
            shadow-[0_20px_40px_rgba(37,99,235,0.28)]
            z-0
          "
          style={{ transform: "translate(6px,6px)" }}
        />

        {/* FRONT GLASS: larger, stronger blur + soft inner glow like reference */}
        <div
          className="
            relative w-full h-full rounded-3xl
            flex items-center justify-center
            bg-gradient-to-br from-white/85 to-blue-50/70
            backdrop-blur-[12px]
            border border-white/70
            z-10
            overflow-hidden
            shadow-[inset_0_2px_3px_rgba(255,255,255,0.95),inset_0_-6px_18px_rgba(0,0,0,0.12),0_18px_40px_rgba(6,11,50,0.12)]
          "
        >
          {/* soft top highlight like the reference (thin white streak) */}
          <div
            className="absolute -top-5 left-0 right-0 h-8 rounded-full pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.05))",
              filter: "blur(8px)",
              opacity: 0.9,
              transform: "translateY(6px)",
            }}
          />

          {/* soft bottom fade to emulate gel */}
          <div
            className="absolute bottom-0 left-0 right-0 h-12 rounded-b-2xl pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.0))",
              mixBlendMode: "screen",
              opacity: 0.95,
            }}
          />

          {/* inner vignette to give that frosted edge */}
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -10px 30px rgba(9,30,66,0.04)",
              mixBlendMode: "normal",
            }}
          />

          {/* Original logo kept intact */}
          <Building2 className="relative w-12 h-12 text-blue-600" strokeWidth={1.8} />
        </div>
      </div>

      {/* Header Text */}
      <div className="flex-1">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-snug">
          {isRegister ? "Create Account" : isAdmin ? "Admin Login" : "User Login"}
        </h1>

        {/* Subtitle slightly moved up */}
        <p
          className="text-sm sm:text-base font-medium -mt-1 tracking-wide"
          style={{
            background: "linear-gradient(90deg,#4f8cff,#6aa8ff)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {isRegister
            ? "Sign up for a new account"
            : isAdmin
              ? "Sign in with your admin credentials"
              : "Sign in with your user credentials"}
        </p>
      </div>
    </div>

    {/* ================= CARD (form) ================= */}
    <div
      className="
        bg-white rounded-2xl
        border border-gray-100
        shadow-[10px_10px_20px_rgba(0,0,0,0.06),-10px_-10px_20px_rgba(255,255,255,0.7)]
        p-8
        min-h-[420px]
        flex flex-col justify-between
        animate-scale
      "
    >
      {/* User/Admin Toggle */}
      {!isRegister && (
        <div className="flex p-1 bg-gray-100 rounded-xl mb-6">
          {["User", "Admin"].map((role) => {
            const active = role === "Admin" ? isAdmin : !isAdmin;
            return (
              <button
                key={role}
                type="button"
                onClick={() => setIsAdmin(role === "Admin")}
                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${
                  active ? "bg-blue-600 text-white shadow-md" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {role}
              </button>
            );
          })}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <InputField label="Email" placeholder="Enter your Email" value={username} onChange={setUsername} icon={<User size={18} />} />

        {isRegister && isAdmin && (
          <>
            <InputField label="Email" placeholder="email@gmail.com" type="email" value={email} onChange={setEmail} icon={<Mail size={18} />} />
            <InputField label="Company" placeholder="Enter company name" value={companyName} onChange={setCompanyName} icon={<Building2 size={18} />} />
          </>
        )}

        <PasswordField label="Password" value={password} onChange={setPassword} showPassword={showPassword} toggleShow={() => setShowPassword(!showPassword)} />

        {!isRegister && !isAdmin && (
  <div className="text-right mt-1">
    <button
      type="button"
      onClick={() => setShowForgotPassword(true)}
      className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
    >
      Forgot Password?
    </button>
  </div>
)}

 
      <button
  type="submit"
  disabled={loading}
  className={`
    w-full py-4 rounded-xl font-bold text-white
    shadow-lg transition-all
    flex items-center justify-center gap-2 group

    bg-blue-600
    hover:bg-blue-700
    active:bg-blue-600
    active:scale-[0.98]

    focus:outline-none
    focus-visible:outline-none
    focus-visible:ring-0
    appearance-none

    disabled:bg-gray-400
    disabled:cursor-not-allowed
    disabled:pointer-events-none
  `}
>
  <span>
    {loading
      ? "Logging in..."
      : isRegister
        ? "Register Admin"
        : isAdmin
          ? "Admin Login"
          : "User Login"}
  </span>

  {!loading && (
    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
  )}
</button>
      </form>
    </div>

    {/* Bottom Link */}
    <div className="mt-6 text-center text-sm text-gray-600">
      {isRegister ? (
        <>
          Already have an account?{" "}
          <button
            onClick={() => {
              setIsRegister(false);
              setUsername("");
              setEmail("");
              setPassword("");
              setCompanyName("");
            }}
            className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
          >
            Sign In
          </button>
        </>
      ) : (
        isAdmin && (
          <>
            {" "}
            <button
  type="button"
  onClick={() => window.location.href = "https://tally-connect.com/forgot-password"}
  className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
>
  Admin Forgot Password 
</button>
          </>
        )
      )}
    </div>
  </div>
</div>

</div>


        {/* Forgot Password Modal */}
        {showForgotPassword && (
         <ForgotPasswordModal
  onClose={() => setShowForgotPassword(false)}
/>
        )}
      </div>
      </div>
    </>
  );
}
