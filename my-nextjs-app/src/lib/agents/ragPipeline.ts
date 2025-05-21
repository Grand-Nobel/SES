// lib/agents/ragPipeline.ts
import weaviate, { WeaviateClient, ConnectionParams, ApiKey } from 'weaviate-ts-client';
import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { openDB, IDBPDatabase } from 'idb';
import { PrivacyLogger } from '@/lib/logging';

// Define a type for the RAG cache database schema
interface RagCacheDb extends IDBPDatabase {
  queries: {
    key: string;
    value: { query: string; results: string[] };
  };
}

// Placeholder for the client, will be initialized asynchronously
let weaviateClientInstance: WeaviateClient | null = null;

async function getWeaviateClient(): Promise<WeaviateClient> {
  if (!weaviateClientInstance) {
    try {
      // Configuration for Weaviate Cloud Service (WCS) or a custom setup
      // Ensure environment variables for host and API key are set up if using WCS
      // For a local or custom setup, adjust parameters accordingly.
      // The host should be just the hostname, not the full URL.
      // Scheme will determine http or https.
      // For WCS, use connectToWeaviateCloud. For local/custom, use connectToLocal or connectToCustom.
      const httpHost = process.env.WEAVIATE_HTTP_HOST;
      const httpPortEnv = process.env.WEAVIATE_HTTP_PORT;
      const httpPort = httpPortEnv ? parseInt(httpPortEnv, 10) : undefined;
      const scheme = process.env.WEAVIATE_SCHEME as 'http' | 'https' | undefined;
      const apiKey = process.env.WEAVIATE_API_KEY;

      if (!httpHost || !scheme) {
        console.error(
          'Weaviate configuration error: WEAVIATE_HTTP_HOST and WEAVIATE_SCHEME environment variables are required.'
        );
        throw new Error(
          'Weaviate client initialization failed due to missing configuration.'
        );
      }
      
      const connectionConfig: ConnectionParams = {
        host: httpHost,
        scheme: scheme,
        // port is often part of the host string (e.g., "localhost:8080") or handled by scheme default
        // If your Weaviate instance uses a non-standard port directly in the host string,
        // ensure httpHost includes it, or add port separately if the client supports it.
        // For weaviate-ts-client, host usually includes the port if not standard.
        // Let's assume host includes port or it's standard for the scheme.
        // If WEAVIATE_HTTP_PORT is specifically for the port number, it should be used if client supports discrete port.
        // Checking weaviate-ts-client ConnectionParams, it has 'host' and 'scheme'. Port is part of host.
      };
      
      if (httpPort !== undefined && !isNaN(httpPort) && !httpHost.includes(':')) {
        // If host does not contain port and httpPort is provided, append it.
        // This is a common pattern but verify with specific Weaviate setup.
        // connectionConfig.host = `${httpHost}:${httpPort}`; 
        // OR if the client has a separate port field (less common for host+scheme based configs)
        // connectionConfig.port = httpPort; 
        // For now, assuming host string might already contain it or standard port is used.
        // If WEAVIATE_HTTP_HOST is "my.domain.com" and WEAVIATE_HTTP_PORT is "8080",
        // host should become "my.domain.com:8080".
        // Let's refine this:
        connectionConfig.host = httpHost + (httpPort && !httpHost.includes(':') ? `:${httpPort}` : '');
      }


      if (apiKey) {
        connectionConfig.apiKey = new ApiKey(apiKey); 
      }
      
      // Add gRPC config from env vars if needed
      // const grpcHost = process.env.WEAVIATE_GRPC_HOST;
      // if (grpcHost) connectionConfig.grpcHost = grpcHost;
      // ... similar for grpcPort and grpcSecure
      
      weaviateClientInstance = weaviate.client(connectionConfig);
      // For weaviate-ts-client, connection is typically lazy or established on first actual call.
      // A ping or ready check might be needed if immediate connection verification is required.
      // For now, we assume client() sets it up for later use.
      // Example ready check (optional, might need to be async if client.ready() is async):
      // if (typeof weaviateClientInstance.ready === 'function') {
      //   await weaviateClientInstance.ready(); 
      // }
      console.log('Weaviate client configured.');
    } catch (error) {
      console.error('Failed to configure Weaviate client:', error);
      throw new Error('Weaviate client configuration failed');
    }
  }
  // Ensure a client is always returned if no error is thrown, or handle null possibility
  if (!weaviateClientInstance) {
    // This case should ideally not be reached if errors in try block are re-thrown
    throw new Error("Weaviate client instance is null after attempting configuration.");
  }
  return weaviateClientInstance;
}


const dbPromise = openDB<RagCacheDb>('ses-rag-cache', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('queries')) {
      db.createObjectStore('queries', { keyPath: 'query' });
    }
  },
});

export async function indexTenantData(tenantId: string, data: { id: string; content: string }[]): Promise<void> {
  const className = `Tenant_${tenantId.replace(/-/g, '_')}`;
  // Example sharding by region - adjust based on your tenantId format or sharding strategy
  const region = tenantId.split('-')[0] || 'default_region'; 

  const client = await getWeaviateClient();
  // Ensure class exists - this might need to be more robust in a production system
  try {
    await client.schema.classGetter().withClassName(className).do();
  } catch (e) { // Assuming error means class doesn't exist
    console.log(`Class ${className} does not exist, creating...`);
    await client.schema.classCreator().withClass({
      class: className,
      vectorizer: 'text2vec-transformers', // Ensure this vectorizer is available in your Weaviate
      // @ts-ignore // shardingConfig might not be in the version of weaviate-ts-client types
      shardingConfig: { desiredCount: 3, region }, 
    }).do();
  }
  

  const batchSize = 100;
  for (let i = 0; i < data.length; i += batchSize) {
    const batcher = client.batch.objectsBatcher();
    const chunk = data.slice(i, i + batchSize);
    for (const item of chunk) {
      batcher.withObject({
        class: className,
        properties: { content: item.content },
        id: item.id, // Ensure IDs are Weaviate-compatible (UUID format often preferred)
      });
      // Consider batching Supabase inserts as well if performance becomes an issue
      await supabase.from('agent_memory_embeddings').upsert({
        tenant_id: tenantId,
        document_id: item.id,
        class_name: className,
      });
    }
    await batcher.do();
    console.log(`Indexed batch ${i / batchSize + 1} for tenant ${tenantId}`);
  }

  await redis.set(`indexed:${tenantId}`, 'true', { EX: 3600 }); // Cache indexing status
}

export async function queryRAG(tenantId: string, query: string): Promise<string[]> {
  const cacheKey = `rag:${tenantId}:${query}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`RAG query cache hit for: ${query}`);
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error("Redis cache read error:", error);
    // Proceed without cache if Redis fails
  }
  
  const className = `Tenant_${tenantId.replace(/-/g, '_')}`;
  const client = await getWeaviateClient();
  const expandedQuery = await expandQuery(query); // External call, ensure error handling
  
  interface WeaviateGraphQLResultItem {
    content: string;
    // Potentially other fields like _additional { id, distance, score, etc. }
  }

  interface WeaviateGraphQLGetResponse {
    [className: string]: WeaviateGraphQLResultItem[];
  }
  
  interface WeaviateGraphQLData {
    Get?: WeaviateGraphQLGetResponse;
    // Potentially other operations like Aggregate, Explore
  }

  interface WeaviateFullGraphQLResponse {
    data?: WeaviateGraphQLData;
    errors?: any[]; // Define a more specific error type if needed
  }

  try {
    const response = (await client.graphql
      .get()
      .withClassName(className)
      .withNearText({ concepts: expandedQuery })
      .withFields('content') // Ensure 'content' is the field storing the text
      .withLimit(5)
      .do()) as WeaviateFullGraphQLResponse; // Type assertion for the overall response

    const classResults = response.data?.Get?.[className];
    const results: string[] = classResults?.map((item: WeaviateGraphQLResultItem) => item.content).filter(content => typeof content === 'string') || [];
    
    if (results.length > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(results), { EX: 3600 });
      } catch (error) {
        console.error("Redis cache write error:", error);
      }
      // Removed IndexedDB write logic as it's not applicable on the server-side
    }

    // Logging should be robust to errors from PrivacyLogger or Supabase
    try {
      const maskedEvent = await PrivacyLogger().log('rag_query', {
        tenantId,
        query,
        expandedQuery,
        results, // Log actual results for analysis
      });
      await supabase.from('system_metrics').insert({
        tenant_id: tenantId,
        metric: 'rag_query',
        value: maskedEvent, // Ensure this is a JSON-compatible object
      });
    } catch (logError) {
      console.error("Error logging RAG query:", logError);
    }
    
    return results;
  } catch (weaviateError) {
    console.error("Weaviate query error:", weaviateError);
    return []; // Return empty array or throw custom error on Weaviate failure
  }
}

// Placeholder for query expansion logic
async function expandQuery(query: string): Promise<string[]> {
  console.log(`Expanding query: ${query}`);
  // In a real app, this would call an external service or use a local model
  // For now, just return the original query and a generic synonym
  const expansionApiUrl = process.env.SEMANTIC_EXPANSION_API_URL;
  if (!expansionApiUrl) {
    console.warn('SEMANTIC_EXPANSION_API_URL is not set. Query expansion will use fallback (original query only).');
    return [query];
  }

  try {
    const response = await fetch(expansionApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) {
      console.error(`Semantic expansion API error: ${response.status} for URL: ${expansionApiUrl}`);
      return [query]; // Fallback to original query
    }
    const data = await response.json();
    return [query, ...(data.synonyms || [])];
  } catch (error) {
    console.error("Query expansion service error:", error);
    return [query]; // Fallback to original query on network or other errors
  }
}
