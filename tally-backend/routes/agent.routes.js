import express from "express";
import pool from "../db.js";

const router = express.Router();

router.post("/handshake", async (req, res) => {
  const { license_key, device_fingerprint } = req.body;

  if (!license_key || !device_fingerprint) {
    return res.status(400).json({ message: "Missing data" });
  }

  try {
    /* =====================================================
       1️⃣ VALIDATE LICENSE
    ===================================================== */
    const licenseRes = await pool.query(
      `
      SELECT id, admin_id, max_devices, is_active
      FROM licenses
      WHERE license_key = $1
      `,
      [license_key]
    );

    if (!licenseRes.rows.length) {
      return res.status(401).json({ message: "Invalid license" });
    }

    const license = licenseRes.rows[0];

    /* =====================================================
       2️⃣ VALIDATE ADMIN
    ===================================================== */
    const adminCheck = await pool.query(
      `SELECT 1 FROM users WHERE id = $1 AND role = 'ADMIN'`,
      [license.admin_id]
    );

    if (adminCheck.rowCount === 0) {
      return res.status(403).json({ message: "Admin not found or invalid" });
    }

    if (!license.is_active) {
      return res.status(403).json({ message: "License disabled" });
    }

    /* =====================================================
       3️⃣ DEVICE CHECK / REGISTER
    ===================================================== */
    const deviceRes = await pool.query(
      `
      SELECT id
      FROM license_devices
      WHERE license_id = $1 AND device_fingerprint = $2
      `,
      [license.id, device_fingerprint]
    );

    if (!deviceRes.rows.length) {
      const countRes = await pool.query(
        `
        SELECT COUNT(*)::int AS count
        FROM license_devices
        WHERE license_id = $1
        `,
        [license.id]
      );

      if (countRes.rows[0].count >= license.max_devices) {
        return res.status(403).json({ message: "Device limit exceeded" });
      }

      await pool.query(
        `
        INSERT INTO license_devices (license_id, device_fingerprint)
        VALUES ($1, $2)
        `,
        [license.id, device_fingerprint]
      );
    } else {
      await pool.query(
        `
        UPDATE license_devices
        SET last_seen = NOW()
        WHERE license_id = $1 AND device_fingerprint = $2
        `,
        [license.id, device_fingerprint]
      );
    }

    /* =====================================================
       4️⃣ RESOLVE COMPANY
    ===================================================== */
    let companyGuid = null;

    const activeCompanyRes = await pool.query(
      `
      SELECT company_guid
      FROM active_company
      WHERE admin_id = $1
      `,
      [license.admin_id]
    );

    if (activeCompanyRes.rows.length) {
      companyGuid = activeCompanyRes.rows[0].company_guid;
    } else {
      const fallbackCompany = await pool.query(
        `
        SELECT company_guid
        FROM companies
        WHERE admin_id = $1
        ORDER BY created_at ASC
        LIMIT 1
        `,
        [license.admin_id]
      );

      if (!fallbackCompany.rows.length) {
        // ✅ FIRST TIME ADMIN → ALLOW AGENT TO CREATE COMPANY
        return res.json({
          admin_id: license.admin_id,
          company_guid: null,
          message: "No company yet. Agent allowed to create first company.",
        });
      }

      companyGuid = fallbackCompany.rows[0].company_guid;
    }

    /* =====================================================
       5️⃣ 🔥 CRITICAL FIX — FORCE active_company
    ===================================================== */
    await pool.query(
      `
      INSERT INTO active_company (admin_id, company_guid)
      VALUES ($1, $2)
      ON CONFLICT (admin_id)
      DO UPDATE SET
        company_guid = EXCLUDED.company_guid,
        updated_at = NOW()
      `,
      [license.admin_id, companyGuid]
    );

    /* =====================================================
       6️⃣ DONE
    ===================================================== */
    return res.json({
      admin_id: license.admin_id,
      company_guid: companyGuid,
    });
  } catch (err) {
    console.error("Handshake error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
