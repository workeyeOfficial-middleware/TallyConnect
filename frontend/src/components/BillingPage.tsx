import { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";
import {
  Check, Sparkles, Calendar, CreditCard, Loader2, X, ArrowRight,
  BadgeIndianRupee, Shield, TrendingUp, RefreshCw, AlertCircle,
  FileText, ChevronRight, Clock,
} from "lucide-react";
import { purchaseLicense } from "./Payment/license";
import { createOrder, verifyPayment } from "./Payment/payment";
import { loadRazorpay } from "./Payment/loadRazorpay";
import { toast } from "sonner";
import type { SettingsTab } from "./SettingsPage";

const PRODUCT_ID = "695902cfc240b17f16c3d716";
const LMS_BASE   = "https://dashboard.licentic.org";

interface BillingPageProps {
  setActiveTab: React.Dispatch<React.SetStateAction<SettingsTab>>;
}

interface PendingOrder {
  transactionId: string;
  orderId: string;
  key: string;
  amount: number;
  amountInPaise: number;
  currency: string;
}

interface UpgradeQuote {
  originalSubtotal: number;
  creditApplied: number;
  adjustedSubtotal: number;
  gst: number;
  finalAmount: number;
  isUpgrade: boolean;
  upgradeDetails?: { from: string; to: string };
}

interface Feature {
  featureSlug: string;
  displayName: string;
  featureType: string;
  value?: number;
  limit?: number;
  uiLabel?: string;
  uiTemplate?: string;
}

interface PriceInfo {
  amount: number;
  currency: string;
  billingPeriod: string;
}

interface LicenseType {
  _id: string;
  name: string;
  description?: string;
  price: PriceInfo;
  features: Feature[];
}

interface ActiveLicense {
  licenseType: LicenseType;
  _id?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  autoRenew?: boolean;
  licenseId?: string;
  ownerUserId?: any;
}

interface Plan {
  _id: string;
  licenseType: LicenseType;
  status: string;
}

function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export default function TallyConnectorBillingPage({ setActiveTab }: BillingPageProps) {
  const [plans,         setPlans]         = useState<Plan[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [activeLicense, setActiveLicense] = useState<ActiveLicense | null>(null);
  const [busy,          setBusy]          = useState(false);
  const [lmsUserId,     setLmsUserId]     = useState<string>("");

  const [modalOpen,      setModalOpen]      = useState(false);
  const [upgradeTarget,  setUpgradeTarget]  = useState<Plan | null>(null);
  const [upgradeQuote,   setUpgradeQuote]   = useState<UpgradeQuote | null>(null);
  const [loadingQuote,   setLoadingQuote]   = useState(false);
  const [quoteError,     setQuoteError]     = useState<string | null>(null);
  const [pendingOrder,   setPendingOrder]   = useState<PendingOrder | null>(null);

  // ── Refs for stale-closure-safe access in Razorpay callbacks ───────────────
  const pendingOrderRef   = useRef<PendingOrder | null>(null);
  const upgradeTargetRef  = useRef<Plan | null>(null);
  const upgradeQuoteRef   = useRef<UpgradeQuote | null>(null);

  const token = localStorage.getItem("token");

  const getEmailFromToken = (): string | null => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.email;
    } catch { return null; }
  };

  const email: string =
    JSON.parse(localStorage.getItem("user") || "{}")?.email ||
    getEmailFromToken() || "";

  const userName: string =
    JSON.parse(localStorage.getItem("user") || "{}")?.name ?? email ?? "";

  /* ── FETCH PLANS ────────────────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${LMS_BASE}/api/license/public/licenses-by-product/${PRODUCT_ID}`);
        const data = await res.json();
        setPlans(data?.licenses || []);
      } catch (err) {
        console.error("Failed to load plans", err);
        setPlans([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── FETCH ACTIVE LICENSE ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!email) return;
    (async () => {
      try {
        const res  = await fetch(`${LMS_BASE}/api/external/actve-license/${encodeURIComponent(email)}?productId=${PRODUCT_ID}`);
        const data = await res.json();
        if (data?.success && data.activeLicense) {
          const lic = data.activeLicense;
          const uid: string =
            (typeof lic.ownerUserId === "string" ? lic.ownerUserId : lic.ownerUserId?._id) ?? "";
          if (uid) setLmsUserId(uid);
          setActiveLicense({
            ...lic,
            licenseType: lic.licenseTypeId ?? lic.licenseType,
            licenseId:   lic.licenseId ?? lic._id,
          });
        } else {
          setActiveLicense(null);
        }
      } catch { setActiveLicense(null); }
    })();
  }, [email]);

  /* ── HELPERS ────────────────────────────────────────────────────────────── */
  const isCurrentPlan = (plan: Plan) =>
    activeLicense?.licenseType?._id === plan.licenseType?._id;

  const getFeaturesList = (features: Feature[]) =>
    features
      .map((f) =>
        f.uiTemplate
          ? f.uiTemplate.replace("{value}", String(f.value ?? f.limit ?? ""))
          : f.uiLabel || f.displayName
      )
      .filter(Boolean);

  const refreshActiveLicense = async () => {
    if (!email) return;
    try {
      const res  = await fetch(`${LMS_BASE}/api/external/actve-license/${encodeURIComponent(email)}?productId=${PRODUCT_ID}`);
      const data = await res.json();
      if (data?.success && data.activeLicense) {
        const lic = data.activeLicense;
        setActiveLicense({
          ...lic,
          licenseType: lic.licenseTypeId ?? lic.licenseType,
          licenseId:   lic.licenseId ?? lic._id,
        });
      }
    } catch { /* silently fail */ }
  };

  /* ── RESET MODAL STATE ──────────────────────────────────────────────────── */
  function resetModal() {
    setUpgradeQuote(null);    upgradeQuoteRef.current  = null;
    setUpgradeTarget(null);   upgradeTargetRef.current = null;
    setPendingOrder(null);    pendingOrderRef.current  = null;
    setQuoteError(null);
  }

  /* ── FETCH QUOTE ────────────────────────────────────────────────────────── */
  async function fetchUpgradeQuote(plan: Plan): Promise<void> {
    if (!email) { toast.error("Please log in to continue"); return; }

    setLoadingQuote(true);
    setQuoteError(null);
    setUpgradeQuote(null);
    setPendingOrder(null);
    pendingOrderRef.current = null;

    try {
      // ── Step 1: purchaseLicense creates a pending transaction ────────────
      // Backend returns: { success, message, data: { transactionId, userId, ... } }
      const purchaseRes = await purchaseLicense({
        name:         userName,
        email,
        licenseId:    plan._id,
        billingCycle: "monthly",
        amount:       0,
        currency:     "INR",
      });

      console.log("📦 purchaseRes:", purchaseRes);

      // ── Extract transactionId from wrapped response ──────────────────────
      const transactionId: string =
        purchaseRes?.data?.transactionId  // wrapped ✅
        ?? purchaseRes?.transactionId     // flat fallback
        ?? "";

      if (!transactionId) {
        const errMsg = purchaseRes?.data?.message ?? purchaseRes?.message;
        throw new Error(errMsg ?? "Transaction ID missing from response");
      }

      const resolvedUserId: string =
        purchaseRes?.data?.userId   // wrapped ✅
        ?? purchaseRes?.userId      // flat fallback
        ?? lmsUserId;

      if (!resolvedUserId) throw new Error("Could not resolve user ID. Please try again.");
      if (!lmsUserId) setLmsUserId(resolvedUserId);

      // ── Step 2: Retry createOrder until backend persists the transaction ─
      // purchaseLicense is async on the backend — poll with backoff (1s, 2s, 3s)
      // so we never hit "No pending transaction found" again.
      let orderRes: any = null;
      const MAX_ATTEMPTS = 4;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (attempt > 0) {
          const delay = 1000 * attempt; // 1000ms, 2000ms, 3000ms
          console.log(`⏳ Attempt ${attempt + 1}: waiting ${delay}ms before retrying createOrder…`);
          await new Promise((r) => setTimeout(r, delay));
        }

        try {
          console.log(`📤 createOrder attempt ${attempt + 1}:`, { transactionId, userId: resolvedUserId, licenseId: plan._id });

          orderRes = await createOrder({
            transactionId,
            userId:       resolvedUserId,
            licenseId:    plan._id,
            billingCycle: "monthly",
            amount:       0,
          });

          console.log(`📦 orderRes (attempt ${attempt + 1}):`, orderRes);

          // Success — got a valid orderId, stop retrying
          if (orderRes?.orderId) break;

          // Backend says transaction not ready yet — retry
          const isPendingErr =
            orderRes?.code === "NO_PENDING_TRANSACTION" ||
            orderRes?.message?.toLowerCase().includes("pending transaction");

          if (isPendingErr && attempt < MAX_ATTEMPTS - 1) {
            console.warn(`⏳ Transaction not ready yet, will retry…`);
            continue;
          }

          // Any other response — stop and let downstream error handling deal with it
          break;

        } catch (err: any) {
          const serverMsg: string =
            err?.response?.data?.message ?? err?.message ?? "";
          const isPendingErr = serverMsg.toLowerCase().includes("pending transaction");

          if (isPendingErr && attempt < MAX_ATTEMPTS - 1) {
            console.warn(`⏳ 400 "pending transaction" on attempt ${attempt + 1}, retrying…`);
            continue;
          }

          // Non-retryable error — rethrow immediately
          throw err;
        }
      }

      // ── Guard: if we exhausted all attempts without an orderId ───────────
      if (!orderRes?.orderId) {
        const code = orderRes?.error ?? orderRes?.code ?? "";
        if (code === "DOWNGRADE_NOT_ALLOWED")
          throw new Error("Downgrade is not allowed while your current plan is active.");
        if (code === "DUPLICATE_PLAN_NOT_ALLOWED")
          throw new Error("You already have this plan active.");
        if (orderRes?.message)
          throw new Error(orderRes.message);
        throw new Error("Order could not be created. Please try again.");
      }

      if (orderRes?.amount == null)
        throw new Error("Invalid order response — missing amount");

      // ── Handle other backend business-rule errors ────────────────────────
      if (orderRes?.message && !orderRes?.orderId) {
        const code = orderRes?.error ?? orderRes?.code ?? "";
        if (code === "DOWNGRADE_NOT_ALLOWED")
          throw new Error("Downgrade is not allowed while your current plan is active.");
        if (code === "DUPLICATE_PLAN_NOT_ALLOWED")
          throw new Error("You already have this plan active.");
        throw new Error(orderRes.message);
      }

      // ── Build quote ──────────────────────────────────────────────────────
      const originalSubtotal =
        orderRes.originalAmount != null && orderRes.originalAmount > 0
          ? Number(orderRes.originalAmount)
          : Number((orderRes.amount / 1.18).toFixed(2));
      const creditApplied    = Number(orderRes.creditApplied ?? 0);
      const adjustedSubtotal = Math.max(originalSubtotal - creditApplied, 0);
      const gst              = Number((adjustedSubtotal * 0.18).toFixed(2));
      const isUpgrade        = Boolean(orderRes.isUpgrade);

      const quote: UpgradeQuote = {
        originalSubtotal,
        creditApplied,
        adjustedSubtotal,
        gst,
        finalAmount: Number(orderRes.amount),
        isUpgrade,
        upgradeDetails: isUpgrade
          ? { from: activeLicense?.licenseType?.name ?? "Current Plan", to: plan.licenseType.name }
          : undefined,
      };

      // ── Resolve Razorpay key ─────────────────────────────────────────────
      const rzpKey: string =
        orderRes.key
        ?? orderRes.razorpayKey
        ?? orderRes.razorpay_key
        ?? "";

      if (!rzpKey) {
        console.error("⚠️ Razorpay key missing from orderRes:", orderRes);
      }

      const order: PendingOrder = {
        transactionId,
        orderId:      orderRes.orderId,
        key:          rzpKey,
        amount:       Number(orderRes.amount),
        amountInPaise:
          orderRes.amountInPaise
          ?? orderRes.amount_in_paise
          ?? Math.round(Number(orderRes.amount) * 100),
        currency: orderRes.currency ?? "INR",
      };

      console.log("✅ pendingOrder ready:", order);

      // ── Save to both state AND refs ──────────────────────────────────────
      setPendingOrder(order);       pendingOrderRef.current  = order;
      setUpgradeQuote(quote);       upgradeQuoteRef.current  = quote;

    } catch (err: any) {
      const errData = err?.response?.data;
      let message   = errData?.message ?? err?.message ?? "Failed to load pricing.";
      const code    = errData?.error ?? errData?.code ?? "";
      if (code === "DOWNGRADE_NOT_ALLOWED")      message = "Downgrade is not allowed while your current plan is active.";
      if (code === "DUPLICATE_PLAN_NOT_ALLOWED") message = "You already have this plan active.";
      console.error("❌ fetchUpgradeQuote error:", message, err);
      setQuoteError(message);
      toast.error(message);
    } finally {
      setLoadingQuote(false);
    }
  }

  /* ── OPEN MODAL ─────────────────────────────────────────────────────────── */
  async function openModal(plan: Plan) {
    resetModal();
    setUpgradeTarget(plan);
    upgradeTargetRef.current = plan;
    setModalOpen(true);
    await fetchUpgradeQuote(plan);
  }

  /* ── CLOSE MODAL ────────────────────────────────────────────────────────── */
  function handleCloseModal() {
    if (busy) return;
    setModalOpen(false);
    resetModal();
  }

  /* ── CONFIRM PAYMENT ────────────────────────────────────────────────────── */
  async function confirmPayment() {
    // Always read from refs — stale-closure-safe
    const order  = pendingOrderRef.current;
    const target = upgradeTargetRef.current;
    const quote  = upgradeQuoteRef.current;

    console.log("🔔 confirmPayment triggered");
    console.log("  order:",  order);
    console.log("  target:", target?.licenseType?.name);
    console.log("  quote:",  quote?.finalAmount);

    if (!target || !quote) {
      toast.error("Missing plan details. Please close and try again.");
      return;
    }
    if (!order?.orderId) {
      toast.error("Order not ready. Please wait a moment and try again.");
      return;
    }
    if (!order.key) {
      toast.error("Payment configuration error — Razorpay key missing. Contact support.");
      console.error("❌ Razorpay key is empty:", order);
      return;
    }

    // Snapshot to plain variables — no state/ref reads after this point
    const planName      = target.licenseType.name;
    const isUpgradeFlow = quote.isUpgrade;
    const txId          = order.transactionId;
    const rzpKey        = order.key;
    const rzpPaise      = order.amountInPaise;
    const rzpCurrency   = order.currency;
    const rzpOrderId    = order.orderId;
    const userEmail     = email;
    const userNameSnap  = userName;

    console.log("🚀 Launching Razorpay:", { rzpKey, rzpPaise, rzpOrderId, rzpCurrency });

    setBusy(true);

    try {
      const sdkLoaded = await loadRazorpay();
      console.log("📦 SDK loaded:", sdkLoaded, "window.Razorpay:", !!(window as any).Razorpay);

      if (!sdkLoaded || !(window as any).Razorpay) {
        toast.error("Razorpay SDK failed to load. Check your internet connection.");
        setBusy(false);
        return;
      }

      // Close modal right before opening Razorpay so there's no overlap
      setModalOpen(false);

      // Tiny yield so React unmounts the modal DOM before Razorpay mounts its iframe
      await new Promise((r) => requestAnimationFrame(r));

      const rzp = new (window as any).Razorpay({
        key:         rzpKey,
        amount:      rzpPaise,
        currency:    rzpCurrency,
        name:        "Tally Connector",
        description: planName,
        order_id:    rzpOrderId,
        prefill:     { email: userEmail, name: userNameSnap },
        theme:       { color: "#2563eb" },
        modal: {
          escape:        true,
          backdropclose: false,
          ondismiss: () => {
            console.log("⚠️ Razorpay modal dismissed");
            setBusy(false);
            toast.info("Payment cancelled");
          },
        },
        handler: async (rzpRes: any) => {
          console.log("✅ Payment success callback:", rzpRes);
          try {
            await verifyPayment({
              transactionId:       txId,
              razorpay_payment_id: rzpRes.razorpay_payment_id,
              razorpay_order_id:   rzpRes.razorpay_order_id,
              razorpay_signature:  rzpRes.razorpay_signature,
            });
            toast.success(
              `${isUpgradeFlow ? "Upgraded" : "Subscribed"} to ${planName} successfully!`,
              { duration: 5000 }
            );
            await refreshActiveLicense();
            resetModal();
          } catch (err) {
            console.error("❌ Verify failed:", err);
            toast.error(
              `Payment verification failed. Contact support with ref: ${txId}`,
              { duration: 8000 }
            );
          } finally {
            setBusy(false);
          }
        },
      });

      rzp.on("payment.failed", (response: any) => {
        console.error("❌ payment.failed:", response.error);
        toast.error(`Payment failed: ${response.error?.description ?? "Unknown error"}`);
        setBusy(false);
      });

      rzp.open();
      console.log("✅ rzp.open() called");

    } catch (e: any) {
      console.error("💥 Unexpected error in confirmPayment:", e);
      toast.error(e?.message ?? "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  /* ── LOADING ────────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center gap-2 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        Loading plans…
      </div>
    );
  }

  const sortedPlans = [...plans].sort((a, b) => {
    if (isCurrentPlan(a)) return -1;
    if (isCurrentPlan(b)) return 1;
    return 0;
  });

  /* ── RENDER ─────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">

      {/* ══ MODAL portal ══ */}
      {modalOpen && upgradeTarget && ReactDOM.createPortal(
        <>
          {/* Backdrop */}
          <div
            onClick={() => !busy && handleCloseModal()}
            style={{
              position: "fixed", inset: 0, zIndex: 99998,
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            }}
          />

          {/* Modal wrapper */}
          <div style={{
            position: "fixed", inset: 0, zIndex: 99999,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "24px", pointerEvents: "none",
          }}>
            <div
              className="pointer-events-auto w-full bg-white overflow-hidden"
              style={{
                maxWidth: "460px",
                borderRadius: "20px",
                boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
                opacity: busy ? 0 : 1,
                pointerEvents: busy ? "none" : "auto",
                transition: "opacity 0.15s ease",
              }}
            >
              {/* Header */}
              <div
                className="px-7 py-6 flex items-start justify-between"
                style={{ background: "linear-gradient(135deg, #2563eb, #1e40af)" }}
              >
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: "rgba(255,255,255,0.65)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {upgradeQuote?.isUpgrade ? "Upgrade Plan" : "Subscribe to Plan"}
                  </p>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {upgradeQuote?.upgradeDetails
                      ? `${upgradeQuote.upgradeDetails.from} → ${upgradeQuote.upgradeDetails.to}`
                      : upgradeTarget.licenseType.name}
                  </h2>
                </div>
                <button
                  onClick={handleCloseModal}
                  disabled={busy}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                  style={{ color: "rgba(255,255,255,0.8)" }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-7 py-7 space-y-5">

                {/* Loading */}
                {loadingQuote && (
                  <div className="flex flex-col items-center justify-center py-14 space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-sm text-slate-500">Calculating your price…</p>
                  </div>
                )}

                {/* Error */}
                {!loadingQuote && quoteError && (
                  <div className="flex flex-col items-center justify-center py-10 space-y-3">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                    <p className="text-sm text-slate-700 font-semibold text-center">Failed to load pricing</p>
                    <p className="text-xs text-slate-400 text-center px-4">{quoteError}</p>
                    <button
                      onClick={() => fetchUpgradeQuote(upgradeTarget)}
                      className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Try again
                    </button>
                  </div>
                )}

                {/* No quote fallback */}
                {!loadingQuote && !quoteError && !upgradeQuote && (
                  <div className="flex flex-col items-center justify-center py-10 space-y-3">
                    <AlertCircle className="w-8 h-8 text-orange-400" />
                    <p className="text-sm text-slate-700 font-semibold">Unable to load pricing</p>
                    <button
                      onClick={() => fetchUpgradeQuote(upgradeTarget)}
                      className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Try again
                    </button>
                  </div>
                )}

                {/* Quote ready */}
                {!loadingQuote && !quoteError && upgradeQuote && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Billing cycle</span>
                      <span className="text-sm font-semibold text-slate-800">Monthly</span>
                    </div>

                    <hr className="border-slate-100" />

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">
                          {upgradeTarget.licenseType.name} (Monthly)
                        </span>
                        <span className="text-sm font-semibold text-slate-800">
                          {formatINR(upgradeQuote.originalSubtotal)}
                        </span>
                      </div>

                      {upgradeQuote.isUpgrade && upgradeQuote.creditApplied > 0 && (
                        <>
                          <hr className="border-dashed border-slate-200" />
                          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-amber-600" />
                              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                                Upgrade Credit Applied
                              </p>
                            </div>
                            <div className="flex justify-between text-amber-700 font-medium text-sm">
                              <span>Prorated credit from current plan</span>
                              <span>− {formatINR(upgradeQuote.creditApplied)}</span>
                            </div>
                          </div>
                        </>
                      )}

                      <hr className="border-slate-100" />

                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">
                          Subtotal{upgradeQuote.isUpgrade && upgradeQuote.creditApplied > 0 ? " after credit" : ""}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">
                          {formatINR(upgradeQuote.adjustedSubtotal)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">GST (18%)</span>
                        <span className="text-sm text-slate-500">+ {formatINR(upgradeQuote.gst)}</span>
                      </div>
                    </div>

                    <hr className="border-slate-200" />

                    <div className="flex justify-between items-center py-1">
                      <span className="text-base font-semibold text-slate-800">Total Payable</span>
                      <span className="text-3xl font-bold text-slate-900">
                        {formatINR(upgradeQuote.finalAmount)}
                      </span>
                    </div>

                    <button
                      onClick={confirmPayment}
                      disabled={busy || !pendingOrder}
                      className="w-full text-white font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-base"
                      style={{
                        background: "linear-gradient(135deg, #2563eb, #1e40af)",
                        borderRadius: "9999px",
                        height: "52px",
                      }}
                    >
                      {busy ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Opening payment…</>
                      ) : !pendingOrder ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Preparing order…</>
                      ) : (
                        <>
                          <BadgeIndianRupee className="w-4 h-4" />
                          Pay {formatINR(upgradeQuote.finalAmount)}&nbsp;&amp;&nbsp;
                          {upgradeQuote.isUpgrade ? "Upgrade" : "Subscribe"}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                      <Shield className="w-3 h-3" /> Secured by Razorpay · Cancel anytime
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ══ PAGE CONTENT ══ */}
      <div className="max-w-7xl mx-auto">

        {/* Page header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full mb-4">
            <CreditCard className="w-4 h-4" />
            Tally Connector Pricing
          </div>
          <h1 className="text-4xl font-bold">Choose Your Plan</h1>
        </div>

     {/* Active license banner */}
{activeLicense && (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
    
    {/* Header */}
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
      Current Subscription
    </p>

    <div className="flex items-center gap-3">
      <span className="text-2xl font-bold text-slate-900 capitalize">
        {activeLicense.licenseType?.name}
      </span>

      <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize bg-emerald-100 text-emerald-700">
        {activeLicense.status ?? "active"}
      </span>
    </div>

    {activeLicense.endDate && (
      <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-2">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        Expires on{" "}
        {new Date(activeLicense.endDate).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </div>
    )}

    {/* Divider */}
    <div className="border-t border-slate-100 my-4" />

    {/* Action */}
    <button
      onClick={() => setActiveTab("invoices")}
      className="flex items-center justify-between w-full sm:w-auto gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
    >
      <span className="flex items-center gap-2">
        <FileText className="w-4 h-4" />
        View Invoices
      </span>
      <ChevronRight className="w-4 h-4 text-slate-400" />
    </button>

  </div>
)}

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {sortedPlans.map((plan) => {
            const type           = plan.licenseType;
            const active         = isCurrentPlan(plan);
            const isProfessional = type.name.toLowerCase().includes("professional");
            const currentPrice   = activeLicense?.licenseType?.price?.amount ?? 0;
            const planPrice      = type.price.amount;
            const isUpgrade      = activeLicense && planPrice > currentPrice;
            const isDowngrade    = activeLicense && planPrice < currentPrice;
            const isFeatured     = active || isProfessional;

            return (
              <div
                key={plan._id}
                className={`relative rounded-3xl p-8 transition-all ${
                  active
                    ? "bg-green-50 border-2 border-green-500 shadow-2xl scale-105"
                    : isFeatured
                    ? "bg-blue-50 border-2 border-blue-400 shadow-xl"
                    : "bg-white border-2 border-gray-200"
                }`}
              >
                {isFeatured && !active && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white rounded-full flex items-center gap-1 text-sm whitespace-nowrap">
                    <Sparkles className="w-4 h-4" /> Most Popular
                  </div>
                )}
                {active && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-green-600 text-white rounded-full text-sm whitespace-nowrap">
                    ✓ Active Plan
                  </div>
                )}

                <h3 className="text-2xl font-bold mb-1">{type.name}</h3>
                {active && <p className="text-sm font-medium text-green-700">You're currently on this plan</p>}
                <p className="text-gray-600 text-sm mb-4">{type.description}</p>
                <div className="text-4xl font-bold">
                  ₹{type.price.amount}
                  <span className="text-base text-gray-500"> per user/{type.price.billingPeriod}</span>
                </div>

                {active ? (
                  <button
                    disabled
                    className="w-full mt-6 py-3 rounded-xl bg-green-100 text-green-700 font-semibold cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => openModal(plan)}
                    disabled={busy}
                    className="w-full mt-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {type.price.amount === 0 ? "Get Started Free"
                      : isUpgrade   ? "Upgrade Plan"
                      : isDowngrade ? "Downgrade Plan"
                      : "Select Plan"}
                  </button>
                )}

                <div className="mt-6 space-y-2">
                  {getFeaturesList(type.features).map((f, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                      {f}
                    </div>
                  ))}
                </div>

                {active && activeLicense?.endDate && (
                  <div className="mt-6 pt-4 border-t text-xs text-gray-600 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Renews on{" "}
                    <strong>{new Date(activeLicense.endDate).toLocaleDateString()}</strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
