/**
 * Error handling utility functions for consistent error handling across controllers
 */

/**
 * Handle unknown error types safely
 * @param error Unknown error object
 * @returns Formatted error message string
 */
export const handleError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

/**
 * Type guard to check if an object is an Error with a response property
 * @param error Unknown error object
 * @returns Type predicate for errors with response property
 */
export const isErrorWithResponse = (error: unknown): error is Error & { response?: any } => {
  return error instanceof Error && 'response' in error;
};

/**
 * Extract error message from API error responses
 * @param error Unknown error object
 * @returns Formatted error message from API response or generic error
 */
export const extractApiErrorMessage = (error: unknown): string => {
  if (isErrorWithResponse(error) && error.response?.data) {
    return error.response.data.message || error.response.data || error.message;
  }
  return handleError(error);
};
