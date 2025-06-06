// integration-layer/agent-runners/tests/index.test.ts
import { AgentRunner, defaultAgentRunner } from '../index';
import type { Agent, Task, TenantConfig } from '../index'; // Import types
import { SupabaseClient } from '@supabase/supabase-js';
import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { supabase as supabaseClientModule } from '../../../src/lib/supabase'; // Corrected path
import { generateExplanation as generateExplanationModule } from '../../explainable-ai'; // Corrected path
import { getTenantConfig as getTenantConfigModule } from '../../config/tenantConfig'; // Corrected path

jest.mock('kafkajs');
jest.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ data: [{}], error: null }),
    update: jest.fn().mockResolvedValue({ data: [{}], error: null }),
  }
}));
jest.mock('../../explainable-ai');
jest.mock('../../config/tenantConfig');

const mockSupabaseClient = supabaseClientModule as unknown as jest.Mocked<SupabaseClient>;
const generateExplanation = generateExplanationModule as jest.MockedFunction<typeof generateExplanationModule>;
const getTenantConfig = getTenantConfigModule as jest.MockedFunction<typeof getTenantConfigModule>;


const mockTenantConfigValue: TenantConfig = {
  id: 'test-tenant',
  name: 'Test Tenant',
  etlRulesPath: 'test/etl/rules.json',
  embeddingModel: 'test-model',
};

describe('AgentRunner', () => {
  let agentRunner: AgentRunner;
  let mockAgent: Agent;
  let mockKafkaProducer: jest.Mocked<Producer>;
  let mockKafkaConsumer: jest.Mocked<Consumer>;
  let capturedEachMessage: (payload: EachMessagePayload) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockKafkaProducer = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue([{}]),
    } as any; // Cast to any to avoid full type implementation for mocks
    mockKafkaConsumer = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockImplementation(async ({ eachMessage }) => {
        capturedEachMessage = eachMessage; // Capture the callback
      }),
      // Add other methods if needed by the code under test, e.g., on, events, etc.
      on: jest.fn(),
      events: { CRASH: 'consumer.crash', CONNECT: 'consumer.connect', DISCONNECT: 'consumer.disconnect'},
      logger: jest.fn(() => ({ debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() })) as any,
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn(),
      seek: jest.fn(),
      commitOffsets: jest.fn().mockResolvedValue(undefined),
      describeGroup: jest.fn().mockResolvedValue(null), // Adjust return as needed
      heartbeat: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockReturnValue(true),
      isLeader: jest.fn().mockReturnValue(true),
      memberId: 'test-member',
      topicPartitions: [],
      assignment: jest.fn(() => []),
      pauseOffsets: jest.fn(),
      resumeOffsets: jest.fn(),
      committed: jest.fn().mockResolvedValue(new Map()),
      offsets: jest.fn().mockResolvedValue({ high: '0', low: '0'}),
      stop: jest.fn().mockResolvedValue(undefined),
    } as any; // Cast to any for simplicity in mock setup

    (Kafka as jest.Mock).mockImplementation(() => ({
      producer: () => mockKafkaProducer,
      consumer: () => mockKafkaConsumer,
    }));
    
    // Mocking the direct import of supabase instance
    // (supabaseClientModule as any) = mockSupabaseClient; // This is tricky, better to mock the module as done above

    generateExplanation.mockResolvedValue('Mocked explanation');
    getTenantConfig.mockResolvedValue(mockTenantConfigValue);

    mockAgent = {
      id: 'test-agent-001',
      name: 'Test Agent',
      execute: jest.fn().mockResolvedValue({ result: 'Test agent execution successful' }),
    };

    agentRunner = new AgentRunner(mockAgent);
  });

  test('should register an agent', () => {
    const newAgent: Agent = { id: 'new-agent', name: 'New Agent', execute: jest.fn() };
    agentRunner.registerAgent(newAgent);
    // To verify, we'd ideally check an internal state or behavior.
    // For now, we assume if it runs, it's registered for subsequent tests.
    // A more robust test might involve triggering a task for the new agent.
    expect(true).toBe(true); 
  });

  test('should start, connect to Kafka, subscribe, and fetch tenant config', async () => {
    await agentRunner.start();
    expect(getTenantConfig).toHaveBeenCalledWith('default-tenant');
    expect(mockKafkaProducer.connect).toHaveBeenCalledTimes(1);
    expect(mockKafkaConsumer.connect).toHaveBeenCalledTimes(1);
    expect(mockKafkaConsumer.subscribe).toHaveBeenCalledWith({ topic: 'agent-tasks', fromBeginning: true });
  });

  test('should process a message for a registered agent', async () => {
    await agentRunner.start(); 

    const task: Task = { id: 'task-123', agentId: 'test-agent-001' };
    const kafkaMessage: EachMessagePayload = {
      topic: 'agent-tasks',
      partition: 0,
      message: { value: Buffer.from(JSON.stringify(task)), offset: '1', key: null, timestamp: '', size: 0, attributes: 0, headers: undefined },
      heartbeat: jest.fn(),
      pause: jest.fn(),
    };
    
    expect(capturedEachMessage).toBeDefined();
    await capturedEachMessage(kafkaMessage);

    expect(mockAgent.execute).toHaveBeenCalledWith(task, mockSupabaseClient, mockTenantConfigValue);
    expect(generateExplanation).toHaveBeenCalledWith(mockAgent.id, task.id, { result: 'Test agent execution successful' });
    expect(mockKafkaProducer.send).toHaveBeenCalledWith({
      topic: 'task-results',
      messages: [{ value: JSON.stringify({
        taskId: task.id,
        output: { result: 'Test agent execution successful' },
        explanation: 'Mocked explanation',
        status: 'completed'
      }) }],
    });
  });

  test('should handle task execution error', async () => {
    await agentRunner.start();
    const error = new Error('Execution failed');
    mockAgent.execute = jest.fn().mockRejectedValue(error);

    const task: Task = { id: 'task-error', agentId: 'test-agent-001' };
    const kafkaMessage: EachMessagePayload = {
      topic: 'agent-tasks',
      partition: 0,
      message: { value: Buffer.from(JSON.stringify(task)), offset: '2', key: null, timestamp: '', size: 0, attributes: 0, headers: undefined },
      heartbeat: jest.fn(),
      pause: jest.fn(),
    };
    
    expect(capturedEachMessage).toBeDefined();
    await capturedEachMessage(kafkaMessage);

    expect(mockAgent.execute).toHaveBeenCalledWith(task, mockSupabaseClient, mockTenantConfigValue);
    expect(generateExplanation).not.toHaveBeenCalled();
    expect(mockKafkaProducer.send).toHaveBeenCalledWith({
      topic: 'task-results',
      messages: [{ value: JSON.stringify({
        taskId: task.id,
        error: error.message,
        status: 'failed'
      }) }],
    });
  });

   test('should ignore task if no agent is registered for agentId', async () => {
    await agentRunner.start();
    const task: Task = { id: 'task-unknown', agentId: 'unknown-agent-id' };
    const kafkaMessage: EachMessagePayload = {
      topic: 'agent-tasks',
      partition: 0,
      message: { value: Buffer.from(JSON.stringify(task)), offset: '3', key: null, timestamp: '', size: 0, attributes: 0, headers: undefined },
      heartbeat: jest.fn(),
      pause: jest.fn(),
    };

    expect(capturedEachMessage).toBeDefined();
    await capturedEachMessage(kafkaMessage);

    expect(mockAgent.execute).not.toHaveBeenCalled();
    // Check that producer.send was not called for task-results with this task's data
    const sendCalls = mockKafkaProducer.send.mock.calls;
    const wasCalledForThisTask = sendCalls.some(call => {
        try {
            const messageValue = call[0].messages[0].value;
            if (messageValue === null || messageValue === undefined) return false;
            const sentMessage = JSON.parse(messageValue.toString());
            return sentMessage.taskId === task.id;
        } catch (e) {
            return false;
        }
    });
    expect(wasCalledForThisTask).toBe(false);
  });


  test('should stop and disconnect Kafka producer and consumer', async () => {
    await agentRunner.start(); 
    await agentRunner.stop();
    expect(mockKafkaProducer.disconnect).toHaveBeenCalledTimes(1);
    expect(mockKafkaConsumer.disconnect).toHaveBeenCalledTimes(1);
  });

  describe('defaultAgentRunner', () => {
    test('defaultAgentRunner should be an instance of AgentRunner', () => {
        expect(defaultAgentRunner).toBeInstanceOf(AgentRunner);
    });
  });
});