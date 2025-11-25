import jwt from 'jsonwebtoken';
import { db } from '../config/Database.js';

export const VerifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ status: false, error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    console.log('Decoded token user:', decoded);

    const roleId = decoded.roleId;
    if (!roleId) {
      return res.status(400).json({ status: false, error: 'Invalid token: roleId missing' });
    }

    const [userResult] = await db.query(
      'SELECT id FROM users WHERE id = ? LIMIT 1',
      { replacements: [decoded?.userId] }
    );

    if (userResult.length === 0) {
      return res.status(401).json({ status: false, message: "Token expired" });
    }

    const [permissionsData] = await db.query(
      `SELECT p.name
       FROM rolepermission rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ?`,
      { replacements: [roleId] }
    );

    const permissions = permissionsData.map(p => p.name);
    console.log('Fetched permissions:', permissions);

    req.user = { ...decoded, permissions, id: decoded.userId || decoded.id };

    // Route and permission mapping
    const routePath = req.baseUrl + req.path;
    const cleanPath = routePath.split('?')[0].replace(/\/+$/, '');
    console.log('Requested route path:', cleanPath);

    const permissionMap = {
      '/add_masters': 'master_add',
      '/get_masters': 'master_get',
      '/update_masters': 'master_update',
      '/delete_masters': 'master_delete'
    };

    const matched = Object.entries(permissionMap).find(([route]) =>
      cleanPath.startsWith(route)
    );

    if (matched && !permissions.includes(matched[1])) {
      return res.status(403).json({ status: false, error: 'Access denied. No permission.' });
    }

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({
      status: false,
      error: "Token verification failed",
      message: error.message
    });
  }
};

export const APIPermission = (permissionId) => {
  return async (req, res, next) => {
    try {
      const roleId = req.user.roleId;

      const [permissionCheck] = await db.query(`
        SELECT p.permission_id, p.name as permission_name
        FROM rolepermission as rp
        LEFT JOIN permissions as p ON (p.id = rp.permission_id) 
        WHERE rp.role_id = '${roleId}' AND p.status = 1
      `);

      const permission_name = permissionCheck.map(i => i.permission_name)
      const permission_id = permissionCheck.map(i => i.permission_id)
      console.log('permission_name',permission_name);
      console.log('permission_id',permission_id);
      
      const PermissionArray = [permissionId];
      const commonValues = PermissionArray.filter(value => permission_id.includes(value));
      console.log('commonValues',commonValues);
      console.log('permissionId',permissionId);

      if (commonValues.length == 0) {
        return res.status(400).json({ status: false, error: 'Access denied', message: 'Access denied' });
      }
      
      if (!permissionId) {
        return res.status(400).json({ status: false, error: 'Invalid permission ID', message: 'Invalid permission ID' });
      }

      const [permissionsNameCheck] = await db.query(`
        SELECT rp.*, p.name as permission_name 
        FROM rolepermission as rp
        LEFT JOIN permissions as p ON (p.id = rp.permission_id) 
        WHERE rp.role_id = '${roleId}' AND (p.name = '${permissionId}' OR rp.permission_id = '${permissionId}')
      `);
      
      console.log('permissionID',permissionsNameCheck);

      const permissionID = permissionsNameCheck[0]?.permission_id || 0
      console.log('permissionID',permissionID);

      next();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, error: err.message || 'Internal server error' });
    }
  };
};


