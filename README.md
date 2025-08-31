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

## 実行

以下のコマンドで実行します。
AWSのプロファイル一覧が表示されます。

```bash
node dist/index.js
```