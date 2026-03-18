import dotenv from "dotenv";

dotenv.config();

export function getEnvVar(varName, warnIfNotSet = true) {
  const value = process.env[varName];
  if (warnIfNotSet && !value) {
    console.warn(`No such environment variable: ${varName}`);
  }
  return value;
}