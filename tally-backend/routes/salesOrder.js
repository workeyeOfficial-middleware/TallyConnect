import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

router.post("/sync", requireAuth, async (req, res) => {
  const adminId = req.user.adminId;

  const {
    order_guid,
    company_guid,
    order_no,
    order_date,
    party_name,
    voucher_type,
    total_amount,
  } = req.body;

  await pool.query(
    `
    INSERT INTO sales_orders (
      admin_id,
      order_guid,
      company_guid,
      order_no,
      order_date,
      party_name,
      voucher_type,
      total_amount
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (order_guid)
    DO UPDATE SET
      order_no     = EXCLUDED.order_no,
      order_date   = EXCLUDED.order_date,
      party_name   = EXCLUDED.party_name,
      voucher_type = EXCLUDED.voucher_type,
      total_amount = EXCLUDED.total_amount
    `,
    [
      adminId,
      order_guid,
      company_guid,
      order_no,
      order_date,
      party_name,
      voucher_type,
      total_amount,
    ]
  );

  res.json({ success: true });
});

export default router;
