import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

router.get("/monthly-summary", requireAuth, async (req, res) => {
  try {
    const adminId = req.user.adminId;
    const userId = req.user.id;        // ✅ INSIDE route
    const role = req.user.role;        // ✅ INSIDE route

    const yearParam = req.query.year;
    const companyGuid = req.query.company_guid;

    if (!companyGuid) {
      return res.status(400).json({ message: "company_guid is required" });
    }

    if (!yearParam) {
      return res.status(400).json({ message: "Year query param missing" });
    }

    const year = parseInt(yearParam, 10);
    if (isNaN(year)) {
      return res.status(400).json({ message: "Year must be a valid number" });
    }

    let query;
    let params;

    /* =====================================
       ADMIN → ALL VOUCHERS
    ===================================== */
    if (role === "ADMIN") {
      query = `
        WITH months AS (
          SELECT generate_series(
            make_date($1, 1, 1),
            make_date($1, 12, 1),
            interval '1 month'
          ) AS month_start
        )
        SELECT
          TO_CHAR(m.month_start, 'Mon YYYY') AS month,
          EXTRACT(MONTH FROM m.month_start) AS month_no,
          COALESCE(SUM(
            CASE  WHEN LOWER(TRIM(v.voucher_type)) IN (
    'sales',
    'sales invoice',
    'receipt',
    'receipt voucher'
  )
            THEN v.amount ELSE 0 END
          ), 0) AS turnover,
          COALESCE(SUM(
            CASE WHEN LOWER(TRIM(v.voucher_type)) IN ('purchase', 'payment')
            THEN v.amount ELSE 0 END
          ), 0) AS expense
        FROM months m
        LEFT JOIN voucher_entries v
          ON DATE_TRUNC('month', v.voucher_date) = m.month_start
          AND EXTRACT(YEAR FROM v.voucher_date) = $1
          AND v.company_guid = $2
          AND v.admin_id = $3
          AND v.is_active = true
        GROUP BY m.month_start
        ORDER BY month_no;
      `;

      params = [year, companyGuid, adminId];
    }

    /* =====================================
       USER → ONLY ALLOWED VOUCHERS
    ===================================== */
else {
  query = `
    WITH months AS (
      SELECT generate_series(
        make_date($1, 1, 1),
        make_date($1, 12, 1),
        interval '1 month'
      ) AS month_start
    )
    SELECT
      TO_CHAR(m.month_start, 'Mon YYYY') AS month,
      EXTRACT(MONTH FROM m.month_start) AS month_no,

      COALESCE(SUM(
        CASE
           WHEN LOWER(TRIM(v.voucher_type)) IN (
    'sales',
    'sales invoice',
    'receipt',
    'receipt voucher'
  )
          THEN v.amount ELSE 0
        END
      ), 0) AS turnover,

      COALESCE(SUM(
        CASE
          WHEN LOWER(TRIM(v.voucher_type)) IN ('purchase', 'payment')
          THEN v.amount ELSE 0
        END
      ), 0) AS expense

    FROM months m

    JOIN users u ON u.id = $4

    LEFT JOIN voucher_entries v
      ON DATE_TRUNC('month', v.voucher_date) = m.month_start
      AND EXTRACT(YEAR FROM v.voucher_date) = $1
      AND v.company_guid = $2
      AND v.admin_id = $3
      AND v.is_active = true
      AND v.voucher_guid = ANY (
        SELECT jsonb_array_elements_text(
          u.voucher_selection_permissions->'allowed_vouchers'
        )
      )

    GROUP BY m.month_start
    ORDER BY month_no;
  `;

  params = [year, companyGuid, adminId, userId];
}






















    const { rows } = await pool.query(query, params);

    const data = rows.map(row => {
      const turnover = Number(row.turnover) || 0;
      const expense = Number(row.expense) || 0;

      return {
        month: row.month.trim(),
        turnover,
        expense,
        profit: turnover - expense,
      };
    });

    res.json(data);
  } catch (error) {
    console.error("Monthly summary error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* =====================================
   AGENT → PROFIT & LOSS SYNC
===================================== */
router.post("/profit-loss/sync", async (req, res) => {
  try {
    const {
      company_guid,
      month,
      from_date,
      to_date,
      net_amount,
      type
    } = req.body;

    if (!company_guid || !month) {
      return res.status(400).json({ message: "company_guid and month required" });
    }

    await pool.query(
      `
      INSERT INTO profit_loss (
        company_guid,
        month,
        from_date,
        to_date,
        net_amount,
        type
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (company_guid, month)
      DO UPDATE SET
        net_amount = EXCLUDED.net_amount,
        type = EXCLUDED.type,
        from_date = EXCLUDED.from_date,
        to_date = EXCLUDED.to_date,
        updated_at = NOW()
      `,
      [company_guid, month, from_date, to_date, net_amount, type]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Profit & Loss sync error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;