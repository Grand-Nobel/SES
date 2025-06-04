// integration-layer/extensibility/tests/index.test.ts
import { startExtensibility } from '../index';
import { supabase } from '@/lib/supabase'; // Used for mock setup
import axios from 'axios'; // Used for mock setup

// --- KafkaJS Mock Setup ---
const mockExtensibilityKafkaMessageProcessor = jest.fn();
const mockExtensibilityConsumerRun = jest.fn(async ({ eachMessage }) => {
  mockExtensibilityKafkaMessageProcessor.mockImplementation(eachMessage);
});
const mockExtensibilityConsumerSubscribe = jest.fn();
const mockExtensibilityConsumerConnect = jest.fn().mockResolvedValue(undefined);

jest.mock('kafkajs', () => {
  return {
    Kafka: jest.fn().mockImplementation(() => ({
      consumer: jest.fn().mockImplementation(() => ({
        connect: mockExtensibilityConsumerConnect,
        subscribe: mockExtensibilityConsumerSubscribe,
        run: mockExtensibilityConsumerRun,
      })),
    })),
  };
});
// --- End KafkaJS Mock Setup ---

jest.mock('@/lib/supabase'); // Mocks my-nextjs-app/src/lib/supabase.ts
jest.mock('axios'); // Mocks axios
jest.mock('../orchestrator/config', () => ({ // Mock orchestrator config
  loadOrchestrationConfig: jest.fn().mockResolvedValue({
    topics: { 'event:user:*': 'test-event-user-topic' },
    agents: {},
    workflows: {},
  }),
}));

describe('User-Defined Extensibility', () => {
  let mockSupabaseSelectExt: jest.Mock;
  let mockSupabaseInsertExt: jest.Mock;
  let mockAxiosPost: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabaseSelectExt = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnThis(), // Allows chaining .eq().eq()
    });
    mockSupabaseInsertExt = jest.fn().mockResolvedValue({});

    (supabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'workflow_definitions') {
        // Ensure the chained 'eq' calls eventually resolve with mock data
        const eqChain = { eq: jest.fn().mockResolvedValue({ data: [{ workflow_definition_id: 'wf-def-1', trigger_config: { event_type: 'user:trigger_event' }, action: { type: 'api_call', url: 'http://test.example.com/action', headers: { 'X-Test': 'true' } } }], error: null }) };
        mockSupabaseSelectExt.mockReturnValue(eqChain);
        return { select: mockSupabaseSelectExt };
      }
      if (tableName === 'workflow_runs') {
        return { insert: mockSupabaseInsertExt };
      }
      return { select: jest.fn().mockReturnThis(), insert: jest.fn() };
    });

    mockAxiosPost = axios.post as jest.Mock;
    mockAxiosPost.mockResolvedValue({ data: { success: true } });
  });

  it('connects, subscribes, fetches rules, executes an API call action, and logs workflow run', async () => {
    const event = {
      event_type: 'user:trigger_event',
      tenant_id: 'tenant-ext-1',
      payload: { custom_data: 'some_value', id: 'payload-id-1' },
    };
    const ruleAction = { type: 'api_call', url: 'http://test.example.com/action', headers: { 'X-Test': 'true' } };

    // Adjust mock for workflow_definitions to return the specific rule
     (supabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'workflow_definitions') {
        return { 
          select: jest.fn().mockReturnThis(), // for .select(...)
          eq: jest.fn().mockReturnThis(), // for first .eq(...)
          // Make the second .eq call (which is chained) resolve with the data
          mockResolvedThis: jest.fn().mockResolvedValue({ data: [{ workflow_definition_id: 'wf-def-1', trigger_config: { event_type: event.event_type }, action: ruleAction }], error: null })
        };
      }
      if (tableName === 'workflow_runs') {
        return { insert: mockSupabaseInsertExt };
      }
      return { select: jest.fn().mockReturnThis(), insert: jest.fn() };
    });
    // More precise mock for the select chain for workflow_definitions
    const mockEqTenant = jest.fn().mockReturnThis();
    const mockEqEventType = jest.fn().mockResolvedValue({ data: [{ workflow_definition_id: 'wf-def-1', trigger_config: { event_type: event.event_type }, action: ruleAction }], error: null });
    mockEqTenant.mockImplementation(() => ({ eq: mockEqEventType }));
     (supabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'workflow_definitions') {
        return { select: jest.fn(() => ({ eq: mockEqTenant })) };
      }
      if (tableName === 'workflow_runs') {
        return { insert: mockSupabaseInsertExt };
      }
      return {};
    });


    await startExtensibility();

    expect(mockExtensibilityConsumerConnect).toHaveBeenCalled();
    expect(mockExtensibilityConsumerSubscribe).toHaveBeenCalledWith({ topic: 'test-event-user-topic' });
    expect(mockExtensibilityConsumerRun).toHaveBeenCalled();

    // Simulate Kafka message
    if (mockExtensibilityKafkaMessageProcessor.getMockImplementation()) {
      await mockExtensibilityKafkaMessageProcessor({ message: { value: Buffer.from(JSON.stringify(event)) } });
    } else {
      throw new Error('Extensibility Kafka consumer.run was not called with eachMessage or mock was not set.');
    }

    // Verify rule fetching
    expect(supabase.from).toHaveBeenCalledWith('workflow_definitions');
    expect(mockEqTenant).toHaveBeenCalledWith('tenant_id', event.tenant_id);
    expect(mockEqEventType).toHaveBeenCalledWith('trigger_config->>event_type', event.event_type);


    // Verify action execution
    expect(mockAxiosPost).toHaveBeenCalledWith(ruleAction.url, event.payload, { headers: ruleAction.headers });

    // Verify workflow run logging
    expect(supabase.from).toHaveBeenCalledWith('workflow_runs');
    expect(mockSupabaseInsertExt).toHaveBeenCalledWith({
      tenant_id: event.tenant_id,
      workflow_definition_id: 'wf-def-1', // from the mocked rule
      status: 'completed',
      context: event.payload,
    });
  });

  it('handles unsupported action type gracefully', async () => {
    const event = {
      event_type: 'user:other_trigger',
      tenant_id: 'tenant-ext-2',
      payload: { data: 'test2' },
    };
    const unsupportedRuleAction = { type: 'send_email', recipient: 'test@example.com' };
    
    const mockEqTenantUnsupported = jest.fn().mockReturnThis();
    const mockEqEventTypeUnsupported = jest.fn().mockResolvedValue({ data: [{ workflow_definition_id: 'wf-def-2', trigger_config: { event_type: event.event_type }, action: unsupportedRuleAction }], error: null });
    mockEqTenantUnsupported.mockImplementation(() => ({ eq: mockEqEventTypeUnsupported }));

    (supabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'workflow_definitions') {
        return { select: jest.fn(() => ({ eq: mockEqTenantUnsupported })) };
      }
       if (tableName === 'workflow_runs') { // Still need to mock this for the insert call
        return { insert: mockSupabaseInsertExt };
      }
      return {};
    });
    
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await startExtensibility();

    if (mockExtensibilityKafkaMessageProcessor.getMockImplementation()) {
      await mockExtensibilityKafkaMessageProcessor({ message: { value: Buffer.from(JSON.stringify(event)) } });
    } else {
      throw new Error('Extensibility Kafka consumer.run was not called with eachMessage or mock was not set.');
    }

    expect(mockAxiosPost).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(`Unsupported action type: ${unsupportedRuleAction.type}`);
    // Check that workflow_runs is still called
    expect(mockSupabaseInsertExt).toHaveBeenCalledWith(expect.objectContaining({
        workflow_definition_id: 'wf-def-2'
    }));
    consoleWarnSpy.mockRestore();
  });
});