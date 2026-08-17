import cron from "node-cron";
import pool from "../db.js";
import { generateMonthlyReport } from "../utils/generateMonthlyReport.js";

cron.schedule("* * * * *", async () => {
  const now = new Date();

  // ✅ ALWAYS compare in UTC
  const day = now.getUTCDate();
  const time = now.toISOString().slice(11, 16); // HH:mm (UTC)

  console.log("[MONTHLY REPORT CRON]", { day, time });

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

  for (const row of rows) {
    await generateMonthlyReport(row.user_id, row.admin_id);
  }
});
