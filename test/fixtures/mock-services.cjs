// Loaded only by test subprocesses. No real AWS request or credentials are used.
const assert = require('node:assert/strict');
const { STSClient, GetSessionTokenCommand } = require('@aws-sdk/client-sts');
const inquirer = require('inquirer').default;

inquirer.createPromptModule = (options) => {
  assert.equal(options.output, process.stderr);
  return async ([question]) => {
    process.stderr.write(`${question.message}\n`);
    if (question.name === 'profile') return { profile: 'test' };
    return { token: '123456' };
  };
};

STSClient.prototype.send = async function (command) {
  assert.ok(command instanceof GetSessionTokenCommand);
  assert.deepEqual(command.input, {
    SerialNumber: 'arn:aws:iam::123456789012:mfa/test',
    TokenCode: '123456',
    DurationSeconds: Number(process.env.TEST_DURATION || 1800),
  });
  assert.equal((await this.config.credentials()).accessKeyId, 'source-key');
  assert.equal(await this.config.region(), 'ap-northeast-1');
  if (process.env.TEST_FAILURE === 'sts') throw new Error('Access denied by STS');
  if (process.env.TEST_FAILURE === 'no-credentials') return {};
  const credentials = {
    AccessKeyId: 'temporary-key',
    SecretAccessKey: 'temporary-secret',
    SessionToken: 'temporary-token',
    Expiration: new Date('2030-01-02T03:04:05Z'),
  };
  if (process.env.TEST_FAILURE === 'partial') delete credentials.SessionToken;
  if (process.env.TEST_FAILURE === 'expiration') delete credentials.Expiration;
  return { Credentials: credentials };
};
