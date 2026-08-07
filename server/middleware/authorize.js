/**
 * Role-Based Access Control (RBAC) Middleware
 * Verifies if the authenticated user possesses one of the required roles (USER, ADMIN, SUPER_ADMIN)
 */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access.'
      });
    }

    const userRole = req.user.role || 'USER';
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${userRole}' does not have sufficient permissions.`
      });
    }

    next();
  };
}
