#!/usr/bin/env node

import { loadSharedConfigFiles } from "@aws-sdk/shared-ini-file-loader";

const main = async () => {
  const config = await loadSharedConfigFiles();
  const profiles = Object.keys(config.credentialsFile);
  console.log("Available profiles:", profiles);
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
