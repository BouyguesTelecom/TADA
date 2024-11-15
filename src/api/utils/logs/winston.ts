import winston, { createLogger, format, transports } from 'winston';
import path from 'path';
require('dotenv').config();
const customLevels = {
    levels: {
        jobInfo: 0,
        jobWarning: 1,
        jobError: 2,
        http: 3,
        error: 6,
        warning: 7,
        info: 9,
        debug: 10
    },
    colors: {
        jobInfo: 'white',
        jobWarning: 'yellow',
        jobError: 'red',
        http: 'blue',
        error: 'red',
        warning: 'yellow',
        info: 'white',
        debug: 'grey'
    },
    emojis: {
        jobInfo: 'ℹ️',
        jobWarning: '⚠️',
        jobError: '⛔️',
        http: '🌐',
        error: '⛔️',
        warning: '⚠️',
        info: 'ℹ️',
        debug: '🐛'
    }
};

winston.addColors(customLevels.colors);

const getLogFileName = (level: string) => {
    const date = new Date().toISOString().split('T')[0];
    return path.join(`./logs/${level}-${date}.log`);
};

const consoleJsonFormat = format.combine(
    format.timestamp(),
    format((info) => {
        info.emoji = customLevels.emojis[info.level] || '';
        return info;
    })(),
    format.json()
);
winston.addColors(customLevels.colors);
const consoleFormat = format.combine(
    format((info) => {
        info.message = `${customLevels.emojis[info.level] || ''}   ${info.message}`;
        return info;
    })(),
    format.colorize({ all: true }),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
);

const fileJsonFormat = format.combine(
    format.timestamp(),
    format((info) => {
        info.emoji = customLevels.emojis[info.level] || '';
        return info;
    })(),
    format.json()
);

const levelFilter = (level: string) => {
    return format((info) => {
        return info.level === level ? info : false;
    })();
};

export const logger = createLogger({
    levels: customLevels.levels,
    transports: [
        new transports.Console({
            format: process.env.DEV_ENV ? consoleFormat : consoleJsonFormat
        }),
        new transports.File({
            filename: getLogFileName('job'),
            level: 'jobInfo',
            format: format.combine(levelFilter('jobInfo'), fileJsonFormat)
        }),
        new transports.File({
            filename: getLogFileName('job'),
            level: 'jobWarning',
            format: format.combine(levelFilter('jobWarning'), fileJsonFormat)
        }),
        new transports.File({
            filename: getLogFileName('job'),
            level: 'jobError',
            format: format.combine(levelFilter('jobError'), fileJsonFormat)
        }),
        new transports.File({
            filename: getLogFileName('error'),
            level: 'error',
            format: format.combine(levelFilter('error'), fileJsonFormat)
        }),
        new transports.File({
            filename: getLogFileName('info'),
            level: 'info',
            format: format.combine(levelFilter('info'), fileJsonFormat)
        }),
        new transports.File({
            filename: getLogFileName('warning'),
            level: 'warning',
            format: format.combine(levelFilter('warning'), fileJsonFormat)
        }),
        new transports.File({
            filename: getLogFileName('debug'),
            level: 'debug',
            format: format.combine(levelFilter('debug'), fileJsonFormat)
        }),
        new transports.File({
            filename: getLogFileName('combined'),
            format: fileJsonFormat
        })
    ]
});

export const jobInfo = (message: string) => {
    logger.log('jobInfo', message);
};
export const jobWarning = (message: string) => {
    logger.log('jobWarning', message);
};
export const jobError = (message: string) => {
    logger.log('jobError', message);
};
