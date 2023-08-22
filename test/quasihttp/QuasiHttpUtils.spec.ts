import { assert } from "chai"
import * as QuasiHttpUtils from "../../src/quasihttp/QuasiHttpUtils"

describe("QuasiHttpUtils", function() {
    describe("testConstantValues", function() {
        it("should pass", function() {
            assert.equal(QuasiHttpUtils.METHOD_CONNECT, "CONNECT");
            assert.equal(QuasiHttpUtils.METHOD_DELETE, "DELETE");
            assert.equal(QuasiHttpUtils.METHOD_GET, "GET");
            assert.equal(QuasiHttpUtils.METHOD_HEAD, "HEAD");
            assert.equal(QuasiHttpUtils.METHOD_OPTIONS, "OPTIONS");
            assert.equal(QuasiHttpUtils.METHOD_PATCH, "PATCH");
            assert.equal(QuasiHttpUtils.METHOD_POST, "POST");
            assert.equal(QuasiHttpUtils.METHOD_PUT, "PUT");
            assert.equal(QuasiHttpUtils.METHOD_TRACE, "TRACE");

            assert.equal(QuasiHttpUtils.STATUS_CODE_OK, 200);
            assert.equal(QuasiHttpUtils.STATUS_CODE_SERVER_ERROR, 500);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_BAD_REQUEST, 400);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_UNAUTHORIZED, 401);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_FORBIDDEN, 403);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_NOT_FOUND, 404);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_METHOD_NOT_ALLOWED, 405);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_PAYLOAD_TOO_LARGE, 413);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_URI_TOO_LONG, 414);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_UNSUPPORTED_MEDIA_TYPE, 415);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_UNPROCESSABLE_ENTITY, 422);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_TOO_MANY_REQUESTS, 429);
        })
    })
})