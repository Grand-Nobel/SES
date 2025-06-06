import supabase from '../../db/supabaseClient';
import logger from '../../utils/logger';
import { MarketplaceConnectorEntry } from '../../types/marketplace.types';

// Placeholder for tenant profile data structure
interface TenantProfile {
  id: string;
  industry?: string;
  size?: number; // e.g., number of employees
  usedTechnologies?: string[]; // e.g., ['Salesforce', 'Google Workspace']
  // ... other relevant profile data
}

// Placeholder for currently installed/used connectors by a tenant
interface TenantConnectorUsage {
  service_identifier: string; // From integration_connectors table
  // ... other usage metrics, e.g., activity level, data volume
}

export class RecommendationEngine {
  constructor() {
    // Initialization if needed, e.g., load ML models, pre-fetch global data
    logger.info('RecommendationEngine initialized.');
  }

  private async getTenantProfile(tenantId: string): Promise<TenantProfile | null> {
    if (!supabase) {
      logger.error('Supabase client not available for getTenantProfile.');
      return null;
    }
    // This assumes a 'tenants' table exists with profile information
    // As per plan, this table might need creation (section 2.9.4)
    // For now, returning mock data or null
    logger.warn({ tenantId }, 'getTenantProfile: Using mock data or null as tenants table/data might not exist yet.');
    // const { data, error } = await supabase.from('tenants').select('*').eq('id', tenantId).single();
    // if (error) {
    //   logger.error({ tenantId, error }, 'Error fetching tenant profile.');
    //   return null;
    // }
    // return data as TenantProfile;
    if (tenantId === 'tenant-123-abc') {
        return { id: tenantId, industry: 'SaaS', size: 50, usedTechnologies: ['Google Workspace'] };
    }
    return null;
  }

  private async getTenantInstalledConnectors(tenantId: string): Promise<TenantConnectorUsage[]> {
    if (!supabase) {
      logger.error('Supabase client not available for getTenantInstalledConnectors.');
      return [];
    }
    // Fetches from 'integration_connectors' table
    const { data, error } = await supabase
      .from('integration_connectors')
      .select('service_name') // service_name maps to service_identifier in marketplace
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) {
      logger.error({ tenantId, error }, 'Error fetching tenant installed connectors.');
      return [];
    }
    return (data || []).map(c => ({ service_identifier: c.service_name }));
  }

  private async getAllMarketplaceConnectors(): Promise<MarketplaceConnectorEntry[]> {
    if (!supabase) {
        logger.error('Supabase client not available for getAllMarketplaceConnectors.');
        return [];
    }
    const { data, error } = await supabase.from('marketplace_connectors').select('*');
    if (error) {
        logger.error({ error }, 'Error fetching all marketplace connectors.');
        return [];
    }
    return data || [];
  }


  /**
   * Generates connector recommendations for a given tenant.
   * This is a placeholder implementation. Real-world scenarios would involve more complex logic,
   * potentially collaborative filtering, content-based filtering, or ML models.
   * @param tenantId The ID of the tenant for whom to generate recommendations.
   * @returns A promise that resolves to an array of recommended MarketplaceConnectorEntry.
   */
  public async getRecommendations(tenantId: string, limit: number = 5): Promise<MarketplaceConnectorEntry[]> {
    logger.info({ tenantId }, 'Generating connector recommendations.');

    const [tenantProfile, installedConnectors, allConnectors] = await Promise.all([
        this.getTenantProfile(tenantId),
        this.getTenantInstalledConnectors(tenantId),
        this.getAllMarketplaceConnectors()
    ]);

    if (allConnectors.length === 0) {
        logger.warn('No marketplace connectors available to recommend.');
        return [];
    }

    const installedServiceIdentifiers = new Set(installedConnectors.map(c => c.service_identifier));
    let recommendations: MarketplaceConnectorEntry[] = [];

    // Simple logic:
    // 1. Prioritize featured connectors not yet installed.
    // 2. Suggest connectors based on (mocked) industry if profile exists.
    // 3. Fill with other non-installed connectors.

    // Rule 1: Featured and not installed
    const featuredNotInstalled = allConnectors.filter(
      c => c.is_featured && !installedServiceIdentifiers.has(c.service_identifier)
    );
    recommendations.push(...featuredNotInstalled);

    // Rule 2: Industry-based (very basic example)
    if (tenantProfile?.industry === 'SaaS') {
      const saasConnectors = allConnectors.filter(
        c => (c.category === 'CRM' || c.category === 'Communication' || c.name.includes('Analytics')) &&
             !installedServiceIdentifiers.has(c.service_identifier) &&
             !recommendations.find(r => r.id === c.id) // Avoid duplicates
      );
      recommendations.push(...saasConnectors);
    }
    
    // Rule 3: Other non-installed, non-featured (to fill up to limit)
    if (recommendations.length < limit) {
        const otherNotInstalled = allConnectors.filter(
            c => !installedServiceIdentifiers.has(c.service_identifier) && 
                 !recommendations.find(r => r.id === c.id)
        );
        recommendations.push(...otherNotInstalled.slice(0, limit - recommendations.length));
    }
    
    // Ensure unique recommendations and limit
    const uniqueRecommendations = Array.from(new Map(recommendations.map(item => [item.id, item])).values());
    
    logger.info({ tenantId, count: uniqueRecommendations.slice(0, limit).length }, 'Generated recommendations.');
    return uniqueRecommendations.slice(0, limit);
  }
}