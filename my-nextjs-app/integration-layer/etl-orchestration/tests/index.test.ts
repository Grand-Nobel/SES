// integration-layer/etl-orchestration/tests/index.test.ts
import { startEtlOrchestration } from '../index';
import { supabase } from '@/lib/supabase'; // Used for mock setup
import { EtlEngine } from '../../etl-engine'; // Corrected path: Used for mock setup

// --- KafkaJS Mock Setup ---
const mockEtlKafkaMessageProcessor = jest.fn();
const mockEtlConsumerRun = jest.fn(async ({ eachMessage }) => {
  mockEtlKafkaMessageProcessor.mockImplementation(eachMessage);
});
const mockEtlConsumerSubscribe = jest.fn();
const mockEtlConsumerConnect = jest.fn().mockResolvedValue(undefined);

jest.mock('kafkajs', () => {
  return {
    Kafka: jest.fn().mockImplementation(() => ({
      consumer: jest.fn().mockImplementation(() => ({
        connect: mockEtlConsumerConnect,
        subscribe: mockEtlConsumerSubscribe,
        run: mockEtlConsumerRun,
      })),
    })),
  };
});
// --- End KafkaJS Mock Setup ---

jest.mock('@/lib/supabase'); // Mocks my-nextjs-app/src/lib/supabase.ts
jest.mock('../../etl-engine'); // Corrected path: Mocks my-nextjs-app/integration-layer/etl-engine/index.ts
jest.mock('../orchestrator/config', () => ({ // Mock orchestrator config
  loadOrchestrationConfig: jest.fn().mockResolvedValue({
    topics: { 'event:integration:*': 'test-event-integration-topic' },
    agents: {},
    workflows: {},
  }),
}));

describe('ETL Orchestration', () => {
  let mockSupabaseInsertEtl: jest.Mock;
  let mockSupabaseUpsertEtl: jest.Mock;
  let mockLoadEtlRules: jest.Mock;
  let mockTransform: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabaseInsertEtl = jest.fn().mockResolvedValue({});
    mockSupabaseUpsertEtl = jest.fn().mockResolvedValue({});
    (supabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'integration_events') {
        return { insert: mockSupabaseInsertEtl };
      }
      if (tableName === 'clients') {
        return { upsert: mockSupabaseUpsertEtl };
      }
      return { insert: jest.fn(), upsert: jest.fn() }; // Default for any other table
    });

    // Mock EtlEngine methods
    // Note: EtlEngine is class-mocked by jest.mock('../../etl-engine')
    // So, its prototype methods need to be mocked on an instance or its constructor.
    mockLoadEtlRules = jest.fn().mockResolvedValue({ ruleType: 'DeduplicateData' });
    mockTransform = jest.fn().mockResolvedValue({ client_id: 'client-transformed-1', name: 'Jane Transformed Doe' });
    
    // Access the mocked constructor to set prototype mocks
    const MockedEtlEngine = EtlEngine as jest.MockedClass<typeof EtlEngine>;
    MockedEtlEngine.prototype.loadEtlRules = mockLoadEtlRules;
    MockedEtlEngine.prototype.transform = mockTransform;
  });

  it('connects, subscribes, transforms, and stores an integration event, then upserts client', async () => {
    const event = {
      event_type: 'integration:client_updated',
      tenant_id: 'tenant-etl-1',
      payload: { source_service: 'Stripe', original_client_id: 'client-raw-1', original_name: 'John Raw Doe' },
    };
    const transformedPayload = { client_id: 'client-transformed-1', name: 'Jane Transformed Doe' };
    mockTransform.mockResolvedValue(transformedPayload); // Ensure transform mock returns the expected shape

    await startEtlOrchestration();

    expect(mockEtlConsumerConnect).toHaveBeenCalled();
    expect(mockEtlConsumerSubscribe).toHaveBeenCalledWith({ topic: 'test-event-integration-topic' });
    expect(mockEtlConsumerRun).toHaveBeenCalled();

    // Simulate Kafka message
    if (mockEtlKafkaMessageProcessor.getMockImplementation()) {
      await mockEtlKafkaMessageProcessor({ message: { value: Buffer.from(JSON.stringify(event)) } });
    } else {
      throw new Error('ETL Kafka consumer.run was not called with eachMessage or mock was not set.');
    }

    // Verify ETL Engine calls
    expect(mockLoadEtlRules).toHaveBeenCalledWith(event.tenant_id);
    expect(mockTransform).toHaveBeenCalledWith(event.payload, { ruleType: 'DeduplicateData' }, event.tenant_id);

    // Verify Supabase interactions
    expect(supabase.from).toHaveBeenCalledWith('integration_events');
    expect(mockSupabaseInsertEtl).toHaveBeenCalledWith({
      tenant_id: event.tenant_id,
      event_type: event.event_type,
      raw_payload: event.payload,
      normalized_payload: transformedPayload,
      source_service: event.payload.source_service,
    });

    expect(supabase.from).toHaveBeenCalledWith('clients');
    expect(mockSupabaseUpsertEtl).toHaveBeenCalledWith({
      id: transformedPayload.client_id,
      tenant_id: event.tenant_id,
      name: transformedPayload.name,
    });
  });

  it('handles null message value gracefully in ETL orchestration', async () => {
    await startEtlOrchestration();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    if (mockEtlKafkaMessageProcessor.getMockImplementation()) {
      await mockEtlKafkaMessageProcessor({ message: { value: null } });
    } else {
      throw new Error('ETL Kafka consumer.run was not called with eachMessage or mock was not set.');
    }
    expect(consoleErrorSpy).toHaveBeenCalledWith('Kafka message value is null or undefined for ETL orchestration');
    expect(supabase.from).not.toHaveBeenCalledWith('integration_events');
    consoleErrorSpy.mockRestore();
  });

  it('handles missing tenant_id in event gracefully', async () => {
    const eventWithoutTenant = {
      event_type: 'integration:some_event',
      payload: { data: 'some_data' },
      // tenant_id is missing
    };
    await startEtlOrchestration();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    if (mockEtlKafkaMessageProcessor.getMockImplementation()) {
      await mockEtlKafkaMessageProcessor({ message: { value: Buffer.from(JSON.stringify(eventWithoutTenant)) } });
    } else {
      throw new Error('ETL Kafka consumer.run was not called with eachMessage or mock was not set.');
    }
    expect(consoleErrorSpy).toHaveBeenCalledWith('tenant_id is missing in the event for ETL orchestration:', eventWithoutTenant);
    expect(mockLoadEtlRules).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
    it('does not upsert client if event_type does not include "client"', async () => {
    const event = {
      event_type: 'integration:product_updated', // Not a client event
      tenant_id: 'tenant-etl-2',
      payload: { source_service: 'Shopify', product_id: 'prod-123' },
    };
    const transformedPayload = { product_id_norm: 'prod-norm-123', category: 'electronics' };
    mockTransform.mockResolvedValue(transformedPayload);

    await startEtlOrchestration();

    if (mockEtlKafkaMessageProcessor.getMockImplementation()) {
      await mockEtlKafkaMessageProcessor({ message: { value: Buffer.from(JSON.stringify(event)) } });
    } else {
      throw new Error('ETL Kafka consumer.run was not called with eachMessage or mock was not set.');
    }

    expect(supabase.from).toHaveBeenCalledWith('integration_events');
    expect(mockSupabaseInsertEtl).toHaveBeenCalled();
    expect(mockSupabaseUpsertEtl).not.toHaveBeenCalled(); // Should not call upsert for 'clients'
  });
});