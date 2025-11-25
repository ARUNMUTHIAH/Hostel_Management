import { formatDateToYYYYMMDD, formatDateTimeToYYYYMMDDHHMMSS } from '../../Utils/Datetime.js';
import moment from 'moment-timezone';
import bcrypt from 'bcrypt';
import jwt from "jsonwebtoken";
import { db } from '../../config/Database.js';
import { performQuery } from '../../config/Database.js';
import { decryptData } from "../../config/encryptData.js";

export const login = async (req, res) => {
  await db.query("SET sql_mode = (SELECT REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', ''))");
  await db.query("SET time_zone = '+05:30'"); // For IST (India Standard Time)

  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.status(401).send({
        status: false,
        message: `${!username && !password ? 'Both Username and Password required' : (username == null ? 'Username required' : 'Password required')}`
      });
    }

    // Query to get user data
    const thisQuery = `SELECT 
      us.id as id,
      us.role_id as role_id,
      us.password as password,
      us.username as username,
      r1.name as role_name,
        GROUP_CONCAT(DISTINCT per.name) as permission_names,
        GROUP_CONCAT(DISTINCT per.id) as permission_ids
      FROM users as us 
      INNER JOIN roles as r1 ON r1.id = us.role_id
      INNER JOIN rolepermission as rp ON rp.role_id = us.role_id
      INNER JOIN permissions as per ON per.id = rp.permission_id
      WHERE BINARY us.username = ? 
      AND us.status != 0
GROUP BY us.id;
`;


    const [rows] = await db.query(thisQuery, { replacements: [username] });
    const data = rows[0];
    await db.query('START TRANSACTION');

    // If no user found or password doesn't match
    if (!data || !(await bcrypt.compare(password, data.password))) {
      // Log failed attempt if user exists
      if (data) {
        await db.query(
          `INSERT INTO userslog (user_id, username, login_time, status) VALUES (?, ?, NOW(), 'fail')`,
          { replacements: [data.id, data.username] }
        );
      }

      return res.status(401).send({
        status: false,
        message: "Invalid login credentials!!!"
      });
    }

    // Log successful login
    await db.query(
      `INSERT INTO userslog (user_id, username, login_time, status) VALUES (?, ?, NOW(), 'success')`,
      { replacements: [data.id, data.username] }
    );

    // Generate token
    const accessToken = jwt.sign({
      roleId: data.role_id,
      userId: data.id,
      role_name: data.role_name,
      Username: data.username,
    }, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = jwt.sign({
      role_id: data.role_id,
      role_name: data.role_name,
      Username: data.username,

    }, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    });

    const permission = [];
    if (data.permission_ids && data.permission_names) {
      const permissionIds = data.permission_ids.split(',');
      const permissionNames = data.permission_names.split(',');

      for (let index = 0; index < permissionIds.length; index++) {
        permission.push({
          id: parseInt(permissionIds[index]),
          name: permissionNames[index]
        });
      }
    }

    const sidebarQuery = `
      SELECT DISTINCT s.id, s.name, s.path, s.icon , s.permission , s.parent_permission
      FROM sidebar s
      INNER JOIN rolepermission rp ON s.permission = rp.permission_id
      WHERE s.status = 1 
      AND rp.role_id = ?
      ORDER BY s.id;
    `;

    const [sidebarRows] = await db.query(sidebarQuery, {
      replacements: [data.role_id, data.role_id]
    });

    console.log('User Role ID:', data.role_id);
    console.log('User Permissions:', permission.map(p => p.name));
    console.log('Sidebar Items:', sidebarRows.length);

    if (!sidebarRows || sidebarRows.length === 0) {
      return res.status(404).send({
        status: false,
        message: "No sidebar items found for this user's permissions."
      });
    }

    await db.query("COMMIT");

    return res.status(200).json({
      issuccess: true,
      status: true,
      message: "Login successfully!!!",
      role_name: data.role_name,
      Username: data.username,
      accessToken: accessToken,
      refreshToken: refreshToken,
      permissions: permission,
      sidebar: sidebarRows,
    });

  } catch (error) {
    try { await db.query('ROLLBACK'); } catch { console.log('rollback fails') }
    console.error("Login error:", error);
    return res.status(401).send({
      status: false,
      message: "Invalid login credentials!!!"
    });
  }
};