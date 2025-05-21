import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { connectorRepository } from 'db/repositories/ConnectorRepository';
import logger from 'utils/logger';
import {
  CreateConnectorConfigRequest,
  CreateConnectorConfigResponse,
  ListConnectorConfigsQuery,
  ListConnectorConfigsPaginatedResponse,
  ListConnectorConfigsResponseItem,
  GetConnectorConfigResponse,
  UpdateConnectorConfigRequest,
  UpdateConnectorConfigResponse,
} from 'types/api.types';
import { CreateIntegrationConnectorDTO, UpdateIntegrationConnectorDTO } from 'types/connector.types';

const router = Router();

// --- Zod Schemas for Validation ---
const baseConnectorSchema = z.object({
  connector_name: z.string().min(1, "Connector name is required"),
  service_name: z.string().min(1, "Service name is required"),
  auth_type: z.enum(['oauth2', 'apikey', 'basic', 'custom']),
  auth_config: z.record(z.any(), { description: "Auth configuration object" }),
  api_spec: z.record(z.any()).optional(),
  scopes: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  is_active: z.boolean().optional(),
});

const createConnectorSchema = baseConnectorSchema.extend({
  tenant_id: z.string().uuid("Invalid Tenant ID format"), // Assuming tenant_id comes in the body for creation
});

const updateConnectorSchema = baseConnectorSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" }
);

const listConnectorsQuerySchema = z.object({
  tenant_id: z.string().uuid("Tenant ID is required and must be a valid UUID in query parameters."), // Or from req.tenantId if middleware sets it
  service_name: z.string().optional(),
  is_active: z.string().transform(val => val === 'true' ? true : (val === 'false' ? false : undefined)).optional(),
  limit: z.coerce.number().int().positive().optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

// Middleware to ensure tenantId is present (either from body or authenticated context)
const ensureTenantId = (req: Request, res: Response, next: NextFunction) => {
  // Prefer tenantId from authenticated context if available (set by tenantAuth middleware)
  const tenantId = req.tenantId || req.body?.tenant_id || req.query?.tenant_id;
  if (!tenantId || typeof tenantId !== 'string' || !z.string().uuid().safeParse(tenantId).success) {
    logger.warn({ bodyTenant: req.body?.tenant_id, queryTenant: req.query?.tenant_id, pathTenant: req.tenantId }, 'Tenant ID is missing or invalid');
    res.status(400).json({ message: 'Tenant ID is missing or invalid.' });
    return;
  }
  // Standardize where tenantId is accessed from for handlers
  req.params.tenantIdFromMiddleware = tenantId; // Use req.params as a common place
  next();
};


// POST /configurations - Create a new connector configuration
router.post('/', ensureTenantId, async (req: Request, res: Response<CreateConnectorConfigResponse | { message: string }>, next: NextFunction): Promise<void> => {
  try {
    const validatedBody = createConnectorSchema.parse({ ...req.body, tenant_id: req.params.tenantIdFromMiddleware });
    const createDto: CreateIntegrationConnectorDTO = {
        ...validatedBody,
        // tenant_id is already in validatedBody from ensureTenantId logic
    };

    const newConnector = await connectorRepository.create(createDto);
    if (!newConnector) {
      res.status(500).json({ message: 'Failed to create connector configuration.' });
      return;
    }
    logger.info({ connectorId: newConnector.id, tenantId: newConnector.tenant_id }, 'Connector configuration created');
    res.status(201).json(newConnector);
    return;
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn({ errors: error.errors }, 'Validation error creating connector config');
      res.status(400).json({ message: 'Validation failed', ...error.format() });
      return;
    }
    logger.error({ error: error.message, stack: error.stack }, 'Error creating connector configuration');
    next(error);
  }
});

// GET /configurations - List all connector configurations for a tenant
router.get('/', ensureTenantId, async (req: Request, res: Response<ListConnectorConfigsPaginatedResponse | { message: string }>, next: NextFunction): Promise<void> => {
  try {
    const validatedQuery = listConnectorsQuerySchema.parse({ ...req.query, tenant_id: req.params.tenantIdFromMiddleware });
    
    const { data, count } = await connectorRepository.findAll(validatedQuery);
    
    const responseItems: ListConnectorConfigsResponseItem[] = data.map(c => ({
        id: c.id,
        connector_name: c.connector_name,
        service_name: c.service_name,
        auth_type: c.auth_type,
        is_active: c.is_active,
        created_at: c.created_at,
        updated_at: c.updated_at,
    }));

    res.status(200).json({
      data: responseItems,
      pagination: {
        offset: validatedQuery.offset,
        limit: validatedQuery.limit,
        total: count || 0,
      },
    });
    return;
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn({ errors: error.errors }, 'Validation error listing connector configs');
      res.status(400).json({ message: 'Validation failed', ...error.format() });
      return;
    }
    logger.error({ error: error.message, stack: error.stack }, 'Error listing connector configurations');
    next(error);
  }
});

// GET /configurations/{connectorId} - Get a specific connector configuration
router.get('/:connectorId', ensureTenantId, async (req: Request, res: Response<GetConnectorConfigResponse | { message: string }>, next: NextFunction): Promise<void> => {
  try {
    const { connectorId } = req.params;
    const tenantId = req.params.tenantIdFromMiddleware;

    if (!z.string().uuid().safeParse(connectorId).success) {
        res.status(400).json({ message: 'Invalid connector ID format.' });
        return;
    }

    const connector = await connectorRepository.findById(connectorId, tenantId);
    if (!connector) {
      res.status(404).json({ message: 'Connector configuration not found.' });
      return;
    }
    res.status(200).json(connector);
    return;
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack, connectorId: req.params.connectorId }, 'Error fetching connector configuration');
    next(error);
  }
});

// PUT /configurations/{connectorId} - Update an existing connector configuration
router.put('/:connectorId', ensureTenantId, async (req: Request, res: Response<UpdateConnectorConfigResponse | { message: string }>, next: NextFunction): Promise<void> => {
  try {
    const { connectorId } = req.params;
    const tenantId = req.params.tenantIdFromMiddleware;

    if (!z.string().uuid().safeParse(connectorId).success) {
        res.status(400).json({ message: 'Invalid connector ID format.' });
        return;
    }
    
    const validatedBody = updateConnectorSchema.parse(req.body);
    const updateDto: UpdateIntegrationConnectorDTO = validatedBody;

    const updatedConnector = await connectorRepository.update(connectorId, tenantId, updateDto);
    if (!updatedConnector) {
      // This could be because it wasn't found, or another update error.
      // findById first could clarify, but adds a DB call.
      const exists = await connectorRepository.findById(connectorId, tenantId);
      if (!exists) {
        res.status(404).json({ message: 'Connector configuration not found for update.' });
        return;
      }
      res.status(500).json({ message: 'Failed to update connector configuration.' });
      return;
    }
    logger.info({ connectorId: updatedConnector.id, tenantId: updatedConnector.tenant_id }, 'Connector configuration updated');
    res.status(200).json(updatedConnector);
    return;
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn({ errors: error.errors, connectorId: req.params.connectorId }, 'Validation error updating connector config');
      res.status(400).json({ message: 'Validation failed', ...error.format() });
      return;
    }
    logger.error({ error: error.message, stack: error.stack, connectorId: req.params.connectorId }, 'Error updating connector configuration');
    next(error);
  }
});

// DELETE /configurations/{connectorId} - Delete a connector configuration
router.delete('/:connectorId', ensureTenantId, async (req: Request, res: Response<{ message: string } | void>, next: NextFunction): Promise<void> => {
  try {
    const { connectorId } = req.params;
    const tenantId = req.params.tenantIdFromMiddleware;

    if (!z.string().uuid().safeParse(connectorId).success) {
        res.status(400).json({ message: 'Invalid connector ID format.' });
        return;
    }

    const success = await connectorRepository.delete(connectorId, tenantId);
    if (!success) {
      // Check if it existed to return 404 vs 500 (or just assume 404 if delete returns false)
      const exists = await connectorRepository.findById(connectorId, tenantId);
       if (!exists) {
        res.status(404).json({ message: 'Connector configuration not found for deletion.' });
        return;
      }
      // If it existed but delete failed, it's an issue.
      res.status(500).json({ message: 'Failed to delete connector configuration.' });
      return;
    }
    logger.info({ connectorId, tenantId }, 'Connector configuration deleted');
    res.status(204).send();
    return;
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack, connectorId: req.params.connectorId }, 'Error deleting connector configuration');
    next(error);
  }
});

export default router;