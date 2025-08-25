export const getStatusCode = (error: Error): number => {
    if (
        error.message.includes('required') ||
        error.message.includes('must be') ||
        error.message.includes('Invalid') ||
         error.message.includes('ALREADY_SYNCED')

    ) {
        return 400; // Bad Request
    }
    if (
        error.message.includes('not found') ||
        (error.message.includes('No') && error.message.includes('found'))
    ) {
        return 404; // Not Found
    }
    if (
        error.message.includes('Authentication') ||
        error.message.includes('expired') ||
        error.message.includes('token')
    ) {
        return 401; // Unauthorized
    }
    if (
        error.message.includes('forbidden') ||
        error.message.includes('permissions')
    ) {
        return 403; // Forbidden
    }
    return 500; // Internal Server Error
};
