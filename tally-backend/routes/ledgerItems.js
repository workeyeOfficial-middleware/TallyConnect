import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

/**
 * POST /ledger-items/sync
 * Used by Tally Agent
 */
router.post("/sync", requireAuth, async (req, res) => {
  try {
    const {
      company_guid,
      voucher_guid,
      voucher_no,
      voucher_date,
      voucher_type,
      ledger_name,
      item_name,
      quantity,
      rate,
      amount
    } = req.body;

    if (
      !company_guid ||
      !voucher_guid ||
      !ledger_name ||
      !item_name ||
      !ledger_name.trim() ||
      !item_name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "company_guid, voucher_guid, ledger_name, item_name required"
      });
    }

    const num = (v) => (typeof v === "number" && !isNaN(v) ? v : 0);

    await pool.query(
      `
      INSERT INTO ledger_items (
        admin_id, company_guid, voucher_guid, voucher_no, voucher_date,
        voucher_type, ledger_name, item_name, quantity, rate, amount
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (admin_id, company_guid, voucher_guid, item_name)
      DO UPDATE SET
        voucher_no   = EXCLUDED.voucher_no,
        voucher_date = EXCLUDED.voucher_date,
        voucher_type = EXCLUDED.voucher_type,
        ledger_name  = EXCLUDED.ledger_name,
        quantity     = EXCLUDED.quantity,
        rate         = EXCLUDED.rate,
        amount       = EXCLUDED.amount,
        updated_at   = NOW()
      `,
      [
        req.user.adminId,
        company_guid,
        voucher_guid,
        voucher_no || null,
        voucher_date || null,
        voucher_type || null,
        ledger_name.trim(),
        item_name.trim(),
        num(quantity),
        num(rate),
        num(amount)
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ ledger-items/sync error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /ledger-items/ledger/:ledgerGuid
 * Used by UI — items bought/sold by a customer/supplier
 * Same permission pattern as GET /bill/ledger/:ledgerGuid
 */
router.get("/ledger/:ledgerGuid", requireAuth, async (req, res) => {
  try {
    const { ledgerGuid } = req.params;
    const { role, id: userId, adminId } = req.user;

    if (role !== "ADMIN") {
      const check = await pool.query(
        `
        SELECT 1
        FROM user_ledger_permissions ulp
        JOIN ledgers l ON l.ledger_guid = ulp.ledger_guid
        WHERE ulp.user_id = $1
          AND ulp.ledger_guid = $2
          AND l.admin_id = $3
        `,
        [userId, ledgerGuid, adminId]
      );

      if (check.rowCount === 0) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const { rows } = await pool.query(
      `
      SELECT
        li.item_name,
        SUM(li.quantity)  AS total_qty,
        SUM(li.amount)    AS total_amount,
        MIN(li.voucher_date) AS first_date,
        MAX(li.voucher_date) AS last_date
      FROM ledger_items li
      WHERE li.admin_id = $1
        AND li.ledger_name = (
          SELECT name FROM ledgers
          WHERE ledger_guid = $2 AND admin_id = $1
          LIMIT 1
        )
        AND li.company_guid = (
          SELECT company_guid FROM active_company WHERE admin_id = $1
        )
      GROUP BY li.item_name
      ORDER BY total_amount DESC
      `,
      [adminId, ledgerGuid]
    );

    res.json(rows);
  } catch (err) {
    console.error("Ledger items fetch error:", err);
    res.status(500).json({ message: "Failed to fetch ledger items" });
  }
});

export default router;