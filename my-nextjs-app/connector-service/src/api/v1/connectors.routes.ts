import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { connectorManager } from 'core/ConnectorManager';
import logger from 'utils/logger';
import {
  TestConnectionResponse,
  FetchDataQuery,
  FetchDataResponse,
  PerformActionRequest,
  PerformActionResponse,
} from 'types/api.types';

const router = Router();

// Middleware to ensure tenantId is present (from tenantAuth middleware)
// and connectorId is a valid UUID from path params.
const ensureTenantAndConnectorId = (req: Request, res: Response, next: NextFunction) => {
  const tenantId = req.tenantId; // Assumes tenantAuth middleware has set this
  const { connectorId } = req.params;

  if (!tenantId) {
    logger.warn({ path: req.path, connectorId }, 'Tenant ID missing from request context (req.tenantId). Ensure tenantAuth middleware runs first.');
    res.status(401).json({ message: 'Unauthorized: Tenant context is missing.' });
    return;
  }
  if (!connectorId || !z.string().uuid().safeParse(connectorId).success) {
    logger.warn({ path: req.path, connectorIdParam: req.params.connectorId }, 'Invalid or missing connector ID in path.');
    res.status(400).json({ message: 'Invalid or missing connector ID.' });
    return;
  }
  // Attach to req.params for consistent access in handlers
  req.params.validatedTenantId = tenantId;
  req.params.validatedConnectorId = connectorId;
  next();
};

// POST /connectors/{connectorId}/test-connection
router.post('/:connectorId/test-connection', ensureTenantAndConnectorId, async (req: Request, res: Response<TestConnectionResponse | { message: string }>, next: NextFunction): Promise<void> => {
  const { validatedConnectorId, validatedTenantId } = req.params;
  try {
    logger.info({ connectorId: validatedConnectorId, tenantId: validatedTenantId }, 'Attempting to test connection.');
    const result = await connectorManager.testConnector(validatedConnectorId, validatedTenantId);
    res.status(result.status === 'success' ? 200 : 400).json(result); // Or 500 for some failures
    return;
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack, connectorId: validatedConnectorId, tenantId: validatedTenantId }, 'Error testing connector connection');
    // Pass to generic error handler, which will decide the status code
    next(error); 
  }
});

// GET /connectors/{connectorId}/data
const fetchDataQuerySchema = z.object({
  resource_path: z.string().min(1, "resource_path is required"),
  // Allow other dynamic query params by not strictly validating them here,
  // they will be passed through to the external service.
}).passthrough(); // .passthrough() allows unknown keys

router.get('/:connectorId/data', ensureTenantAndConnectorId, async (req: Request, res: Response<FetchDataResponse | { message: string }>, next: NextFunction): Promise<void> => {
  const { validatedConnectorId, validatedTenantId } = req.params;
  try {
    const validatedQuery = fetchDataQuerySchema.parse(req.query);
    const { resource_path, ...otherQueryParams } = validatedQuery;

    logger.info({ connectorId: validatedConnectorId, tenantId: validatedTenantId, resource_path }, 'Attempting to fetch data.');

    const response = await connectorManager.makeRequest(
      validatedConnectorId,
      validatedTenantId,
      {
        method: 'GET',
        url: resource_path, // This is relative to the service's base URL if any
        params: otherQueryParams,
      }
    );

    res.status(response.status).json({
      data: response.data,
      source_metadata: {
        request_url: response.config.url, // This might be the full URL if baseURL was set
        status_code: response.status,
        // Potentially add response headers if needed: response.headers
      }
    });
    return;

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn({ errors: error.errors, connectorId: validatedConnectorId, tenantId: validatedTenantId }, 'Validation error fetching data');
      res.status(400).json({ message: 'Validation failed', ...error.format() });
      return;
    }
    logger.error({ error: error.isAxiosError ? error.toJSON() : error.message, connectorId: validatedConnectorId, tenantId: validatedTenantId }, 'Error fetching data from connector');
    // If it's an Axios error, the status code from the external service might be relevant
    if (error.isAxiosError && error.response) {
      res.status(error.response.status).json({ message: error.response.data?.message || error.message, data: error.response.data });
      return;
    }
    next(error); // Pass to generic error handler
  }
});

// POST /connectors/{connectorId}/actions
const performActionSchema = z.object({
  action_name: z.string().min(1, "action_name is required"),
  payload: z.any().optional(),
  resource_path: z.string().optional(), // e.g. /issues for create_issue
  method: z.enum(['POST', 'PUT', 'DELETE', 'PATCH', 'GET']).optional().default('POST'),
});

router.post('/:connectorId/actions', ensureTenantAndConnectorId, async (req: Request, res: Response<PerformActionResponse | { message: string }>, next: NextFunction): Promise<void> => {
  const { validatedConnectorId, validatedTenantId } = req.params;
  try {
    const validatedBody = performActionSchema.parse(req.body);
    const { action_name, payload, resource_path, method } = validatedBody;

    logger.info({ connectorId: validatedConnectorId, tenantId: validatedTenantId, action_name, resource_path, method }, 'Attempting to perform action.');

    // The resource_path for an action might be fixed or dynamic based on action_name
    // This is a generic handler; specific services might have more structured ways to define actions.
    const targetUrl = resource_path || `/actions/${action_name}`; // Example default

    const response = await connectorManager.makeRequest(
      validatedConnectorId,
      validatedTenantId,
      {
        method: method,
        url: targetUrl,
        data: payload,
      }
    );
    
    res.status(response.status).json({
        status: 'success',
        result: response.data,
        message: `Action '${action_name}' performed successfully.`
    });
    return;

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn({ errors: error.errors, connectorId: validatedConnectorId, tenantId: validatedTenantId }, 'Validation error performing action');
      res.status(400).json({ message: 'Validation failed', ...error.format() });
      return;
    }
    logger.error({ error: error.isAxiosError ? error.toJSON() : error.message, connectorId: validatedConnectorId, tenantId: validatedTenantId }, 'Error performing action via connector');
    if (error.isAxiosError && error.response) {
      res.status(error.response.status).json({ status: 'failure', message: error.response.data?.message || error.message, result: error.response.data });
      return;
    }
    next(error);
  }
});


export default router;