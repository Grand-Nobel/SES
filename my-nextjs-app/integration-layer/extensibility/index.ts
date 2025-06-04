// integration-layer/extensibility/index.ts
import { Kafka } from 'kafkajs';
import { supabase } from '../../src/lib/supabase'; // Adjusted path
import axios from 'axios';
import { loadOrchestrationConfig } from '../orchestrator/config';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('extensibility');

const kafka = new Kafka({
  clientId: 'extensibility',
  brokers: ['broker1.ses.com:9092', 'broker2.ses.com:9092'],
  ssl: {
    ca: [process.env.KAFKA_SSL_CA!], // Added non-null assertion
    cert: process.env.KAFKA_SSL_CERT,
    key: process.env.KAFKA_SSL_KEY,
  },
});

const consumer = kafka.consumer({ groupId: 'extensibility-group' });

interface UserDefinedRule {
  workflow_definition_id: string; // Assuming this ID exists on the rule
  trigger_config: { event_type: string; [key: string]: any }; // More specific if possible
  action: { type: string; url?: string; headers?: any; [key: string]: any }; // More specific if possible
}

export async function startExtensibility() {
  const config = await loadOrchestrationConfig();
  await consumer.connect();
  await consumer.subscribe({ topic: config.topics['event:user:*'] || 'event:user:*' });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const span = tracer.startSpan('executeUserDefinedWorkflow');
      try {
        if (!message.value) {
          console.error('Kafka message value is null or undefined for extensibility workflow');
          return;
        }
        const event = JSON.parse(message.value.toString());

        if (!event.tenant_id || !event.event_type) {
          console.error('tenant_id or event_type is missing in the event for extensibility workflow:', event);
          return;
        }

        const rules: UserDefinedRule[] = await getUserDefinedRules(event.tenant_id, event.event_type);
        for (const rule of rules) {
          await executeAction(rule.action, event.payload);
          await supabase
            .from('workflow_runs')
            .insert({
              tenant_id: event.tenant_id,
              workflow_definition_id: rule.workflow_definition_id,
              status: 'completed', // Consider more dynamic status based on action result
              context: event.payload,
              // executed_at: new Date().toISOString(), // Optional: add execution timestamp
            });
        }
      } catch (error) {
        console.error('Error processing extensibility Kafka message:', error);
        // Optionally, rethrow or handle specific errors
      }
      finally {
        span.end();
      }
    },
  });
}

async function getUserDefinedRules(tenantId: string, eventType: string): Promise<UserDefinedRule[]> {
  const { data, error } = await supabase
    .from('workflow_definitions')
    .select('workflow_definition_id, trigger_config, action') // Ensure workflow_definition_id is selected
    .eq('tenant_id', tenantId)
    .eq('trigger_config->>event_type', eventType); // Correctly query JSONB field

  if (error) {
    console.error(`Error fetching user defined rules for tenant ${tenantId}, eventType ${eventType}:`, error);
    return [];
  }
  return data || [];
}

async function executeAction(action: UserDefinedRule['action'], payload: any) {
  const actionSpan = tracer.startSpan(`executeAction_${action.type}`);
  try {
    if (action.type === 'api_call') {
      if (!action.url) {
        console.error('API call action is missing URL:', action);
        return;
      }
      await axios.post(action.url, payload, { headers: action.headers || {} });
      console.log(`API call to ${action.url} executed successfully.`);
    } else {
      console.warn(`Unsupported action type: ${action.type}`);
    }
  } catch (error) {
    console.error(`Error executing action type ${action.type} to URL ${action.url || 'N/A'}:`, error);
    // Potentially update workflow_runs with a 'failed' status here
    throw error; // Re-throw to be caught by the main try-catch if needed
  } finally {
    actionSpan.end();
  }
}