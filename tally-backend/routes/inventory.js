import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";
import requireInventoryPermission from "../middleware/requireInventoryPermission.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = express.Router();

router.get("/", requireAuth,requireInventoryPermission, async (req, res) => {
  try {
    const { role, inventoryPermissions, adminId } = req.user;

    // ❌ USER without permission → BLOCK
    if (
      role !== "ADMIN" &&
      inventoryPermissions?.can_view === false
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view inventory",
      });
    }

   let query;
let params;

if (role === "ADMIN") {
  query = `
   SELECT
  si.item_guid                         AS id,
  ss.item_name                         AS name,

  COALESCE(si.opening_qty, 0)          AS opening,

  COALESCE(SUM(
    CASE WHEN im.movement_type = 'IN' THEN im.qty END
  ), 0)                                AS inward,

  COALESCE(SUM(
    CASE WHEN im.movement_type = 'OUT' THEN im.qty END
  ), 0)                                AS outward,

  ss.closing_qty                       AS closing,

  CASE
    WHEN ss.closing_qty <> 0
    THEN ROUND(ss.closing_value / ss.closing_qty, 2)
    ELSE 0
  END                                  AS rate,

  ss.closing_value                     AS value

FROM stock_summary ss

LEFT JOIN stock_items si
  ON si.name = ss.item_name
 AND si.company_guid = ss.company_guid
 AND si.admin_id = ss.admin_id

LEFT JOIN inventory_movements im
  ON im.item_name = ss.item_name
 AND im.company_guid = ss.company_guid
 AND im.admin_id = ss.admin_id

WHERE ss.admin_id = $1
  AND ss.company_guid = (
    SELECT company_guid
    FROM active_company
    WHERE admin_id = $1
  )

GROUP BY
  si.item_guid,
  ss.item_name,
  si.opening_qty,
  ss.closing_qty,
  ss.closing_value

ORDER BY ss.item_name;

  `;
  params = [adminId];
} else {
  query = `
    SELECT
  si.item_guid                         AS id,
  ss.item_name                         AS name,

  COALESCE(si.opening_qty, 0)          AS opening,

  COALESCE(SUM(
    CASE WHEN im.movement_type = 'IN' THEN im.qty END
  ), 0)                                AS inward,

  COALESCE(SUM(
    CASE WHEN im.movement_type = 'OUT' THEN im.qty END
  ), 0)                                AS outward,

  ss.closing_qty                       AS closing,

  CASE
    WHEN ss.closing_qty <> 0
    THEN ROUND(ss.closing_value / ss.closing_qty, 2)
    ELSE 0
  END                                  AS rate,

  ss.closing_value                     AS value

FROM stock_summary ss

LEFT JOIN stock_items si
  ON si.name = ss.item_name
 AND si.company_guid = ss.company_guid
 AND si.admin_id = ss.admin_id

LEFT JOIN inventory_movements im
  ON im.item_name = ss.item_name
 AND im.company_guid = ss.company_guid
 AND im.admin_id = ss.admin_id

WHERE ss.admin_id = $2
  AND ss.company_guid = (
    SELECT company_guid
    FROM active_company
    WHERE admin_id = $2
  )
AND EXISTS (
  SELECT 1
  FROM user_inventory_permissions uip
  WHERE uip.user_id = $1
    AND uip.admin_id = $2
    AND lower(trim(uip.item_name)) = lower(trim(ss.item_name))
)

GROUP BY
  si.item_guid,
  ss.item_name,
  si.opening_qty,
  ss.closing_qty,
  ss.closing_value

ORDER BY ss.item_name;

  `;
  params = [req.user.id, adminId];
}

const { rows } = await pool.query(query, params);

const columns = inventoryPermissions?.columns || {};

let filteredData = rows.map(row => {
  // 🔐 ALWAYS include numeric fields for calculations
 let result = {
  id: row.id,
  name: row.name,
  opening: row.opening ?? 0,
  inward: row.inward ?? 0,
  outward: row.outward ?? 0,
  closing: row.closing ?? 0,
  rate: row.rate ?? 0,
  minStock: 0,
  value: row.value ?? 0,
};



  // 🔐 Apply column-level hiding (UI concern)
  if (role !== "ADMIN") {
    if (columns.itemCode === false) delete result.id;
    if (columns.itemName === false) delete result.name;
    if (columns.closingStock === false) delete result.closing;
    if (columns.rate === false) delete result.rate;
    if (columns.value === false) delete result.value;
  }

  return result;
});


res.json({ success: true, data: filteredData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

router.get(
  "/user-inventory/:userId",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { rows } = await pool.query(

      `
      SELECT item_name
FROM user_inventory_permissions
WHERE user_id = $1
  AND admin_id = $2

      `,
      [req.params.userId, req.user.adminId]
    );

    res.json(rows);
  }
);
router.post(
  "/user-inventory",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { userId, items } = req.body;

    if (!userId || !Array.isArray(items)) {
      return res.status(400).json({ error: "Invalid payload" });
    }

   await pool.query(
  `
  DELETE FROM user_inventory_permissions
  WHERE user_id = $1
    AND admin_id = $2
  `,
  [userId, req.user.adminId]
);


    for (const item of items) {
      await pool.query(
        `
        INSERT INTO user_inventory_permissions (admin_id, user_id, item_name)
VALUES ($1, $2, $3)
        `,
       [req.user.adminId, userId, item]
      );
    }

    res.json({ success: true });
  }
);

router.post(
  "/bulk-user-inventory",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { userIds, items } = req.body;

    for (const userId of userIds) {
      await pool.query(
  `
  DELETE FROM user_inventory_permissions
  WHERE user_id = $1
    AND admin_id = $2
  `,
  [userId, req.user.adminId]
);


      for (const item of items) {
        await pool.query(
          `
         INSERT INTO user_inventory_permissions (admin_id, user_id, item_name)
VALUES ($1, $2, $3)
          `,
         [req.user.adminId, userId, item]
        );
      }
    }

    res.json({ success: true });
  }
);


router.post(
  "/full-sync",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const {
  company_guid,
  item_guid,
  name,
  group,
  unit,
  opening_qty,
  opening_value,
  closing_qty,
  closing_value,

  // New Tally GST / HSN fields
  hsn_code,
  gst_rate,
  cgst_rate,
  sgst_rate,
  igst_rate,
  gst_applicable
} = req.body;
      // 🔒 PREVENT FK CRASH (CRITICAL FIX)
const companyCheck = await pool.query(
  `
  SELECT 1 FROM companies
  WHERE company_guid = $1 AND admin_id = $2
  `,
  [company_guid, req.user.adminId]
);

if (companyCheck.rowCount === 0) {
  console.log("⛔ Inventory skipped (company not owned):", company_guid);

  return res.json({
    success: true,
    skipped: true
  });
}


      if (!company_guid || !item_guid || !name) {
        return res.status(400).json({ error: "Missing required fields" });
      }

// 1️⃣ Upsert stock_items
// Existing stock fields + new HSN/GST fields
await pool.query(
  `
  INSERT INTO stock_items
  (
    admin_id,
    company_guid,
    item_guid,
    name,
    parent_group,
    unit,
    opening_qty,
    opening_value,
    hsn_code,
    gst_rate,
    cgst_rate,
    sgst_rate,
    igst_rate,
    gst_applicable
  )
  VALUES
  (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12,
    $13,
    $14
  )
  ON CONFLICT (admin_id, company_guid, item_guid)
  DO UPDATE SET
    name = EXCLUDED.name,
    parent_group = EXCLUDED.parent_group,
    unit = EXCLUDED.unit,
    opening_qty = EXCLUDED.opening_qty,
    opening_value = EXCLUDED.opening_value,
    hsn_code = EXCLUDED.hsn_code,
    gst_rate = EXCLUDED.gst_rate,
    cgst_rate = EXCLUDED.cgst_rate,
    sgst_rate = EXCLUDED.sgst_rate,
    igst_rate = EXCLUDED.igst_rate,
    gst_applicable = EXCLUDED.gst_applicable
  `,
  [
    req.user.adminId,
    company_guid,
    item_guid,
    name,
    group || null,
    unit || null,
    opening_qty ?? 0,
    opening_value ?? 0,
    hsn_code || null,
    gst_rate ?? 0,
    cgst_rate ?? 0,
    sgst_rate ?? 0,
    igst_rate ?? 0,
    gst_applicable || null
  ]
);

console.log("📦 FULL SYNC INVENTORY PAYLOAD:", {
  name,
  group,
  unit,
  hsn_code,
  gst_rate,
  cgst_rate,
  sgst_rate,
  igst_rate,
  gst_applicable
});

      // 2️⃣ Upsert stock_summary
      await pool.query(
        `
        INSERT INTO stock_summary
        (admin_id, company_guid, item_name, closing_qty, closing_value)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (admin_id, company_guid, item_name)
        DO UPDATE SET
          closing_qty = EXCLUDED.closing_qty,
          closing_value = EXCLUDED.closing_value
        `,
        [
          req.user.adminId,
          company_guid,
          name,
          closing_qty || 0,
          closing_value || 0
        ]
      );

      res.json({ success: true });
    } catch (err) {
      console.error("Inventory full sync error:", err.message);

// ❌ NEVER BREAK AGENT LOOP
return res.json({
  success: true,
  skipped: true
});
    }
  }
);

/* --------------------------
   INVENTORY MOVEMENT SYNC (FROM AGENT)
--------------------------- */

router.post(
  "/inventory-movement/sync",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const {
        company_guid,
        item_name,
        qty,
        movement_type,
        voucher_type,
        voucher_date
      } = req.body;

      // 🔒 PREVENT FK CRASH
const companyCheck = await pool.query(
  `
  SELECT 1 FROM companies
  WHERE company_guid = $1 AND admin_id = $2
  `,
  [company_guid, req.user.adminId]
);

if (companyCheck.rowCount === 0) {
  console.log("⛔ Inventory movement skipped (company not owned):", company_guid);

  return res.json({
    success: true,
    skipped: true
  });
}



      if (!company_guid || !item_name || !qty || !movement_type) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // 🔥 Convert YYYYMMDD → YYYY-MM-DD
      let formattedDate = null;
      if (voucher_date && voucher_date.length === 8) {
        formattedDate = `${voucher_date.slice(0,4)}-${voucher_date.slice(4,6)}-${voucher_date.slice(6,8)}`;
      }

      await pool.query(
        `
        INSERT INTO inventory_movements
        (admin_id, company_guid, item_name, qty, movement_type, voucher_type, voucher_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          req.user.adminId,
          company_guid,
          item_name,
          qty,
          movement_type,
          voucher_type,
          formattedDate
        ]
      );

      res.json({ success: true });

    } catch (err) {
  console.error("Inventory movement sync error:", err.message);

  // ❌ NEVER BREAK AGENT LOOP
  return res.json({
    success: true,
    skipped: true
  });
}
  }
);


router.post(
  "/cleanup",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { company_guid, existing_ids } = req.body;
      const adminId = req.user.adminId;

      if (!company_guid || !Array.isArray(existing_ids)) {
        return res.status(400).json({ success: false });
      }

      // 1️⃣ Delete from stock_summary first
      await pool.query(
        `
        DELETE FROM stock_summary
        WHERE admin_id = $1
          AND company_guid = $2
          AND item_name NOT IN (
            SELECT name FROM stock_items
            WHERE admin_id = $1
              AND company_guid = $2
              AND item_guid = ANY($3)
          )
        `,
        [adminId, company_guid, existing_ids]
      );

      // 2️⃣ Delete orphan stock_items
      await pool.query(
        `
        DELETE FROM stock_items
        WHERE admin_id = $1
          AND company_guid = $2
          AND item_guid != ALL($3)
        `,
        [adminId, company_guid, existing_ids]
      );

      // 3️⃣ Delete orphan inventory_movements
      await pool.query(
        `
        DELETE FROM inventory_movements
        WHERE admin_id = $1
          AND company_guid = $2
          AND item_name NOT IN (
            SELECT name FROM stock_items
            WHERE admin_id = $1
              AND company_guid = $2
          )
        `,
        [adminId, company_guid]
      );

      res.json({ success: true });

    } catch (err) {
      console.error("Inventory cleanup error:", err);
      res.status(500).json({ success: false });
    }
  }
);


// ==========================================
// MOBILE INVENTORY — FULL ITEM DETAILS
// ==========================================

router.get(
  "/mobile",
  requireAuth,
  requireInventoryPermission,
  async (req, res) => {
    try {
const result = await pool.query(
  `
  SELECT
    si.item_guid,
    si.name,
    si.parent_group,
    si.unit,

    COALESCE(si.opening_qty, 0) AS opening_qty,
    COALESCE(si.opening_value, 0) AS opening_value,

    COALESCE(ss.closing_qty, 0) AS closing_qty,
    COALESCE(ss.closing_value, 0) AS closing_value,

    CASE
      WHEN COALESCE(ss.closing_qty, 0) <> 0
      THEN ROUND(
        COALESCE(ss.closing_value, 0) /
        ss.closing_qty,
        2
      )
      ELSE 0
    END AS rate,

    si.hsn_code,
    si.gst_rate,
    si.cgst_rate,
    si.sgst_rate,
    si.igst_rate,
    si.gst_applicable

  FROM stock_items si

  LEFT JOIN stock_summary ss
    ON ss.item_name = si.name
    AND ss.company_guid = si.company_guid
    AND ss.admin_id = si.admin_id

  WHERE si.admin_id = $1
    AND si.company_guid = (
      SELECT company_guid
      FROM active_company
      WHERE admin_id = $1
    )

  ORDER BY si.name ASC
  `,
  [req.user.adminId]
);

return res.json({
  success: true,
  items: result.rows.map(item => ({
    // Identity
    item_guid: item.item_guid,
    name: item.name,
    group: item.parent_group,

    // Stock
    unit: item.unit,
    opening_qty: Number(item.opening_qty || 0),
    opening_value: Number(item.opening_value || 0),

    closing_qty: Number(item.closing_qty || 0),
    closing_value: Number(item.closing_value || 0),

    // Calculated current rate
    rate: Number(item.rate || 0),

    // Tax
    hsn_code: item.hsn_code || null,
    gst_rate:
      item.gst_rate !== null
        ? Number(item.gst_rate)
        : null,
    cgst_rate:
      item.cgst_rate !== null
        ? Number(item.cgst_rate)
        : null,
    sgst_rate:
      item.sgst_rate !== null
        ? Number(item.sgst_rate)
        : null,
    igst_rate:
      item.igst_rate !== null
        ? Number(item.igst_rate)
        : null,
    gst_applicable: item.gst_applicable || null
  }))
});

    } catch (err) {
      console.error(
        "❌ Mobile inventory fetch error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: "Failed to fetch mobile inventory"
      });
    }
  }
);

export default router;