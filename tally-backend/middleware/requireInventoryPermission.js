import pool from "../db.js";

export default async function requireInventoryPermission(req, res, next) {
  try {
    if (req.user.role === "ADMIN") return next();

    const result = await pool.query(
      `SELECT inventory_permissions FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ message: "Invalid user" });
    }

    const perms = result.rows[0].inventory_permissions || {};

    if (perms.can_view === false) {
      return res.status(403).json({ message: "Inventory access denied" });
    }

    // ✅ attach to req.user (important)
    req.user.inventoryPermissions = perms;

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Permission check failed" });
  }
}
