import winston from "winston";
const { combine, timestamp, json, printf, colorize } = winston.format;

const logger = winston.createLogger({
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }), // apply color to log level
        timestamp({ format: "HH:mm:ss.SSS" }), // set time format
        printf(({ timestamp, level, message, ...others }) => {
          return `${timestamp} [${level}]: ${message} ${
            Object.keys(others).length ? JSON.stringify(others, null, 2) : ""
          }`;
        })
      ),
    }),
  ],
});

export default logger;
