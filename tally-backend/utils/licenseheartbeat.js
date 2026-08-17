

export async function sendHeartbeat({
  licenseId,
  adminId,
  features,
}) {
  try {
    const res = await fetch(
      `https://dashboard.licentic.org/api/heartbeat/${licenseId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.LICENSE_INTERNAL_KEY,
        },
        body: JSON.stringify({
          userId: adminId,
          features,
        }),
      }
    );

    const data = await res.json();

    console.log("✅ Heartbeat sent:", data);
  } catch (err) {
    console.error("❌ Heartbeat failed:", err.message);
  }
}

