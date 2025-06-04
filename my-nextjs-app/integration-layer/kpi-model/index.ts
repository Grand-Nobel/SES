// integration-layer/kpi-model/index.ts
import { Kafka } from 'kafkajs';
import { supabase } from '../../src/lib/supabase'; // Adjusted path
import { augmentPayload } from '../vector-bridge';
import { loadOrchestrationConfig } from '../orchestrator/config'; // Adjusted path
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('kpi-model');

const kafka = new Kafka({
  clientId: 'kpi-model',
  brokers: ['broker1.ses.com:9092', 'broker2.ses.com:9092'],
  ssl: {
    ca: [process.env.KAFKA_SSL_CA!], // Added non-null assertion, ensure this env var is set
    cert: process.env.KAFKA_SSL_CERT,
    key: process.env.KAFKA_SSL_KEY,
  },
});

const consumer = kafka.consumer({ groupId: 'kpi-model-group' });

export async function startKpiModelExecution() {
  const config = await loadOrchestrationConfig();
  await consumer.connect();
  await consumer.subscribe({ topic: config.topics['event:analytics:*'] || 'event:analytics:*' });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const span = tracer.startSpan('executeKpiModel');
      try {
        if (!message.value) {
          console.error('Kafka message value is null or undefined');
          return;
        }
        const event = JSON.parse(message.value.toString());
        const augmentedPayload = await augmentPayload(event.payload, event.tenant_id);
        const prediction = await executeModel(event.payload.model_name, augmentedPayload);
        await supabase
          .from('kpi_predictions')
          .insert({
            tenant_id: event.tenant_id,
            model_name: event.payload.model_name,
            entity_type: event.payload.entity_type,
            entity_id: event.payload.entity_id,
            prediction: { result: prediction, confidence: 0.9 },
          });
      } catch (error) {
        console.error('Error processing Kafka message:', error);
        // Optionally, rethrow or handle specific errors for retry/dead-letter queue
      }
      finally {
        span.end();
      }
    },
  });
}

async function executeModel(modelName: string, payload: any) {
  return modelName === 'ChurnPredictor' ? { churn_risk: 0.75 } : { revenue_forecast: 10000 };
}