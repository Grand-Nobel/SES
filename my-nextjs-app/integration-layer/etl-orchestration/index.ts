// integration-layer/etl-orchestration/index.ts
import { Kafka } from 'kafkajs';
import { supabase } from '../../src/lib/supabase'; // Adjusted path
import { EtlEngine } from '../etl-engine'; // Assuming etl-engine/index.ts exists
import { loadOrchestrationConfig } from '../orchestrator/config';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('etl-orchestration');
const etlEngine = new EtlEngine(); // Assuming EtlEngine constructor requires no args or is mocked

const kafka = new Kafka({
  clientId: 'etl-orchestration',
  brokers: ['broker1.ses.com:9092', 'broker2.ses.com:9092'],
  ssl: {
    ca: [process.env.KAFKA_SSL_CA!], // Added non-null assertion
    cert: process.env.KAFKA_SSL_CERT,
    key: process.env.KAFKA_SSL_KEY,
  },
});

const consumer = kafka.consumer({ groupId: 'etl-orchestration-group' });

export async function startEtlOrchestration() {
  const config = await loadOrchestrationConfig();
  await consumer.connect();
  await consumer.subscribe({ topic: config.topics['event:integration:*'] || 'event:integration:*' });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const span = tracer.startSpan('executeEtlTask');
      try {
        if (!message.value) {
          console.error('Kafka message value is null or undefined for ETL orchestration');
          return;
        }
        const event = JSON.parse(message.value.toString());
        
        // Ensure tenant_id is present in the event for loading rules
        if (!event.tenant_id) {
          console.error('tenant_id is missing in the event for ETL orchestration:', event);
          return;
        }
        const rules = await etlEngine.loadEtlRules(event.tenant_id);
        
        // Ensure payload and tenant_id are present for transformation
        if (!event.payload) {
            console.error('payload is missing in the event for ETL orchestration:', event);
            return;
        }
        const transformed = await etlEngine.transform(event.payload, rules, event.tenant_id);
        
        await supabase
          .from('integration_events')
          .insert({
            tenant_id: event.tenant_id,
            event_type: event.event_type,
            raw_payload: event.payload,
            normalized_payload: transformed,
            source_service: event.payload.source_service, // Assuming source_service is in payload
          });

        if (event.event_type && event.event_type.includes('client') && transformed) {
          // Ensure transformed object has the necessary properties
          if (transformed.client_id && transformed.name) {
            await supabase
              .from('clients')
              .upsert({
                id: transformed.client_id,
                tenant_id: event.tenant_id,
                name: transformed.name,
                // Add other relevant fields from transformed if necessary
              });
          } else {
            console.error('Transformed data for client upsert is missing client_id or name:', transformed);
          }
        }
      } catch (error) {
        console.error('Error processing ETL orchestration Kafka message:', error);
        // Optionally, rethrow or handle specific errors
      }
      finally {
        span.end();
      }
    },
  });
}