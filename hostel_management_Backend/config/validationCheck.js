
export const validateLocationLevels = async (existingLocData, requiredLocationLevels, db) => {
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

  return validations.every(valid => valid === true);
}
export const handleSequelizeError = (error) => {
  if (error.name === 'SequelizeUniqueConstraintError' || error.code === 'ER_DUP_ENTRY') {
    const match = error.message.match(/Duplicate entry '(.+)' for key '(.+)'/);
    const value = match ? match[1] : 'unknown';
    const field = match ? match[2].replace(/.*\./, '') : 'field';

    return {
      statusCode: 400,
      status: false,
      message: `Duplicate entry for ${field}: '${value}'`
    };
  }

  if (error.name === 'SequelizeForeignKeyConstraintError' || error.code === 'ER_NO_REFERENCED_ROW_2') {
    const field = error.fields?.[0] || 'reference ID';

    return {
      statusCode: 400,
      status: false,
      message: `Foreign key error: Invalid ${field}`
    };
  }

  return {
    statusCode: 500,
    status: false,
    message: error.message || 'Internal Server Error',
  };
};
