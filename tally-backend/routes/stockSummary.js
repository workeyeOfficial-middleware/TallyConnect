import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

/**
 * POST /stock-summary/sync
 * AGENT
 */
router.post("/sync", requireAuth, async (req, res) => {
  try {
    const adminId = req.user.adminId; // ✅ FROM JWT

    const {
      company_guid,
      item_name,
      closing_qty,
      closing_value
    } = req.body;

    if (!adminId || !company_guid || !item_name) {
      return res.status(400).json({
        success: false,
        message: "company_guid and item_name required"
      });
    }

    await pool.query(
      `
      INSERT INTO stock_summary
      (
        admin_id,
        company_guid,
        item_name,
        closing_qty,
        closing_value
      )
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (admin_id, company_guid, item_name)
      DO UPDATE SET
        closing_qty = EXCLUDED.closing_qty,
        closing_value = EXCLUDED.closing_value,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        adminId,
        company_guid,
        item_name,
        closing_qty || 0,
        closing_value || 0
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ stock-summary/sync error:", err.message);
    res.status(500).json({ success: false });
  }
});

export default router;
