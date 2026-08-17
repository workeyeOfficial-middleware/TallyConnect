import express from "express";
import pool from "../db.js";

const router = express.Router();

router.post("/sync", async (req, res) => {
  const { ledger_guid, company_guid, period, amount } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO ageing 
       (ledger_guid, company_guid, period, amount)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ledger_guid, company_guid, period, amount]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Fetch ageing data
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM ageing ORDER BY period ASC");
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});


// ✅ NEW: Fetch ageing for a specific ledger
router.get("/ledger/:ledgerGuid", async (req, res) => {
  const { ledgerGuid } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        b.due_date,
        b.amount
      FROM bills b
      JOIN ledgers l
        ON l.name = b.ledger_name
       AND l.ledger_guid = $1
      `,
      [ledgerGuid]
    );

    const ageing = {
      "0-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    result.rows.forEach((bill) => {
      const outstanding = Number(bill.amount);
      if (outstanding <= 0) return;

      const dueDate = new Date(bill.due_date);
      dueDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays <= 30) ageing["0-30"] += outstanding;
      else if (diffDays <= 60) ageing["31-60"] += outstanding;
      else if (diffDays <= 90) ageing["61-90"] += outstanding;
      else ageing["90+"] += outstanding;
    });

    res.json([
      { period: "0-30", amount: ageing["0-30"] },
      { period: "31-60", amount: ageing["31-60"] },
      { period: "61-90", amount: ageing["61-90"] },
      { period: "90+", amount: ageing["90+"] },
    ]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



export default router;