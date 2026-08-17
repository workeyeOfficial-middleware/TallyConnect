import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

/* ==========================
   AGENT → SYNC ITEMS
========================== */
router.post("/sync", async (req, res) => {
  try {
    const { invoice_guid, item_name, quantity, rate, amount } = req.body;

    await pool.query(
      `
      INSERT INTO invoice_items
      (admin_id,invoice_guid, item_name, quantity, rate, amount)
      VALUES ($1,$2,$3,$4,$5)
      `,
      [admin_id,invoice_guid, item_name, quantity, rate, amount]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Invoice item sync error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ==========================
   UI → GET ITEMS BY INVOICE
========================== */
router.get("/:invoice_guid", requireAuth, async (req, res) => {
  try {
    const { invoice_guid } = req.params;
    const adminId = req.user.adminId;

    const { rows } = await pool.query(
      `
      SELECT ii.*
      FROM invoice_items ii
      JOIN invoices i ON i.invoice_guid = ii.invoice_guid
      WHERE ii.invoice_guid = $1
        AND i.company_guid = (
          SELECT ac.company_guid
          FROM active_company ac
          WHERE ac.admin_id = $2
        )
      `,
      [invoice_guid, adminId]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Invoice items fetch error:", err);
    res.status(500).json({ success: false });
  }
});

export default router;
