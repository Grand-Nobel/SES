// integration-layer/vector-bridge/tests/index.test.ts
import { augmentPayload } from '../index';
import { supabase } from '../../../src/lib/supabase'; // Adjusted path
import Redis from 'ioredis';
import { EtlEngine } from '../../etl-engine/index'; // Adjusted path, import for mocking

jest.mock('../../../src/lib/supabase'); // Adjusted path
jest.mock('ioredis');
jest.mock('../../etl-engine/index'); // Mock the EtlEngine class module

describe('Vector Bridge', () => {
  const mockLoadEtlRules = jest.fn();
  const mockTransform = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Configure the mocked EtlEngine class to return instances with mocked methods
    (EtlEngine as jest.MockedClass<typeof EtlEngine>).mockImplementation(() => {
      return {
        loadEtlRules: mockLoadEtlRules,
        transform: mockTransform,
      } as unknown as EtlEngine;
    });

    // Reset mock implementations for EtlEngine methods for each test
    mockLoadEtlRules.mockResolvedValue({ prompt: 'Deduplicate' });
    mockTransform.mockResolvedValue({ name: 'John', transformed_by_etl: true }); // Align with EtlEngine placeholder and augmentPayload logic

    // Mock for supabase.from(...).select(...).eq(...).eq(...)
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        // This 'eq' is for the first call: .eq('tenant_id', tenantId)
        eq: jest.fn().mockImplementationOnce(function(this: any) {
          // It returns an object that has the second 'eq' method
          return {
            // This 'eq' is for the second call: .eq('entity_id', entityIdentifier)
            // This is the one that finally resolves with the data or error.
            eq: jest.fn().mockResolvedValueOnce({
              data: [{ embedding: [0.1, 0.2] }],
              error: null,
            }),
          };
        }),
      }),
    });

    (Redis.prototype.get as jest.Mock).mockResolvedValue(null);
    (Redis.prototype.setex as jest.Mock).mockResolvedValue('OK');
  });

  it('augments payload with context and ETL when entity_id is present', async () => {
    const payload = { lead_id: 'lead-1', other_data: 'test_data' };
    const tenantId = 'tenant-1';
    const result = await augmentPayload(payload, tenantId);

    // Expected result based on mocks:
    // transformed part from mockTransform: { name: 'John', transformed_by_etl: true }
    // retrieved_context from supabase mock: [{ embedding: [0.1, 0.2] }]
    expect(result).toEqual({
      name: 'John',
      transformed_by_etl: true,
      retrieved_context: [{ embedding: [0.1, 0.2] }],
    });

    expect(supabase.from).toHaveBeenCalledWith('agent_memory_embeddings');
    // Check that the chained .eq calls were made (implicitly tested by the mock structure if it works)
    expect(mockLoadEtlRules).toHaveBeenCalledWith(tenantId);
    expect(mockTransform).toHaveBeenCalledWith(payload, { prompt: 'Deduplicate' }, tenantId);
    expect(Redis.prototype.get).toHaveBeenCalledWith(`context:${tenantId}:${JSON.stringify(payload)}`);
    expect(Redis.prototype.setex).toHaveBeenCalled();
  });

  it('handles cache hit correctly', async () => {
    const payload = { client_id: 'client-abc', data: 'sample' };
    const tenantId = 'tenant-2';
    const cachedData = {
      name: 'Cached John',
      transformed_by_etl: true,
      retrieved_context: [{ embedding: [0.3, 0.4] }],
    };
    (Redis.prototype.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));

    const result = await augmentPayload(payload, tenantId);
    expect(result).toEqual(cachedData);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(mockLoadEtlRules).not.toHaveBeenCalled();
    expect(mockTransform).not.toHaveBeenCalled();
    expect(Redis.prototype.setex).not.toHaveBeenCalled();
  });

  it('proceeds without embeddings if entity_id is not in payload', async () => {
    const payload = { some_data: 'no_entity_id' };
    const tenantId = 'tenant-3';
    const result = await augmentPayload(payload, tenantId);

    expect(result).toEqual({
      name: 'John', // from mockTransform
      transformed_by_etl: true,
      retrieved_context: [], // No embeddings fetched
    });
    expect(supabase.from).not.toHaveBeenCalled(); // supabase.from should not be called
    expect(mockLoadEtlRules).toHaveBeenCalledWith(tenantId);
    expect(mockTransform).toHaveBeenCalledWith(payload, { prompt: 'Deduplicate' }, tenantId);
    expect(Redis.prototype.setex).toHaveBeenCalled();
  });

  it('handles error from supabase fetching embeddings', async () => {
    const payload = { lead_id: 'lead-err' };
    const tenantId = 'tenant-err';
    const supabaseError = new Error('Supabase fetch failed');

    // Adjust supabase mock for this specific test case
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        // This 'eq' is for the first call: .eq('tenant_id', tenantId)
        eq: jest.fn().mockImplementationOnce(function(this: any) {
          // It returns an object that has the second 'eq' method
          return {
            // This 'eq' is for the second call: .eq('entity_id', entityIdentifier)
            eq: jest.fn().mockResolvedValueOnce({ // Use mockResolvedValueOnce if this mock is specific to this test
              data: null,
              error: supabaseError,
            }),
          };
        }),
      }),
    });

    // The augmentPayload function currently re-throws the error.
    // If it were to handle it and return, the test would be different.
    await expect(augmentPayload(payload, tenantId)).rejects.toThrow('Supabase fetch failed');

    expect(mockLoadEtlRules).not.toHaveBeenCalled(); // Should not be called if error is thrown before
    expect(mockTransform).not.toHaveBeenCalled();
    expect(Redis.prototype.setex).not.toHaveBeenCalled();
  });
});