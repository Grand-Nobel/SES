// integration-layer/vector-bridge/index.ts
import { supabase } from '../../src/lib/supabase'; // Adjusted import path
import Redis from 'ioredis';
import { EtlEngine } from '../etl-engine/index'; // Adjusted import path
import { trace, SpanStatusCode } from '@opentelemetry/api'; // Import SpanStatusCode

const tracer = trace.getTracer('vector-bridge');
const redis = new Redis({ host: process.env.REDIS_HOST || 'redis', port: Number(process.env.REDIS_PORT) || 6379 });
const etlEngine = new EtlEngine();

export async function augmentPayload(payload: any, tenantId: string): Promise<any> {
  const span = tracer.startSpan('augmentPayload');
  try {
    const cacheKey = `context:${tenantId}:${JSON.stringify(payload)}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      span.addEvent('Cache hit');
      return JSON.parse(cached);
    }
    span.addEvent('Cache miss');

    // Assuming payload might have lead_id or client_id for fetching embeddings
    const entityIdentifier = payload.lead_id || payload.client_id;
    let embeddings: { embedding: number[] }[] = []; // Explicitly type embeddings

    if (entityIdentifier) {
      const { data, error } = await supabase
        .from('agent_memory_embeddings')
        .select('embedding')
        .eq('tenant_id', tenantId)
        .eq('entity_id', entityIdentifier);

      if (error) {
        console.error('Error fetching embeddings:', error);
        span.recordException(error);
        // Decide how to handle the error, e.g., proceed without embeddings or throw
      } else {
        embeddings = data || [];
      }
    } else {
      console.warn('No lead_id or client_id in payload to fetch embeddings.');
      span.addEvent('No entity_identifier for embeddings');
    }

    const rules = await etlEngine.loadEtlRules(tenantId);
    const transformed = await etlEngine.transform(payload, rules, tenantId);

    const augmented = {
      ...transformed,
      retrieved_context: embeddings,
    };

    await redis.setex(cacheKey, 3600, JSON.stringify(augmented)); // Cache for 1 hour
    span.setAttribute('cacheKey', cacheKey);
    return augmented;
  } catch (error) {
    console.error('Error in augmentPayload:', error);
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message }); // Use imported SpanStatusCode
    // Depending on the desired behavior, you might want to re-throw the error
    // or return a default/unaugmented payload.
    // For now, re-throwing to make the caller aware.
    throw error;
  } finally {
    span.end();
  }
}