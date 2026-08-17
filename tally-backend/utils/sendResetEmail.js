import axios from "axios";
import qs from "qs";

/* ================= GET ACCESS TOKEN ================= */
const getAccessToken = async () => {
  const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID;
  const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
  const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;

  const url = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

  const data = qs.stringify({
    client_id: MICROSOFT_CLIENT_ID,
    scope: "https://graph.microsoft.com/.default",
    client_secret: MICROSOFT_CLIENT_SECRET,
    grant_type: "client_credentials",
  });

  const res = await axios.post(url, data, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  return res.data.access_token;
};

/* ================= SEND EMAIL ================= */
export const sendResetEmail = async (toEmail, otp) => {
  try {
    const MICROSOFT_SENDER_EMAIL = process.env.MICROSOFT_SENDER_EMAIL;

    const accessToken = await getAccessToken();

    const emailHTML = `
<div style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        
        <table width="420" cellpadding="0" cellspacing="0" style="
          background:#ffffff;
          border-radius:12px;
          box-shadow:0 10px 30px rgba(0,0,0,0.08);
          overflow:hidden;
        ">
          
          <!-- Header -->
          <tr>
            <td style="
              background:linear-gradient(135deg,#2563eb,#1e40af);
              padding:20px;
              text-align:center;
              color:#ffffff;
              font-size:20px;
              font-weight:bold;
              letter-spacing:1px;
            ">
              Tally Connect
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px;text-align:center;color:#333;">
              
              <h2 style="margin:0 0 10px 0;">Password Reset</h2>
              
              <p style="margin:0 0 20px 0;color:#666;font-size:14px;">
                Use the OTP below to reset your password
              </p>

              <!-- OTP Box -->
              <div style="
                font-size:36px;
                letter-spacing:10px;
                font-weight:bold;
                color:#2563eb;
                background:#f1f5f9;
                padding:15px 25px;
                border-radius:10px;
                display:inline-block;
                margin:20px 0;
              ">
                ${otp}
              </div>

              <p style="margin-top:10px;color:#888;font-size:13px;">
                This OTP is valid for <b>10 minutes</b>.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="
              padding:20px;
              text-align:center;
              font-size:12px;
              color:#999;
              border-top:1px solid #eee;
            ">
              If you didn’t request this, please ignore this email.<br/>
              © ${new Date().getFullYear()} Tally Connect
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</div>
`;

    const emailData = {
      message: {
        subject: "Your Password Reset OTP",
        body: {
          contentType: "HTML",
          content: emailHTML,
        },
        toRecipients: [
          {
            emailAddress: {
              address: toEmail,
            },
          },
        ],
      },
      saveToSentItems: false,
    };

    await axios.post(
      `https://graph.microsoft.com/v1.0/users/${MICROSOFT_SENDER_EMAIL}/sendMail`,
      emailData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error(
      "Microsoft Graph Email Error:",
      error.response?.data || error.message
    );
    throw new Error("Failed to send OTP email");
  }
};