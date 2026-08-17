import express from "express";
import pool from "../db.js";

const router = express.Router();

/**
 * POST /invoice-item/bulk-sync
 */
router.post("/bulk-sync", async (req, res) => {
  const rows = req.body;

  if (!Array.isArray(rows)) {
    return res.status(400).json({ success: false });
  }

  try {
    for (const r of rows) {
      await pool.query(
        `
        INSERT INTO invoice_items
        ( admin_id,invoice_guid, company_guid, item_name, quantity, rate, amount)
        VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
           r.admin_id,
          r.invoice_guid,
          r.company_guid,
          r.item_name,
          r.quantity,
          r.rate,
          r.amount,
        ]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ invoice-item bulk-sync error:", err.message);
    res.status(500).json({ success: false });
  }
});

export default router;
