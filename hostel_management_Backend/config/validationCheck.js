export const validateLocationLevels = async (
  existingLocData,
  requiredLocationLevels,
  db
) => {
  const validations = await Promise.all(
    existingLocData.map(async (locId, index) => {
      const gmaster_id = requiredLocationLevels[index];
      const [[result]] = await db.query(
        `SELECT id FROM gmastervalue WHERE id = ? AND gmaster_id = ?`,
        { replacements: [locId, gmaster_id] }
      );
      return result?.id !== undefined;
    })
  );

  return validations.every((valid) => valid === true);
};
export const handleSequelizeError = (error) => {
  // Handle UNIQUE constraint
  if (
    error.name === "SequelizeUniqueConstraintError" ||
    error.code === "ER_DUP_ENTRY"
  ) {
    const text = error.sqlMessage || error.message || "";

    // Extract duplicate value
    const value =
      text.match(/Duplicate entry '(.+?)'/)?.[1] ||
      error.parent?.sqlMessage?.match(/Duplicate entry '(.+?)'/)?.[1] ||
      "";

    // Try direct Sequelize fields
    let field = "";
    if (error.fields && Object.keys(error.fields).length > 0) {
      field = Object.keys(error.fields)[0];
    }

    // Try extracting key from SQL text
    if (!field) {
      field = text.match(/for key '(.+?)'/)?.[1] || "";
    }

    // If MySQL returns PRIMARY, map to correct field
    if (field.toLowerCase() === "primary") {
      field = "memberid"; // change if your PK is different
    }

    // Clean constraint suffix/prefix
    field = field
      .replace(/^unique_/i, "")
      .replace(/_unique$/i, "")
      .replace(/_idx$/i, "")
      .replace(/^ux_/i, "")
      .replace(/^uk_/i, "")
      .replace(/.*\./, "")
      .trim();

    // Fallback if field still blank — detect from message
    if (!field) {
      if (/memberid/i.test(text)) field = "memberid";
      else if (/mobile/i.test(text)) field = "mobile";
      else if (/email/i.test(text)) field = "email";
      else if (/parentcontact/i.test(text)) field = "parentcontact";
      else field = "field";
    }

    return {
      statusCode: 400,
      status: false,
      message: `Duplicate ${field}: '${value}'`,
    };
  }

  // Handle FOREIGN KEY constraints
  if (
    error.name === "SequelizeForeignKeyConstraintError" ||
    error.code === "ER_NO_REFERENCED_ROW_2"
  ) {
    const field =
      (error.fields && Object.keys(error.fields)[0]) || "reference ID";

    return {
      statusCode: 400,
      status: false,
      message: `Foreign key error: Invalid ${field}`,
    };
  }

  // Default error
  return {
    statusCode: 500,
    status: false,
    message: error.message || "Internal Server Error",
  };
};
