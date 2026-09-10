import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";
import { sendHeartbeat } from "../utils/licenseheartbeat.js";

const router = express.Router();


const PRODUCT_ID = "695902cfc240b17f16c3d716";

async function getCompanyLimit(email) {
  try {
    const licenseRes = await fetch(
      `https://dashboard.licentic.org/api/external/actve-license/${email}?productId=${PRODUCT_ID}`
    );

    const licenseData = await licenseRes.json();

    
   
    
    const rawFeatures =
      licenseData?.activeLicense?.licenseType?.features ||
      licenseData?.activeLicense?.licenseTypeId?.features;

    if (rawFeatures && typeof rawFeatures === "object") {
      return rawFeatures["company-limit"] ?? null;
    }

    return null;
  } catch (err) {
    console.error("License fetch failed:", err.message);
    return null;
  }
}


/* =========================================================
   AGENT → CREATE / UPSERT COMPANY
   (NO AUTH — agent uses license-based admin_id)
========================================================= */
router.post("/create", requireAuth, async (req, res) => {
const { company_guid, name } = req.body;
const adminId = req.user.adminId;

 if (!company_guid || !name) {
  return res.status(400).json({
    success: false,
    message: "company_guid and name are required",
  });
}


  try {
    // 🔒 Validate admin exists
  

  

    // ✅ UPSERT (NO admin change on conflict)
    // ✅ CREATE OR RETURN EXISTING COMPANY (NO LICENSE MODE)

let result = await pool.query(
  `SELECT * FROM companies WHERE company_guid = $1`,
  [company_guid]
);

// 🔥 FIX: attach company to current admin if different
if (result.rowCount > 0 && result.rows[0].admin_id !== adminId) {
  console.log("⛔ Skipping company (belongs to another admin):", name);

  return res.json({
    success: true,
    skipped: true,
    message: "Company belongs to another account",
  });
}

// insert if not exists
if (result.rowCount === 0) {
  result = await pool.query(
    `
    INSERT INTO companies (company_guid, name, admin_id)
    VALUES ($1, $2, $3)
    RETURNING *
    `,
    [company_guid, name, adminId]
  );
} else {
  result = { rows: [result.rows[0]] };
}

res.json({
  success: true,
  data: result.rows[0],
});

  } catch (err) {
    console.error("Company create error:", err.message);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});


/* =========================================================
   AUTH REQUIRED BELOW (UI ONLY)
========================================================= */
router.use(requireAuth);

/* =========================================================
   SELECT COMPANY (ADMIN ONLY — WITH LICENSE LIMIT)
========================================================= */
/* =========================================================
   SELECT COMPANY (ADMIN ONLY — WITH LICENSE LIMIT)
========================================================= */
router.post("/select", async (req, res) => {
  const { company_guid } = req.body;
  const adminId = req.user.adminId;

  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin only" });
  }

  if (!company_guid) {
    return res.status(400).json({ message: "company_guid required" });
  }

  try {
    // 🔹 Get company limit from license
    const companyLimit = await getCompanyLimit(req.user.email);

    // 🔹 Check if already selected
    const alreadySelectedRes = await pool.query(
      `
      SELECT 1
      FROM selected_companies
      WHERE admin_id = $1 AND company_guid = $2
      `,
      [adminId, company_guid]
    );

    const alreadySelected = alreadySelectedRes.rowCount > 0;

    // 🔹 Count selected companies
    const countResult = await pool.query(
      `
      SELECT COUNT(*) 
      FROM selected_companies
      WHERE admin_id = $1
      `,
      [adminId]
    );

    const currentSelected = Number(countResult.rows[0].count);

    // 🔒 Limit check (ONLY if not already selected)
    if (
      !alreadySelected &&
      companyLimit !== null &&
      currentSelected >= companyLimit
    ) {
      return res.status(403).json({
        success: false,
        message: `Company selection limit exceeded. Your plan allows ${companyLimit} companies. You have already selected ${currentSelected} companies.`
      });
    }

    // 🔹 Insert only if not already selected
if (!alreadySelected) {
  await pool.query(
    `
    INSERT INTO selected_companies (admin_id, company_guid)
    VALUES ($1, $2)
    `,
    [adminId, company_guid]
  );
    const licenseRes = await fetch(
    `https://dashboard.licentic.org/api/external/actve-license/${req.user.email}?productId=${PRODUCT_ID}`,
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

  if (licenseId && lmsUserId) {
    await sendHeartbeat({
      licenseId,
      adminId: lmsUserId,
      features: [
        {
          slug: "company-limit",
          value: 1, // ✅ IMPORTANT: increment by 1
        },
      ],
    });
  }
}

    res.json({ success: true });

  } catch (err) {
    console.error("Company select error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});


/* =========================================================
   GET SELECTED COMPANIES (ADMIN)
========================================================= */
router.get("/selected", async (req, res) => {
  const adminId = req.user.adminId;

  const result = await pool.query(
    `
    SELECT c.company_guid, c.name, sc.starting_from
    FROM selected_companies sc
    JOIN companies c 
      ON c.company_guid = sc.company_guid
    WHERE sc.admin_id = $1
    ORDER BY sc.selected_at ASC
    `,
    [adminId]
  );

  res.json({
    success: true,
    data: result.rows
  });
});



/* =========================================================
   GET COMPANIES (ADMIN → ONLY OWN)
========================================================= */
router.get("/", async (req, res) => {
  const adminId = req.user.adminId;

  // 🧩 AUTO-HEAL legacy companies (SAFE, ONE-TIME)
  await pool.query(
    `
    UPDATE companies
    SET admin_id = $1
    WHERE admin_id IS NULL
    `,
    [adminId]
  );

  const result = await pool.query(
    `
    SELECT *
    FROM companies
    WHERE admin_id = $1
    ORDER BY created_at DESC
    `,
    [adminId]
  );

  res.json({ success: true, data: result.rows });
});


/* =========================================================
   GET ACTIVE COMPANY (PER ADMIN)
========================================================= */
router.get("/active", async (req, res) => {
  const adminId = req.user.adminId;

  const result = await pool.query(
    `
    SELECT company_guid
    FROM active_company
    WHERE admin_id = $1
    `,
    [adminId]
  );

  res.json({
    success: true,
    company_guid: result.rows[0]?.company_guid || null,
  });
});

/* =========================================================
   SET ACTIVE COMPANY (ADMIN ONLY — UI)
========================================================= */
// router.post("/set-active", async (req, res) => {
//    console.log("=== SET ACTIVE HIT ===");
//   const { company_guid } = req.body;

//   const adminId = req.user.adminId;

//   if (req.user.role !== "ADMIN") {
//     return res.status(403).json({ message: "Admin only" });
//   }

//   await pool.query(
//     `
//     INSERT INTO active_company (admin_id, company_guid)
//     VALUES ($1, $2)
//     ON CONFLICT (admin_id)
//     DO UPDATE SET
//       company_guid = EXCLUDED.company_guid,
//       updated_at = NOW()
//     `,
//     [adminId, company_guid]
//   );


// //sufiyan

//    const licenseRes = await fetch(
//       `https://dashboard.licentic.org/api/external/actve-license/${req.user.email}?productId=${PRODUCT_ID}`
//     );

//     const licenseData = await licenseRes.json();
//     const licenseId = licenseData?.activeLicense?._id;

//   const countResult = await pool.query(
//   `
//   SELECT COUNT(*) 
//   FROM selected_companies
//   WHERE admin_id = $1
//   `,
//   [adminId]
// );

// const activeCompanyCount = Number(countResult.rows[0].count);

// if (licenseId) {
//   await sendHeartbeat({
//     licenseId,
//     adminId,
//     features: [
//       {
//         slug: "company-limit",
//         value: activeCompanyCount,
//       },
//     ],
//   });
// }

//    //sufiyan

//   res.json({ success: true, company_guid });
// });


router.post("/set-active", async (req, res) => {
  console.log("=== SET ACTIVE HIT ===");

  const { company_guid } = req.body;
  const adminId = req.user.adminId;

  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin only" });
  }

  if (!company_guid) {
    return res.status(400).json({ message: "company_guid required" });
  }

  try {
    await pool.query(
      `
      INSERT INTO active_company (admin_id, company_guid)
      VALUES ($1, $2)
      ON CONFLICT (admin_id)
      DO UPDATE SET
        company_guid = EXCLUDED.company_guid,
        updated_at = NOW()
      `,
      [adminId, company_guid]
    );

    console.log("✅ Active company updated:", company_guid);

    return res.json({
      success: true,
      company_guid,
    });

  } catch (err) {
    console.error("Set active error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});
router.get("/by-guid/:guid", requireAuth, async (req, res) => {
  const { guid } = req.params;
  const adminId = req.user.adminId;

  const result = await pool.query(
    `
    SELECT company_guid, name
    FROM companies
    WHERE company_guid = $1 AND admin_id = $2
    `,
    [guid, adminId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Company not found" });
  }

  res.json({ success: true, data: result.rows[0] });
});



/* =========================================================
   SYNC START — ENSURE COLUMN EXISTS (AUTO-MIGRATE)
========================================================= */
async function ensureSyncStartColumn() {
  try {
    await pool.query(`
      ALTER TABLE selected_companies
      ADD COLUMN IF NOT EXISTS starting_from VARCHAR(10) DEFAULT NULL
    `);
  } catch (err) {
    console.error("Failed to ensure starting_from column:", err.message);
  }
}
ensureSyncStartColumn();

/* =========================================================
   GET SYNC START DATE FOR A COMPANY
========================================================= */
router.get("/sync-start/:guid", async (req, res) => {
  const { guid } = req.params;
  const adminId = req.user.adminId;

  try {
    const result = await pool.query(
      `
      SELECT starting_from
      FROM selected_companies
      WHERE admin_id = $1 AND company_guid = $2
      `,
      [adminId, guid]
    );

    if (result.rowCount === 0) {
      return res.json({
        success: true,
        company_guid: guid,
        starting_from: null,
      });
    }

    return res.json({
      success: true,
      company_guid: guid,
      starting_from: result.rows[0].starting_from || null,
    });
  } catch (err) {
    console.error("Get sync start error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =========================================================
   SET / UPDATE SYNC START DATE FOR A COMPANY (ADMIN ONLY)
========================================================= */
router.put("/sync-start/:guid", async (req, res) => {
  const { guid } = req.params;
  const { starting_from } = req.body;
  const adminId = req.user.adminId;

  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Admin only" });
  }

  if (!starting_from) {
    return res.status(400).json({ success: false, message: "starting_from is required (YYYY-MM-01)" });
  }

  const dateRegex = /^\d{4}-\d{2}-01$/;
  if (!dateRegex.test(starting_from)) {
    return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-01" });
  }

  try {
    const existing = await pool.query(
      `SELECT 1 FROM selected_companies WHERE admin_id = $1 AND company_guid = $2`,
      [adminId, guid]
    );

    if (existing.rowCount === 0) {
      await pool.query(
        `INSERT INTO selected_companies (admin_id, company_guid, starting_from) VALUES ($1, $2, $3)`,
        [adminId, guid, starting_from]
      );
    } else {
      await pool.query(
        `UPDATE selected_companies SET starting_from = $1 WHERE admin_id = $2 AND company_guid = $3`,
        [starting_from, adminId, guid]
      );
    }

    return res.json({
      success: true,
      company_guid: guid,
      starting_from,
    });
  } catch (err) {
    console.error("Set sync start error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
