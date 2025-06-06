// integration-layer/llm-workflows/tests/index.test.ts
import { startLlmWorkflows } from '../index';
import { supabase } from '@/lib/supabase'; // Used for mock setup

// --- KafkaJS Mock Setup ---
const mockLlmKafkaMessageProcessor = jest.fn();
const mockLlmConsumerRun = jest.fn(async ({ eachMessage }) => {
  mockLlmKafkaMessageProcessor.mockImplementation(eachMessage);
});
const mockLlmConsumerSubscribe = jest.fn();
const mockLlmConsumerConnect = jest.fn().mockResolvedValue(undefined);

jest.mock('kafkajs', () => {
  return {
    Kafka: jest.fn().mockImplementation(() => ({
      consumer: jest.fn().mockImplementation(() => ({
        connect: mockLlmConsumerConnect,
        subscribe: mockLlmConsumerSubscribe,
        run: mockLlmConsumerRun,
      })),
    })),
  };
});
// --- End KafkaJS Mock Setup ---

jest.mock('@/lib/supabase'); // Mocks my-nextjs-app/src/lib/supabase.ts
jest.mock('../orchestrator/config', () => ({ // Mock orchestrator config
  loadOrchestrationConfig: jest.fn().mockResolvedValue({
    topics: { 'event:client:*': 'test-event-client-topic' },
    agents: {},
    workflows: {},
  }),
}));

describe('LLM Workflows', () => {
  let mockSupabaseSelect: jest.Mock;
  let mockSupabaseInsertLlm: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabaseSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnThis(), // Allows chaining .eq().eq()
      single: jest.fn().mockResolvedValue({ data: { content: 'Welcome Email Template' }, error: null }),
    });
    mockSupabaseInsertLlm = jest.fn().mockResolvedValue({});

    (supabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'template_library') {
        return { select: mockSupabaseSelect };
      }
      if (tableName === 'interactions') {
        return { insert: mockSupabaseInsertLlm };
      }
      return {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: {}, error: null }),
      };
    });
  });

  it('connects, subscribes, fetches a template, generates content, and inserts into interactions', async () => {
    const event = {
      event_type: 'client:report_needed', // Example: client:report_needed -> report_needed
      tenant_id: 'tenant-1',
      payload: { client_id: 'client-1', user_id: 'user-1' },
    };

    await startLlmWorkflows();

    expect(mockLlmConsumerConnect).toHaveBeenCalled();
    expect(mockLlmConsumerSubscribe).toHaveBeenCalledWith({ topic: 'test-event-client-topic' });
    expect(mockLlmConsumerRun).toHaveBeenCalled();

    // Simulate Kafka message
    if (mockLlmKafkaMessageProcessor.getMockImplementation()) {
      await mockLlmKafkaMessageProcessor({ message: { value: Buffer.from(JSON.stringify(event)) } });
    } else {
      throw new Error('LLM Kafka consumer.run was not called with eachMessage or mock was not set.');
    }

    // Verify template fetching
    expect(supabase.from).toHaveBeenCalledWith('template_library');
    expect(mockSupabaseSelect).toHaveBeenCalledWith('content');
    expect(mockSupabaseSelect().eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(mockSupabaseSelect().eq().eq).toHaveBeenCalledWith('template_type', 'report_needed'); // From event_type
    expect(mockSupabaseSelect().eq().eq().single).toHaveBeenCalled();


    // Verify interaction insertion
    expect(supabase.from).toHaveBeenCalledWith('interactions');
    expect(mockSupabaseInsertLlm).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      content: 'Generated content using template "Welcome Email Template" for client: client-1, user: user-1',
    });
  });

  it('handles null message value gracefully in LLM workflow', async () => {
    await startLlmWorkflows();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    if (mockLlmKafkaMessageProcessor.getMockImplementation()) {
      await mockLlmKafkaMessageProcessor({ message: { value: null } });
    } else {
      throw new Error('LLM Kafka consumer.run was not called with eachMessage or mock was not set.');
    }
    expect(consoleErrorSpy).toHaveBeenCalledWith('Kafka message value is null or undefined for LLM workflow');
    expect(supabase.from).not.toHaveBeenCalledWith('interactions');
    consoleErrorSpy.mockRestore();
  });

  it('uses default template if fetching template fails', async () => {
    // Override supabase mock for this specific test case
    mockSupabaseSelect.mockReturnValueOnce({ // For template_library
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
    });
     (supabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'template_library') {
        return { select: mockSupabaseSelect };
      }
      if (tableName === 'interactions') {
        return { insert: mockSupabaseInsertLlm };
      }
      return {};
    });


    const event = {
      event_type: 'client:onboarding_email',
      tenant_id: 'tenant-2',
      payload: { client_id: 'client-2', user_id: 'user-2' },
    };

    await startLlmWorkflows();
    if (mockLlmKafkaMessageProcessor.getMockImplementation()) {
      await mockLlmKafkaMessageProcessor({ message: { value: Buffer.from(JSON.stringify(event)) } });
    } else {
      throw new Error('LLM Kafka consumer.run was not called with eachMessage or mock was not set.');
    }

    expect(mockSupabaseInsertLlm).toHaveBeenCalledWith(expect.objectContaining({
      content: 'Generated content using template "Default template (error fetching)" for client: client-2, user: user-2',
    }));
  });
});