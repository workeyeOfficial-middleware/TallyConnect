import pool from "../db.js";

export const createNotification = async ({
  type,
  message,
  user_id,
  meta = null, // ⭐ optional
}) => {
  await pool.query(
    `INSERT INTO notifications (type, message, user_id, meta)
     VALUES ($1, $2, $3, $4)`,
    [type, message, user_id, meta]
  );
};



