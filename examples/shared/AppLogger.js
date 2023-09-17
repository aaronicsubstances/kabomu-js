DEBUG_ENABLED = false

exports.logDebug = function() {
    if (DEBUG_ENABLED) {
        console.debug(getTimestamp(), "DEBUG", ...arguments)
    }
}

exports.logInfo = function() {
    console.info(getTimestamp(), "INFO", ...arguments)
}

exports.logWarn = function() {
    console.warn(getTimestamp(), "WARN", ...arguments)
}

exports.logError = function() {
    console.error(getTimestamp(), "ERROR", ...arguments)
}

function getTimestamp() {
    return new Date().toISOString()
        .replace("T", " ")
        .replace("Z", "");
}