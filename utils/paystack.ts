import https from 'https';
import crypto from 'crypto';

const getPaystackSecretKey = (): string => {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error('Missing PAYSTACK_SECRET_KEY environment variable');
  }
  return key;
};

const paystackRequest = async (path: string, method = 'GET', body?: any): Promise<any> => {
  const PAYSTACK_SECRET_KEY = getPaystackSecretKey();
  const payload = body ? JSON.stringify(body) : undefined;
  const options: https.RequestOptions = {
    hostname: 'api.paystack.co',
    port: 443,
    path,
    method,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const responseText = Buffer.concat(chunks).toString('utf8');
        try {
          const json = JSON.parse(responseText);
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(json.message || `Paystack error ${res.statusCode}`));
            return;
          }
          resolve(json);
        } catch (error: any) {
          reject(new Error(`Unable to parse Paystack response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => reject(error));
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
};

export const initializeTransaction = async (
  email: string,
  amount: number,
  callbackUrl: string,
  metadata: Record<string, any> = {}
) => {
  const response = await paystackRequest('/transaction/initialize', 'POST', {
    email,
    amount,
    callback_url: callbackUrl,
    metadata,
  });

  if (!response.status) {
    throw new Error(response.message || 'Paystack transaction initialization failed');
  }
  return response.data;
};

export const verifyTransaction = async (reference: string) => {
  const response = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (!response.status) {
    throw new Error(response.message || 'Paystack transaction verification failed');
  }
  return response.data;
};

export const verifyWebhookSignature = (rawBody: Buffer, signature: string): boolean => {
  const PAYSTACK_SECRET_KEY = getPaystackSecretKey();
  const hmac = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');
  return signature === digest;
};
