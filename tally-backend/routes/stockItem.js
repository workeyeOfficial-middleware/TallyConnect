import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";
import { createMobileNotificationForAdmin } from "../utils/mobileNotification.js";

const router = express.Router();

router.post("/sync", requireAuth, async (req, res) => {
  const adminId = req.user.adminId;

  const {
    item_guid,
    company_guid,
    name,
    unit,
    opening_qty,
    opening_value
  } = req.body;

  await pool.query(
    `
    INSERT INTO stock_items
    (
      admin_id,
      item_guid,
      company_guid,
      name,
      unit,
      opening_qty,
      opening_value
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (admin_id, item_guid)
    DO UPDATE SET
      name = EXCLUDED.name,
      unit = EXCLUDED.unit,
      opening_qty = EXCLUDED.opening_qty,
      opening_value = EXCLUDED.opening_value
    `,
    [
      adminId,
      item_guid,
      company_guid,
      name,
      unit,
      opening_qty || 0,
      opening_value || 0,
    ]
  );

  createMobileNotificationForAdmin({
    type: "item_sync",
    message: `New item synced: ${name}`,
    adminId,
  }).catch((e) => console.error("mobile item_sync notify error:", e.message));

  res.json({ success: true });
});

export default router;
