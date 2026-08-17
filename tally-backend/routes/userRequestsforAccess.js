import express from "express";
import pool from "../db.js";           // ✅ use pool, not db
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

// ============================================
// POST /request-to-admin — User sends request
// ============================================
router.post("/request-to-admin", requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    if (!message || message.trim().length < 10) {
      return res.status(400).json({ message: "Message too short (min 10 chars)" });
    }

    // Find which admin owns this user
    const userResult = await pool.query(
      "SELECT admin_id, username FROM users WHERE id = $1",
      [userId]
    );

    const adminId = userResult.rows[0]?.admin_id;
    if (!adminId) {
      return res.status(400).json({ message: "No admin assigned to this user" });
    }

    // Insert the request
    await pool.query(
      `INSERT INTO user_requests (user_id, admin_id, message) VALUES ($1, $2, $3)`,
      [userId, adminId, message]
    );

    // Create a notification for the admin
    await pool.query(
      `INSERT INTO notifications (type, message, user_id) VALUES ('request', $1, $2)`,
      [`New request from ${userResult.rows[0].username}`, adminId]
    );

    res.json({ success: true, message: "Request sent successfully" });

  } catch (err) {
    console.error("Error sending request:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ============================================
// GET /admin/requests — Admin fetches all requests
// ============================================
router.get("/admin/requests", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied" });
    }

    const adminId = req.user.id;

    const result = await pool.query(
      `SELECT 
         ur.id,
         ur.message,
         ur.created_at,
         ur.is_read,
         u.username AS user_name,
         u.email    AS user_email
       FROM user_requests ur
       JOIN users u ON u.id = ur.user_id
       WHERE ur.admin_id = $1
       ORDER BY ur.created_at DESC`,
      [adminId]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("Error fetching requests:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;