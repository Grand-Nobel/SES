// import * as tf from '@tensorflow/tfjs'; // tf is unused
import { load, UniversalSentenceEncoder } from '@tensorflow-models/universal-sentence-encoder'; // Import UniversalSentenceEncoder
import { InferenceSession, Tensor } from 'onnxjs';
import { supabase } from './supabase'; // Assuming supabase is in the same lib directory

export class CommandParser {
  private model!: UniversalSentenceEncoder; // Use UniversalSentenceEncoder type
  private session!: InferenceSession;

  async init() {
    this.model = await load();
    this.session = new InferenceSession();
    // Assuming '/models/bert.onnx' is accessible via public directory or similar
    await this.session.loadModel('/models/bert.onnx');
  }

  async parseCommand(query: string): Promise<string[]> {
    try {
      const embeddings = await this.model.embed([query]);
      const inputTensorData = embeddings.dataSync();
      const inputTensorShape = embeddings.shape;

      // Create an ONNX.js Tensor from TensorFlow.js data
      const onnxInput = new Tensor(inputTensorData, 'float32', inputTensorShape); // Corrected Tensor constructor arguments

      const results = await this.session.run([onnxInput]); // Pass input as an array

      // Assuming the output tensor is named 'output'
      const outputTensor = results.get('output');
      if (!outputTensor) {
        throw new Error("ONNX output tensor 'output' not found.");
      }
      const outputData = outputTensor.data as Float32Array;

      const commands = Array.from(outputData).map((score, i) => ({
        command: ['open_leads', 'create_task'][i], // Placeholder command names
        score,
      }));
      return commands.filter((c) => c.score > 0.8).map((c) => c.command);
    } catch (error) {
      console.error('Client-side NLP failed, falling back to server:', error);
      return await this.fallbackToServer(query);
    }
  }

  private async fallbackToServer(query: string): Promise<string[]> {
    const { data, error } = await supabase.rpc('fetch_commands', { query });
    if (error) {
      console.error('Error fetching commands from RPC:', error);
      throw error;
    }
    return data;
  }
}
