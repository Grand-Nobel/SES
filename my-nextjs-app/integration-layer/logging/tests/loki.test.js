// integration-layer/logging/tests/loki.test.js

// This is a Jest test file to check the configuration of the Grafana Loki dashboard.
// It verifies that the dashboard JSON is structured as expected.

describe('Loki Dashboard Configuration', () => {
  let dashboardJson;

  beforeAll(() => {
    // Dynamically require the dashboard JSON to access its content.
    // Ensure the path is correct relative to this test file.
    try {
      dashboardJson = require('../loki-dashboard.json');
    } catch (error) {
      console.error("Failed to load loki-dashboard.json. Make sure the file exists at the correct path and is valid JSON.", error);
      // Throw an error to fail the test suite if the dashboard can't be loaded.
      throw new Error("Could not load loki-dashboard.json for testing.");
    }
  });

  it('should have a title for SES Orchestration Logs', () => {
    expect(dashboardJson.title).toBe('SES Orchestration Logs');
  });

  it('should define at least two panels', () => {
    expect(dashboardJson.panels).toBeDefined();
    expect(dashboardJson.panels.length).toBeGreaterThanOrEqual(2);
  });

  it('should have a panel for Orchestrator Logs with correct query', () => {
    const orchestratorPanel = dashboardJson.panels.find(panel => panel.title === 'Orchestrator Logs');
    expect(orchestratorPanel).toBeDefined();
    expect(orchestratorPanel.type).toBe('logs');
    expect(orchestratorPanel.targets).toBeDefined();
    expect(orchestratorPanel.targets.length).toBeGreaterThanOrEqual(1);
    expect(orchestratorPanel.targets[0].expr).toBe('{job="orchestrator", app="ses-orchestration"}');
    expect(orchestratorPanel.datasource.uid).toBe('${DS_LOKI}');
  });

  it('should have a panel for Agent Runner Logs with correct query', () => {
    const agentRunnerPanel = dashboardJson.panels.find(panel => panel.title === 'Agent Runner Logs');
    expect(agentRunnerPanel).toBeDefined();
    expect(agentRunnerPanel.type).toBe('logs');
    expect(agentRunnerPanel.targets).toBeDefined();
    expect(agentRunnerPanel.targets.length).toBeGreaterThanOrEqual(1);
    expect(agentRunnerPanel.targets[0].expr).toBe('{job="agent-runner", app="ses-orchestration"}');
    expect(agentRunnerPanel.datasource.uid).toBe('${DS_LOKI}');
  });

  it('should use a Loki datasource variable for panels', () => {
    dashboardJson.panels.forEach(panel => {
      if (panel.type === 'logs') { // Only check log panels for Loki datasource
        expect(panel.datasource).toBeDefined();
        expect(panel.datasource.type).toBe('loki');
        expect(panel.datasource.uid).toBe('${DS_LOKI}');
      }
    });
  });

  it('should have basic dashboard metadata (ID, UID, schemaVersion)', () => {
    // expect(dashboardJson.id).toBeNull(); // Or a specific ID if it's not null
    expect(dashboardJson.uid).toBe('ses-orchestration-logs');
    expect(dashboardJson.schemaVersion).toBe(37); // Or whatever the current schema version is
  });

  it('should be set to dark style and have relevant tags', () => {
    expect(dashboardJson.style).toBe('dark');
    expect(dashboardJson.tags).toEqual(expect.arrayContaining(['ses', 'orchestration', 'loki']));
  });
});