import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router(); // ✅ REQUIRED

router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. get user preferences
    const prefRes = await pool.query(
      `SELECT notification_preferences FROM users WHERE id = $1`,
      [userId]
    );

    const prefs = prefRes.rows[0]?.notification_preferences || {};

    // 2. fetch notifications
    const result = await pool.query(
      `
      SELECT *
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [userId]
    );

    // 3. filter based on preferences
    const TYPE_TO_PREF_KEY = {
      USER_CREATED: "user_created",
      USER_DELETED: "user_deleted",
      VOUCHER_CREATED: "new_voucher",
      VOUCHER_DELETED: "new_voucher",
      PAYMENT_DUE: "payment_due",
      LOW_STOCK: "low_stock",
      MONTHLY_REPORT: "monthly_reports",
      BILL: "bill_created",
    };

    const filtered = result.rows.filter((n) => {
      const prefKey = TYPE_TO_PREF_KEY[n.type];
      if (!prefKey) return true; // unknown types → allow
      return prefs[prefKey] === true;
    });

    res.json(filtered);
  } catch (err) {
    console.error("FETCH NOTIFICATIONS ERROR:", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});


router.post("/:id/read", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE notifications SET is_read = true WHERE id = $1",
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark as read" });
  }
});

router.get("/download/:file", requireAuth, (req, res) => {
  res.download(`uploads/reports/${req.params.file}`);
});

router.delete("/clear-all", async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      "DELETE FROM notifications WHERE user_id = $1",
      [userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("CLEAR ALL ERROR:", err);
    res.status(500).json({ message: "Failed to clear notifications" });
  }
});


export default router;
