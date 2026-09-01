import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

/* =====================================================
   MARK INACTIVE VOUCHERS
===================================================== */
router.post("/reset-active", requireAuth, async (req, res) => {
  const adminId = req.user.adminId;
  const { company_guid } = req.body;

  if (!adminId || !company_guid) {
    return res.status(400).json({ success: false });
  }

  try {
    await pool.query(
      `
      UPDATE vouchers
      SET is_active = false
      WHERE admin_id = $1
        AND company_guid = $2
      `,
      [adminId, company_guid]
    );

    await pool.query(
      `
      UPDATE voucher_entries
      SET is_active = false
      WHERE admin_id = $1
        AND company_guid = $2
      `,
      [adminId, company_guid]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Reset active failed:", err.message);
    res.status(500).json({ success: false });
  }
});




/* =====================================================
   SYNC VOUCHER ENTRIES
===================================================== */
router.post("/sync", requireAuth, async (req, res) => {
  const adminId = req.user.adminId;

  const {
    voucher_guid,
    company_guid,
    voucher_date,
    voucher_type,
    reference_no,
    net_amount,        // ✅ MUST ADD THIS
    entries,
  } = req.body;

  // ✅ ADD THIS BLOCK HERE
const companyCheck = await pool.query(
  `
  SELECT 1 FROM companies
  WHERE company_guid = $1 AND admin_id = $2
  `,
  [company_guid, adminId]
);

if (companyCheck.rowCount === 0) {
  console.log("⛔ Voucher skipped (company not owned):", company_guid);

  return res.json({
    success: true,
    skipped: true
  });
}


  if (!adminId || !voucher_guid || !company_guid || !Array.isArray(entries)) {
    return res.status(400).json({ success: false });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ==============================
       1️⃣ UPSERT INTO vouchers
    ============================== */
    await client.query(
      `
      INSERT INTO vouchers (
        admin_id,
        voucher_guid,
        company_guid,
        voucher_type,
        voucher_date,
        reference_no,
        net_amount,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,true)
      ON CONFLICT (admin_id, company_guid, voucher_guid)
      DO UPDATE SET
        voucher_type = EXCLUDED.voucher_type,
        voucher_date = EXCLUDED.voucher_date,
        reference_no = EXCLUDED.reference_no,
        net_amount = EXCLUDED.net_amount,
        is_active = true
      `,
      [
        adminId,
        voucher_guid,
        company_guid,
        voucher_type,
        voucher_date,
        reference_no,
        net_amount || 0
      ]
    );

    /* ==============================
       2️⃣ UPSERT voucher_entries
    ============================== */
    for (const e of entries) {
      if (!e.ledger_name || e.amount === undefined || e.is_debit === undefined) {
        continue;
      }

      await client.query(
        `
        INSERT INTO voucher_entries (
          admin_id,
          voucher_guid,
          company_guid,
          ledger_name,
          amount,
          is_debit,
          voucher_date,
          voucher_type,
          reference_no,
          is_active
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
        ON CONFLICT (admin_id, company_guid, voucher_guid, ledger_name)
        DO UPDATE SET
          amount = EXCLUDED.amount,
          is_debit = EXCLUDED.is_debit,
          voucher_date = EXCLUDED.voucher_date,
          voucher_type = EXCLUDED.voucher_type,
          reference_no = EXCLUDED.reference_no,
          is_active = true
        `,
        [
          adminId,
          voucher_guid,
          company_guid,
          e.ledger_name,
          Math.abs(e.amount),
          e.is_debit,
          voucher_date,
          voucher_type,
          reference_no,
        ]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true });

  } catch (err) {
  await client.query("ROLLBACK");

  console.error("Voucher sync error:", err.message);

  // ✅ DO NOT BREAK SYNC
  return res.json({
    success: true,
    skipped: true
  });
} finally {
    client.release();
  }
});


/* =====================================================
   GET VOUCHERS (UI)
===================================================== */
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const adminId = req.user.adminId;
    const { ledgerGuid } = req.query;

    /* ========= LEDGER DETAIL MODE ========= */
    if (ledgerGuid) {
      if (role !== "ADMIN") {
        const check = await pool.query(
  `
  SELECT 1
  FROM user_ledger_permissions ulp
  JOIN ledgers l
    ON l.ledger_guid = ulp.ledger_guid
  WHERE ulp.user_id = $1
    AND ulp.ledger_guid = $2
    AND l.admin_id = $3
  `,
  [userId, ledgerGuid, adminId]
);


        if (check.rowCount === 0) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const result = await pool.query(
        `
        SELECT
          ve.voucher_guid AS id,
          ve.voucher_date,
          ve.voucher_type,
          ve.reference_no,
          CASE WHEN ve.is_debit THEN ve.amount ELSE 0 END AS debit,
          CASE WHEN NOT ve.is_debit THEN ve.amount ELSE 0 END AS credit
        FROM voucher_entries ve
        JOIN ledgers l
  ON l.ledger_guid = $1
 AND l.company_guid = ve.company_guid
 AND l.admin_id = $2

        WHERE ve.is_active = true
          AND ve.company_guid = (
            SELECT company_guid
            FROM active_company
            WHERE admin_id = $2
          )
        ORDER BY ve.voucher_date ASC
        `,
        [ledgerGuid, adminId]
      );

      return res.json(result.rows);
    }

    /* ========= VOUCHER LIST ========= */
    let query;
    let params;

    if (role === "ADMIN") {
     query = `
SELECT
  v.voucher_guid,
  v.voucher_date,
  v.voucher_type,
  v.reference_no,
  v.net_amount AS amount,
  v.is_active,
  MAX(CASE WHEN ve.is_debit = false THEN ve.ledger_name END) AS party_name,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'item_name', li.item_name,
          'quantity', li.quantity,
          'rate', li.rate,
          'amount', li.amount
        )
      )
      FROM ledger_items li
      WHERE li.voucher_guid = v.voucher_guid
        AND li.company_guid = v.company_guid
        AND li.admin_id = $1
    ),
    '[]'
  ) AS items
FROM vouchers v
LEFT JOIN voucher_entries ve
  ON ve.voucher_guid = v.voucher_guid
 AND ve.admin_id = v.admin_id
 AND ve.company_guid = v.company_guid
WHERE v.admin_id = $1
  AND v.company_guid = (
    SELECT company_guid
    FROM active_company
    WHERE admin_id = $1
  )
GROUP BY 
  v.voucher_guid,
  v.voucher_date,
  v.voucher_type,
  v.reference_no,
  v.net_amount,
  v.is_active
ORDER BY v.voucher_date DESC
`;
params = [adminId];


    } else {
      query = `
  SELECT
    ve.voucher_guid,
    ve.voucher_date,
    ve.voucher_type,
    MAX(ve.reference_no) AS reference_no,

    -- PARTY LEDGER
    MAX(CASE WHEN ve.is_debit = false THEN ve.ledger_name END) AS party_name,

    -- ✅ PARTY AMOUNT (FIXED)
    MAX(CASE WHEN ve.is_debit = false THEN ve.amount END) AS amount,

    BOOL_OR(ve.is_active) AS is_active,

    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'item_name', li.item_name,
            'quantity', li.quantity,
            'rate', li.rate,
            'amount', li.amount
          )
        )
        FROM ledger_items li
        WHERE li.voucher_guid = ve.voucher_guid
          AND li.company_guid = ve.company_guid
          AND li.admin_id = u.admin_id
      ),
      '[]'
    ) AS items
  FROM voucher_entries ve
  JOIN users u ON u.id = $1
  WHERE ve.admin_id = u.admin_id
    AND ve.company_guid = (
      SELECT company_guid
      FROM active_company
      WHERE admin_id = u.admin_id
    )
    AND ve.voucher_guid = ANY (
      SELECT jsonb_array_elements_text(
        u.voucher_selection_permissions->'allowed_vouchers'
      )
    )
  GROUP BY ve.voucher_guid, ve.voucher_date, ve.voucher_type
  ORDER BY ve.voucher_date DESC
`;
params = [userId];

    }

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Voucher GET error:", err);
    res.status(500).json({ success: false });
  }
});

/* =====================================================
   DELETE (SOFT DELETE) VOUCHER
===================================================== */
router.delete("/:voucherGuid", requireAuth, async (req, res) => {
  const { voucherGuid } = req.params;
  const adminId = req.user.adminId;

  try {
   await pool.query(
  `
  UPDATE vouchers
  SET is_active = false
  WHERE admin_id = $1
    AND voucher_guid = $2
    AND company_guid = (
      SELECT company_guid
      FROM active_company
      WHERE admin_id = $1
    )
  `,
  [adminId, voucherGuid]
);


    res.json({ success: true });
  } catch (err) {
    console.error("Delete voucher error:", err.message);
    res.status(500).json({ success: false });
  }
});

/* =====================================================
   GET SINGLE VOUCHER (EDIT)
===================================================== */
router.get("/:voucherGuid", requireAuth, async (req, res) => {
  const { voucherGuid } = req.params;
  const adminId = req.user.adminId;

  const result = await pool.query(
    `
    SELECT
      voucher_guid,
      voucher_date,
      voucher_type,
      reference_no,
      ledger_name,
      amount,
      is_debit
    FROM voucher_entries
    WHERE admin_id = $1
      AND company_guid = (
        SELECT company_guid
        FROM active_company
        WHERE admin_id = $1
      )
      AND voucher_guid = $2
      AND is_active = true
    ORDER BY is_debit DESC
    `,
    [adminId, voucherGuid]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "Voucher not found" });
  }

  const rows = result.rows;

  res.json({
    voucher_guid: rows[0].voucher_guid,
    voucher_date: rows[0].voucher_date,
    voucher_type: rows[0].voucher_type,
    reference_no: rows[0].reference_no,
    ledger_entries: rows.map(r => ({
      ledger_name: r.ledger_name,
      amount: Number(r.amount),
      is_debit: r.is_debit
    }))
  });
});


router.get("/user-vouchers/:userId", requireAuth, async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `SELECT voucher_selection_permissions
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (!result.rows.length) {
      return res.json({ vouchers: [] });
    }

    const permissions = result.rows[0].voucher_selection_permissions || {};
    const vouchers = permissions.allowed_vouchers || [];

    res.json({ vouchers });
  } catch (err) {
    console.error("Get user vouchers error:", err);
    res.status(500).json({ vouchers: [] });
  }
});

router.post("/user-vouchers", requireAuth, async (req, res) => {
  const { userId, vouchers } = req.body;

  if (!userId || !Array.isArray(vouchers)) {
    return res.status(400).json({ success: false });
  }

  try {
    await pool.query(
      `
      UPDATE users
      SET voucher_selection_permissions = jsonb_build_object(
        'allowed_vouchers', $1::jsonb
      )
      WHERE id = $2
      `,
      [JSON.stringify(vouchers), userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Save user vouchers error:", err);
    res.status(500).json({ success: false });
  }
});

/* =====================================================
   GET VOUCHERS BY LEDGER (Ledger Details Page)
===================================================== */
// router.get("/ledger/:ledgerGuid", requireAuth, async (req, res) => {

//   const { ledgerGuid } = req.params;
//   const adminId = req.user.adminId;
//   const role = req.user.role;
//   const userId = req.user.id;

//   try {
//     /* =========================
//        🔐 Permission Check
//     ========================== */
//     if (role !== "ADMIN") {
//       const check = await pool.query(
//         `
//         SELECT 1
//         FROM user_ledger_permissions ulp
//         JOIN ledgers l
//           ON l.ledger_guid = ulp.ledger_guid
//         WHERE ulp.user_id = $1
//           AND ulp.ledger_guid = $2
//           AND l.admin_id = $3
//         `,
//         [userId, ledgerGuid, adminId]
//       );

//       if (check.rowCount === 0) {
//         return res.status(403).json({ message: "Access denied" });
//       }
//     }

//     /* =========================
//        🎯 Fetch Only That Ledger's Entries
//     ========================== */
//     const result = await pool.query(
//       `
//       SELECT
//   ve.voucher_guid AS id,
//   MAX(ve.voucher_date) AS voucher_date,
//   MAX(ve.voucher_type) AS voucher_type,
//   MAX(ve.reference_no) AS reference_no,

//   SUM(CASE WHEN ve.is_debit THEN ve.amount ELSE 0 END) AS debit,
//   SUM(CASE WHEN NOT ve.is_debit THEN ve.amount ELSE 0 END) AS credit

// FROM voucher_entries ve
// JOIN ledgers l
//   ON l.ledger_guid = $1
//  AND l.admin_id = $2
//  AND l.company_guid = ve.company_guid
//  AND ve.ledger_name = l.name

// WHERE ve.is_active = true
//   AND ve.company_guid = (
//     SELECT company_guid
//     FROM active_company
//     WHERE admin_id = $2
//   )

// GROUP BY ve.voucher_guid
// ORDER BY MAX(ve.voucher_date) ASC
//       `,
//       [ledgerGuid, adminId]
//     );

//     res.json(result.rows);

//   } catch (err) {
//     console.error("Ledger vouchers fetch error:", err);
//     res.status(500).json({ message: "Failed to fetch ledger vouchers" });
//   }
// });


// New
router.get("/ledger/:ledgerGuid", requireAuth, async (req, res) => {

  const { ledgerGuid } = req.params;
  const adminId = req.user.adminId;
  const role = req.user.role;
  const userId = req.user.id;

  try {
    /* 🔐 Permission Check (unchanged) */
    if (role !== "ADMIN") {
      const check = await pool.query(
        `
        SELECT 1
        FROM user_ledger_permissions ulp
        JOIN ledgers l
          ON l.ledger_guid = ulp.ledger_guid
        WHERE ulp.user_id = $1
          AND ulp.ledger_guid = $2
          AND l.admin_id = $3
        `,
        [userId, ledgerGuid, adminId]
      );

      if (check.rowCount === 0) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    /* 🎯 Fetch Only That Ledger's Entries (unchanged query) */
    const result = await pool.query(
      `
      SELECT
        ve.voucher_guid AS id,
        MAX(ve.voucher_date) AS voucher_date,
        MAX(ve.voucher_type) AS voucher_type,
        MAX(ve.reference_no) AS reference_no,
        SUM(CASE WHEN ve.is_debit THEN ve.amount ELSE 0 END) AS debit,
        SUM(CASE WHEN NOT ve.is_debit THEN ve.amount ELSE 0 END) AS credit
      FROM voucher_entries ve
      JOIN ledgers l
        ON l.ledger_guid = $1
       AND l.admin_id = $2
       AND l.company_guid = ve.company_guid
       AND ve.ledger_name = l.name
      WHERE ve.is_active = true
        AND ve.company_guid = (
          SELECT company_guid
          FROM active_company
          WHERE admin_id = $2
        )
      GROUP BY ve.voucher_guid
      ORDER BY MAX(ve.voucher_date) ASC
      `,
      [ledgerGuid, adminId]
    );

    /* 🆕 Attach items per voucher (exact join on voucher_guid) */
    let itemRows = [];
    const voucherGuids = result.rows.map((r) => r.id);

    if (voucherGuids.length > 0) {
      const itemRes = await pool.query(
        `
        SELECT
          voucher_guid,
          item_name,
          SUM(quantity) AS total_qty,
          SUM(amount)   AS total_amount
        FROM ledger_items
        WHERE admin_id = $1
          AND voucher_guid = ANY($2)
        GROUP BY voucher_guid, item_name
        `,
        [adminId, voucherGuids]
      );
      itemRows = itemRes.rows;
    }

    const data = result.rows.map((v) => ({
      ...v,
      items: itemRows.filter((i) => i.voucher_guid === v.id)
    }));

    res.json(data);

  } catch (err) {
    console.error("Ledger vouchers fetch error:", err);
    res.status(500).json({ message: "Failed to fetch ledger vouchers" });
  }
});


router.post("/bulk-user-vouchers", requireAuth, async (req, res) => {
  const { userIds, vouchers } = req.body;

  if (!Array.isArray(userIds) || !Array.isArray(vouchers)) {
    return res.status(400).json({ success: false });
  }

  try {
    await pool.query(
      `
      UPDATE users
      SET voucher_selection_permissions = jsonb_build_object(
        'allowed_vouchers', $1::jsonb
      )
      WHERE id = ANY($2)
      `,
      [JSON.stringify(vouchers), userIds]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Bulk voucher selection error:", err);
    res.status(500).json({ success: false });
  }
});


router.post("/cleanup/voucher", requireAuth, async (req, res) => {

  const { company_guid, existing_ids } = req.body;
  const adminId = req.user.adminId;

  if (!company_guid || !Array.isArray(existing_ids)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {

    const toDelete = await pool.query(
      `
      SELECT *
FROM vouchers
WHERE admin_id = $1
AND company_guid = $2
AND NOT (voucher_guid = ANY($3))
      `,
      [adminId, company_guid, existing_ids]
    );

    const vouchers = toDelete.rows;

    if (vouchers.length === 0) {
      return res.json({ success: true, deleted: 0 });
    }

    const voucherGuids = vouchers.map(v => v.voucher_guid);

    /* Save history */
    for (const voucher of vouchers) {

      const entries = await pool.query(
  `
  SELECT *
  FROM voucher_entries
  WHERE voucher_guid = $1
  AND admin_id = $2
  AND company_guid = $3
  `,
  [voucher.voucher_guid, adminId, company_guid]
);

      await pool.query(
        `
        INSERT INTO deleted_records
        (admin_id, company_guid, entity_type, entity_guid, entity_data, deleted_from)
        VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          adminId,
          company_guid,
          "voucher",
          voucher.voucher_guid,
          {
            voucher,
            entries: entries.rows
          },
          "tally_sync"
        ]
      );
    }

    /* delete entries */
    await pool.query(
      `
      DELETE FROM voucher_entries
      WHERE voucher_guid = ANY($1)
      `,
      [voucherGuids]
    );

    /* delete vouchers */
    const result = await pool.query(
      `
      DELETE FROM vouchers
      WHERE admin_id = $1
        AND company_guid = $2
        AND voucher_guid = ANY($3)
      `,
      [adminId, company_guid, voucherGuids]
    );

    res.json({
      success: true,
      deleted: result.rowCount
    });

  } catch (err) {
    console.error("Voucher cleanup failed:", err);
    res.status(500).json({ error: err.message });
  }

});

router.post("/deleted/restore-voucher/:id", requireAuth, async (req, res) => {

  const adminId = req.user.adminId;
  const { id } = req.params;

  const record = await pool.query(
    `
    SELECT *
    FROM deleted_records
    WHERE id=$1
      AND admin_id=$2
      AND entity_type='voucher'
    `,
    [id, adminId]
  );

  if (!record.rows.length) {
    return res.status(404).json({ error: "Record not found" });
  }

  const data = record.rows[0].entity_data;
  const voucher = data.voucher;
  const entries = data.entries;

  await pool.query(
    `
    INSERT INTO vouchers
    (
      admin_id,
      voucher_guid,
      company_guid,
      voucher_type,
      voucher_date,
      reference_no,
      net_amount,
      is_active
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,true)
    `,
    [
      voucher.admin_id,
      voucher.voucher_guid,
      voucher.company_guid,
      voucher.voucher_type,
      voucher.voucher_date,
      voucher.reference_no,
      voucher.net_amount
    ]
  );

  for (const e of entries) {

    await pool.query(
      `
      INSERT INTO voucher_entries
      (
        admin_id,
        voucher_guid,
        company_guid,
        ledger_name,
        amount,
        is_debit,
        voucher_date,
        voucher_type,
        reference_no,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
      `,
      [
        e.admin_id,
        e.voucher_guid,
        e.company_guid,
        e.ledger_name,
        e.amount,
        e.is_debit,
        e.voucher_date,
        e.voucher_type,
        e.reference_no
      ]
    );

  }

  await pool.query(
    `DELETE FROM deleted_records WHERE id=$1`,
    [id]
  );

  res.json({
    success: true,
    message: "Voucher restored"
  });

});


export default router;