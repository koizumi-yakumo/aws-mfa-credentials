# 利用者向けマニュアル

AWS の MFA を使い、一時的な認証情報を取得します。Node.js 20 以上が必要です。

## 実行方法

```bash
npx aws-mfa-credentials
```

プロファイルを選び、6桁の MFA コードを入力すると、取得した値と有効期限（UTC）を表示します。
シークレットアクセスキーとセッショントークンの表示は `********` になります。

通常実行では呼び出し元の環境変数は変わりません。現在の bash / zsh に設定する場合は次を実行してください。

```bash
aws_mfa_output="$(npx aws-mfa-credentials --shell)" && eval "$aws_mfa_output"
```

有効期間は選択した config プロファイルの `duration_seconds` に従い、未指定なら30分です。

期限切れでも環境変数は残りますが、その認証情報による AWS API 呼び出しは失敗します。上記の `--shell` を使ったコマンドを再実行して更新してください。
