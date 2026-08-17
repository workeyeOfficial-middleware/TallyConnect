import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

/* ==========================
   AGENT → SYNC INVOICE
========================== */
router.post("/sync", requireAuth, async (req, res) => {
  try {
    const adminId = req.user.adminId; // ✅ FROM TOKEN

    const {
      invoice_guid,
      company_guid,
      invoice_no,
      invoice_date,
      invoice_type,
      party_name,
      total_amount,
    } = req.body;

    if (!adminId || !invoice_guid || !company_guid) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await pool.query(
      `
      INSERT INTO invoices (
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
        adminId,          // ✅ FIXED
        invoice_guid,
        company_guid,
        invoice_no,
        invoice_date,
        invoice_type,
        party_name,
        total_amount,
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Invoice sync error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ==========================
   UI → GET INVOICES
========================== */
router.get("/", requireAuth, async (req, res) => {
  try {
    const adminId = req.user.adminId;

    const { rows } = await pool.query(
      `
      SELECT
        i.invoice_guid,
        i.invoice_no,
        i.invoice_date,
        i.invoice_type,
        i.party_name,
        i.total_amount
      FROM invoices i
      WHERE i.admin_id = $1
        AND i.company_guid = (
          SELECT company_guid
          FROM active_company
          WHERE admin_id = $1
        )
      ORDER BY i.invoice_date DESC
      `,
      [adminId]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Invoice fetch error:", err);
    res.status(500).json({ success: false });
  }
});

// =====================================================
// 🆕 GET INVOICES BY LEDGER (READ-ONLY, SAFE)
// =====================================================
router.get("/ledger/:ledgerGuid", requireAuth, async (req, res) => {
  try {
    const { ledgerGuid } = req.params;
    const { role, id: userId, adminId } = req.user;

    // 🔒 USER permission check (same pattern as vouchers)
    if (role !== "ADMIN") {
      const check = await pool.query(
        `
        SELECT 1
        FROM user_ledger_permissions
        WHERE user_id = $1
          AND ledger_guid = $2
        `,
        [userId, ledgerGuid]
      );

      if (check.rowCount === 0) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const { rows } = await pool.query(
      `
      SELECT
        i.invoice_guid AS id,
        i.invoice_no,
        i.invoice_date,
        i.invoice_type,
        i.party_name,
        i.total_amount
      FROM invoices i
      JOIN ledgers l
        ON l.name = i.party_name
       AND l.ledger_guid = $1
      WHERE i.admin_id = $2
        AND i.company_guid = (
          SELECT company_guid
          FROM active_company
          WHERE admin_id = $2
        )
      ORDER BY i.invoice_date DESC
      `,
      [ledgerGuid, adminId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Ledger invoice API error:", err);
    res.status(500).json({ message: "Failed to fetch invoices" });
  }
});
export default router;
