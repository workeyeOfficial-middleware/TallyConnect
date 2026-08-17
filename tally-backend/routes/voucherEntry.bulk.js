import express from "express";
const router = express.Router();


router.post("/bulk-sync", async (req, res) => {
  const rows = req.body;

  if (!Array.isArray(rows)) {
    return res.status(400).json({ success: false });
  }

  for (const r of rows) {
    await pool.query(
      `
      INSERT INTO voucher_entries
      (voucher_guid, company_guid, ledger_name, amount, is_debit, voucher_date, voucher_type, reference_no)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (voucher_guid, ledger_name)
      DO UPDATE SET
        amount = EXCLUDED.amount,
        is_debit = EXCLUDED.is_debit
      `,
      [
        r.voucher_guid,
        r.company_guid,
        r.ledger_name,
        r.amount,
        r.is_debit,
        r.voucher_date,
        r.voucher_type,
        r.reference_no,
      ]
    );
  }

  res.json({ success: true });
});
export default router;
