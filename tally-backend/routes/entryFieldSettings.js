import express from "express";
import pool from "../db.js";

const router = express.Router();

const STANDARD_FIELDS = {
  SALES: [
    "due_date",
    "hsn_sac",
    "discount",
    "gst",
    "reference_no",
    "sales_person",
    "bank_payment_details",
  ],

  PURCHASE: [
    "due_date",
    "hsn_sac",
    "discount",
    "gst",
    "reference_no",
    "bank_payment_details",
    "bill_allocation",
  ],

  RECEIPT: [
    "reference_no",
    "instrument_cheque_no",
    "deposit_to_account",
    "bill_allocation",
    "narration",
  ],

  PAYMENT: [
    "reference_no",
    "transaction_utr_cheque_no",
    "bank_account_details",
    "bill_allocation",
    "narration",
  ],

  JOURNAL: [
    "reference_no",
    "bill_allocation",
    "narration",
  ],
};

const ALLOWED_VOUCHER_TYPES = Object.keys(STANDARD_FIELDS);

/*
 * GET
 * /entry-field-settings/:voucherType
 *
 * Returns:
 * 1. Standard field settings
 * 2. Custom fields
 */
router.get("/:voucherType", async (req, res) => {
  try {
    const userId = req.user.id;
    const voucherType = req.params.voucherType.toUpperCase();

    if (!ALLOWED_VOUCHER_TYPES.includes(voucherType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid voucher type",
      });
    }

    // Get logged-in user's admin
    const userResult = await pool.query(
      `
      SELECT
        id,
        COALESCE(admin_id, id) AS admin_id
      FROM public.users
      WHERE id = $1
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const adminId = userResult.rows[0].admin_id;

    // Get active company
    const companyResult = await pool.query(
      `
      SELECT company_guid
      FROM public.active_company
      WHERE admin_id = $1
      `,
      [adminId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No active company selected",
      });
    }

    const companyGuid = companyResult.rows[0].company_guid;

    // -----------------------------------------
    // STANDARD FIELD SETTINGS
    // -----------------------------------------

    const settingsResult = await pool.query(
      `
      SELECT
        field_key,
        enabled
      FROM public.user_entry_field_settings
      WHERE user_id = $1
        AND admin_id = $2
        AND company_guid = $3
        AND voucher_type = $4
      `,
      [userId, adminId, companyGuid, voucherType]
    );

    // By default, standard fields are enabled
    const standardFields = {};

    STANDARD_FIELDS[voucherType].forEach((fieldKey) => {
      standardFields[fieldKey] = true;
    });

    // Apply saved settings
    settingsResult.rows.forEach((row) => {
      standardFields[row.field_key] = row.enabled;
    });

    // -----------------------------------------
    // CUSTOM FIELDS
    // -----------------------------------------

    const customFieldsResult = await pool.query(
      `
      SELECT
        id,
        field_key,
        field_name,
        field_type,
        options,
        enabled,
        created_at,
        updated_at
      FROM public.user_entry_custom_fields
      WHERE user_id = $1
        AND admin_id = $2
        AND company_guid = $3
        AND voucher_type = $4
      ORDER BY id ASC
      `,
      [userId, adminId, companyGuid, voucherType]
    );

    return res.json({
      success: true,

      voucherType,

      // Standard ON/OFF settings
      fields: standardFields,

      // Custom fields created by this user
      customFields: customFieldsResult.rows,
    });
  } catch (error) {
    console.error("GET entry field settings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch entry field settings",
      error: error.message,
    });
  }
});


/*
 * PUT
 * /entry-field-settings/:voucherType
 *
 * Saves standard field ON/OFF settings.
 */
router.put("/:voucherType", async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const voucherType = req.params.voucherType.toUpperCase();
    const fields = req.body.fields;

    if (!ALLOWED_VOUCHER_TYPES.includes(voucherType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid voucher type",
      });
    }

    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      return res.status(400).json({
        success: false,
        message: "fields object is required",
      });
    }

    // Validate field keys BEFORE starting transaction
    for (const [fieldKey, enabled] of Object.entries(fields)) {
      if (!STANDARD_FIELDS[voucherType].includes(fieldKey)) {
        return res.status(400).json({
          success: false,
          message: `Invalid field key '${fieldKey}' for ${voucherType}`,
        });
      }

      if (typeof enabled !== "boolean") {
        return res.status(400).json({
          success: false,
          message: `Value for '${fieldKey}' must be boolean`,
        });
      }
    }

    // Get user/admin
    const userResult = await client.query(
      `
      SELECT
        id,
        COALESCE(admin_id, id) AS admin_id
      FROM public.users
      WHERE id = $1
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const adminId = userResult.rows[0].admin_id;

    // Get active company
    const companyResult = await client.query(
      `
      SELECT company_guid
      FROM public.active_company
      WHERE admin_id = $1
      `,
      [adminId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No active company selected",
      });
    }

    const companyGuid = companyResult.rows[0].company_guid;

    await client.query("BEGIN");

    for (const [fieldKey, enabled] of Object.entries(fields)) {
      await client.query(
        `
        INSERT INTO public.user_entry_field_settings
        (
          user_id,
          admin_id,
          company_guid,
          voucher_type,
          field_key,
          enabled,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())

        ON CONFLICT
        (
          user_id,
          company_guid,
          voucher_type,
          field_key
        )
        DO UPDATE SET
          enabled = EXCLUDED.enabled,
          updated_at = NOW()
        `,
        [
          userId,
          adminId,
          companyGuid,
          voucherType,
          fieldKey,
          enabled,
        ]
      );
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Entry field settings saved successfully",
      voucherType,
      fields,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // Ignore rollback error
    }

    console.error("PUT entry field settings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save entry field settings",
      error: error.message,
    });
  } finally {
    client.release();
  }
});


/*
 * POST
 * /entry-field-settings/:voucherType/custom
 *
 * Creates a custom field.
 */
router.post("/:voucherType/custom", async (req, res) => {
  try {
    const userId = req.user.id;
    const voucherType = req.params.voucherType.toUpperCase();

    const {
      fieldKey,
      fieldName,
      fieldType,
      options = [],
    } = req.body;

    if (!ALLOWED_VOUCHER_TYPES.includes(voucherType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid voucher type",
      });
    }

    if (!fieldName || !fieldType) {
      return res.status(400).json({
        success: false,
        message: "fieldName and fieldType are required",
      });
    }

    // Get user/admin
    const userResult = await pool.query(
      `
      SELECT
        id,
        COALESCE(admin_id, id) AS admin_id
      FROM public.users
      WHERE id = $1
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const adminId = userResult.rows[0].admin_id;

    // Get active company
    const companyResult = await pool.query(
      `
      SELECT company_guid
      FROM public.active_company
      WHERE admin_id = $1
      `,
      [adminId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No active company selected",
      });
    }

    const companyGuid = companyResult.rows[0].company_guid;

    // Generate field key if Android doesn't provide one
    const finalFieldKey =
      fieldKey ||
      `custom_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)}`;

    const result = await pool.query(
      `
      INSERT INTO public.user_entry_custom_fields
      (
        user_id,
        admin_id,
        company_guid,
        voucher_type,
        field_key,
        field_name,
        field_type,
        options,
        enabled,
        created_at,
        updated_at
      )
      VALUES
      (
        $1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW()
      )
      RETURNING *
      `,
      [
        userId,
        adminId,
        companyGuid,
        voucherType,
        finalFieldKey,
        fieldName,
        fieldType,
        JSON.stringify(options),
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Custom field created successfully",
      customField: result.rows[0],
    });
  } catch (error) {
    console.error("POST custom field error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create custom field",
      error: error.message,
    });
  }
});


/*
 * PATCH
 * /entry-field-settings/:voucherType/custom/:fieldKey
 *
 * Enables/disables a custom field.
 */
router.patch("/:voucherType/custom/:fieldKey", async (req, res) => {
  try {
    const userId = req.user.id;
    const voucherType = req.params.voucherType.toUpperCase();
    const fieldKey = req.params.fieldKey;
    const { enabled } = req.body;

    if (!ALLOWED_VOUCHER_TYPES.includes(voucherType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid voucher type",
      });
    }

    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "enabled must be boolean",
      });
    }

    const result = await pool.query(
      `
      UPDATE public.user_entry_custom_fields
      SET
        enabled = $1,
        updated_at = NOW()
      WHERE user_id = $2
        AND voucher_type = $3
        AND field_key = $4
      RETURNING *
      `,
      [enabled, userId, voucherType, fieldKey]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Custom field not found",
      });
    }

    return res.json({
      success: true,
      message: "Custom field setting updated successfully",
      customField: result.rows[0],
    });
  } catch (error) {
    console.error("PATCH custom field error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update custom field",
      error: error.message,
    });
  }
});


/*
 * DELETE
 * /entry-field-settings/:voucherType/custom/:fieldKey
 *
 * Deletes a custom field.
 */
router.delete("/:voucherType/custom/:fieldKey", async (req, res) => {
  try {
    const userId = req.user.id;
    const voucherType = req.params.voucherType.toUpperCase();
    const fieldKey = req.params.fieldKey;

    const result = await pool.query(
      `
      DELETE FROM public.user_entry_custom_fields
      WHERE user_id = $1
        AND voucher_type = $2
        AND field_key = $3
      RETURNING *
      `,
      [userId, voucherType, fieldKey]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Custom field not found",
      });
    }

    return res.json({
      success: true,
      message: "Custom field deleted successfully",
      customField: result.rows[0],
    });
  } catch (error) {
    console.error("DELETE custom field error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete custom field",
      error: error.message,
    });
  }
});


export default router;