import express from "express";
import dotenv from "dotenv";
import requireAuth from "../middleware/requireAuth.js";
import { notifyIfEnabled } from "../utils/notifyIfEnabled.js";
import pool from "../db.js";

dotenv.config();

const router = express.Router();

// =====================================================
// ✅ HELPER — Get Microsoft Access Token
// =====================================================
const getMicrosoftToken = async () => {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[MS-TOKEN] ❌ Failed to get token:", data);
    throw new Error(data.error_description || "Failed to get Microsoft token");
  }

  console.log("[MS-TOKEN] ✅ Token fetched successfully");
  return data.access_token;
};

// =====================================================
// ✅ HELPER — Send Email via Microsoft Graph
// =====================================================
const sendOutlookEmail = async ({ toEmail, toName, subject, htmlContent }) => {
  const senderEmail = process.env.MICROSOFT_SENDER_EMAIL;

  console.log("[MS-EMAIL] 📧 Sending to:", toEmail);
  console.log("[MS-EMAIL] From:", senderEmail);

  const token = await getMicrosoftToken();

  const url = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;

  const emailPayload = {
    message: {
      subject,
      body: {
        contentType: "HTML",
        content: htmlContent,
      },
      toRecipients: [
        {
          emailAddress: {
            address: toEmail,
            name: toName || toEmail,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailPayload),
  });

  console.log("[MS-EMAIL] Graph API response status:", response.status);

  const rawText = await response.text();
  console.log("[MS-EMAIL] Graph API raw response:", rawText || "(empty — 202 is success)");

  if (!response.ok) {
    let error;
    try { error = JSON.parse(rawText); } catch { error = rawText; }
    console.error("[MS-EMAIL] ❌ Graph API error:", JSON.stringify(error));
    throw new Error(error?.error?.message || "Failed to send email via Outlook");
  }

  console.log("[MS-EMAIL] ✅ Email accepted by Graph API for:", toEmail);
};

// =====================================================
// ✅ EMAIL TEMPLATE
// =====================================================
const buildEmailHTML = (username, email, password) => `
<body style="font-family:Arial;background:#f4f6f9;padding:20px;">
  <table width="600" align="center" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr>
      <td style="background:#0f172a;color:#ffffff;padding:20px;text-align:center;">
        <h2 style="margin:0;">Access Update</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:30px;">
        <p>Hello <strong>${username}</strong>,</p>
        <p>Your account has been successfully created. Below are your login details:</p>
        <table width="100%" cellpadding="10" cellspacing="0" style="background:#f1f5f9;">
          <tr><td style="font-size:14px;"><strong>Username:</strong> ${username}</td></tr>
          <tr><td style="font-size:14px;"><strong>Email:</strong> ${email}</td></tr>
          <tr><td style="font-size:14px;"><strong>Password:</strong> ${password}</td></tr>
        </table>
        <p style="margin-top:20px;">
          <a href="https://dashboard.tally-connect.com/"
             style="background:#0f172a;color:#ffffff;padding:10px 20px;text-decoration:none;display:inline-block;">
            Login Now
          </a>
        </p>
        <p style="font-size:12px;color:#888;text-align:center;">
          If you did not request this access, please contact your administrator.
        </p>
      </td>
    </tr>
    <tr>
      <td align="center" style="background:#f1f5f9;padding:15px;font-size:12px;color:#666;">
        © ${new Date().getFullYear()} Tally Connect. All rights reserved.
      </td>
    </tr>
  </table>
</body>
`;

// =====================================================
// ✅ MAIN ROUTE
// =====================================================
router.post("/", requireAuth, async (req, res) => {
  try {
    const { email, username, users } = req.body;
    const adminId = req.user?.adminId;

    console.log("[SEND-INVITE] REQ USER:", req.user);
    console.log("[SEND-INVITE] ADMIN ID:", adminId);
    console.log("[SEND-INVITE] BODY:", req.body);

    if (!adminId) {
      return res.status(400).json({ message: "Admin ID missing in token" });
    }

    // =====================================================
    // ✅ BULK MODE
    // =====================================================
    if (Array.isArray(users) && users.length > 0) {
      console.log("[SEND-INVITE] 📦 Bulk mode — total users:", users.length);

      for (const user of users) {
        try {
          const userResult = await pool.query(
            "SELECT password, username FROM users WHERE email = $1",
            [user.email]
          );

          if (userResult.rows.length === 0) {
            console.warn("[BULK] ⚠️ User not found in DB:", user.email);
            continue;
          }

          const password = userResult.rows[0].password;
          const dbUsername = userResult.rows[0].username;

          console.log("[BULK] 📤 Sending to:", user.email);

          await sendOutlookEmail({
            toEmail: user.email,
            toName: dbUsername,
            subject: "Your Account Access",
            htmlContent: buildEmailHTML(dbUsername, user.email, password),
          });

          console.log("[BULK] ✅ Sent to:", user.email);

          await notifyIfEnabled({
            type: "USER_INVITE",
            message: `Invite email sent to ${user.email}`,
            user_id: req.user.id,
          });

        } catch (bulkErr) {
          console.error("[BULK] ❌ Failed for", user.email, ":", bulkErr.message);
        }
      }

      return res.json({ success: true, bulk: true });
    }

    // =====================================================
    // ✅ SINGLE MODE
    // =====================================================
    if (!email || !username) {
      return res.status(400).json({ message: "Email and username are required" });
    }

    console.log("[SEND-INVITE] 🔍 Looking up user in DB for email:", email);

    const userResult = await pool.query(
      "SELECT password, username FROM users WHERE email = $1",
      [email]
    );

    console.log("[SEND-INVITE] DB rows found:", userResult.rows.length);

    if (userResult.rows.length === 0) {
      console.error("[SEND-INVITE] ❌ No user found in DB for email:", email);
      return res.status(404).json({ message: "User not found" });
    }

    const password = userResult.rows[0].password;
    const dbUsername = userResult.rows[0].username;

    console.log("[SEND-INVITE] ✅ User found:", dbUsername, "| hasPassword:", !!password);

    await sendOutlookEmail({
      toEmail: email,
      toName: dbUsername,
      subject: "Your Account Access",
      htmlContent: buildEmailHTML(dbUsername, email, password),
    });

    await notifyIfEnabled({
      type: "USER_INVITE",
      message: `Invite email sent to ${email}`,
      user_id: req.user.id,
    });

    return res.json({ success: true });

  } catch (err) {
    console.error("========== INVITE ERROR ==========");
    console.error("MESSAGE:", err.message);
    console.error("STACK:", err.stack);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

export default router;