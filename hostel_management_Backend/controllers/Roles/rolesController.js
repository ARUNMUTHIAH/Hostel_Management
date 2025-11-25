import { db, performQuery } from "../../config/Database.js";
import { formatDateTimeToYYYYMMDDHHMMSS, formatDateToYYYYMMDD, getCurrentISTTime, getCurrentISTDate, capitalizeFirstLetter } from "../../Utils/Datetime.js";
import { handleSequelizeError } from "../../config/validationCheck.js";

async function CheckRolePermissions(bodydata) {
    try {
        if (bodydata.permissions?.length == 0) {
            return { success: false, message: `Invalid permissions values` };
        }

        const [permissionExists] = await db.query(
            `SELECT id FROM permissions WHERE id IN (:ids)`,
            {
                replacements: { ids: bodydata.permissions },
            }
        );
        const foundIds = permissionExists.map(row => row.id);
        const missing = bodydata.permissions.filter(id => !foundIds.includes(id));

        if (missing.length > 0) {
            console.log('check error');

            return { success: false, message: `Invalid permissions values` };
        }

        return { success: true };

    } catch (err) {
        return {
            success: false,
            message: 'Failed to check permissions',
            error: err.message
        };
    }
}
export const AddRole = async (req, res) => {

    const QueryTime = await getCurrentISTTime();
    console.log('Current IST Time:', QueryTime);

    try {
        console.log('handle_ADD_TRY', QueryTime);
        let table = req.params.table;
        let bodydata = req.body.data || req.body;

        const { columns, placeholders, values, error, statusCode } = req.precheck;
        console.log('resultError', error);

        if (error) {
            return res.status(statusCode || 400).json({ status: false, message: error });
        }
        console.log('roles_add_initiated', QueryTime);

        const permissionCheck = await CheckRolePermissions(bodydata);
        if (!permissionCheck.success) {
            return res.status(400).json({
                status: false,
                message: permissionCheck.message,
            });
        }
        await db.query('START TRANSACTION');
        const trimmedValues = values.map((val, idx) => {
          if (columns[idx] === 'name' && typeof val === 'string') {
            // return val.trim();
            return capitalizeFirstLetter(val)
          }
          return val;
        });
        const roleResult = await db.query(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
            { replacements: trimmedValues }
        );
        console.log('roleResult123', roleResult);

        const roleId = roleResult[0];
        console.log(`Processing permissions for role ID: ${roleId}`);

        for (const permissionId of bodydata.permissions) {
            await db.query(
                `INSERT INTO rolepermission (role_id, permission_id) VALUES (?, ?)`,
                { replacements: [roleId, permissionId] }
            );
            console.log(`Mapped role ${roleId} to permission ${permissionId}`);
        }
        console.log('roles_add_completed', QueryTime);
        await db.query('COMMIT');
        res.status(200).json({ status: true, message: `Roles added successfully.` });



    } catch (error) {
        try { await db.query('ROLLBACK'); } catch { console.log('rollback fails') }

        console.error("Error in handleAdd:", error);
        console.log('handle_ADD_Catch', QueryTime);
        const errorFetch = handleSequelizeError(error);
        const status_code = errorFetch?.statusCode || 500
        const error_message = errorFetch?.message
        const error_status = errorFetch?.status

        res.status(status_code).json({
            status: error_status,
            message: error_message
        });
    };
};
export const UpdateRole = async (req, res) => {

    const QueryTime = await getCurrentISTTime();
    console.log('Current IST Time:', QueryTime);

    console.log('handled_updated_initiated', QueryTime);

    try {
        console.log('handled_updated_initiated1111', QueryTime);

        let table = req.params.table;
        const bodydata = req.body.data || req.body;

        console.log(' Update body received:', req.body);
        console.log(' Parsed update data:', bodydata);

        const { originaltable, error, statusCode } = req.precheck;
        console.log('resultError', error);

        if (error) {
            return res.status(statusCode || 400).json({ status: false, message: error });
        }

        console.log('updated_roles_initiated', QueryTime);
        console.log('originaltablEX', originaltable);
        const { name, status, permissions } = bodydata;
        const { id } = req.params;

        const permissionCheck = await CheckRolePermissions(bodydata);
        if (!permissionCheck.success) {
            return res.status(400).json({
                status: false,
                message: permissionCheck.message,
            });
        }
        await db.query('START TRANSACTION');

        const fields = [];
        const valuesU = [];

        if (name !== undefined) {
            fields.push("name = ?");
            const formattedName = capitalizeFirstLetter(name);
            valuesU.push(formattedName);
        }

        if (status !== undefined) {
            fields.push("status = ?");
            valuesU.push(status);
        }

        if (fields.length > 0) {
            // valuesU.push(id);
            const query = `UPDATE roles SET ${fields.join(", ")} WHERE id = ?`;
            await db.query(query, { replacements: [...valuesU, id], });
        }

        await db.query(
            `DELETE FROM rolepermission WHERE role_id = ?`,
            {
                replacements: [id]
            }
        );

        for (const permissionId of permissions) {
            await db.query(
                `INSERT INTO rolepermission (role_id, permission_id) VALUES (?, ?)`,
                {
                    replacements: [id, permissionId]
                }
            );
        }
        await db.query('COMMIT');
        console.log('updated_roles_completed', QueryTime);

        return res.status(200).json({
            status: true,
            message: 'Role and permissions updated successfully'
        });


    } catch (error) {
        try { await db.query('ROLLBACK'); } catch { console.log('rollback fails') }
        console.error(error);
        console.log('handled_updated_failed', QueryTime);

        const errorFetch = handleSequelizeError(error);
        const status_code = errorFetch?.statusCode || 500
        const error_message = errorFetch?.message
        const error_status = errorFetch?.status

        res.status(status_code).json({
            status: error_status,
            message: error_message
        });
    }
};
export const GetRoles = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  console.log('Current IST Time:', QueryTime);
  console.log('handled_get_initiated', QueryTime);

  try {

    let table = req.params.table;
    const id = req.query.id;
    const searchTerm = req.query.search || '';

    const { tableName, primaryKeyField, defaultSortField, sortField, sortOrder, usePagination, page, pageSize, offset } = req.getcheck;
    console.log('resultError',req.precheck);

    let whereConditions = [];
    let whereParams = [];

    const PageClause = usePagination == true ?  `LIMIT ${pageSize} OFFSET ${offset} `: ``;
    console.log('PageClause',PageClause);

    if (id) {
        whereConditions.push(`${primaryKeyField} = ?`);
        whereParams.push(id);
    }
    if (searchTerm) {
        whereConditions.push(`name LIKE ?`);
        whereParams.push(`%${searchTerm}%`);
    }


        
        let query = `SELECT id,name,status FROM ${tableName} `;

        if (whereConditions.length > 0) {
          query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        query += `${PageClause}`
        
        const [roles] = await db.query(query, { replacements: whereParams });
        
        const rolesWithPermissions = await Promise.all(roles.map(async (role) => {
          
          const [permissions] = await db.query(
            `SELECT p.id FROM permissions p 
            JOIN rolepermission rp ON p.id = rp.permission_id 
            WHERE rp.role_id = ?`,
            { replacements: [role.id] }
          );
          
          const permissionIds = permissions.map(p => p.id);
          
          return {
            ...role,
            permissions: permissionIds 
          };
        }));

      const [[{ total }]] = await db.query(
          `SELECT COUNT(*) as total FROM ${tableName} ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}`,
          { replacements: whereParams }
        );
      console.log('roles_list_completed', QueryTime);
        
        return res.status(200).json({
          status: true,
          issuccess: true,
          count: total,
          data: id ? rolesWithPermissions[0] : rolesWithPermissions
        });
  } catch (error) {
    console.error('Error in handleGet:', error);
    res.status(500).json({
      status: false,
      issuccess: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
export const DeleteRole = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  console.log('Current IST Time:', QueryTime);

  try {
    console.log('handle_delete_initiated', QueryTime);

    const idParam = req.params.id;
    const idArray = idParam.split(',').map(id => parseInt(id.trim(), 10)).filter(Number.isInteger);

    if (!Array.isArray(idArray) || idArray.length === 0) {
      return res.status(400).json({
        status: false,
        issuccess: false,
        message: "Invalid 'id' array provided",
        id: req.params.id
      });
    }

    const placeholders = idArray.map(() => '?').join(', ');
    const [result] = await db.query(
      `DELETE FROM roles WHERE id IN (${placeholders})`,
      { replacements: idArray }
    );

    if (!result || result.affectedRows === 0) {
      return res.status(500).json({
        status: false,
        issuccess: false,
        message: 'No matching records found.'
      });
    }

    return res.status(200).json({
      status: true,
      issuccess: true,
      message: 'Roles deleted successfully.',
      deletedCount: result.affectedRows
    });

  } catch (error) {
    console.log('handle_delete_failed', QueryTime);

    const errorFetch = handleSequelizeError(error);
    const status_code = errorFetch?.statusCode || 500
    const error_message = errorFetch?.message
    const error_status = errorFetch?.status

    res.status(status_code).json({
      status: error_status,
      message: error_message
    });

    return res.status(status_code).json({
      status: error_status,
      message: error_message,
      issuccess: false,
      id: req.params.id
    });
  }
};
