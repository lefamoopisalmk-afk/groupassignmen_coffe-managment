export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(error, _request, response, _next) {
  if (error instanceof HttpError) {
    return response.status(error.status).json({ error: error.message });
  }

  if (error?.name === 'ZodError') {
    return response.status(400).json({
      error: 'Invalid request data',
      details: error.issues.map(({ path, message }) => ({
        field: path.join('.'),
        message,
      })),
    });
  }

  console.error('Unhandled API error:', error);
  return response.status(500).json({ error: 'Internal server error' });
}
