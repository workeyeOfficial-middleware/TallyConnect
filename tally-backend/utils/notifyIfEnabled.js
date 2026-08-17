// utils/notifyIfEnabled.js
import pool from "../db.js";
import { createNotification } from "./notification.js";

const TYPE_TO_PREF_KEY = {
  USER_CREATED: "user_created",
  USER_DELETED: "user_deleted",
  USER_INVITE: "user_created",
  VOUCHER_CREATED: "new_voucher",
  VOUCHER_DELETED: "new_voucher",
  PAYMENT_DUE: "payment_due",
  LOW_STOCK: "low_stock",
  MONTHLY_REPORT: "monthly_reports",
};

export async function notifyIfEnabled({ type, message, user_id }) {
  const prefKey = TYPE_TO_PREF_KEY[type];
  if (!prefKey) return;

  const { rows } = await pool.query(
    `SELECT notification_preferences
     FROM users
     WHERE id = $1`,
    [user_id]
  );

  const prefs = rows[0]?.notification_preferences || {};

  // ❌ user turned OFF this notification
  if (!prefs[prefKey]) return;

  // ✅ user allowed → create notification
  await createNotification({ type, message, user_id });
}
