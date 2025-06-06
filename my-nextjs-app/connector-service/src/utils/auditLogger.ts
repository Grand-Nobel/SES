import supabase from '../db/supabaseClient'; // Assuming this client is configured for service_role if needed
import logger from './logger';

const AUDIT_LOG_TABLE = 'audit_logs';

export interface AuditLogEntry {
  tenant_id?: string | null;
  user_id?: string | null; // Can be system ID like 'connector-service' or actual user UUID
  action: string; // e.g., 'CREATE_CONNECTOR', 'UPDATE_CONNECTOR_AUTH'
  target_resource_type?: string | null; // e.g., 'connector', 'configuration'
  target_resource_id?: string | null;
  payload?: Record<string, any> | null; // Details of the action
  ip_address?: string | null;
  user_agent?: string | null;
  status?: 'success' | 'failure' | 'pending' | null;
  error_message?: string | null;
}

/**
 * Logs an audit event to the Supabase audit_logs table.
 * @param entry The audit log entry to record.
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  if (!supabase) {
    logger.error({ entry }, 'Supabase client not available. Cannot log audit event.');
    // Depending on policy, might throw or fail silently in dev if Supabase isn't critical for the action itself
    return;
  }

  // Ensure default status if not provided
  const entryToInsert = {
    ...entry,
    status: entry.status || 'success',
  };

  try {
    const { error } = await supabase.from(AUDIT_LOG_TABLE).insert(entryToInsert);
    if (error) {
      logger.error({ error, auditEntry: entryToInsert }, 'Failed to insert audit log into Supabase.');
      // Handle error appropriately - e.g., retry, log to a fallback, alert
    } else {
      logger.info({ action: entry.action, resource: entry.target_resource_id }, 'Audit event logged successfully.');
    }
  } catch (err) {
    logger.error({ err, auditEntry: entryToInsert }, 'Exception occurred while logging audit event.');
    // Handle exception
  }
}

// Example usage (can be called from ConnectorManager, route handlers, etc.):
/*
import { logAuditEvent } from './auditLogger';

async function someServiceAction(tenantId: string, userId: string, connectorId: string) {
  // ... perform action ...
  
  await logAuditEvent({
    tenant_id: tenantId,
    user_id: userId,
    action: 'CONNECTOR_CONFIGURATION_UPDATED',
    target_resource_type: 'connector',
    target_resource_id: connectorId,
    payload: { changes: { field: 'newValue' } },
    status: 'success'
  });

  // If an error occurred:
  // await logAuditEvent({
  //   tenant_id: tenantId,
  //   user_id: userId,
  //   action: 'CONNECTOR_CONFIGURATION_UPDATE_FAILED',
  //   target_resource_type: 'connector',
  //   target_resource_id: connectorId,
  //   payload: { attempt: { field: 'newValue' } },
  //   status: 'failure',
  //   error_message: 'Specific error detail'
  // });
}
*/