// integration-layer/tests/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics'; // Importing common metrics

// Custom Metrics (optional, but good for detailed reporting)
const GetEventDuration = new Trend('get_event_duration');
const PostEventDuration = new Trend('post_event_duration');
const ErrorRate = new Rate('errors'); // Tracks the rate of failed requests

export const options = {
  vus: 100, // Number of virtual users
  duration: '30s', // Duration of the test
  // stages: [ // Optional: for more complex load patterns (e.g., ramp-up, soak)
  //   { duration: '1m', target: 100 }, // Ramp up to 100 VUs over 1 minute
  //   { duration: '3m', target: 100 }, // Stay at 100 VUs for 3 minutes
  //   { duration: '1m', target: 0 },   // Ramp down to 0 VUs over 1 minute
  // ],
  thresholds: {
    // 99.9th percentile of request duration should be below 200ms
    'http_req_duration': ['p(99.9)<200'],
    // Error rate should be less than 1%
    'http_req_failed': ['rate<0.01'], // k6 built-in metric for failed requests
    'errors': ['rate<0.01'], // Custom error rate (if you manually track errors)
    // Checks pass rate should be above 99%
    'checks': ['rate>0.99'],
  },
  // ext: { // Optional: for cloud execution or specific k6 extensions
  //   loadimpact: {
  //     projectID: 12345,
  //     // Name of the test run
  //     name: "SES Orchestrator Load Test"
  //   }
  // }
};

// Base URL for the orchestrator service
const BASE_URL = 'http://orchestrator:80'; // As specified in the outline

// Helper function to generate a unique ID (simplified for k6)
function uuidv4() {
  // k6 does not have direct access to Node.js 'crypto' or browser 'crypto.randomUUID'
  // This is a simplified UUID-like string generator for k6 context.
  // For truly unique IDs in a distributed test, consider other strategies or k6 libraries.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function () {
  // Define the payload for the POST request
  const eventId = uuidv4();
  const traceId = uuidv4();
  const leadId = `lead-${uuidv4().substring(0,8)}`;

  const payload = {
    event_id: eventId,
    event_type: 'lead.created', // Example event type
    tenant_id: `tenant-${Math.floor(Math.random() * 10) + 1}`, // Random tenant ID
    payload: {
      lead_id: leadId,
      name: 'John Doe LoadTest',
      source: 'Web Form LoadTest',
      email: `${leadId}@example-loadtest.com`
    },
    timestamp: new Date().toISOString(),
    priority: 'normal',
    trace_id: traceId,
  };

  // Send a POST request to the /event endpoint
  const res = http.post(`${BASE_URL}/event`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'PostEvent' }, // Tag for filtering results
  });

  // Add duration to custom metric
  PostEventDuration.add(res.timings.duration);

  // Check the response status and content
  const checkRes = check(res, {
    'is status 200': (r) => r.status === 200,
    'response body is not empty': (r) => r.body && r.body.length > 0,
    // 'response contains trace_id': (r) => r.json('trace_id') === traceId, // If orchestrator returns it
  });

  // If the check fails, increment the error rate
  if (!checkRes) {
    ErrorRate.add(1); // Increment error counter if any check fails
  }

  // Add a short sleep to simulate think time or pacing
  sleep(Math.random() * 3 + 1); // Sleep for 1 to 4 seconds
}

// Optional: Setup and Teardown functions
// export function setup() {
//   console.log("Setting up the load test environment...");
//   // E.g., authenticate, prepare test data
// }

// export function teardown(data) {
//   console.log("Tearing down the load test environment...");
//   // E.g., clean up test data
// }