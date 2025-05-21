import { Router, Request, Response, NextFunction } from 'express';
import supabase from '../../db/supabaseClient';
import logger from '../../utils/logger';
import { ListMarketplaceConnectorsDTO, InstallMarketplaceConnectorDTO, MarketplaceConnectorEntry, InstallationResult } from '../../types/marketplace.types';
// Assume integration_connectors table types are available if needed for cross-service logic, or define simplified version here.
// For now, we'll focus on marketplace_connectors table.

const router = Router();

const MARKETPLACE_TABLE = 'marketplace_connectors';
const INTEGRATIONS_TABLE = 'integration_connectors'; // For creating new integrations

/**
 * GET /api/v1/marketplace/connectors
 * Lists available marketplace connectors.
 * Query params: tenant_id (required), category, search_term, is_featured, limit, offset, sort_by, sort_order
 */
router.get('/connectors', async (req: Request, res: Response, next: NextFunction) => {
  // Placeholder for authorization: In a real app, verify user/tenant permissions here
  // For example, using middleware or a helper function:
  // if (!hasPermission(req.authContext, 'read:marketplace_connectors')) {
  //   return res.status(403).json({ error: 'Forbidden' });
  // }

  const {
    tenant_id,
    category,
    search_term,
    is_featured,
    limit = 20,
    offset = 0,
    sort_by = 'name',
    sort_order = 'asc'
  } = req.query as unknown as ListMarketplaceConnectorsDTO;

  if (!tenant_id) {
    return res.status(400).json({ error: 'tenant_id query parameter is required.' });
  }

  if (!supabase) {
    logger.error('Supabase client not available for listing marketplace connectors.');
    return res.status(500).json({ error: 'Database connection error.' });
  }

  try {
    let query = supabase.from(MARKETPLACE_TABLE).select('*');

    if (category) {
      query = query.eq('category', category);
    }
    if (search_term) {
      // Basic search on name and description. More advanced search might use full-text search.
      query = query.or(`name.ilike.%${search_term}%,description.ilike.%${search_term}%`);
    }
    if (typeof is_featured === 'boolean' || is_featured === 'true' || is_featured === 'false') {
        query = query.eq('is_featured', String(is_featured).toLowerCase() === 'true');
    }
    
    query = query.limit(Number(limit)).range(Number(offset), Number(offset) + Number(limit) - 1);
    
    if (sort_by && ['name', 'created_at'].includes(sort_by)) {
        query = query.order(sort_by, { ascending: sort_order === 'asc' });
    }


    const { data: marketplaceData, error, count } = await query;

    if (error) {
      logger.error({ error, queryParams: req.query }, 'Error fetching marketplace connectors from Supabase.');
      return next(error);
    }

    // Optionally, enrich with information about which connectors are already installed by this tenant
    let enrichedData = marketplaceData as MarketplaceConnectorEntry[];
    if (marketplaceData && marketplaceData.length > 0) {
      const { data: installedConnectors, error: installedError } = await supabase
        .from(INTEGRATIONS_TABLE)
        .select('service_name')
        .eq('tenant_id', tenant_id);

      if (installedError) {
        logger.warn({ error: installedError, tenant_id }, 'Could not fetch installed connectors for enrichment. Proceeding without it.');
      } else if (installedConnectors) {
        const installedServiceNames = new Set(installedConnectors.map(ic => ic.service_name));
        enrichedData = marketplaceData.map(mc => ({
          ...mc,
          is_installed_for_tenant: installedServiceNames.has(mc.service_identifier),
        })) as MarketplaceConnectorEntry[]; // Cast needed if is_installed_for_tenant is added to type
      }
    }

    res.status(200).json({ data: enrichedData, count });
  } catch (err) {
    logger.error({ err, queryParams: req.query }, 'Exception in GET /connectors');
    next(err);
  }
});

/**
 * POST /api/v1/marketplace/install
 * Installs a connector for a tenant. This means creating an entry in the `integration_connectors` table
 * based on a `marketplace_connectors` entry.
 * Body: { tenant_id, marketplace_connector_id, custom_auth_config?, custom_name? }
 */
router.post('/install', async (req: Request, res: Response, next: NextFunction) => {
  const {
    tenant_id,
    marketplace_connector_id,
    custom_auth_config,
    custom_name
  } = req.body as InstallMarketplaceConnectorDTO;

  if (!tenant_id || !marketplace_connector_id) {
    return res.status(400).json({ error: 'tenant_id and marketplace_connector_id are required.' });
  }

  if (!supabase) {
    logger.error('Supabase client not available for installing marketplace connector.');
    return res.status(500).json({ error: 'Database connection error.' });
  }

  try {
    // 1. Fetch the marketplace connector details
    const { data: marketplaceEntry, error: fetchError } = await supabase
      .from(MARKETPLACE_TABLE)
      .select('*')
      .eq('id', marketplace_connector_id)
      .single();

    if (fetchError || !marketplaceEntry) {
      logger.warn({ marketplace_connector_id, fetchError }, 'Marketplace connector not found for installation.');
      return res.status(404).json({ error: 'Marketplace connector not found.' });
    }

    // 2. Check if this service_identifier is already installed for the tenant
    const { data: existingInstallation, error: existingError } = await supabase
      .from(INTEGRATIONS_TABLE)
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('service_name', marketplaceEntry.service_identifier) // service_name in integrations_connectors maps to service_identifier in marketplace_connectors
      .maybeSingle(); // Use maybeSingle to not error if no row is found

    if (existingError) {
      logger.error({ error: existingError, tenant_id, service_identifier: marketplaceEntry.service_identifier }, 'Error checking for existing installation.');
      return next(existingError);
    }

    if (existingInstallation) {
      logger.warn({ tenant_id, service_identifier: marketplaceEntry.service_identifier, existingInstallationId: existingInstallation.id }, 'Connector service already installed for this tenant.');
      return res.status(409).json({ error: `Service "${marketplaceEntry.name}" (${marketplaceEntry.service_identifier}) is already installed for this tenant.`, installed_connector_id: existingInstallation.id });
    }
    
    // 3. Prepare data for the new integration_connectors record
    const newIntegrationData = {
      tenant_id,
      connector_name: custom_name || marketplaceEntry.name, // Use custom name or default from marketplace
      service_name: marketplaceEntry.service_identifier,
      auth_type: marketplaceEntry.default_auth_config?.type || 'custom', // Infer from default_auth_config
      auth_config: custom_auth_config || marketplaceEntry.default_auth_config || {},
      api_spec: marketplaceEntry.default_api_spec || {},
      scopes: marketplaceEntry.available_scopes || [],
      is_active: true, // Default to active, user can deactivate later
      metadata: {
        source_marketplace_id: marketplace_connector_id,
        installed_from: 'marketplace-service',
      },
      // sync_version and last_sync_at will be null/default initially
    };

    // 3. Insert into integration_connectors table
    const { data: newIntegration, error: insertError } = await supabase
      .from(INTEGRATIONS_TABLE)
      .insert(newIntegrationData)
      .select()
      .single();

    if (insertError) {
      logger.error({ insertError, newIntegrationData }, 'Error creating integration_connector from marketplace entry.');
      return next(insertError);
    }
    
    const result: InstallationResult = {
        success: true,
        message: `Connector "${newIntegration.connector_name}" installed successfully.`,
        installed_connector_id: newIntegration.id
    };

    // TODO: Potentially trigger post-installation setup, e.g., initial auth flow if OAuth2
    logger.info({ tenant_id, marketplace_connector_id, installed_connector_id: newIntegration.id }, 'Connector installed successfully from marketplace.');
    res.status(201).json(result);

  } catch (err) {
    logger.error({ err, body: req.body }, 'Exception in POST /install');
    next(err);
  }
});

export default router;