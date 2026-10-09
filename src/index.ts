#!/usr/bin/env node

import { parseArgs } from "node:util";
import { loadSharedConfigFiles } from "@smithy/shared-ini-file-loader";
import { STSClient, GetSessionTokenCommand } from "@aws-sdk/client-sts";
import inquirer from "inquirer";
import { renderCredentials } from "./shell";

const main = async () => {
  const { values } = parseArgs({
    options: {
      shell: { type: "boolean" },
    },
  });
  const { credentialsFile, configFile } = await loadSharedConfigFiles();
  const profiles = Object.keys(credentialsFile);

  // In --shell mode stdout is evaluated, so keep prompts on stderr.
  const prompt = inquirer.createPromptModule({ output: process.stderr });
  const { profile } = await prompt([
    {
      type: "list",
      name: "profile",
      message: "Select AWS profile",
      choices: profiles,
    },
  ]);

  const selectedProfile = configFile[profile];
  if (!selectedProfile || !selectedProfile.mfa_serial) {
    console.error(`MFA not configured for profile "${profile}"`);
    process.exit(1);
  }
  const mfaSerial = selectedProfile.mfa_serial;

  const { token } = await prompt([
    {
      type: "input",
      name: "token",
      message: "Enter MFA token",
    },
  ]);

  const credentials = credentialsFile[profile];
  if (!credentials || !credentials.aws_access_key_id || !credentials.aws_secret_access_key) {
    console.error(`Credentials not found for profile "${profile}"`);
    process.exit(1);
  }

  const sts = new STSClient({
    region: selectedProfile.region || "us-east-1",
    credentials: {
      accessKeyId: credentials.aws_access_key_id,
      secretAccessKey: credentials.aws_secret_access_key,
      sessionToken: credentials.aws_session_token,
    },
  });

  const command = new GetSessionTokenCommand({
    SerialNumber: mfaSerial,
    TokenCode: token,
    DurationSeconds: Number(selectedProfile.duration_seconds ?? 1800),
  });

  try {
    const data = await sts.send(command);
    if (data.Credentials) {
      console.log(renderCredentials(data.Credentials, values.shell));
    } else {
      console.error("Could not get temporary credentials.");
      process.exit(1);
    }
  } catch (err) {
    console.error("Error getting session token:", err);
    process.exit(1);
  }
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
