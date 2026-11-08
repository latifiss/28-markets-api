import http from 'k6/http';
import { check } from 'k6';

const baseUrl = __ENV.BASE_URL;
if (!baseUrl) {
  throw new Error('Set BASE_URL to the deployed API origin');
}

export const options = {
  discardResponseBodies: true,
  scenarios: {
    market_data_reads: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 500,
      maxVUs: 3000,
      stages: [
        { target: 500, duration: '2m' },
        { target: 1000, duration: '3m' },
        { target: 2000, duration: '3m' },
        { target: 2000, duration: '5m' },
        { target: 0, duration: '2m' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<250', 'p(99)<750'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/api/forex`, {
    headers: { Accept: 'application/json' },
    tags: { endpoint: 'public-forex-list' },
  });

  check(response, {
    'successful status': (result) => result.status >= 200 && result.status < 400,
    'response is JSON': (result) =>
      String(result.headers['Content-Type'] || '').includes('application/json'),
  });
}
