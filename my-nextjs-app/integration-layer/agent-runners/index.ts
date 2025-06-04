// integration-layer/agent-runners/index.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { Kafka, Consumer, Producer, EachMessagePayload } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../src/lib/supabase'; // Corrected path
import { generateExplanation } from '../explainable-ai'; // Corrected path
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { getTenantConfig } from '../config/tenantConfig'; // TenantConfig will be defined locally

const tracer = trace.getTracer('agent-runner-pool');

// Define TenantConfig based on the structure returned by getTenantConfig
export interface TenantConfig {
  id: string;
  name: string;
  etlRulesPath: string;
  embeddingModel: string;
  // Add other tenant-specific configurations as needed
}

export interface Task {
  id: string;
  agentId: string;
  // ... other task properties
  // Example: payload: any;
}

export interface Agent {
  id: string;
  name: string;
  // ... other agent properties
  execute: (task: Task, supabaseClient: SupabaseClient, tenantConfig: TenantConfig) => Promise<any>;
}

class AgentRunner {
  private supabaseClient: SupabaseClient;
  private kafka: Kafka;
  private consumer: Consumer;
  private producer: Producer;
  private agents: Map<string, Agent> = new Map();
  private tenantConfig!: TenantConfig; // Will be initialized in start()

  constructor(initialAgent: Agent) {
    this.agents.set(initialAgent.id, initialAgent);
    this.supabaseClient = supabase; // Use the imported instance
    // this.tenantConfig will be initialized in start()

    this.kafka = new Kafka({
      clientId: `agent-runner-${initialAgent.id}-${uuidv4()}`, // Ensure unique client ID
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    });
    this.producer = this.kafka.producer();
    // Ensure unique groupId if multiple instances of the same agent runner are deployed
    this.consumer = this.kafka.consumer({ groupId: `agent-group-${initialAgent.id}` });
  }

  public registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    console.log(`Agent ${agent.name} registered to runner.`);
  }


  public async start(): Promise<void> {
    const span = tracer.startSpan('AgentRunner.start');
    try {
      // Initialize tenantConfig
      this.tenantConfig = await getTenantConfig('default-tenant'); // Added await and default ID
      if (!this.tenantConfig) {
        throw new Error('Failed to initialize tenant configuration.');
      }
      console.log('Tenant configuration initialized:', this.tenantConfig);

      await this.producer.connect();
      await this.consumer.connect();

      const agentIds = Array.from(this.agents.keys());
      if (agentIds.length === 0) {
        console.warn('No agents registered. Consumer will not subscribe to any topics.');
        span.end();
        return;
      }

      // Using a common topic 'agent-tasks'.
      // Tasks should have an 'agentId' field to be routed to the correct agent logic.
      await this.consumer.subscribe({ topic: 'agent-tasks', fromBeginning: true });
      console.log(`Agent runner subscribed to topic: agent-tasks for agents: ${agentIds.join(', ')}`);


      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
          const messageProcessingSpan = tracer.startSpan('AgentRunner.processMessage', {
            attributes: { topic, partition, offset: message.offset?.toString() },
          });
          try {
            if (!message.value) {
              console.warn('Received message with null value, skipping.');
              messageProcessingSpan.addEvent('Null message value received');
              messageProcessingSpan.end();
              return;
            }
            const task = JSON.parse(message.value.toString()) as Task;
            console.log(`Received task ${task.id} for agent ${task.agentId}`);

            const agent = this.agents.get(task.agentId);
            if (agent) {
              const executionSpan = tracer.startSpan('AgentRunner.executeTask', {
                attributes: { agentId: agent.id, taskId: task.id },
              });
              try {
                const output = await agent.execute(task, this.supabaseClient, this.tenantConfig);
                console.log(`Task ${task.id} completed by agent ${agent.id}. Output:`, output);

                const explanation = await generateExplanation(agent.id, task.id, output);
                console.log(`Explanation for task ${task.id}: ${explanation}`);

                await this.producer.send({
                  topic: 'task-results',
                  messages: [{ value: JSON.stringify({ taskId: task.id, output, explanation, status: 'completed' }) }],
                });
                executionSpan.addEvent('Task execution successful and result sent.');
              } catch (error) {
                console.error(`Error executing task ${task.id} by agent ${agent.id}:`, error);
                executionSpan.recordException(error as Error);
                executionSpan.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
                await this.producer.send({
                  topic: 'task-results', 
                  messages: [{ value: JSON.stringify({ taskId: task.id, error: (error as Error).message, status: 'failed' }) }],
                });
              } finally {
                executionSpan.end();
              }
            } else {
              console.warn(`No agent registered for agentId: ${task.agentId}. Task ${task.id} ignored.`);
              messageProcessingSpan.addEvent('No agent registered for task', { agentId: task.agentId });
            }
          } catch (error) {
            console.error('Error processing message:', error);
            messageProcessingSpan.recordException(error as Error);
            messageProcessingSpan.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
          } finally {
            messageProcessingSpan.end();
          }
        },
      });
    } catch (error) {
      console.error('Failed to start agent runner:', error);
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      throw error; 
    } finally {
      span.end();
    }
  }

  public async stop(): Promise<void> {
    const span = tracer.startSpan('AgentRunner.stop');
    try {
      await this.consumer.disconnect();
      await this.producer.disconnect();
      console.log('Agent runner stopped.');
    } catch (error) {
      console.error('Error stopping agent runner:', error);
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
    } finally {
      span.end();
    }
  }
}

const exampleAgent: Agent = {
  id: 'example-agent-001',
  name: 'Example Agent',
  execute: async (task: Task, supabaseClient: SupabaseClient, tenantConfig: TenantConfig) => {
    const span = trace.getTracer('example-agent').startSpan('ExampleAgent.execute', {
      attributes: { taskId: task.id, agentId: task.agentId },
    });
    try {
      console.log(`Example Agent executing task ${task.id} with config for tenant: ${tenantConfig.id}`); // Changed tenantConfig.tenantId to tenantConfig.id
      await new Promise(resolve => setTimeout(resolve, 1000));
      const result = { message: `Task ${task.id} processed by Example Agent.` };
      span.addEvent('Task processing complete.');
      return result;
    } catch (error) {
      console.error(`Example Agent error executing task ${task.id}:`, error);
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  },
};

const runner = new AgentRunner(exampleAgent);

export { AgentRunner, runner as defaultAgentRunner };
// Agent and Task are already exported at their definition.
// TenantConfig is also exported at its definition.
// If we need to re-export TenantConfig with an alias as a type:
export type { TenantConfig as AgentRunnerTenantConfig };