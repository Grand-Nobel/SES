// integration-layer/explainable-ai/index.ts
import { supabase } from '../../src/lib/supabase'; // Adjusted path
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('explainable-ai');

export async function generateExplanation(agentId: string, taskId: string, output: any): Promise<string> { // Corrected Promise type
  const span = tracer.startSpan('generateExplanation');
  try {
    const explanation = `Agent ${agentId} processed task ${taskId} with output: ${JSON.stringify(output)}`;
    await supabase
      .from('agent_logs')
      .update({ output_payload: { explanation } })
      .eq('task_id', taskId);

    await supabase
      .from('agent_shadow_action_responses')
      .insert({
        agent_id: agentId,
        task_id: taskId,
        explanation,
      });

    // Ensure the channel name is valid and does not contain special characters
    // that might be problematic for Supabase channels.
    const channelName = `explanations_for_task_${taskId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    await supabase
      .channel(channelName) // Using a more specific channel name, ensuring it's valid
      .send({
        type: 'broadcast',
        event: 'explanation_generated', // More specific event name
        payload: { taskId, explanation, agentId },
      });

    return explanation;
  } catch (error) {
    console.error(`Error in generateExplanation for taskId ${taskId}:`, error);
    // Depending on requirements, you might want to throw the error
    // or return a specific error message/object.
    // For now, rethrowing to ensure visibility of the error.
    throw error;
  }
  finally {
    span.end();
  }
}