# aws-mfa-credentials
AWS で MFA 環境でのクレデンシャル情報を取得するサポートツール

## 開発環境

### セットアップ
1. Node.js をインストールします。
2. このリポジトリをクローンします。
3. リポジトリのルートディレクトリで `npm install` を実行して、依存関係をインストールします。

### ビルド
以下のコマンドを実行して、TypeScript のソースコードをコンパイルします。
```bash
npm run build
```

コンパイルされた JavaScript ファイルは `dist` ディレクトリに出力されます。

### リンク

ローカルで開発版をコマンドとして利用するには、以下のコマンドを実行します。

```bash
npm link
```

## 実行

### ローカルでの実行

`npm link` を実行した後、以下のコマンドで実行できます。

```bash
aws-mfa-credentials
```

### 公開版の実行

npm に公開されたパッケージは、以下のコマンドで実行できます。

```bash
npx aws-mfa-credentials
```

## 利用方法

実行方法の詳細は、利用者向けドキュメント [Manual.md](Manual.md) を参照してください。

## 公開

npm に公開するには、以下の手順を実行します。

1. `package.json` の `version` を更新します。
2. `npm login` で npm にログインします。
3. `npm publish` を実行します。