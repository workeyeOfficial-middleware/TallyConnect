import express from "express";
import pool from "../db.js";
import path from "path";
import requireAuth from "../middleware/requireAuth.js";
import {
  getMobilePrefs,
  saveMobilePrefs,
  TITLE_BY_TYPE,
} from "../utils/mobileNotification.js";

const router = express.Router();

/* =========================================
   GET /api/mobile/notifications
   Notification list for the mobile bell icon.
========================================= */
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const prefs = await getMobilePrefs(userId);

    const result = await pool.query(
      `SELECT id, type, title, message, file, is_read, created_at
       FROM mobile_notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );

    const notifications = result.rows
      .filter((n) => prefs[n.type] === true)
      .map((n) => ({
        id: n.id,
        title: n.title || TITLE_BY_TYPE[n.type] || "Notification",
        message: n.message || "",
        is_read: Boolean(n.is_read),
        created_at: n.created_at,
        type: n.type,
        file: n.file || null,
      }));

    res.json({ success: true, notifications });
  } catch (err) {
    console.error("FETCH MOBILE NOTIFICATIONS ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
});

/* =========================================
   GET /api/mobile/notifications/config
========================================= */
router.get("/config", requireAuth, async (req, res) => {
  try {
    const config = await getMobilePrefs(req.user.id);
    res.json({ success: true, config });
  } catch (err) {
    console.error("FETCH MOBILE NOTIFICATION CONFIG ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to load notification config" });
  }
});

/* =========================================
   PUT /api/mobile/notifications/config
========================================= */
router.put("/config", requireAuth, async (req, res) => {
  try {
    const config = await saveMobilePrefs(req.user.id, req.body);
    res.json({ success: true, config });
  } catch (err) {
    console.error("SAVE MOBILE NOTIFICATION CONFIG ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to save notification config" });
  }
});

/* =========================================
   POST /api/mobile/notifications/:id/read
========================================= */
router.post("/:id/read", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE mobile_notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to mark as read" });
  }
});

/* =========================================
   DELETE /api/mobile/notifications/clear-all
========================================= */
router.delete("/clear-all", requireAuth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM mobile_notifications WHERE user_id = $1`, [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("CLEAR ALL ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to clear notifications" });
  }
});

/* =========================================
   GET /api/mobile/notifications/download/:file
========================================= */
router.get("/download/:file", requireAuth, (req, res) => {
  const reportsDir = path.resolve("uploads", "reports");
  const safePath = path.normalize(path.join(reportsDir, req.params.file));

  if (!safePath.startsWith(reportsDir + path.sep)) {
    return res.status(400).json({ success: false, message: "Invalid file" });
  }

  res.download(safePath);
});

export default router;