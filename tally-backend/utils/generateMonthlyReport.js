import ExcelJS from "exceljs";
import pool from "../db.js";
import fs from "fs";
import path from "path";
import { createNotification } from "./notification.js";

export async function generateMonthlyReport(userId, adminId) {
  // 1️⃣ Ensure reports folder exists
  const reportsDir = path.join("uploads", "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // 2️⃣ Fetch monthly data (USING EXISTING DB FUNCTION)
  const { rows } = await pool.query(
    `SELECT * FROM monthly_report_data($1)`,
    [adminId]
  );

  if (!rows.length) return;

  // 3️⃣ Create Excel
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Monthly Report");

  sheet.columns = [
    { header: "Month", key: "month", width: 20 },
    { header: "Turnover", key: "turnover", width: 15 },
    { header: "Expense", key: "expense", width: 15 },
    { header: "Profit", key: "profit", width: 15 },
  ];

  rows.forEach((r) => {
    sheet.addRow({
      month: r.month,
      turnover: Number(r.turnover),
      expense: Number(r.expense),
      profit: Number(r.profit),
    });
  });

  // 4️⃣ Save file
  const fileName = `monthly_report_${userId}_${Date.now()}.xlsx`;
  const filePath = path.join(reportsDir, fileName);

  await workbook.xlsx.writeFile(filePath);

  // 5️⃣ Create notification
  await createNotification({
    type: "MONTHLY_REPORT",
    user_id: userId,
    message: "📊 This is your Monthly Report. Download the Excel sheet.",
    meta: {
      file: fileName,
    },
  });
}
