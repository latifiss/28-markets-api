import http from 'k6/http';
import { check } from 'k6';

const rawBaseUrl = __ENV.BASE_URL || '';
const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
const apiKey = __ENV.API_KEY;

if (!baseUrl) throw new Error('Set BASE_URL to the deployed API origin');
if (!apiKey) throw new Error('Set API_KEY to a dedicated load-test API key');

const duration = __ENV.DURATION || '30m';
const targetRps = Number(__ENV.TARGET_RPS || 600);

export const options = {
  discardResponseBodies: true,
  scenarios: {
    sustained_market_reads: {
      executor: 'constant-arrival-rate',
      rate: targetRps,
      timeUnit: '1s',
      duration,
      preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 1000),
      maxVUs: Number(__ENV.MAX_VUS || 5000),
    },
    peak_burst: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 1000,
      maxVUs: 5000,
      stages: [
        { target: 1000, duration: '1m' },
        { target: 2000, duration: '5m' },
        { target: 0, duration: '1m' },
      ],
      startTime: duration,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<250', 'p(99)<750'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/api/v1/forex/pairs`, {
    headers: {
      Accept: 'application/json',
      'X-API-Key': apiKey,
    },
    tags: { endpoint: 'authenticated-forex-pairs-list' },
  });

  check(response, {
    'successful status': (result) => result.status >= 200 && result.status < 400,
    'response is JSON': (result) =>
      String(result.headers['Content-Type'] || '').includes('application/json'),
  });
}
