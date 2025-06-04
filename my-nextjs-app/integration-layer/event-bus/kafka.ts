import { Kafka } from 'kafkajs';
import Redis from 'ioredis';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('event-bus');
const redis = new Redis({ host: 'redis', port: 6379 });

const kafka = new Kafka({
  clientId: 'ses-client',
  brokers: ['broker1.ses.com:9092', 'broker2.ses.com:9092'],
  ssl: {
    ca: [process.env.KAFKA_SSL_CA as string], // Loaded via Vault
    cert: process.env.KAFKA_SSL_CERT as string,
    key: process.env.KAFKA_SSL_KEY as string,
  },
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'ses-group' });

export async function publishEvent(topic: string, tenantId: string, message: any, highTraffic: boolean = false) {
  const span = tracer.startSpan('publishEvent');
  try {
    if (highTraffic) {
      const allowed = await rateLimitEvent(topic, 1000, 60); // 1000 events per minute
      if (!allowed) {
        await producer.connect();
        await producer.send({
          topic: `${topic}:delayed`,
          messages: [{ value: JSON.stringify({ ...message, delayed: true }) }],
        });
        return;
      }
    }
    await producer.connect();
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify({ tenantId, ...message }) }],
    });
  } finally {
    await producer.disconnect();
    span.end();
  }
}

export async function subscribeToTopic(topic: string, callback: (message: any) => void) {
  await consumer.connect();
  await consumer.subscribe({ topic });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const span = tracer.startSpan('consumeEvent');
      try {
        if (message.value) {
          const event = JSON.parse(message.value.toString());
          await callback(event);
        } else {
          console.warn('Received message with null value, skipping.');
        }
      } finally {
        span.end();
      }
    },
  });
}

export async function rateLimitEvent(eventType: string, limit: number, window: number): Promise<boolean> {
  const key = `rate_limit:${eventType}`;
  const current = (await redis.get(key)) || 0;
  if (parseInt(current as string) >= limit) return false;

  await redis.multi()
    .incr(key)
    .expire(key, window)
    .exec();
  return true;
}