import pino from "pino";

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

export const logger = pino({
  level,
  serializers: { err: pino.stdSerializers.err },
  redact: {
    paths: [
      "password",
      "secret",
      "token",
      "refreshToken",
      "refresh_token",
      "authorization",
      "cookie",
      "*.password",
      "*.secret",
      "*.token",
      "*.refreshToken",
      "*.refresh_token",
      "*.authorization",
      "*.cookie",
    ],
    censor: "[REDACTED]",
  },
});
