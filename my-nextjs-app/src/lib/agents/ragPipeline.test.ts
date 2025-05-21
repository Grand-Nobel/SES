// lib/agents/ragPipeline.test.ts
import { indexTenantData, queryRAG } from './ragPipeline';
import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { PrivacyLogger } from '@/lib/logging';
import { openDB } from 'idb'; // Import openDB for mocking

jest.mock('@/lib/supabase');
jest.mock('@/lib/redis');
jest.mock('@/lib/logging');
jest.mock('idb', () => ({
  openDB: jest.fn(),
}));

// Mock Weaviate client globally for all tests in this file
const mockWeaviateClient = {
  schema: {
    classGetter: jest.fn().mockReturnThis(),
    classCreator: jest.fn().mockReturnThis(),
    withClass: jest.fn().mockReturnThis(),
    withClassName: jest.fn().mockReturnThis(),
    do: jest.fn().mockResolvedValue({}), // Default mock for .do()
  },
  batch: {
    objectsBatcher: jest.fn().mockReturnValue({
      withObject: jest.fn().mockReturnThis(),
      do: jest.fn().mockResolvedValue({}),
    }),
  },
  graphql: {
    get: jest.fn().mockReturnThis(),
    withClassName: jest.fn().mockReturnThis(),
    withNearText: jest.fn().mockReturnThis(),
    withFields: jest.fn().mockReturnThis(),
    withLimit: jest.fn().mockReturnThis(),
    do: jest.fn().mockResolvedValue({ data: { Get: { Tenant_test_tenant: [{ content: 'Test result' }] } } }), // Mock GraphQL response
  },
};

jest.mock('weaviate-ts-client', () => ({
  WeaviateClient: jest.fn(() => mockWeaviateClient),
}));


describe('RAG Pipeline', () => {
  const mockDb = {
    get: jest.fn(),
    put: jest.fn(),
    createObjectStore: jest.fn(), // Added to satisfy IDBPDatabase interface if upgrade is called
    // Add other methods if your tests or code interact with them
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.from as jest.Mock).mockReturnValue({
      upsert: jest.fn().mockResolvedValue({}),
      insert: jest.fn().mockResolvedValue({}),
    });
    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.set as jest.Mock).mockResolvedValue('OK');
    (PrivacyLogger as jest.Mock).mockReturnValue({ log: jest.fn().mockResolvedValue({}) });
    
    // Mock openDB to return our mockDb
    (openDB as jest.Mock).mockResolvedValue(mockDb);
    mockDb.get.mockReset(); // Reset mockDb calls for each test
    mockDb.put.mockReset();


    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ synonyms: ['test synonym'] }),
    });
  });

  it('batches indexing operations', async () => {
    const data = Array.from({ length: 150 }, (_, i) => ({ id: `doc-${i}`, content: `Test document ${i}` }));
    // Mock classGetter to throw an error initially to simulate class creation path
    mockWeaviateClient.schema.classGetter().do.mockRejectedValueOnce(new Error("Class not found"));
    
    await indexTenantData('tenant-1', data);
    
    // Check if classCreator was called because classGetter failed
    expect(mockWeaviateClient.schema.classCreator().withClass).toHaveBeenCalled();
    // Check batching logic (e.g., objectsBatcher called twice for 150 items with batchSize 100)
    expect(mockWeaviateClient.batch.objectsBatcher().do).toHaveBeenCalledTimes(2); 
    expect(supabase.from('agent_memory_embeddings').upsert).toHaveBeenCalledTimes(150);
    expect(redis.set).toHaveBeenCalledWith('indexed:tenant-1', 'true', { EX: 3600 });
  });

  it('uses cached query results from Redis', async () => {
    (redis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(['Cached result from Redis']));
    const results = await queryRAG('tenant-1', 'test query');
    expect(results).toEqual(['Cached result from Redis']);
    expect(mockWeaviateClient.graphql.get).not.toHaveBeenCalled(); // Should not call Weaviate if cache hit
  });

  it('falls back to IndexedDB when offline and Redis fails or misses', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
    (redis.get as jest.Mock).mockResolvedValue(null); // Simulate Redis miss or error
    mockDb.get.mockResolvedValueOnce({ query: 'test query', results: ['Offline result from IndexedDB'] });
    
    const results = await queryRAG('tenant-1', 'test query');
    expect(results).toEqual(['Offline result from IndexedDB']);
    expect(mockDb.get).toHaveBeenCalledWith('queries', 'test query');
    expect(mockWeaviateClient.graphql.get).not.toHaveBeenCalled(); // Should not call Weaviate
  });

  it('queries Weaviate and caches results when online and no cache hit', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    (redis.get as jest.Mock).mockResolvedValue(null); // Redis miss
     // Weaviate mock is set up in the global scope to return 'Test result'
    
    const results = await queryRAG('tenant-1', 'test query for weaviate');
    
    expect(results).toEqual(['Test result']);
    expect(mockWeaviateClient.graphql.get).toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledWith('rag:tenant-1:test query for weaviate', JSON.stringify(['Test result']), { EX: 3600 });
    expect(mockDb.put).toHaveBeenCalledWith('queries', { query: 'test query for weaviate', results: ['Test result'] });
    expect(PrivacyLogger().log).toHaveBeenCalled();
    expect(supabase.from('system_metrics').insert).toHaveBeenCalled();
  });
});
