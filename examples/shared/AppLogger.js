DEBUG_ENABLED = true

exports.logDebug = function() {
    if (DEBUG_ENABLED) {
        console.debug(...arguments)
    }
}

exports.logInfo = function() {
    console.info(...arguments)
}

exports.logWarn = function() {
    console.warn(...arguments)
}

exports.logError = function() {
    console.error(...arguments)
}