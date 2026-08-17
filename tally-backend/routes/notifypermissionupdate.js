import express from "express";
import dotenv from "dotenv";
import requireAuth from "../middleware/requireAuth.js";
import pool from "../db.js";

dotenv.config();
const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { userIds, modules } = req.body;

    if (!userIds || !modules) {
      return res.status(400).json({ message: "Missing data" });
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;

    if (!BREVO_API_KEY) {
  return res.status(500).json({ message: "Brevo API key not configured" });
}

    const users = await pool.query(
      "SELECT email, username FROM users WHERE id = ANY($1)",
      [userIds]
    );

    for (const user of users.rows) {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: {
            name: process.env.BREVO_SENDER_NAME,
            email: process.env.BREVO_SENDER_EMAIL,
          },
          to: [{ email: user.email }],
          subject: "Your Access Has Been Updated",
          htmlContent: `
            <h3>Hello ${user.username}</h3>
            <p>Your access permissions have been updated.</p>
            <p><b>You now have access to:</b></p>
            <ul>
              ${modules.map(m => `<li>${m}</li>`).join("")}
            </ul>
            <p>Please login to view your updated access.</p>
          `,
        }),
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Email failed" });
  }
});

export default router;