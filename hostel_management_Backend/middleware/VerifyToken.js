import jwt from "jsonwebtoken";

export const VerifyToken1 = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      status: false,
      message: "Access denied. No token provided.",
    });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        status: false,
        message: "Invalid or expired token.",
      });
    }

    req.user = {
      userId: decoded.userId,
      roleId: decoded.roleId,
      role_name: decoded.role_name,
      Username: decoded.Username,
    };

    next();
  });
};
