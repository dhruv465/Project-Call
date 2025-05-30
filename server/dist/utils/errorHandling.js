"use strict";
/**
 * Error handling utility functions for consistent error handling across controllers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractApiErrorMessage = exports.isErrorWithResponse = exports.handleError = void 0;
/**
 * Handle unknown error types safely
 * @param error Unknown error object
 * @returns Formatted error message string
 */
const handleError = (error) => {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
};
exports.handleError = handleError;
/**
 * Type guard to check if an object is an Error with a response property
 * @param error Unknown error object
 * @returns Type predicate for errors with response property
 */
const isErrorWithResponse = (error) => {
    return error instanceof Error && 'response' in error;
};
exports.isErrorWithResponse = isErrorWithResponse;
/**
 * Extract error message from API error responses
 * @param error Unknown error object
 * @returns Formatted error message from API response or generic error
 */
const extractApiErrorMessage = (error) => {
    if ((0, exports.isErrorWithResponse)(error) && error.response?.data) {
        return error.response.data.message || error.response.data || error.message;
    }
    return (0, exports.handleError)(error);
};
exports.extractApiErrorMessage = extractApiErrorMessage;
//# sourceMappingURL=errorHandling.js.map