import { Request, Response, NextFunction } from 'express';
import logger from 'utils/logger';

// Extend Express Request type to include tenantId
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

const tenantAuth = (req: Request, res: Response, next: NextFunction) => {
  // Placeholder for tenant authentication/identification logic
  // This logic would typically:
  // 1. Extract tenant identifier from the request (e.g., JWT, API key, custom header)
  // 2. Validate the tenant identifier
  // 3. Attach tenantId to the request object for downstream use

  const extractedTenantId = req.headers['x-tenant-id'] as string; // Example: using a custom header

  if (!extractedTenantId) {
    logger.warn('Tenant ID not found in request headers (x-tenant-id).');
    // Depending on the strictness required, you might deny the request:
    // return res.status(401).json({ message: 'Unauthorized: Tenant ID missing.' });
    // For now, we'll allow it to proceed for development flexibility
  } else {
    req.tenantId = extractedTenantId;
    logger.debug({ tenantId: req.tenantId }, 'Tenant ID attached to request.');
  }

  next();
};

export default tenantAuth;