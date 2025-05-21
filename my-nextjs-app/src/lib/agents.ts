// Placeholder for agentRunner
export const agentRunner = {
  run: async (params: any): Promise<{ success: boolean; data: any; message?: string }> => {
    console.log("Mock agentRunner.run called with:", params);
    // In a real application, this would interact with an agent system
    // Simulate a response that includes a message
    let message = "This is a mock response from the AI assistant.";
    if (params.payload?.userInput) {
      message = `Mock response to: "${params.payload.userInput.substring(0, 50)}..."`;
    }
    return { success: true, data: {}, message }; // Mock response with message
  }
};
