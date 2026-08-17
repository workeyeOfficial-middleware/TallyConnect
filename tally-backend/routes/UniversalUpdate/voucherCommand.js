import express from "express";
import pool from "../../db.js";
import requireAuth from "../../middleware/requireAuth.js";
import { createNotification } from "../../utils/notification.js";

import crypto from "crypto";

const router = express.Router();

const ALLOWED_VOUCHER_TYPES = [
  "Journal",
  "Payment",
  "Receipt",
  "Sales",
  "Purchase"
];

/* =====================================================
   HELPER: payload hash
===================================================== */
function hashPayload(payload) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

/* =====================================================
   VALIDATE ACCOUNTING BALANCE
===================================================== */
function validateEntries(entries) {
  let debit = 0;
  let credit = 0;

  for (const e of entries) {
    if (!e.ledger_name || !e.amount || typeof e.is_debit !== "boolean") {
      throw new Error("Invalid ledger entry");
    }

    if (e.is_debit) debit += Number(e.amount);
    else credit += Number(e.amount);
  }

  if (debit !== credit) {
    throw new Error("Debit and credit totals do not match");
  }
}

/* =====================================================
   CREATE VOUCHER COMMAND
===================================================== */
router.post("/create", requireAuth, async (req, res) => {
  try {
    const adminId = req.user.adminId;

    const {
  voucher_type,
  voucher_date,
  narration,
  reference_no,
  invoice_number,
  due_date,

  party,
  items,

  subtotal,
  discount_amount,
  taxable_amount,

  cgst_amount,
  sgst_amount,
  igst_amount,
  total_tax,
  invoice_total,

  payment,
  custom_fields,

  ledger_entries
} = req.body;

    // ✅ GENERATE HERE (ONLY ONCE)
    const voucher_guid = crypto.randomUUID();
   const final_reference_no =
  reference_no || `UI-${Date.now()}`;

    if (!voucher_type || !voucher_date || !Array.isArray(ledger_entries)) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    validateEntries(ledger_entries);

    // ✅ Voucher type validation
if (!ALLOWED_VOUCHER_TYPES.includes(voucher_type)) {
  return res.status(400).json({
    message: `Unsupported voucher type: ${voucher_type}`
  });
}

// ✅ Sales voucher rule
if (voucher_type === "Sales") {
  const debitCount = ledger_entries.filter(e => e.is_debit).length;
  const creditCount = ledger_entries.filter(e => !e.is_debit).length;

  if (debitCount !== 1 || creditCount < 1) {
    return res.status(400).json({
      message: "Sales voucher must have 1 Debit (Party) and Credit Sales ledgers"
    });
  }
}

// ✅ Purchase voucher rule
if (voucher_type === "Purchase") {
  const debitCount = ledger_entries.filter(e => e.is_debit).length;
  const creditCount = ledger_entries.filter(e => !e.is_debit).length;

  if (creditCount !== 1 || debitCount < 1) {
    return res.status(400).json({
      message: "Purchase voucher must have 1 Credit (Party) and Debit Purchase ledgers"
    });
  }
}


    const companyRes = await pool.query(
      `SELECT company_guid FROM active_company WHERE admin_id = $1`,
      [adminId]
    );

    if (!companyRes.rows.length) {
      return res.status(400).json({ message: "No active company" });
    }

    const company_guid = companyRes.rows[0].company_guid;

    // ✅ MUST CONTAIN voucher_guid
   const payload = {
  voucher_guid,
  voucher_type,
  voucher_date,
  narration,
  reference_no: final_reference_no,

  invoice_number: invoice_number || null,
  due_date: due_date || null,

  party: party || null,
  items: Array.isArray(items) ? items : [],

  subtotal: subtotal ?? null,
  discount_amount: discount_amount ?? null,
  taxable_amount: taxable_amount ?? null,

  cgst_amount: cgst_amount ?? null,
  sgst_amount: sgst_amount ?? null,
  igst_amount: igst_amount ?? null,
  total_tax: total_tax ?? null,
  invoice_total: invoice_total ?? null,

  payment: payment || null,
  custom_fields: custom_fields || null,

  ledger_entries
};

    const payload_hash = hashPayload(payload);

    const exists = await pool.query(
      `
      SELECT 1 FROM sync_queue
      WHERE payload_hash = $1
        AND entity_type = 'VOUCHER'
        AND action = 'CREATE'
        AND status IN ('pending','processing','success')
      `,
      [payload_hash]
    );

    if (exists.rowCount > 0) {
      return res.json({ success: true, duplicate: true });
    }
const result = await pool.query(
  `
  INSERT INTO sync_queue
    (admin_id, company_guid, entity_type, entity_guid, action, payload, payload_hash, source)
  VALUES
    ($1,$2,'VOUCHER',$3,'CREATE',$4,$5,'UI')
  RETURNING id
  `,
  [
    adminId,
    company_guid,
    voucher_guid,   // ✅ THIS FIXES IT
    payload,
    payload_hash
  ]
);


    await createNotification({
  type: "VOUCHER_CREATED",
  message: `Successfully created ${voucher_type} voucher`,
  user_id: req.user.id, // admin who created it
});

    res.json({
  success: true,
  command_id: result.rows[0].id,
  voucher_guid,
  status: "QUEUED"
});

  } catch (err) {
    console.error("Voucher create command error:", err.message);
    res.status(400).json({ message: err.message });
  }
});


/* =====================================================
   ALTER VOUCHER COMMAND
===================================================== */
router.post("/alter", requireAuth, async (req, res) => {
  try {
    const adminId = req.user.adminId;

 const {
  voucher_guid,
  voucher_type,
  voucher_date,
  narration,
  reference_no,
  invoice_number,
  due_date,

  party,
  items,

  subtotal,
  discount_amount,
  taxable_amount,

  cgst_amount,
  sgst_amount,
  igst_amount,
  total_tax,
  invoice_total,

  payment,
  custom_fields,

  ledger_entries
} = req.body;

    if (!voucher_guid || !voucher_type || !voucher_date) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    validateEntries(ledger_entries);

    // ✅ Voucher type validation
if (!ALLOWED_VOUCHER_TYPES.includes(voucher_type)) {
  return res.status(400).json({
    message: `Unsupported voucher type: ${voucher_type}`
  });
}

// ✅ Sales voucher rule
if (voucher_type === "Sales") {
  const debitCount = ledger_entries.filter(e => e.is_debit).length;
  const creditCount = ledger_entries.filter(e => !e.is_debit).length;

  if (debitCount !== 1 || creditCount < 1) {
    return res.status(400).json({
      message: "Sales voucher must have 1 Debit (Party) and Credit Sales ledgers"
    });
  }
}

// ✅ Purchase voucher rule
if (voucher_type === "Purchase") {
  const debitCount = ledger_entries.filter(e => e.is_debit).length;
  const creditCount = ledger_entries.filter(e => !e.is_debit).length;

  if (creditCount !== 1 || debitCount < 1) {
    return res.status(400).json({
      message: "Purchase voucher must have 1 Credit (Party) and Debit Purchase ledgers"
    });
  }
}

    const companyRes = await pool.query(
      `SELECT company_guid FROM active_company WHERE admin_id = $1`,
      [adminId]
    );

    if (!companyRes.rows.length) {
  return res.status(400).json({ message: "No active company" });
}

const company_guid = companyRes.rows[0].company_guid;

    const payload = {
  voucher_guid,
  voucher_type,
  voucher_date,
  narration,
  reference_no: reference_no || null,

  invoice_number: invoice_number || null,
  due_date: due_date || null,

  party: party ?? null,
  items: Array.isArray(items) ? items : [],

  subtotal: subtotal ?? null,
  discount_amount: discount_amount ?? null,
  taxable_amount: taxable_amount ?? null,

  cgst_amount: cgst_amount ?? null,
  sgst_amount: sgst_amount ?? null,
  igst_amount: igst_amount ?? null,
  total_tax: total_tax ?? null,
  invoice_total: invoice_total ?? null,

  payment: payment ?? null,
  custom_fields: custom_fields ?? null,

  ledger_entries
};

    const payload_hash = hashPayload(payload);

    const result = await pool.query(
      `
      INSERT INTO sync_queue
        (admin_id, company_guid, entity_type, entity_guid, action, payload, payload_hash, source)
      VALUES
        ($1,$2,'VOUCHER',$3,'ALTER',$4,$5,'UI')
      RETURNING id
      `,
      [
        adminId,
        company_guid,
        voucher_guid,
        payload,
        payload_hash
      ]
    );

    res.json({ success: true, command_id: result.rows[0].id });
  } catch (err) {
    console.error("Voucher alter command error:", err.message);
    res.status(400).json({ message: err.message });
  }
});

export default router;

// Payment , receipt and journal, Payment ,Purchase  is working  read and create 