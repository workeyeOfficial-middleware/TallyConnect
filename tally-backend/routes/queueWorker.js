import pool from "./db.js";
import axios from "axios";

async function processQueue() {
 const { rows } = await pool.query(`
  SELECT *
  FROM sync_queue
WHERE status = 'pending'  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED
`);


  if (!rows.length) return;

  const job = rows[0];

  try {
    await pool.query(
      `UPDATE sync_queue SET status='processing' WHERE id=$1`,
      [job.id]
    );

    const {
      entity_type,
      payload,
      entity_guid,
      company_guid,
    } = job;

    /* ===============================
       🔹 LEDGER HANDLER
    =============================== */
    if (entity_type === "LEDGER") {
      await pool.query(
        `
        INSERT INTO ledgers
        (
          ledger_guid,
          company_guid,
          name,
          parent_group,
          opening_balance,
          closing_balance,
          type
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (ledger_guid)
        DO UPDATE SET
          name = EXCLUDED.name,
          parent_group = EXCLUDED.parent_group,
          opening_balance = EXCLUDED.opening_balance,
          closing_balance = EXCLUDED.closing_balance,
          type = EXCLUDED.type
        `,
        [
          entity_guid,
          company_guid,
          payload.name,
          payload.parent_group,
          payload.opening_balance || 0,
          payload.closing_balance || 0,
          payload.type || "General",
        ]
      );
    }


    /* ===============================
   🔹 VOUCHER HANDLER (🔥 THIS WAS MISSING)
=============================== */
if (entity_type === "VOUCHER") {
  const {
    voucher_guid,
    voucher_type,
    voucher_date,
    narration,
    ledger_entries,
    reference_no,
  } = payload;

  // 👉 Call VoucherEntry /sync API to write into voucher_entries table
  await axios.post(
  `${process.env.API_BASE_URL}/api/voucher-entry/sync`,
    {
      voucher_guid,
      company_guid,
      voucher_date,
      voucher_type,
      reference_no: reference_no || "",
      entries: ledger_entries.map((e) => ({
        ledger_name: e.ledger_name,
        amount: Math.abs(e.amount),
        is_debit: e.is_debit,
      })),
    },
    {
      headers: {
Authorization: `Bearer ${process.env.SERVICE_TOKEN}`      },
    }
  );
}

    /* ===============================
       ✅ MARK AS DONE
    =============================== */
    await pool.query(
      `
      UPDATE sync_queue
      SET status='done', processed_at=now()
      WHERE id=$1
      `,
      [job.id]
    );

    await pool.query(
      `
      INSERT INTO sync_logs
      (queue_id, company_guid, entity_type, entity_guid, message)
      VALUES ($1,$2,$3,$4,$5)
      `,
      [
        job.id,
        company_guid,
        entity_type,
        entity_guid,
        "Sync processed successfully",
      ]
    );

  } catch (err) {
    await pool.query(
      `
      UPDATE sync_queue
      SET status='failed', error=$2
      WHERE id=$1
      `,
      [job.id, err.message]
    );
  }
}

setInterval(processQueue, 1000);
