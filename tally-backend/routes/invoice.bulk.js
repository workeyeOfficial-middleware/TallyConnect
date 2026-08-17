import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

/**
 * POST /invoice/bulk-sync
 * AGENT → BULK INVOICE SYNC
 */
router.post("/bulk-sync", requireAuth, async (req, res) => {
  const adminId = req.user.adminId; // ✅ FROM TOKEN
  const rows = req.body;

  if (!adminId || !Array.isArray(rows)) {
    return res.status(400).json({ success: false, error: "Invalid payload" });
  }

  try {
    for (const r of rows) {
      await pool.query(
        `
        INSERT INTO invoices
        (
          admin_id,
          invoice_guid,
          company_guid,
          invoice_no,
          invoice_date,
          invoice_type,
          party_name,
          total_amount
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (invoice_guid, company_guid)
        DO UPDATE SET
          invoice_no = EXCLUDED.invoice_no,
          invoice_date = EXCLUDED.invoice_date,
          invoice_type = EXCLUDED.invoice_type,
          party_name = EXCLUDED.party_name,
          total_amount = EXCLUDED.total_amount
        `,
        [
          adminId,              // ✅ FIX
          r.invoice_guid,
          r.company_guid,
          r.invoice_no,
          r.invoice_date,
          r.invoice_type,
          r.party_name,
          r.total_amount,
        ]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ invoice bulk-sync error:", err.message);
    res.status(500).json({ success: false });
  }
});

export default router;
