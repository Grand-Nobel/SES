// integration-layer/tests/load-test.test.js

// This is a Jest test file to check the configuration of the k6 script.
// It does not run k6 itself but verifies the k6 script's options.

// Mock k6 modules that are imported in load-test.js but not relevant for this options check.
// If load-test.js directly executed code at the module level that depended on k6 runtime,
// more extensive mocking might be needed.
jest.mock('k6/http', () => ({
  __esModule: true, // This is important for ES modules
  default: {
    get: jest.fn(),
    post: jest.fn(),
    // Add other http methods if used in global scope of load-test.js
  },
}));
jest.mock('k6', () => ({
  check: jest.fn(),
  sleep: jest.fn(),
  group: jest.fn(),
  // Add other k6 functions if used in global scope of load-test.js
}));
jest.mock('k6/metrics', () => ({
  Trend: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
  Rate: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
  Counter: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
  Gauge: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
}));


describe('Load Testing Script Configuration', () => {
  // Dynamically require the k6 script to access its exports
  // Ensure the path is correct relative to this test file.
  const k6Script = require('./load-test.js');

  it('should define k6 script options correctly', () => {
    expect(k6Script.options).toBeDefined();
    expect(k6Script.options.vus).toBe(100);
    expect(k6Script.options.duration).toBe('30s');
  });

  it('should define http_req_duration threshold aligned with SLO', () => {
    expect(k6Script.options.thresholds).toBeDefined();
    expect(k6Script.options.thresholds.http_req_duration).toEqual(['p(99.9)<200']);
  });

  it('should define http_req_failed threshold', () => {
    expect(k6Script.options.thresholds).toBeDefined();
    expect(k6Script.options.thresholds.http_req_failed).toEqual(['rate<0.01']);
  });
  
  it('should define custom errors rate threshold', () => {
    expect(k6Script.options.thresholds).toBeDefined();
    expect(k6Script.options.thresholds.errors).toEqual(['rate<0.01']);
  });

  it('should define checks pass rate threshold', () => {
    expect(k6Script.options.thresholds).toBeDefined();
    expect(k6Script.options.thresholds.checks).toEqual(['rate>0.99']);
  });

  it('should have a default export function (the main k6 test function)', () => {
    expect(typeof k6Script.default).toBe('function');
  });
});