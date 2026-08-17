
// import crypto from "crypto";
// import redis from "../redis.js";
// import { sendResetEmail } from "../utils/sendResetEmail.js";
import requireAuth from "../middleware/requireAuth.js";

// import dotenv from "dotenv";

// dotenv.config();



// // ==============================
// // ✅ RESEND SMTP (WORKS ON RENDER)
// // ==============================
// const transporter = nodemailer.createTransport({
//   host: "smtp.resend.com",
//   port: 587,
//   secure: false,
//   auth: {
//     user: "resend",
//     pass: process.env.RESEND_API_KEY,
//   },
// });

// // OPTIONAL: verify once at startup
// transporter.verify((err, success) => {
//   if (err) console.error("SMTP Error:", err);
//   else console.log("SMTP Ready");
// });

// // ----------------------
// // GET /auth/pending-reset-requests
// // ----------------------
// router.get("/pending-reset-requests", requireAuth, async (req, res) => {
//   const adminId = req.user.id;

//   try {
//     const adminResult = await pool.query(
//       "SELECT company_id FROM users WHERE id=$1 AND role='ADMIN'",
//       [adminId]
//     );

//     if (!adminResult.rows.length)
//       return res.status(403).json({ message: "Not an admin" });

//     const companyId = adminResult.rows[0].company_id;

//     const requests = await pool.query(
//       `SELECT pr.id, pr.token, u.username, u.email
//        FROM password_reset_requests pr
//        JOIN users u ON u.id = pr.user_id
//        WHERE pr.approved=FALSE AND u.company_id=$1`,
//       [companyId]
//     );

//     res.json(requests.rows);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // ----------------------
// // POST /auth/forgot-password
// // ----------------------


// // ================= FORGOT PASSWORD =================
// router.post("/forgot-password", async (req, res) => {
//   try {
//     const { email } = req.body;

//     if (!email)
//       return res.status(400).json({ message: "Email required" });

//     const user = await pool.query(
//       "SELECT id FROM users WHERE LOWER(email)=LOWER($1)",
//       [email]
//     );

//     // Always return same response (security)
//     if (!user.rows.length) {
//       return res.json({
//         message: "If email exists, reset link sent",
//       });
//     }

//     // Generate token
//     const token = crypto.randomBytes(32).toString("hex");

//     // Store in Redis for 10 minutes
//     await redis.set(
//       `reset:${token}`,
//       user.rows[0].id,
//       "EX",
//       600
//     );

//     const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

//     await sendResetEmail(email, resetLink);

//     res.json({
//       message: "Reset link sent successfully",
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // ----------------------
// // GET /auth/approve-reset/:token
// // ----------------------
// // router.get("/approve-reset/:token", async (req, res) => {
// //   const { token } = req.params;

// //   try {
// //     const result = await pool.query(
// //       `SELECT pr.id, pr.user_id, pr.expires_at, u.email, u.username
// //        FROM password_reset_requests pr
// //        JOIN users u ON u.id=pr.user_id
// //        WHERE pr.token=$1 AND pr.approved=FALSE`,
// //       [token]
// //     );

// //     if (!result.rows.length) return res.send("Invalid or expired token");

// //     const reqData = result.rows[0];
// //     if (new Date(reqData.expires_at) < new Date())
// //       return res.send("Token expired");

// //     const newPassword = crypto.randomBytes(4).toString("hex");
// //     const hashed = await bcrypt.hash(newPassword, 10);

// //     await pool.query("UPDATE users SET password=$1 WHERE id=$2", [
// //       hashed,
// //       reqData.user_id,
// //     ]);

// //     await pool.query("DELETE FROM password_reset_requests WHERE id=$1", [
// //       reqData.id,
// //     ]);

// //     await transporter.sendMail({
// //       from: "Tally Connect <onboarding@resend.dev>",
// //       to: reqData.email,
// //       subject: "Your New Password",
// //       html: `
// //         <p>Hello <b>${reqData.username}</b>,</p>
// //         <p>Your new password is:</p>
// //         <p><b>${newPassword}</b></p>
// //       `,
// //     });

// //     res.send("Password reset successful");
// //   } catch (err) {
// //     console.error(err);
// //     res.status(500).send("Server error");
// //   }
// // });

// // ================= RESET PASSWORD =================
// router.post("/reset-password", async (req, res) => {
//   try {
//     const { token, newPassword } = req.body;

//     if (!token || !newPassword)
//       return res.status(400).json({
//         message: "Token and password required",
//       });

//     // Check Redis
//     const userId = await redis.get(`reset:${token}`);

//     if (!userId)
//       return res.status(400).json({
//         message: "Invalid or expired token",
//       });

//     // Update password directly (plain text)
//     await pool.query(
//       "UPDATE users SET password=$1 WHERE id=$2",
//       [newPassword, userId]
//     );

//     // Delete token after use
//     await redis.del(`reset:${token}`);

//     res.json({
//       message: "Password updated successfully",
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });
// // ----------------------
// 
import express from "express";
import pool from "../db.js";
import crypto from "crypto";

import { sendResetEmail } from "../utils/sendResetEmail.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/* ================= FORGOT PASSWORD ================= */
// router.post("/forgot-password", async (req, res) => {
//   try {
//     const { email } = req.body;

//     if (!email) {
//       return res.status(400).json({ message: "Email required" });
//     }

//     const user = await pool.query(
//       "SELECT id FROM users WHERE LOWER(email)=LOWER($1)",
//       [email]
//     );

//     // Always return same message (security)
//     if (!user.rows.length) {
//       return res.json({
//         message: "If email exists, reset link sent",
//       });
//     }

//     const token = crypto.randomBytes(32).toString("hex");

//     await redis.set(
//       `reset:${token}`,
//       user.rows[0].id,
//       "EX",
//       600
//     );

//     const resetLink =
//       `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

//     await sendResetEmail(email, resetLink);

//     res.json({
//       message: "Reset link sent successfully",
//     });

//   } catch (err) {
//     console.error("Forgot password error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// /* ================= RESET PASSWORD ================= */
// router.post("/reset-password", async (req, res) => {
//   try {
//     const { token, newPassword } = req.body;

//     if (!token || !newPassword) {
//       return res.status(400).json({
//         message: "Token and password required",
//       });
//     }

//     const userId = await redis.get(`reset:${token}`);

//     if (!userId) {
//       return res.status(400).json({
//         message: "Invalid or expired token",
//       });
//     }

//     await pool.query(
//       "UPDATE users SET password=$1 WHERE id=$2",
//       [newPassword, userId]
//     );

//     await redis.del(`reset:${token}`);

//     res.json({
//       message: "Password updated successfully",
//     });

//   } catch (err) {
//     console.error("Reset password error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

/* ================= SEND OTP ================= */
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ message: "Email required" });

    const user = await pool.query(
      "SELECT id FROM users WHERE LOWER(email)=LOWER($1)",
      [email]
    );

    if (!user.rows.length)
      return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // OTP expiry = 10 minutes
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    // Save OTP in DB
    await pool.query(
      "UPDATE users SET reset_otp=$1, otp_expiry=$2 WHERE LOWER(email)=LOWER($3)",
      [otp, expiry, email]
    );

    // Send OTP via Brevo
    await sendResetEmail(email, otp);

    res.json({ message: "OTP sent successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
/* ================= VERIFY OTP ================= */
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: "All fields required" });

    const user = await pool.query(
      "SELECT reset_otp, otp_expiry FROM users WHERE LOWER(email)=LOWER($1)",
      [email]
    );

    if (!user.rows.length)
      return res.status(404).json({ message: "User not found" });

    const { reset_otp, otp_expiry } = user.rows[0];

    // Check OTP
    if (reset_otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    // Check expiry
    if (new Date() > otp_expiry)
      return res.status(400).json({ message: "OTP expired" });

    // Hash password
    // const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE users 
       SET password=$1, reset_otp=NULL, otp_expiry=NULL
       WHERE LOWER(email)=LOWER($2)`,
      [newPassword, email]
    );

    res.json({ message: "Password updated successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;