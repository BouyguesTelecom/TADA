import http, { RefinedResponse, ResponseType } from 'k6/http';
import { check } from 'k6';
import { getEnvironment } from '../config/environment';

const env = getEnvironment();

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

export function makeAuthHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
  return {
    'Authorization': `Bearer ${env.bearerToken}`,
    'Content-Type': 'application/json',
    ...additionalHeaders
  };
}

export function makeMultipartHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${env.bearerToken}`
  };
}

export function makeRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: any,
  options?: RequestOptions
): RefinedResponse<ResponseType | undefined> {
  
  const params = {
    headers: makeAuthHeaders(options?.headers),
    timeout: options?.timeout || env.timeout
  };

  switch (method) {
    case 'GET':
      return http.get(url, params);
    case 'POST':
      return http.post(url, payload, params);
    case 'PATCH':
      return http.patch(url, payload, params);
    case 'DELETE':
      return http.del(url, payload, params);
    default:
      throw new Error(`Unsupported method: ${method}`);
  }
}

export function checkResponse(
  response: RefinedResponse<ResponseType | undefined>,
  expectedStatus: number | number[] = 200,
  testName?: string
): boolean {
  const statusCodes = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  const statusCheck = statusCodes.includes(response.status);
  
  const prefix = testName ? `${testName} - ` : '';
  const checkName = `${prefix}status is ${statusCodes.join(' or ')}`;
  
  if (response.status >= 400) {
    console.log(`Error ${response.status}: ${response.body}`);
  }
  
  const result = check(response, {
    [checkName]: (r) => statusCodes.includes(r.status)
  });
  
  return result && statusCheck;
}

export function logResponse(response: RefinedResponse<ResponseType | undefined>, context?: string): void {
  const prefix = context ? `[${context}] ` : '';
  console.log(`${prefix}Status: ${response.status}, Duration: ${response.timings.duration}ms`);
  
  if (response.status >= 400) {
    console.log(`${prefix}Error body:`, response.body);
  }
}