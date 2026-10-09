import type { Credentials } from "@aws-sdk/client-sts";

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function renderCredentials(credentials: Credentials | undefined, asShell = false): string {
  if (!credentials?.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken ||
      !(credentials.Expiration instanceof Date) || !Number.isFinite(credentials.Expiration.getTime())) {
    throw new Error("STS did not return complete temporary credentials and an expiration time.");
  }
  const values = {
    AWS_ACCESS_KEY_ID: credentials.AccessKeyId,
    AWS_SECRET_ACCESS_KEY: credentials.SecretAccessKey,
    AWS_SESSION_TOKEN: credentials.SessionToken,
    AWS_CREDENTIAL_EXPIRATION: credentials.Expiration.toISOString(),
  };
  const displayValues = Object.entries(values).map(([name, value]) =>
    `${name}=${name === "AWS_SECRET_ACCESS_KEY" || name === "AWS_SESSION_TOKEN" ? "********" : value}`
  );
  if (!asShell) return displayValues.join("\n");

  return [
    ...Object.entries(values).map(([name, value]) => `export ${name}=${shellQuote(value)}`),
    // Mask secrets only in the display; the environment keeps the real values.
    `printf '%s\\n' ${displayValues.map(shellQuote).join(" ")}`,
  ].join("\n");
}
