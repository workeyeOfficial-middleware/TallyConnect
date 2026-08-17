import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { X, BookOpen, CheckCircle2 } from "lucide-react";
import { Activity, Users, Clock } from "lucide-react"; 

interface WelcomeBannerProps {
  userName?: string;
}

export function WelcomeBanner({ userName }: WelcomeBannerProps) {
  const [visible, setVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [name, setName] = useState("");

  /* -------------------- SHOW ON LOGIN -------------------- */
  useEffect(() => {
  if (userName?.trim()) {
    setName(userName.trim());
  } else {
    const stored = localStorage.getItem("userName");
    if (stored?.trim() && stored !== "friend") {
      setName(stored.trim());
    }
  }

  const showTimer = setTimeout(() => setVisible(true), 100);
  return () => clearTimeout(showTimer);
}, [userName]);


  /* -------------------- LOCK BODY SCROLL -------------------- */
  useEffect(() => {
    if (visible) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [visible]);

  /* -------------------- ESC KEY CLOSE -------------------- */
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  /* -------------------- CLOSE HANDLER -------------------- */
  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);

    setTimeout(() => {
      setVisible(false);
      setIsClosing(false);
    }, 300);
  };

  if (!visible) return null;

  return ReactDOM.createPortal(
    <>
      {/* Overlay (tap anywhere closes) */}
      <div
        onClick={handleClose}
        className={`fixed inset-0 z-[1000] bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[1010] flex items-center justify-center px-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-title"
          className={`bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden
            transition-all duration-300 ease-out
            ${isClosing ? "opacity-0 scale-95" : "opacity-100 scale-100 animate-fade-in"}
          `}
        >
          {/* Progress bar */}
          <div className="h-1 bg-gray-200">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-progress" />

          </div>

          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center shadow-inner">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
          <h2
  id="welcome-title"
  className="text-lg font-bold text-gray-800"
>
  {name ? `Welcome ${name}!` : "Welcome!"}
</h2>


            </div>

            <button
              onClick={handleClose}
              aria-label="Close welcome dialog"
              className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 flex flex-col gap-2">
            <p className="text-gray-700 text-sm">
              Your{" "}
              <span className="font-semibold text-gray-800">Tally Connect</span>{" "}
              dashboard is ready for smooth accounting.
            </p>

            {[
               { icon: <Activity className="w-4 h-4 text-blue-500" />, text: "Quick overview of ledgers & vouchers" },
  { icon: <Users className="w-4 h-4 text-purple-500" />, text: "Send invites & manage users easily" },
  { icon: <Clock className="w-4 h-4 text-green-500" />, text: "Track your activity in real-time" },
            ].map((feature, i) => (
               <div
    key={i}
    className="flex items-center gap-2 bg-gray-50 p-2 rounded-md hover:bg-gray-100 transition"
  >
    {feature.icon}
    <span className="text-gray-800 text-sm">{feature.text}</span>
  </div>
            ))}
          </div>

          {/* Action */}
          <button
            onClick={handleClose}
            className="w-full py-2 bg-blue-600 text-white font-bold rounded-b-xl hover:bg-blue-700 transition"
          >
            Let’s Go! 🚀
          </button>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.35s ease-out;
        }

        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .animate-progress {
          animation: progress 8s linear;
        }
      `}</style>
    </>,
    document.body,
  );
}