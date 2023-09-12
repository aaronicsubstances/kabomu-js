import path from "path"
import winston from "winston"
import DailyRotateFile from "winston-daily-rotate-file"

const myFormat = winston.format.printf(info => {
    const {
        level,
        message,
        label
    } = info
    const timestamp = new Date().toISOString()
        .replace(/T/, ' ').replace(/Z$/, '')
    return `${timestamp} ${level.toUpperCase()} ${label} ${message}`
})
export const appLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.splat(),
        myFormat
    ),
    transports: [
        new DailyRotateFile({
            filename: "%DATE%.log",
            dirname: path.join(__dirname, "../../../logs")
        })
    ]
})
