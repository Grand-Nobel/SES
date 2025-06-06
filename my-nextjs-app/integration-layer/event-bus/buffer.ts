import { Kafka } from 'kafkajs';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('event-buffer');

const kafka = new Kafka({
  clientId: 'event-buffer',
  brokers: ['broker1.ses.com:9092', 'broker2.ses.com:9092'],
  ssl: {
    ca: [process.env.KAFKA_SSL_CA!], // Assert non-null as loaded via Vault
    cert: process.env.KAFKA_SSL_CERT!, // Assert non-null as loaded via Vault
    key: process.env.KAFKA_SSL_KEY!, // Assert non-null as loaded via Vault
  },
});

const consumer = kafka.consumer({ groupId: 'event-buffer-group' });
const producer = kafka.producer();

export async function startEventBuffer() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'event:*:delayed' });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const span = tracer.startSpan('rePublishEvent');
      try {
        if (!message.value) {
          console.warn('Received message with null value, skipping.');
          return;
        }
        const event = JSON.parse(message.value.toString());
        await new Promise(resolve => setTimeout(resolve, 60000)); // Delay 1 minute
        await producer.connect();
        await producer.send({
          topic: event.event_type.split(':delayed')[0],
          messages: [{ value: JSON.stringify(event) }],
        });
      } finally {
        await producer.disconnect();
        span.end();
      }
    },
  });
}