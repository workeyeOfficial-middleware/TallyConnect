import pool from "../db.js";

/* =========================================
   MOBILE NOTIFICATIONS (SELF-CONTAINED)
   Separate from the web notification system.
========================================= */

export const MOBILE_NOTIFICATION_DEFAULTS = {
  create_entry: true,
  entry_failed: true,
  sync_failed: true,
  sync_completed: false,
  voucher_sync: false,
  party_sync: true,
  item_sync: false,
  ledger_sync: false,
  tally_connection: true,
  system_alerts: true,
};

export const TITLE_BY_TYPE = {
  create_entry: "Entry Created",
  entry_failed: "Entry Sync Failed",
  sync_failed: "Sync Failed",
  sync_completed: "Sync Completed",
  voucher_sync: "Vouchers Synced",
  party_sync: "New Party Synced",
  item_sync: "New Item Synced",
  ledger_sync: "New Ledger Synced",
  tally_connection: "Tally Connection",
  system_alerts: "System Alert",
};

/* =========================================
   ENSURE MOBILE TABLES EXIST (idempotent)
========================================= */
export async function ensureMobileSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mobile_notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT,
      message TEXT,
      file TEXT,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mobile_notification_preferences (
      user_id INTEGER PRIMARY KEY,
      config JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mobile_notifications_user
    ON mobile_notifications (user_id, created_at DESC)
  `);
}
ensureMobileSchema().catch((err) =>
  console.error("⚠️ mobile notifications schema failed:", err.message)
);

/* =========================================
   CONFIG HELPERS
========================================= */
export async function getMobilePrefs(userId) {
  const { rows } = await pool.query(
    `SELECT config FROM mobile_notification_preferences WHERE user_id = $1`,
    [userId]
  );
  return { ...MOBILE_NOTIFICATION_DEFAULTS, ...(rows[0]?.config || {}) };
}

export async function saveMobilePrefs(userId, incoming) {
  const current = await getMobilePrefs(userId);
  const cleaned = {};
  for (const [key, value] of Object.entries(incoming || {})) {
    if (Object.prototype.hasOwnProperty.call(MOBILE_NOTIFICATION_DEFAULTS, key)) {
      cleaned[key] = Boolean(value);
    }
  }
  const next = { ...current, ...cleaned };
  await pool.query(
    `INSERT INTO mobile_notification_preferences (user_id, config)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (user_id)
     DO UPDATE SET config = EXCLUDED.config`,
    [userId, next]
  );
  return next;
}

// Create a mobile notification for ONE user (respects their mobile config)
export async function createMobileNotification({ type, title, message, user_id, file = null }) {
  const prefs = await getMobilePrefs(user_id);
  const enabled = prefs[type] ?? MOBILE_NOTIFICATION_DEFAULTS[type] ?? false;
  if (!enabled) return { inserted: false };

  const { rows } = await pool.query(
    `INSERT INTO mobile_notifications (user_id, type, title, message, file)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [user_id, type, title || TITLE_BY_TYPE[type] || "Notification", message, file]
  );
  return { inserted: true, id: rows[0].id };
}

// Create for the admin AND every user under that admin who enabled this type.
export async function createMobileNotificationForAdmin({ type, title, message, adminId, file = null }) {
  const { rows } = await pool.query(
    `SELECT id FROM users WHERE admin_id = $1`,
    [adminId]
  );

  const recipients = new Set(rows.map((r) => r.id));
  recipients.add(adminId);

  for (const userId of recipients) {
    await createMobileNotification({ type, title, message, user_id: userId, file });
  }
}