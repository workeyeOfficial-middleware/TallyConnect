import express from "express";
import pool from "../db.js";
import jwt from "jsonwebtoken";
import requireAuth from "../middleware/requireAuth.js";
process.env.JWT_SECRET = "tallyconnect-local-test-secret-2026";
const router = express.Router();
//import bcrypt from "bcrypt";



const generateToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      role: user.role,
      adminId: user.admin_id,
      username: user.username,
      email: user.email,        // ✅ PRIMARY IDENTITY
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

/* =====================================================
   REGISTER
   - Creates ADMIN or USER
   - Auto-generates LICENSE for ADMIN
===================================================== */
router.post("/register", async (req, res) => {
  const { username, email, password, isAdmin } = req.body;

  try {
    const exists = await pool.query(
      "SELECT 1 FROM users WHERE email=$1",
      [email]
    );

    if (exists.rowCount > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const role = isAdmin ? "ADMIN" : "USER";

    // ✅ HASH PASSWORD FOR BOTH ADMIN & USER
   // const hashedPassword = await bcrypt.hash(password, 10);

    const userResult = await pool.query(
      `
      INSERT INTO users (username, email, password, role)
      VALUES ($1,$2,$3,$4)
      RETURNING id, username, role
      `,
      [username, email, password, role]
      //[username, email, hashedPassword, role]
    );

    const user = userResult.rows[0];

    // Admin owns itself
    if (role === "ADMIN") {
      await pool.query(
        "UPDATE users SET admin_id = id WHERE id = $1",
        [user.id]
      );
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: err.message });
  }
});


/* =====================================================
   LOGIN
   - Pure authentication only
===================================================== 
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE username=$1`,
      [username]
    );

    if (!result.rows.length) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];

    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        adminId: user.admin_id,
            ledgerPermissions: user.ledger_permissions || { columns: {} },

                vouchersPermissions: user.vouchers_permissions || {
      can_view: true,
      columns: {},
                },
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: err.message });
  }
});

/*
/* =====================================================
   ME
===================================================== */
router.get("/me", requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT
       id,
       username,
       role,
       admin_id,
       ledger_permissions,
       vouchers_permissions,
         orders_permissions,
           inventory_permissions,
           dashboard_permissions

     FROM users
     WHERE id = $1`,
    [req.user.id]
  );

  const user = result.rows[0];

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    adminId: user.admin_id,   // 🔑 RESTORED
    ledgerPermissions: user.ledger_permissions,
    vouchersPermissions: user.vouchers_permissions,
      ordersPermissions: user.orders_permissions, // ✅ ADD THIS
  inventoryPermissions: user.inventory_permissions, // ✅ ADD THIS
 dashboardPermissions: user.dashboard_permissions || { widgets: {} },

  });
});




/* =====================================================
   LOGIN
===================================================== 
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const result = await pool.query(
    "SELECT * FROM users WHERE username=$1",
    [username]
  );

  if (!result.rows.length || result.rows[0].password !== password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const user = result.rows[0];
  const token = generateToken(user);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      adminId: user.admin_id,
      dashboardPermissions: user.dashboard_permissions || { widgets: {} },
      ledgerPermissions: user.ledger_permissions || { columns: {} },
      vouchersPermissions: user.vouchers_permissions || {
        can_view: true,
        columns: {},
      },
            ordersPermissions: user.orders_permissions || { columns: {} }, // ✅ REQUIRED
inventoryPermissions: user.inventory_permissions || {
        can_view: true,
        columns: {},
      },
    },
  });
});

*/

router.post("/login", async (req, res) => {
  const { username, password, loginType } = req.body;

  try {
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const email = username.trim().toLowerCase();

    if (!loginType) {
  return res.status(400).json({
    message: "loginType is required (USER or ADMIN)"
  });
}

    // =====================================
    // 👤 USER LOGIN (DATABASE ONLY)
    // =====================================
    if (loginType === "USER") {
      const result = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );

      if (!result.rows.length) {
        return res.status(401).json({
          message: "No account found with this email",
        });
      }

      const user = result.rows[0];

      if (user.role !== "USER") {
  return res.status(403).json({
    message: "Invalid user login type",
  });
}



      if (user.password !== password) {
        return res.status(401).json({
          message: "Invalid credentials",
        });
      }

      if (!user.admin_id) {
        return res.status(403).json({
          message: "User is not linked to any admin",
        });
      }

      const token = generateToken(user);

      return res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          adminId: user.admin_id,
        },
      });
    }

    // =====================================
    // 🔐 ADMIN LOGIN (LMS + LICENSE)
    // =====================================
    if (loginType === "ADMIN") {

      // =====================================
// 🧪 TEMPORARY LOCAL TEST BYPASS
// REMOVE THIS BLOCK AFTER TESTING
// =====================================
const TEST_AUTH_BYPASS =false;

if (TEST_AUTH_BYPASS) {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  if (!result.rows.length) {
    return res.status(401).json({
      message: "Test user not found",
    });
  }

  const user = result.rows[0];

  if (user.role !== "ADMIN") {
    return res.status(403).json({
      message: "Test user is not an admin",
    });
  }

  const token = generateToken(user);

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      adminId: user.admin_id,
      plan: "TEST",
    },
  });
}

      const productId = "695902cfc240b17f16c3d716";

      // 🔹 LICENSE CHECK
      const licenseRes = await fetch(
        `https://dashboard.licentic.org/api/external/actve-license/${email}?productId=${productId}`,
        {
          headers: {
            "x-api-key": process.env.LICENSE_INTERNAL_KEY,
          },
        }
      );

      const licenseData = await licenseRes.json();

      const validLicense = licenseData?.activeLicense;

      if (!validLicense) {
        return res.status(403).json({
          message: "No active license found",
        });
      }

      // 🔹 LMS LOGIN
      const lmsAuthRes = await fetch(
        "https://dashboard.licentic.org/api/external/customer-login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.LICENSE_INTERNAL_KEY,
          },
          body: JSON.stringify({ email, password }),
        }
      );

      const lmsAuthData = await lmsAuthRes.json();

      if (!lmsAuthData.success) {
        return res.status(401).json({
          message: "Invalid credentials",
        });
      }

      // 🔹 FIND OR CREATE ADMIN
      let result = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );

      let user;

      if (result.rowCount === 0) {
        const insert = await pool.query(
          `INSERT INTO users (email, username, password, role)
           VALUES ($1,$2,$3,'ADMIN')
           RETURNING *`,
          [email, email.split("@")[0], password]
        );

        user = insert.rows[0];

        await pool.query(
          "UPDATE users SET admin_id = id WHERE id = $1",
          [user.id]
        );

        user.admin_id = user.id;
      } else {
        user = result.rows[0];

        if (user.role !== "ADMIN") {
    return res.status(403).json({
      message: "Not an admin account",
    });
  }

      }

      const token = generateToken(user);

      return res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          adminId: user.admin_id,
          plan: validLicense?.licenseTypeId?.name || null,
        },
      });
    }

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Login failed" });
  }
});







export default router;