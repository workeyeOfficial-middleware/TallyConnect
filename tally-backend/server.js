import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
//import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import requireAuth from "./middleware/requireAuth.js";
import agentStatusRoutes from "./routes/agentStatus.js";
import forgotPasswordRoutes from "./routes/forgotPassword.js";
import "./cron/monthlyReportCron.js";

//dotenv.config();

// Import DB and routes
import pool from "./db.js";
import companiesRoute from "./routes/companies.js";
import ledgersRoute from "./routes/ledgers.js";
import vouchersRoute from "./routes/voucherEntry.js";
import billsRoute from "./routes/bills.js";
import ageingRoute from "./routes/ageing.js";
import salesOrderRoutes from "./routes/salesOrder.js";
import salesOrderItemRoutes from "./routes/salesOrderItem.js";
import stockItemRoutes from "./routes/stockItem.js";
import stockSummaryRoutes from "./routes/stockSummary.js";
import reportsRoutes from "./routes/reports.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import invoiceItemRoutes from "./routes/invoiceItem.routes.js";
import syncRoutes from "./routes/sync.routes.js";
import ordersRoutes from "./routes/orders.js";
import inventoryRoutes from "./routes/inventory.js";
import dashboardRoutes from "./routes/dashboard.js";
import agentRoutes from "./routes/agent.routes.js";
import voucherEntryBulkRoutes from "./routes/voucherEntry.bulk.js";
import usersRoute from "./routes/users.js";
import invoiceBulkRoutes from "./routes/invoice.bulk.js";
import invoiceItemBulkRoutes from "./routes/invoiceItem.bulk.js";
import voucherCommandRoutes from "./routes/UniversalUpdate/voucherCommand.js";
import syncQueueRoutes from "./routes/syncQueueRoutes.js";
import adminNotificationsRoutes from "./routes/adminNotifications.js";
import sendInviteRouter from "./routes/sendInvite.js";
import notifyPermissionUpdate from "./routes/notifypermissionupdate.js";
import userRequestsRouter from "./routes/userRequestsforAccess.js";
import entryFieldSettingsRoutes from "./routes/entryFieldSettings.js";
import mobileVoucherCommand from "./routes/UniversalUpdate/mobileVoucherCommand.js";
import mobileSyncQueueRoutes from "./routes/mobileSyncQueueRoutes.js";
import ledgerItemRoutes from "./routes/ledgerItems.js";

console.log("🔥 SERVER STARTED WITH AGENT-STATUS ROUTE");

const app = express();

app.use(cors());
//app.use(express.json());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/auth", authRoutes);
// Routes
app.use("/company", companiesRoute);

app.use(
  "/ledger",
  (req, res, next) => {
    if (req.path === "/sync") return next();
    requireAuth(req, res, next);
  },
  ledgersRoute
);

app.use(
  "/voucher-entry",
  (req, res, next) => {
    if (
      req.path === "/sync" ||
      req.path === "/mark-inactive" ||
      req.path === "/bulk-sync"
    ) {
      return next(); // 🤖 agent allowed
    }
    requireAuth(req, res, next); // 👤 UI only
  },
  vouchersRoute
);

app.use("/voucher-entry", voucherEntryBulkRoutes);

app.use("/orders", requireAuth, ordersRoutes);

app.use("/bill", billsRoute);
app.use("/ageing", ageingRoute);
app.use("/sales-order", salesOrderRoutes);
app.use("/sales-order-item", salesOrderItemRoutes);
app.use("/stock-item", stockItemRoutes);
app.use("/stock-summary", stockSummaryRoutes);
app.use(
  "/invoice",
  (req, res, next) => {
    if (req.path === "/sync" || req.path === "/bulk-sync") {
      return next(); // 🤖 agent allowed
    }
    requireAuth(req, res, next); // 👤 UI only
  },
  invoiceRoutes
);

app.use(
  "/invoice-item",
  (req, res, next) => {
    if (req.path === "/sync" || req.path === "/bulk-sync") {
      return next(); // 🤖 agent allowed
    }
    requireAuth(req, res, next); // 👤 UI only
  },
  invoiceItemRoutes
);

app.use("/sync", syncRoutes);
app.use("/inventory", inventoryRoutes);
app.use("/users", usersRoute);
app.use("/uploads", express.static("uploads"));
app.use("/api/users", usersRoute);
app.use("/dashboard", dashboardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/inventory", inventoryRoutes);
app.use("/stock-summary", stockSummaryRoutes);
app.use("/api/auth", forgotPasswordRoutes);
app.use("/send-invite", sendInviteRouter);

app.use("/agent", agentRoutes);
app.use("/invoice", invoiceBulkRoutes);
app.use("/invoice-item", invoiceItemBulkRoutes);
app.use("/agent-status", agentStatusRoutes);
app.use("/voucher-command", voucherCommandRoutes);
app.use("/sync-queue", syncQueueRoutes);
app.use("/admin/notifications", requireAuth, adminNotificationsRoutes);
app.use("/notify-permission-update", notifyPermissionUpdate);
app.use("/", requireAuth, userRequestsRouter);
app.use("/api/mobile-voucher-command", mobileVoucherCommand);
app.use("/api/mobile-sync-queue", mobileSyncQueueRoutes);
app.use("/ledger-items", ledgerItemRoutes);

app.use(
  "/entry-field-settings",
  requireAuth,
  entryFieldSettingsRoutes
);
// Test route
app.get("/", (req, res) => {
  res.send("Backend working!");
});

// DB test
app.get("/check-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ success: true, time: result.rows[0] });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);

