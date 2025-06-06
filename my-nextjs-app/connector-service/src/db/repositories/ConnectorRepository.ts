import supabase from 'db/supabaseClient';
import logger from 'utils/logger';
import {
  IntegrationConnector,
  CreateIntegrationConnectorDTO,
  UpdateIntegrationConnectorDTO,
  ListConnectorsQuery
} from 'types/connector.types';

const TABLE_NAME = 'integration_connectors';

export class ConnectorRepository {
  async create(connectorData: CreateIntegrationConnectorDTO): Promise<IntegrationConnector | null> {
    if (!supabase) {
      logger.error('Supabase client not initialized. Cannot create connector.');
      return null;
    }
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert({ ...connectorData, is_active: connectorData.is_active ?? true })
        .select()
        .single();

      if (error) {
        logger.error({ error, connectorData }, 'Error creating connector in Supabase');
        throw error;
      }
      return data as IntegrationConnector;
    } catch (err) {
      logger.error({ err, connectorData }, 'Exception in ConnectorRepository.create');
      return null;
    }
  }

  async findById(id: string, tenantId: string): Promise<IntegrationConnector | null> {
    if (!supabase) {
      logger.error('Supabase client not initialized. Cannot find connector by ID.');
      return null;
    }
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId) // Ensure tenant isolation
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // PostgREST error for "Not found"
          logger.info({ id, tenantId }, 'Connector not found by ID for tenant.');
          return null;
        }
        logger.error({ error, id, tenantId }, 'Error finding connector by ID in Supabase');
        throw error;
      }
      return data as IntegrationConnector;
    } catch (err) {
      logger.error({ err, id, tenantId }, 'Exception in ConnectorRepository.findById');
      return null;
    }
  }

  async findAll(query: ListConnectorsQuery): Promise<{ data: IntegrationConnector[], count: number | null }> {
    if (!supabase) {
      logger.error('Supabase client not initialized. Cannot find all connectors.');
      return { data: [], count: 0 };
    }
    try {
      let supabaseQuery = supabase
        .from(TABLE_NAME)
        .select('*', { count: 'exact' })
        .eq('tenant_id', query.tenant_id); // Mandatory tenant filter

      if (query.service_name) {
        supabaseQuery = supabaseQuery.eq('service_name', query.service_name);
      }
      if (typeof query.is_active === 'boolean') {
        supabaseQuery = supabaseQuery.eq('is_active', query.is_active);
      }

      const limit = query.limit || 20;
      const offset = query.offset || 0;
      supabaseQuery = supabaseQuery.range(offset, offset + limit - 1);
      // Add ordering if needed, e.g., .order('created_at', { ascending: false })

      const { data, error, count } = await supabaseQuery;

      if (error) {
        logger.error({ error, query }, 'Error finding all connectors in Supabase');
        throw error;
      }
      return { data: (data as IntegrationConnector[]) || [], count };
    } catch (err) {
      logger.error({ err, query }, 'Exception in ConnectorRepository.findAll');
      return { data: [], count: 0 };
    }
  }

  async update(id: string, tenantId: string, updateData: UpdateIntegrationConnectorDTO): Promise<IntegrationConnector | null> {
    if (!supabase) {
      logger.error('Supabase client not initialized. Cannot update connector.');
      return null;
    }
    try {
      // Ensure tenant_id is not part of updateData to prevent changing tenant ownership
      const { tenant_id, ...restUpdateData } = updateData as any;

      const { data, error } = await supabase
        .from(TABLE_NAME)
        .update(restUpdateData)
        .eq('id', id)
        .eq('tenant_id', tenantId) // Ensure tenant isolation for update
        .select()
        .single();

      if (error) {
        logger.error({ error, id, tenantId, updateData }, 'Error updating connector in Supabase');
        throw error;
      }
      return data as IntegrationConnector;
    } catch (err) {
      logger.error({ err, id, tenantId, updateData }, 'Exception in ConnectorRepository.update');
      return null;
    }
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    if (!supabase) {
      logger.error('Supabase client not initialized. Cannot delete connector.');
      return false;
    }
    try {
      const { error, count } = await supabase
        .from(TABLE_NAME)
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('tenant_id', tenantId); // Ensure tenant isolation for delete

      if (error) {
        logger.error({ error, id, tenantId }, 'Error deleting connector in Supabase');
        throw error;
      }
      return count !== null && count > 0;
    } catch (err) {
      logger.error({ err, id, tenantId }, 'Exception in ConnectorRepository.delete');
      return false;
    }
  }
}

export const connectorRepository = new ConnectorRepository();