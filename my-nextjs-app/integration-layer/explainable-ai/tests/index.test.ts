// integration-layer/explainable-ai/tests/index.test.ts
import { generateExplanation } from '../index';
import { supabase } from '@/lib/supabase'; // Mocked Supabase client

jest.mock('@/lib/supabase'); // Mocks my-nextjs-app/src/lib/supabase.ts

describe('Explainable AI', () => {
  let mockSupabaseUpdate: jest.Mock;
  let mockSupabaseInsert: jest.Mock;
  let mockSupabaseChannelSend: jest.Mock;
  let mockSupabaseChannel: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabaseUpdate = jest.fn().mockReturnThis(); // .eq() will be called on this
    mockSupabaseInsert = jest.fn().mockResolvedValue({});
    mockSupabaseChannelSend = jest.fn().mockResolvedValue({});
    
    // Mock for chained .eq() after .update()
    const updateChainable = { eq: jest.fn().mockResolvedValue({}) };
    mockSupabaseUpdate.mockReturnValue(updateChainable);

    (supabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'agent_logs') {
        return { update: mockSupabaseUpdate };
      }
      if (tableName === 'agent_shadow_action_responses') {
        return { insert: mockSupabaseInsert };
      }
      // Default mock for other tables if any were called unexpectedly
      return {
        update: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({}),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({}),
      };
    });

    mockSupabaseChannel = jest.fn().mockReturnValue({
      send: mockSupabaseChannelSend,
    });
    (supabase.channel as jest.Mock) = mockSupabaseChannel;
  });

  it('generates an explanation, updates logs, inserts response, and sends a channel message', async () => {
    const agentId = 'agent-test-1';
    const taskId = 'task-test-987';
    const output = { result: 'success', details: 'completed successfully' };
    const expectedExplanation = `Agent ${agentId} processed task ${taskId} with output: ${JSON.stringify(output)}`;
    const expectedChannelName = `explanations_for_task_${taskId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    const explanation = await generateExplanation(agentId, taskId, output);

    expect(explanation).toBe(expectedExplanation);

    // Verify agent_logs update
    expect(supabase.from).toHaveBeenCalledWith('agent_logs');
    expect(mockSupabaseUpdate).toHaveBeenCalledWith({ output_payload: { explanation: expectedExplanation } });
    expect(mockSupabaseUpdate().eq).toHaveBeenCalledWith('task_id', taskId);

    // Verify agent_shadow_action_responses insert
    expect(supabase.from).toHaveBeenCalledWith('agent_shadow_action_responses');
    expect(mockSupabaseInsert).toHaveBeenCalledWith({
      agent_id: agentId,
      task_id: taskId,
      explanation: expectedExplanation,
    });

    // Verify Supabase channel send
    expect(supabase.channel).toHaveBeenCalledWith(expectedChannelName);
    expect(mockSupabaseChannelSend).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'explanation_generated',
      payload: { taskId, explanation: expectedExplanation, agentId },
    });
  });

  it('rethrows an error if Supabase operations fail', async () => {
    const agentId = 'agent-err';
    const taskId = 'task-err';
    const output = { result: 'failure' };
    const dbError = new Error('Supabase DB error');

    // Simulate an error during the update operation
    (supabase.from as jest.Mock).mockImplementationOnce((tableName: string) => {
      if (tableName === 'agent_logs') {
        return { 
          update: jest.fn().mockReturnThis(),
          // Make the chained eq call throw an error
          eq: jest.fn().mockRejectedValue(dbError) 
        };
      }
      return {};
    });
    
    // Mock console.error to prevent test output pollution
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(generateExplanation(agentId, taskId, output)).rejects.toThrow(dbError);
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(`Error in generateExplanation for taskId ${taskId}:`, dbError);
    consoleErrorSpy.mockRestore();
  });
});