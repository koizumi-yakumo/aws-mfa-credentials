const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { renderCredentials, shellQuote } = require('../dist/shell.js');

const cli = path.resolve(__dirname, '../dist/index.js');
const fixture = path.resolve(__dirname, 'fixtures/mock-services.cjs');
const config = '[profile test]\nmfa_serial = arn:aws:iam::123456789012:mfa/test\nregion = ap-northeast-1\n';
const credentials = '[test]\naws_access_key_id = source-key\naws_secret_access_key = source-secret\n';

function environment(t, options = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'aws-mfa-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(path.join(dir, 'config'), options.config ?? config);
  writeFileSync(path.join(dir, 'credentials'), options.credentials ?? credentials);
  return {
    ...process.env,
    NODE_OPTIONS: `--require ${JSON.stringify(fixture)}`,
    AWS_CONFIG_FILE: path.join(dir, 'config'),
    AWS_SHARED_CREDENTIALS_FILE: path.join(dir, 'credentials'),
    AWS_EC2_METADATA_DISABLED: 'true',
    AWS_ACCESS_KEY_ID: 'old-key',
    AWS_SECRET_ACCESS_KEY: 'old-secret',
    AWS_SESSION_TOKEN: 'old-token',
    AWS_CREDENTIAL_EXPIRATION: 'old-expiration',
    TEST_DURATION: String(options.duration ?? 1800),
    TEST_FAILURE: options.failure ?? '',
  };
}

function run(args, env) {
  return spawnSync(process.execPath, [cli, ...args], { env, encoding: 'utf8', timeout: 10000 });
}

test('a direct invocation fetches credentials and displays masked secrets without setup', (t) => {
  const result = run([], environment(t));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'AWS_ACCESS_KEY_ID=temporary-key\nAWS_SECRET_ACCESS_KEY=********\nAWS_SESSION_TOKEN=********\nAWS_CREDENTIAL_EXPIRATION=2030-01-02T03:04:05.000Z\n');
  assert.doesNotMatch(result.stdout + result.stderr, /temporary-secret|temporary-token|export /);
  assert.match(result.stderr, /Select AWS profile\nEnter MFA token/);
});

for (const scenario of [
  { name: '30 minutes by default' },
  { name: 'configured duration', config: `${config}duration_seconds = 7200\n`, duration: 7200 },
]) {
  test(`requests ${scenario.name} and emits expiration without mixing in prompts`, (t) => {
    const result = run(['--shell', ...(scenario.args ?? [])], environment(t, scenario));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /export AWS_ACCESS_KEY_ID='temporary-key'/);
    assert.match(result.stdout, /export AWS_CREDENTIAL_EXPIRATION='2030-01-02T03:04:05.000Z'/);
    assert.doesNotMatch(result.stdout, /Select AWS profile|Enter MFA token/);
    assert.match(result.stderr, /Select AWS profile\nEnter MFA token/);
  });
}

for (const scenario of [
  { name: 'unknown option', args: ['--unknown'], error: /Unknown option/ },
  { name: 'removed init option', args: ['--init'], error: /Unknown option/ },
  { name: 'missing MFA configuration', config: '', error: /MFA not configured/ },
  { name: 'missing source secret', credentials: '[test]\naws_access_key_id = source-key\n', error: /Credentials not found/ },
  { name: 'STS error', failure: 'sts', error: /Access denied/ },
  { name: 'missing credentials', failure: 'no-credentials', error: /Could not get temporary credentials/ },
  { name: 'partial credentials', failure: 'partial', error: /complete temporary credentials/ },
  { name: 'missing expiration', failure: 'expiration', error: /expiration time/ },
]) {
  test(`fails without emitting shell code on ${scenario.name}`, (t) => {
    const result = run(['--shell', ...(scenario.args ?? [])], environment(t, scenario));
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, scenario.error);
  });
}

for (const shell of ['bash', 'zsh']) {
  const available = spawnSync(shell, ['--version']).status === 0;
  const runShell = (script, env) => spawnSync(shell, ['-f', '-c', script], { env, encoding: 'utf8', timeout: 10000 });
  const command = `${shellQuote(process.execPath)} ${shellQuote(cli)}`;
  const showEnvironment = `${shellQuote(process.execPath)} -e 'console.log("CHILD=" + JSON.stringify([process.env.AWS_ACCESS_KEY_ID, process.env.AWS_SECRET_ACCESS_KEY, process.env.AWS_SESSION_TOKEN, process.env.AWS_CREDENTIAL_EXPIRATION]))'`;

  test(`${shell}: masks displayed secrets while exporting real credentials to the shell and its children`, { skip: !available }, (t) => {
    const result = runShell(`aws_mfa_output="$(${command} --shell)" && eval "$aws_mfa_output" || exit $?\n${showEnvironment}`, environment(t));
    assert.equal(result.status, 0, result.stderr);
    const display = result.stdout.split('CHILD=')[0];
    assert.equal(display, 'AWS_ACCESS_KEY_ID=temporary-key\nAWS_SECRET_ACCESS_KEY=********\nAWS_SESSION_TOKEN=********\nAWS_CREDENTIAL_EXPIRATION=2030-01-02T03:04:05.000Z\n');
    assert.doesNotMatch(display + result.stderr, /temporary-secret|temporary-token/);
    assert.match(result.stdout, /CHILD=\["temporary-key","temporary-secret","temporary-token","2030-01-02T03:04:05.000Z"\]/);
    assert.doesNotMatch(result.stdout, /export /);
  });

  test(`${shell}: failed requests preserve existing credentials and the exit status`, { skip: !available }, (t) => {
    const result = runShell(`aws_mfa_output="$(${command} --shell)" && eval "$aws_mfa_output"\nprintf 'STATUS=%s\\n' "$?"\n${showEnvironment}`, environment(t, { failure: 'sts' }));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^STATUS=1\nCHILD=\["old-key","old-secret","old-token","old-expiration"\]/);
  });

  test(`${shell}: quoted credential values cannot execute shell syntax`, { skip: !available }, (t) => {
    const value = 'quote\' " $(printf INJECTED) `printf INJECTED` \\ space\nnext-line';
    const script = renderCredentials({
      AccessKeyId: value, SecretAccessKey: value, SessionToken: value,
      Expiration: new Date('2030-01-02T03:04:05Z'),
    }, true);
    const result = runShell(`${script}\n${showEnvironment}`, environment(t));
    assert.equal(result.status, 0, result.stderr);
    const child = result.stdout.split('\n').find(line => line.startsWith('CHILD='));
    assert.deepEqual(JSON.parse(child.slice(6)), [value, value, value, '2030-01-02T03:04:05.000Z']);
  });
}
