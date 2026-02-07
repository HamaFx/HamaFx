import { fail } from './http.js';
import { withCors } from './request.js';

export async function handleApi(
  request: Request,
  fn: () => Promise<Response>
): Promise<Response> {
  try {
    const response = await fn();
    return withCors(response, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return withCors(fail(message, 500), request);
  }
}
