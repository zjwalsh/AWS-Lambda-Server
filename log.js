const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const { combine, timestamp, printf } = format;

const fileRotateTransport = new transports.DailyRotateFile({
    filename: 'logs/ts-middleware-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '100m',
    maxFiles: '3d',
    zippedArchive: true
  });
  
  const logger = createLogger({
    level:  process.env["npm_config_log_level"] || process.env["log_level"] || "info",

    format: combine(
        timestamp({
          format: "MMM-DD-YYYY HH:mm:ss",
        }),
        format.json({ space: 2 })
        ),
    transports: [fileRotateTransport],
  });

module.exports=logger;
