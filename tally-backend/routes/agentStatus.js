import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";
import { createMobileNotificationForAdmin } from "../utils/mobileNotification.js";

const router = express.Router();

/**
 * POST /agent-status/sync-status
 * Called by agent.js
 */
router.post("/sync-status", requireAuth, async (req, res) => {
  try {
   // const adminId = req.user.adminId;
   const adminId = req.user.adminId;
    const { company_guid } = req.body;

    console.log("🔥 SYNC STATUS UPDATE");
console.log("Admin ID (POST):", req.user.adminId);
console.log("Company GUID (POST):", req.body.company_guid);

    if (!adminId || !company_guid) {
      return res.status(400).json({ success: false });
    }

    await pool.query(
      `
INSERT INTO agent_status
  (admin_id, company_guid, last_sync_at, sync_in_progress)
VALUES
  ($1, $2, NOW(), FALSE)
ON CONFLICT (admin_id, company_guid)
DO UPDATE SET
  last_sync_at = NOW(),
  sync_in_progress = FALSE

      `,
      [adminId, company_guid]
    );

    createMobileNotificationForAdmin({
      type: "sync_completed",
      message: "Tally sync completed successfully",
      adminId,
    }).catch((e) => console.error("mobile sync_completed notify error:", e.message));

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Agent sync-status error:", err);
    // 🔒 Never block agent execution
    res.json({ success: false });
  }
});

/**
 * GET /agent-status/sync-status
 * Used by frontend (sidebar / dashboard)
 */

router.get("/sync-status", requireAuth, async (req, res) => {
  try {
    const adminId = req.user.adminId;    const { company_guid } = req.query;

     console.log("🔍 GET SYNC STATUS CALLED");
    console.log("Admin ID:", adminId);
    console.log("Company GUID:", company_guid);

    if (!company_guid) {
      return res.json({
        success: true,
        last_sync_at: null,
        sync_in_progress: false
      });
    }

    const result = await pool.query(
      `
      SELECT last_sync_at, sync_in_progress
      FROM agent_status
      WHERE admin_id = $1
        AND company_guid = $2
      `,
      [adminId, company_guid]
    );

    res.json({
      success: true,
      last_sync_at: result.rows[0]?.last_sync_at || null,
      sync_in_progress: result.rows[0]?.sync_in_progress || false
    });

  } catch (err) {
    console.error("❌ Fetch sync status failed:", err);
    res.status(500).json({ success: false });
  }
});




router.post("/sync-started", requireAuth, async (req, res) => {
  try {
    const adminId = req.user.adminId;    const { company_guid } = req.body;

    if (!adminId || !company_guid) {
      return res.status(400).json({ success: false });
    }

    await pool.query(
      `
      INSERT INTO agent_status
        (admin_id, company_guid, sync_in_progress)
      VALUES
        ($1, $2, TRUE)
      ON CONFLICT (admin_id, company_guid)
      DO UPDATE SET
        sync_in_progress = TRUE
      `,
      [adminId, company_guid]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Sync started error:", err);
    res.json({ success: false });
  }
});


export default router;
