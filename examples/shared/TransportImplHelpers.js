const {
    MiscUtils,
    QuasiHttpError
} = require("kabomu-js")

exports.createDelayPromise = async function(delayMs) {
    await new Promise((resolve) => {
        setTimeout(resolve, delayMs)
    })
}

exports.createCancellableTimeoutPromise = function(
        timeoutMillis, timeoutMsg,
        abortController) {
    if (!timeoutMillis || timeoutMillis <= 0) {
        return undefined
    }
    const blankChequePromise = MiscUtils.createBlankChequePromise()
    const timeoutId = setTimeout(() => {
        const timeoutError = new QuasiHttpError(
            timeoutMsg,
            QuasiHttpError.REASON_CODE_TIMEOUT);
        blankChequePromise.reject(timeoutError);
    }, timeoutMillis);
    const cancellationHandle = {
        promise: blankChequePromise.promise,
        cancel() {
            clearTimeout(timeoutId);
            blankChequePromise.resolve();
            abortController?.abort()
        }
    }
    return cancellationHandle
}