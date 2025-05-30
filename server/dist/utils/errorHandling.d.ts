/**
 * Error handling utility functions for consistent error handling across controllers
 */
/**
 * Handle unknown error types safely
 * @param error Unknown error object
 * @returns Formatted error message string
 */
export declare const handleError: (error: unknown) => string;
/**
 * Type guard to check if an object is an Error with a response property
 * @param error Unknown error object
 * @returns Type predicate for errors with response property
 */
export declare const isErrorWithResponse: (error: unknown) => error is Error & {
    response?: any;
};
/**
 * Extract error message from API error responses
 * @param error Unknown error object
 * @returns Formatted error message from API response or generic error
 */
export declare const extractApiErrorMessage: (error: unknown) => string;
