import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";
import requireAdmin from "../middleware/requireAdmin.js";
import { createNotification } from "../utils/notification.js";
//import bcrypt from "bcrypt";
import { sendHeartbeat } from "../utils/licenseheartbeat.js";

const router = express.Router();

/* =========================================================
   SELF ROUTES (MUST COME FIRST)
========================================================= */

/**
 * GET current logged-in user profile
 */
/* old code working with create voucher and the  bill
router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT id, username, email, company, role, avatar_url,
             ledger_permissions,
             vouchers_permissions,
             orders_permissions,
             inventory_permissions,
             dashboard_permissions
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    const u = result.rows[0];

   u.ledger_permissions = {
  columns: {},
  ...(u.ledger_permissions || {})
};

u.vouchers_permissions = {
  columns: {},
  ...(u.vouchers_permissions || {})
};

u.orders_permissions = {
  columns: {},
  ...(u.orders_permissions || {})
};

u.inventory_permissions = {
  columns: {},
  ...(u.inventory_permissions || {})
};

u.dashboard_permissions = {
  widgets: {},
  ...(u.dashboard_permissions || {})
};


    res.json(u);
  } catch (err) {
    res.status(500).json({ message: "Failed to load profile" });
  }
});

*/

router.get("/me", requireAuth, async (req, res) => {

  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT 
  u.id,
  u.username,
  u.email,
  u.company,
  u.role,
  u.avatar_url,
  u.ledger_permissions,
  u.vouchers_permissions,
  u.orders_permissions,
  u.inventory_permissions,
  u.dashboard_permissions,
  u.admin_id,
  a.email AS admin_email
FROM users u
LEFT JOIN users a ON u.admin_id = a.id
WHERE u.id = $1

      `,
      [userId]
    );

    const u = result.rows[0];

    const ledgerPerm   = u.ledger_permissions   || { columns: {} };
    const voucherPerm  = u.vouchers_permissions || { columns: {} };
    const ordersPerm   = u.orders_permissions   || { columns: {} };
    const inventoryPerm= u.inventory_permissions|| { columns: {} };
    const dashboardPerm= u.dashboard_permissions|| { widgets: {} };

    res.json({
      // 🔹 core fields
      id: u.id,
      username: u.username,
      email: u.email,
      company: u.company,
      role: u.role,
      avatar_url: u.avatar_url,

      admin_email: u.admin_email || u.email,

      // 🔹 OLD (snake_case) — REQUIRED for voucher/bill visibility
      ledger_permissions: ledgerPerm,
      vouchers_permissions: voucherPerm,
      orders_permissions: ordersPerm,
      inventory_permissions: inventoryPerm,
      dashboard_permissions: dashboardPerm,

      // 🔹 NEW (camelCase) — REQUIRED for column hide
      ledgerPermissions: ledgerPerm,
      vouchersPermissions: voucherPerm,
      ordersPermissions: ordersPerm,
      inventoryPermissions: inventoryPerm,
      dashboardPermissions: dashboardPerm,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load profile" });
  }
});

/**
 * UPDATE current logged-in user profile
 */
router.put("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email, company, role } = req.body;

    await pool.query(
      `
      UPDATE users
      SET username = $1,
          email = $2,
          company = $3,
          role = $4
      WHERE id = $5
      `,
      [username, email, company, role, userId]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Profile update failed" });
  }
});

/**
 * GET notification preferences (logged-in user)
 */
router.get("/me/notifications", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT notification_preferences
       FROM users
       WHERE id = $1`,
      [userId]
    );

    res.json(result.rows[0]?.notification_preferences || {});
  } catch (err) {
    res.status(500).json({ message: "Failed to load notifications" });
  }
});

/**
 * UPDATE notification preferences (logged-in user)
 */
router.put("/me/notifications", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      `UPDATE users
       SET notification_preferences = $1::jsonb
       WHERE id = $2`,
      [req.body, userId]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to save notifications" });
  }
});

import uploadAvatar from "../middleware/uploadAvatar.js";

/**
 * UPLOAD avatar (logged-in user)
 */
router.post(
  "/me/avatar",
  requireAuth,
  uploadAvatar.single("avatar"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      await pool.query(
        `UPDATE users
         SET avatar_url = $1
         WHERE id = $2`,
        [avatarUrl, userId]
      );

      res.json({ avatar_url: avatarUrl });
    } catch (err) {
      console.error("Avatar upload failed", err);
      res.status(500).json({ message: "Avatar upload failed" });
    }
  }
);

/* =========================================================
   ADMIN COLLECTION ROUTES
========================================================= */

/**
 * GET all users (ADMIN)
 */
/* old working for new voucher and bill
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const adminId = req.user.adminId;

  const result = await pool.query(
    `
    SELECT id, username, email, role, avatar_url,
           ledger_permissions,
           vouchers_permissions,
           orders_permissions,
           inventory_permissions,
           dashboard_permissions
    FROM users
    WHERE admin_id = $1
    ORDER BY id DESC
    `,
    [adminId]
  );

 for (let u of result.rows) {
  u.ledger_permissions = {
    columns: {},
    ...(u.ledger_permissions || {})
  };

  u.vouchers_permissions = {
    columns: {},
    ...(u.vouchers_permissions || {})
  };

  u.orders_permissions = {
    columns: {},
    ...(u.orders_permissions || {})
  };

  u.inventory_permissions = {
    columns: {},
    ...(u.inventory_permissions || {})
  };

  u.dashboard_permissions = {
    widgets: {},
    ...(u.dashboard_permissions || {})
  };
}


  res.json(result.rows);
});

*/

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const adminId = req.user.adminId;

  const result = await pool.query(
    `
    SELECT id, username, email, role, avatar_url,
           ledger_permissions,
           vouchers_permissions,
           orders_permissions,
           inventory_permissions,
           dashboard_permissions
    FROM users
    WHERE admin_id = $1
    ORDER BY id DESC
    `,
    [adminId]
  );

  res.json(
    result.rows.map(u => {
      const ledgerPerm   = u.ledger_permissions   || { columns: {} };
      const voucherPerm  = u.vouchers_permissions || { columns: {} };
      const ordersPerm   = u.orders_permissions   || { columns: {} };
      const inventoryPerm= u.inventory_permissions|| { columns: {} };
      const dashboardPerm= u.dashboard_permissions|| { widgets: {} };

      return {
        // 🔹 core fields
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        avatar_url: u.avatar_url,

        // 🔹 OLD (snake_case) — keeps voucher/bill visibility working
        ledger_permissions: ledgerPerm,
        vouchers_permissions: voucherPerm,
        orders_permissions: ordersPerm,
        inventory_permissions: inventoryPerm,
        dashboard_permissions: dashboardPerm,

        // 🔹 NEW (camelCase) — keeps column hide working
        ledgerPermissions: ledgerPerm,
        vouchersPermissions: voucherPerm,
        ordersPermissions: ordersPerm,
        inventoryPermissions: inventoryPerm,
        dashboardPermissions: dashboardPerm,
      };
    })
  );
});

/**
 * ADMIN creates a user
 */
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  const adminId =
    req.user.role === "ADMIN"
      ? req.user.id
      : req.user.adminId;

  try {
    /* 1️⃣ Count existing users */
    const userCountResult = await pool.query(
      "SELECT COUNT(*) FROM users WHERE admin_id = $1",
      [adminId]
    );
    const currentUserCount = Number(userCountResult.rows[0].count);

    /* 2️⃣ Fetch license */
    const licenseRes = await fetch(
      `https://dashboard.licentic.org/api/external/actve-license/${req.user.email}?productId=695902cfc240b17f16c3d716`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.LICENSE_INTERNAL_KEY,
        },
      }
    );

    const licenseData = await licenseRes.json();

    const rawFeatures =
      licenseData?.activeLicense?.licenseType?.features ||
      licenseData?.activeLicense?.licenseTypeId?.features;

    let allowedUsers = null;

    if (rawFeatures && typeof rawFeatures === "object") {
      allowedUsers = rawFeatures["user-limit"];
    }

    /* 3️⃣ HARD BLOCK */
    if (allowedUsers !== null && currentUserCount >= allowedUsers) {
      return res.status(403).json({
        message: "Upgrade your plan to create more users",
      });
    }

    /* 4️⃣ Check duplicate */
    const exists = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (exists.rowCount > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const username = email.split("@")[0];

    const result = await pool.query(
      `
      INSERT INTO users
        (username, email, password, role, isadmin, admin_id)
      VALUES
        ($1, $2, $3, 'USER', false, $4)
      RETURNING id, username, email
      `,
      [username, email.toLowerCase(), password, adminId]
    );

    /* 5️⃣ SEND HEARTBEAT (+1) */
    const licenseId = licenseData?.activeLicense?._id;
    const lmsUserId = licenseData?.activeLicense?.ownerUserId;

    if (licenseId && lmsUserId) {
      await sendHeartbeat({
        licenseId,
        adminId: lmsUserId,
        features: [
          {
            slug: "user-limit",
            value: 1, // increment
          },
        ],
      });
    }

    res.json({ user: result.rows[0] });

  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});



/* =========================================================
   ADMIN USER-SPECIFIC ROUTES (MUST BE LAST)
========================================================= */

router.put("/:id/voucher-permissions", requireAuth, requireAdmin, async (req, res) => {
  await pool.query(
    "UPDATE users SET vouchers_permissions = $1::jsonb WHERE id = $2",
    [req.body, req.params.id]
  );
  res.json({ success: true });
});

router.put("/:id/ledger-permissions", requireAuth, requireAdmin, async (req, res) => {
  await pool.query(
    "UPDATE users SET ledger_permissions = $1 WHERE id = $2",
    [req.body, req.params.id]
  );
  res.json({ success: true });
});

router.put("/:id/orders-permissions", requireAuth, requireAdmin, async (req, res) => {
  await pool.query(
    "UPDATE users SET orders_permissions = $1::jsonb WHERE id = $2",
    [req.body, req.params.id]
  );
  res.json({ success: true });
});

router.put("/:id/inventory-permissions", requireAuth, requireAdmin, async (req, res) => {
  await pool.query(
    "UPDATE users SET inventory_permissions = $1::jsonb WHERE id = $2",
    [req.body, req.params.id]
  );
  res.json({ success: true });
});

router.put("/:id/dashboard-permissions", requireAuth, requireAdmin, async (req, res) => {
  await pool.query(
    "UPDATE users SET dashboard_permissions = $1::jsonb WHERE id = $2",
    [req.body, req.params.id]
  );
  res.json({ success: true });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userIdToDelete = req.params.id;

    const userResult = await pool.query(
      "SELECT username FROM users WHERE id = $1",
      [userIdToDelete]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const deletedUsername = userResult.rows[0].username;

    await pool.query(
      "DELETE FROM users WHERE id = $1",
      [userIdToDelete]
    );

    /* 1️⃣ Fetch license */
    const licenseRes = await fetch(
      `https://dashboard.licentic.org/api/external/actve-license/${req.user.email}?productId=695902cfc240b17f16c3d716`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.LICENSE_INTERNAL_KEY,
        },
      }
    );

    const licenseData = await licenseRes.json();

    const licenseId = licenseData?.activeLicense?._id;
    const lmsUserId = licenseData?.activeLicense?.ownerUserId;

    /* 2️⃣ SEND HEARTBEAT (-1) */
    if (licenseId && lmsUserId) {
      await sendHeartbeat({
        licenseId,
        adminId: lmsUserId,
        features: [
          {
            slug: "user-limit",
            value: -1, // decrement
          },
        ],
      });
    }

    await createNotification({
      type: "USER_DELETED",
      message: `User deleted successfully: ${deletedUsername}`,
      user_id: req.user.id,
    });

    res.json({ success: true });

  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET ledgers assigned to a user (ADMIN)


router.get("/:id/ledgers", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT ledger_guid
      FROM user_ledger_permissions
      WHERE user_id = $1
      ORDER BY ledger_guid
      `,
      [id]
    );

    res.json(result.rows || []); // [{ ledger_guid }]
  } catch (err) {
    console.error("Fetch user ledgers failed", err);
    res.json([]);
  }
});


router.post(
  "/bulk-ledger-assign",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { userIds, ledgerIds } = req.body;

    try {
      const ledgersResult = await pool.query(
        `
        SELECT ledger_guid, name
        FROM ledgers
        WHERE ledger_guid = ANY($1)
        `,
        [ledgerIds]
      );

      for (const userId of userIds) {
        await pool.query(
          `DELETE FROM user_ledger_permissions WHERE user_id = $1`,
          [userId]
        );

        for (const l of ledgersResult.rows) {
          await pool.query(
            `
            INSERT INTO user_ledger_permissions
              (user_id, ledger_guid, ledger_name)
            VALUES ($1, $2, $3)
            `,
            [userId, l.ledger_guid, l.name]
          );
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Bulk ledger assign failed:", err);
      res.status(500).json({ message: "Bulk ledger assignment failed" });
    }
  }
);


router.put(
  "/bulk-voucher-permissions",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { userIds, permissions } = req.body;

    if (!Array.isArray(userIds) || !permissions) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    try {
      for (const userId of userIds) {
        await pool.query(
          `
          UPDATE users
          SET vouchers_permissions = $1::jsonb
          WHERE id = $2
          `,
          [permissions, userId]
        );
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Bulk voucher permissions failed:", err);
      res.status(500).json({ message: "Bulk update failed" });
    }
  }
);

router.put(
  "/bulk-orders-permissions",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { userIds, permissions } = req.body;

    if (!Array.isArray(userIds) || !permissions) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    try {
      for (const userId of userIds) {
        await pool.query(
          `
          UPDATE users
          SET orders_permissions = $1::jsonb
          WHERE id = $2
          `,
          [permissions, userId]
        );
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Bulk orders permissions failed:", err);
      res.status(500).json({ message: "Bulk update failed" });
    }
  }
);

router.put(
  "/bulk-ledger-permissions",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { userIds, permissions } = req.body;

    if (!Array.isArray(userIds) || !permissions) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    try {
      for (const userId of userIds) {
        await pool.query(
          `
          UPDATE users
          SET ledger_permissions = $1::jsonb
          WHERE id = $2
          `,
          [permissions, userId]
        );
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Bulk ledger permissions failed:", err);
      res.status(500).json({ message: "Bulk update failed" });
    }
  }
);


// GET single user for invite (ADMIN only)
router.get("/:id/invite-info", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.adminId;

    console.log(`[INVITE-INFO] Fetching invite info for userId=${id}, adminId=${adminId}`);

    const result = await pool.query(
      `SELECT id, username, email, password 
       FROM users 
       WHERE id = $1 AND admin_id = $2`,
      [id, adminId]
    );

    if (result.rowCount === 0) {
      console.warn(`[INVITE-INFO] ❌ User not found — userId=${id}, adminId=${adminId}`);
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];
    console.log(`[INVITE-INFO] ✅ Found user — email=${user.email}, hasPassword=${!!user.password}`);

    res.json(user);
  } catch (err) {
    console.error("[INVITE-INFO] 💥 Server error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put(
  "/bulk-inventory-permissions",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { userIds, permissions } = req.body;

    if (!Array.isArray(userIds) || !permissions) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    try {
      for (const userId of userIds) {
        await pool.query(
          `
          UPDATE users
          SET inventory_permissions = $1::jsonb
          WHERE id = $2
          `,
          [permissions, userId]
        );
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Bulk inventory permissions failed:", err);
      res.status(500).json({ message: "Bulk update failed" });
    }
  }
);

router.put(
  "/bulk-dashboard-permissions",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { userIds, permissions } = req.body;

    if (!Array.isArray(userIds) || !permissions) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    try {
      for (const userId of userIds) {
        await pool.query(
          `
          UPDATE users
          SET dashboard_permissions = $1::jsonb
          WHERE id = $2
          `,
          [permissions, userId]
        );
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Bulk dashboard permissions failed:", err);
      res.status(500).json({ message: "Bulk dashboard update failed" });
    }
  }
);

router.put("/me/monthly-report-schedule", requireAuth, async (req, res) => {
  const { report_day, report_time, enabled } = req.body;

  if (!report_day || !report_time) {
    return res.status(400).json({ message: "Missing fields" });
  }

  await pool.query(
    `
    INSERT INTO monthly_report_settings (user_id, day_of_month, report_time, enabled)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id)
    DO UPDATE SET
      day_of_month = EXCLUDED.day_of_month,
      report_time = EXCLUDED.report_time,
      enabled = EXCLUDED.enabled,
      updated_at = now()
    `,
    [req.user.id, report_day, report_time, enabled]
  );

  res.json({ success: true });
});

router.get("/me/monthly-report-schedule", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `
    SELECT day_of_month, report_time, enabled
    FROM monthly_report_settings
    WHERE user_id = $1
    `,
    [req.user.id]
  );

  res.json(rows[0] || null);
});

export default router;