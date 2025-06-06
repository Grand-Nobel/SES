// integration-layer/kpi-model/tests/index.test.ts
import { startKpiModelExecution } from '../index';
import { supabase } from '@/lib/supabase'; // Used for mock setup

// --- KafkaJS Mock Setup ---
// This mock allows us to capture the eachMessage handler and trigger it manually in tests.
const mockKafkaMessageProcessor = jest.fn();
const mockConsumerRun = jest.fn(async ({ eachMessage }) => {
  // Assign the passed eachMessage to our mock function so we can call it from the test
  mockKafkaMessageProcessor.mockImplementation(eachMessage);
});
const mockConsumerSubscribe = jest.fn();
const mockConsumerConnect = jest.fn().mockResolvedValue(undefined); // Ensure connect is a resolved promise

jest.mock('kafkajs', () => {
  return {
    Kafka: jest.fn().mockImplementation(() => ({
      consumer: jest.fn().mockImplementation(() => ({
        connect: mockConsumerConnect,
        subscribe: mockConsumerSubscribe,
        run: mockConsumerRun,
      })),
    })),
  };
});
// --- End KafkaJS Mock Setup ---

jest.mock('@/lib/supabase'); // Mocks my-nextjs-app/src/lib/supabase.ts
jest.mock('../vector-bridge'); // Mocks my-nextjs-app/integration-layer/vector-bridge/index.ts
jest.mock('../orchestrator/config', () => ({ // Mock orchestrator config
  loadOrchestrationConfig: jest.fn().mockResolvedValue({
    topics: { 'event:analytics:*': 'test-event-analytics-topic' },
    agents: {},
    workflows: {},
  }),
}));


describe('KPI Model Execution', () => {
  let mockSupabaseInsert: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabaseInsert = jest.fn().mockResolvedValue({});
    // supabase here is the mocked version due to jest.mock('@/lib/supabase')
    (supabase.from as jest.Mock).mockReturnValue({
      insert: mockSupabaseInsert,
    });

    // Ensure augmentPayload from the mocked vector-bridge is set up
    const mockAugmentPayload = require('../vector-bridge').augmentPayload;
    mockAugmentPayload.mockResolvedValue({ augmented_data: 'some_data', lead_id: 'lead-1' });
  });

  it('connects, subscribes, and processes a message for a KPI model', async () => {
    const event = {
      event_type: 'analytics:hourly_update',
      tenant_id: 'tenant-1',
      payload: { model_name: 'ChurnPredictor', entity_type: 'Client', entity_id: 'client-1' },
    };

    // Start the execution pipeline (this will set up the consumer and call .run)
    await startKpiModelExecution();

    // Verify Kafka consumer setup
    expect(mockConsumerConnect).toHaveBeenCalled();
    expect(mockConsumerSubscribe).toHaveBeenCalledWith({ topic: 'test-event-analytics-topic' });
    expect(mockConsumerRun).toHaveBeenCalled();

    // Simulate a Kafka message arriving by calling the captured eachMessage handler
    // Ensure mockKafkaMessageProcessor has been set by the .run() call
    if (mockKafkaMessageProcessor.getMockImplementation()) {
      await mockKafkaMessageProcessor({ message: { value: Buffer.from(JSON.stringify(event)) } });
    } else {
      throw new Error('Kafka consumer.run was not called with eachMessage or mockKafkaMessageProcessor was not set up.');
    }
    
    // Verify Supabase interaction
    expect(supabase.from).toHaveBeenCalledWith('kpi_predictions');
    expect(mockSupabaseInsert).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      model_name: 'ChurnPredictor',
      entity_type: 'Client',
      entity_id: 'client-1',
      prediction: { result: { churn_risk: 0.75 }, confidence: 0.9 },
    });

    // Verify augmentPayload was called
    const mockAugmentPayload = require('../vector-bridge').augmentPayload;
    expect(mockAugmentPayload).toHaveBeenCalledWith(event.payload, event.tenant_id);
  });

  it('handles null message value gracefully', async () => {
    await startKpiModelExecution(); // Setup consumer

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    if (mockKafkaMessageProcessor.getMockImplementation()) {
      await mockKafkaMessageProcessor({ message: { value: null } });
    } else {
      throw new Error('Kafka consumer.run was not called with eachMessage or mockKafkaMessageProcessor was not set up.');
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith('Kafka message value is null or undefined');
    expect(supabase.from).not.toHaveBeenCalled(); // Should not proceed to DB insert

    consoleErrorSpy.mockRestore();
  });
});