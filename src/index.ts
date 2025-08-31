#!/usr/bin/env node

import { loadSharedConfigFiles } from "@aws-sdk/shared-ini-file-loader";
import { STSClient, GetSessionTokenCommand } from "@aws-sdk/client-sts";
import inquirer from "inquirer";

const main = async () => {
  const { credentialsFile, configFile } = await loadSharedConfigFiles();
  const profiles = Object.keys(credentialsFile);

  const { profile } = await inquirer.prompt([
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

  const { token } = await inquirer.prompt([
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
  });

  try {
    const data = await sts.send(command);
    if (data.Credentials) {
      console.log(`export AWS_ACCESS_KEY_ID=${data.Credentials.AccessKeyId}`);
      console.log(`export AWS_SECRET_ACCESS_KEY=${data.Credentials.SecretAccessKey}`);
      console.log(`export AWS_SESSION_TOKEN=${data.Credentials.SessionToken}`);
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
