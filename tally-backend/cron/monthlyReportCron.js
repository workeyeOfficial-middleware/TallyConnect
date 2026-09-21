import cron from "node-cron";
import pool from "../db.js";
import { generateMonthlyReport } from "../utils/generateMonthlyReport.js";

let reportRunning = false;

cron.schedule("* * * * *", async () => {
  if (reportRunning) return;

  const now = new Date();
  const day = now.getUTCDate();
  const time = now.toISOString().slice(11, 16); // HH:mm (UTC)

  const { rows } = await pool.query(
    `
    SELECT m.user_id, u.admin_id
    FROM monthly_report_settings m
    JOIN users u ON u.id = m.user_id
    WHERE m.enabled = true
      AND m.day_of_month = $1
      AND m.report_time = $2
    `,
    [day, time]
  );

  if (rows.length === 0) return;

  reportRunning = true;
  try {
    console.log("[MONTHLY REPORT CRON] running", { day, time, users: rows.length });
    for (const row of rows) {
      await generateMonthlyReport(row.user_id, row.admin_id);
    }
  } catch (err) {
    console.error("[MONTHLY REPORT CRON] error:", err.message);
  } finally {
    reportRunning = false;
  }
});