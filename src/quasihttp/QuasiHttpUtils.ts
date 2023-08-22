/**
 *  Request environment variable for local server endpoint.
 */
export const REQ_ENV_KEY_LOCAL_PEER_ENDPOINT = "kabomu.local_peer_endpoint";

/**
 *  Request environment variable for remote client endpoint.
 */
export const REQ_ENV_KEY_REMOTE_PEER_ENDPOINT = "kabomu.remote_peer_endpoint";

/**
 * Request environment variable for the transport instance from
 * which a request was received.
 */
export const REQ_ENV_KEY_TRANSPORT_INSTANCE = "kabomu.transport";

/**
 * Request environment variable for the connection from which a
 * request was received.
 */
export const REQ_ENV_KEY_CONNECTION = "kabomu.connection";

/**
 * Response environment variable for indicating whether or not
 * response has been bufferred already.
 */
export const RES_ENV_KEY_RESPONSE_BUFFERING_APPLIED = "kabomu.response_buffering_enabled";

/**
 * Response environment variable for indicating that response
 * should not be sent at all.
 * Intended for use in responding to fire and forget requests.
 */
export const RES_ENV_KEY_SKIP_RESPONSE_SENDING = "kabomu.skip_response_sending";

/**
 *  Connectivity parameter for indicating to client transports that it
 *  can create connections which provide empty reads, because such
 *  connections are to be used in situations where responses are not needed,
 *  or where responses won't arrive at all.
 */
export const CONNECTIVITY_PARAM_FIRE_AND_FORGET = "kabomu.fire_and_forget";

export const METHOD_CONNECT = "CONNECT";
export const METHOD_DELETE = "DELETE";
export const METHOD_GET = "GET";
export const METHOD_HEAD = "HEAD";
export const METHOD_OPTIONS = "OPTIONS";
export const METHOD_PATCH = "PATCH";
export const METHOD_POST = "POST";
export const METHOD_PUT = "PUT";
export const METHOD_TRACE = "TRACE";

/**
 * 200 OK
 */
export const STATUS_CODE_OK = 200;

/**
 * 500 Internal Server Error
 */
export const STATUS_CODE_SERVER_ERROR = 500;

/**
 * 400 Bad Request
 */
export const STATUS_CODE_CLIENT_ERROR_BAD_REQUEST = 400;

/**
 * 401 Unauthorized
 */
export const STATUS_CODE_CLIENT_ERROR_UNAUTHORIZED = 401;

/**
 * 403 Forbidden
 */
export const STATUS_CODE_CLIENT_ERROR_FORBIDDEN = 403;

/**
 * 404 Not Found
 */
export const STATUS_CODE_CLIENT_ERROR_NOT_FOUND = 404;

/**
 * 405 Method Not Allowed
 */
export const STATUS_CODE_CLIENT_ERROR_METHOD_NOT_ALLOWED = 405;

/**
 * 413 Payload Too Large
 */
export const STATUS_CODE_CLIENT_ERROR_PAYLOAD_TOO_LARGE = 413;

/**
 * 414 URI Too Long
 */
export const STATUS_CODE_CLIENT_ERROR_URI_TOO_LONG = 414;

/**
 * 415 Unsupported Media Type
 */
export const STATUS_CODE_CLIENT_ERROR_UNSUPPORTED_MEDIA_TYPE = 415;

/**
 * 422 Unprocessable Entity
 */
export const STATUS_CODE_CLIENT_ERROR_UNPROCESSABLE_ENTITY = 422;

/**
 * 429 Too Many Requests
 */
export const STATUS_CODE_CLIENT_ERROR_TOO_MANY_REQUESTS = 429;
