import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

/* -------------------------
   GET ORDER BOOK
-------------------------- */
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const adminId = req.user.adminId;

    let query;
    let params;

    if (role === "ADMIN") {
  query = `
    SELECT
      o.order_guid AS id,
      o.order_type AS type,
      o.order_date AS date,
      o.party_name AS customer,
      o.amount,
      o.due_date,
      o.status,
      COALESCE(
        json_agg(
          json_build_object(
            'item_name', li.item_name,
            'quantity', li.quantity,
            'rate', li.rate,
            'amount', li.amount
          )
        ) FILTER (WHERE li.item_name IS NOT NULL),
        '[]'
      ) AS items

        FROM orders o
        LEFT JOIN ledger_items li
          ON li.company_guid = o.company_guid
         AND li.voucher_guid = o.order_guid
        WHERE o.company_guid = (
          SELECT ac.company_guid
          FROM active_company ac
          WHERE ac.admin_id = $1
        )
        GROUP BY o.id
        ORDER BY o.order_date DESC
      `;
      params = [adminId];

    } else {
  query = `
    SELECT
      o.order_guid AS id,
      o.order_type AS type,
      o.order_date AS date,
      o.party_name AS customer,
      o.amount,
      o.due_date,
      o.status,
      COALESCE(
        json_agg(
          json_build_object(
            'item_name', li.item_name,
            'quantity', li.quantity,
            'rate', li.rate,
            'amount', li.amount
          )
        ) FILTER (WHERE li.item_name IS NOT NULL),
        '[]'
      ) AS items

        FROM orders o
        JOIN users u ON u.id = $1
        LEFT JOIN ledger_items li
          ON li.company_guid = o.company_guid
         AND li.voucher_guid = o.order_guid
        WHERE
          o.company_guid = (
            SELECT ac.company_guid
            FROM active_company ac
            WHERE ac.admin_id = u.admin_id
          )
          AND o.order_guid = ANY (
            SELECT jsonb_array_elements_text(
              u.order_selection_permissions->'allowed_orders'
            )
          )
       GROUP BY o.id
        ORDER BY o.order_date DESC
      `;
      params = [userId];
    }

    const { rows } = await pool.query(query, params);

    res.json({ success: true, data: rows });

  } catch (err) {
    console.error("Order fetch error:", err);
    res.status(500).json({ success: false });
  }
});

/* =====================================================
   GET USER ORDER SELECTION PERMISSIONS
===================================================== */
router.get("/user-orders/:userId", requireAuth, async (req, res) => {
  try {
    const adminId = req.user.adminId;
    const { userId } = req.params;

    const result = await pool.query(
      `
      SELECT order_selection_permissions
      FROM users
      WHERE id = $1 AND admin_id = $2
      `,
      [userId, adminId]
    );

    if (result.rowCount === 0) {
      return res.json({ orders: [] });
    }

    const permissions = result.rows[0].order_selection_permissions || {};
    res.json({
      orders: permissions.allowed_orders || [],
    });
  } catch (err) {
    console.error("Fetch order permissions error:", err);
    res.status(500).json({ orders: [] });
  }
});

/* =====================================================
   SAVE USER ORDER SELECTION PERMISSIONS
===================================================== */
router.post("/user-orders", requireAuth, async (req, res) => {
  try {
    const adminId = req.user.adminId;
    const { userId, orders } = req.body;

    if (!userId || !Array.isArray(orders)) {
      return res.status(400).json({ success: false });
    }

    // Ensure user belongs to this admin
    const check = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND admin_id = $2`,
      [userId, adminId]
    );

    if (check.rowCount === 0) {
      return res.status(403).json({ success: false });
    }

    await pool.query(
      `
      UPDATE users
      SET order_selection_permissions = $1
      WHERE id = $2
      `,
      [
        JSON.stringify({ allowed_orders: orders }),
        userId,
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Save order permissions error:", err);
    res.status(500).json({ success: false });
  }
});

router.post(
  "/bulk-user-orders",
  requireAuth,
  async (req, res) => {
    try {
      const adminId = req.user.adminId;
      const { userIds, orders } = req.body;

      if (!Array.isArray(userIds) || !Array.isArray(orders)) {
        return res.status(400).json({ success: false });
      }

      for (const userId of userIds) {
        const check = await pool.query(
          `SELECT id FROM users WHERE id = $1 AND admin_id = $2`,
          [userId, adminId]
        );

        if (check.rowCount === 0) continue;

        await pool.query(
          `
          UPDATE users
          SET order_selection_permissions = $1
          WHERE id = $2
          `,
          [JSON.stringify({ allowed_orders: orders }), userId]
        );
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Bulk order assignment failed:", err);
      res.status(500).json({ success: false });
    }
  }
);

/* =====================================================
   SYNC ORDER FROM TALLY AGENT
===================================================== */
router.post("/sync", requireAuth, async (req, res) => {
  try {
    const {
      order_guid,
      company_guid,
      order_no,
      order_date,
      party_name,
      total_amount,
      type
    } = req.body;

    if (!order_guid || !company_guid) {
      return res.status(400).json({ success: false, message: "Missing data" });
    }

    await pool.query(
      `
      INSERT INTO orders (
        order_guid,
        company_guid,
        order_no,
        order_date,
        party_name,
        order_type,
        amount,
        status,
        admin_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending',$8)
      ON CONFLICT (order_guid)
      DO UPDATE SET
        order_no = EXCLUDED.order_no,
        order_date = EXCLUDED.order_date,
        party_name = EXCLUDED.party_name,
        order_type = EXCLUDED.order_type,
        amount = EXCLUDED.amount
      `,
      [
        order_guid,
        company_guid,
        order_no,
        order_date,
        party_name,
        type,
        total_amount,
        req.user.adminId
      ]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Order sync error:", err);
    res.status(500).json({ success: false });
  }
});

router.post("/cleanup/order", requireAuth, async (req, res) => {
  const { company_guid, existing_ids } = req.body;
  const adminId = req.user.adminId;

  if (!company_guid || !Array.isArray(existing_ids)) {
    return res.status(400).json({ success: false });
  }

  try {
    if (existing_ids.length === 0) {
      return res.json({ success: true });
    }

    await pool.query(
      `
      UPDATE orders
      SET is_active = false
      WHERE admin_id = $1
        AND company_guid = $2
        AND order_guid != ALL($3)
      `,
      [adminId, company_guid, existing_ids]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Order cleanup error:", err); // keep full error
    res.status(500).json({ success: false, message: err.message });
  }
});


export default router;
