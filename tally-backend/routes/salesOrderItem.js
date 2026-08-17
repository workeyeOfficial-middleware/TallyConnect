import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

router.post("/sync", requireAuth, async (req, res) => {
  const adminId = req.user.adminId;

  const {
    order_guid,
    item_name,
    quantity,
    rate,
    amount,
  } = req.body;

  await pool.query(
    `
    INSERT INTO sales_order_items
    (
      admin_id,
      order_guid,
      item_name,
      quantity,
      rate,
      amount
    )
    VALUES ($1,$2,$3,$4,$5,$6)
    `,
    [adminId, order_guid, item_name, quantity, rate, amount]
  );

  res.json({ success: true });
});

export default router;
