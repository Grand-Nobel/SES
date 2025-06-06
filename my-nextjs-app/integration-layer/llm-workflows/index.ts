// integration-layer/llm-workflows/index.ts
import { Kafka } from 'kafkajs';
import { supabase } from '../../src/lib/supabase'; // Adjusted path
import { loadOrchestrationConfig } from '../orchestrator/config';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('llm-workflows');

const kafka = new Kafka({
  clientId: 'llm-workflows',
  brokers: ['broker1.ses.com:9092', 'broker2.ses.com:9092'],
  ssl: {
    ca: [process.env.KAFKA_SSL_CA!], // Added non-null assertion
    cert: process.env.KAFKA_SSL_CERT,
    key: process.env.KAFKA_SSL_KEY,
  },
});

const consumer = kafka.consumer({ groupId: 'llm-workflows-group' });

export async function startLlmWorkflows() {
  const config = await loadOrchestrationConfig();
  await consumer.connect();
  await consumer.subscribe({ topic: config.topics['event:client:*'] || 'event:client:*' });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const span = tracer.startSpan('executeLlmWorkflow');
      try {
        if (!message.value) {
          console.error('Kafka message value is null or undefined for LLM workflow');
          return;
        }
        const event = JSON.parse(message.value.toString());
        const template = await getTemplate(event.tenant_id, event.event_type);
        const content = await generateContent(template, event.payload);
        await supabase
          .from('interactions')
          .insert({
            tenant_id: event.tenant_id,
            user_id: event.payload.user_id,
            content,
          });
      } catch (error) {
        console.error('Error processing LLM workflow Kafka message:', error);
        // Optionally, rethrow or handle specific errors
      }
      finally {
        span.end();
      }
    },
  });
}

async function getTemplate(tenantId: string, eventType: string) {
  const { data, error } = await supabase
    .from('template_library')
    .select('content')
    .eq('tenant_id', tenantId)
    .eq('template_type', eventType.split(':')[1]) // Assumes event_type is like 'client:report_needed'
    .single();

  if (error) {
    console.error(`Error fetching template for tenant ${tenantId}, eventType ${eventType}:`, error);
    return 'Default template (error fetching)';
  }
  return data?.content || 'Default template';
}

async function generateContent(template: string, payload: any) {
  // Basic placeholder for content generation
  return `Generated content using template "${template}" for client: ${payload.client_id}, user: ${payload.user_id}`;
}