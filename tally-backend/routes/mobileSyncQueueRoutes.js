import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

/* =========================================
   AGENT: FETCH PENDING MOBILE VOUCHERS
========================================= */
router.get("/pending", requireAuth, async (req, res) => {
  const { company_guid } = req.query;

  if (!company_guid) {
    return res.status(400).json({
      message: "company_guid required"
    });
  }

  const result = await pool.query(
    `
    SELECT
      id,
      action,
      payload
    FROM mobile_sync_queue
    WHERE status = 'pending'
      AND entity_type = 'VOUCHER'
      AND company_guid = $1
    ORDER BY created_at ASC
    LIMIT 10
    `,
    [company_guid]
  );

  res.json(result.rows);
});


/* =========================================
   MOBILE APP: FETCH QUEUE ACTIVITY / HISTORY
========================================= */
router.get("/activity", requireAuth, async (req, res) => {
  try {
    const { company_guid } = req.query;

    if (!company_guid) {
      return res.status(400).json({
        message: "company_guid required"
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        entity_type,
        action,
        status,
        payload,
        error,
        created_at,
        processed_at
      FROM mobile_sync_queue
      WHERE entity_type = 'VOUCHER'
        AND company_guid = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [company_guid]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch mobile queue activity:", error);

    res.status(500).json({
      message: "Failed to fetch queue activity"
    });
  }
});

/* =========================================
   AGENT: MARK PROCESSING
========================================= */
router.post("/:id/processing", requireAuth, async (req, res) => {
  await pool.query(
    `
    UPDATE mobile_sync_queue
    SET status = 'processing'
    WHERE id = $1
    `,
    [req.params.id]
  );

  res.json({ success: true });
});

/* =========================================
   AGENT: MARK SUCCESS
========================================= */
router.post("/:id/success", requireAuth, async (req, res) => {
  await pool.query(
    `
    UPDATE mobile_sync_queue
    SET
      status = 'success',
      processed_at = now()
    WHERE id = $1
    `,
    [req.params.id]
  );

  res.json({ success: true });
});

/* =========================================
   AGENT: MARK FAILED
========================================= */
router.post("/:id/failed", requireAuth, async (req, res) => {
  const { error } = req.body;

  await pool.query(
    `
    UPDATE mobile_sync_queue
    SET
      status = 'failed',
      error = $2
    WHERE id = $1
    `,
    [
      req.params.id,
      error || "Unknown error"
    ]
  );

  res.json({ success: true });
});

export default router;