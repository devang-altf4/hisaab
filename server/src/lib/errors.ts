/** Every error the API returns has the shape { error: { code, message, details? } }. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Resource') => new ApiError(404, 'NOT_FOUND', `${what} not found`);
export const forbidden = (msg = 'Not allowed') => new ApiError(403, 'FORBIDDEN', msg);
export const badRequest = (msg: string, details?: unknown) => new ApiError(400, 'BAD_REQUEST', msg, details);
