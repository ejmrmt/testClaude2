# Gemini AI iOSアプリ セットアップ手順

このドキュメントでは、iPhoneアプリからGemini AIを呼び出すシステムの完全なセットアップ手順を説明します。

## 📋 前提条件

- Xcode 15+
- iOS 15+
- Node.js 18+
- Firebase プロジェクト
- Google AI Studio API キー（任意）

## 🍎 1. iOSアプリのセットアップ

### 1.1 新規プロジェクト作成

1. Xcodeを開き、「Create a new Xcode project」を選択
2. 「iOS」→「App」を選択
3. プロジェクト情報を入力：
   - Product Name: `GeminiAIApp`
   - Interface: `SwiftUI`
   - Language: `Swift`
   - Bundle Identifier: `com.yourcompany.geminaiapp`

### 1.2 Firebase SDK の追加

1. File > Add Package Dependencies...
2. 以下のURLを入力：
   ```
   https://github.com/firebase/firebase-ios-sdk.git
   ```
3. 以下のライブラリを選択：
   - `FirebaseCore`
   - `FirebaseVertexAI`

### 1.3 Firebase設定ファイル

1. [Firebase Console](https://console.firebase.google.com/)でプロジェクトを作成
2. iOS アプリを追加（Bundle IDを正確に入力）
3. `GoogleService-Info.plist` をダウンロード
4. Xcodeプロジェクトのルートに追加（Target membership を確認）

### 1.4 コードファイルの追加

- `App.swift` を作成（Firebase初期化用）
- `ContentView.swift` を置き換え（メインUI）

### 1.5 Info.plist の設定

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

## 🔥 2. Firebase の設定

### 2.1 Vertex AI の有効化

1. Firebase Console > Build > Vertex AI in Firebase
2. 「Get started」をクリック
3. 利用規約に同意
4. プロジェクトの場所を選択（asia-northeast1推奨）

### 2.2 認証の設定

1. Firebase Console > Authentication
2. 「始める」をクリック
3. Sign-in method > Anonymous を有効化（テスト用）

### 2.3 Firestore の設定（オプション）

1. Firebase Console > Firestore Database
2. 「データベースを作成」
3. テストモードで開始
4. ロケーションを選択（asia-northeast1推奨）

## 🖥️ 3. Genkitサーバーのセットアップ

### 3.1 プロジェクト初期化

```bash
mkdir gemini-genkit-server
cd gemini-genkit-server
npm init -y
```

### 3.2 依存関係のインストール

```bash
# 本番依存関係
npm install @genkit-ai/core @genkit-ai/googleai @google/generative-ai express cors helmet express-rate-limit dotenv zod

# 開発依存関係
npm install -D nodemon eslint jest supertest
```

### 3.3 環境変数ファイル

`.env` ファイルを作成：
```env
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### 3.4 サーバー起動

```bash
# 開発モード
npm run dev

# 本番モード
npm start
```

## ☁️ 4. Firebase Functions の設定（代替手段）

### 4.1 Firebase CLI のインストール

```bash
npm install -g firebase-tools
firebase login
```

### 4.2 Functions の初期化

```bash
firebase init functions
# TypeScript or JavaScript: JavaScript を選択
# ESLint: Yes
# Install dependencies: Yes
```

### 4.3 環境変数の設定

```bash
firebase functions:config:set gemini.api_key="YOUR_GEMINI_API_KEY"
```

### 4.4 デプロイ

```bash
firebase deploy --only functions
```

## 🔧 5. APIキーの取得

### 5.1 Google AI Studio API キー

1. [Google AI Studio](https://makersuite.google.com/app/apikey) にアクセス
2. 「Create API Key」をクリック
3. 既存のGoogle Cloud プロジェクトを選択または新規作成
4. APIキーをコピーして保存

### 5.2 Firebase プロジェクトでの設定

1. Google Cloud Console > APIs & Services > Credentials
2. Gemini API を有効化
3. 認証情報を作成（APIキー）

## 🚀 6. 動作確認

### 6.1 iOSアプリの起動

1. Xcodeでプロジェクトを開く
2. シミュレーターまたは実機を選択
3. Run ボタンでアプリを起動

### 6.2 機能テスト

#### APIキーありモード
1. APIキーフィールドに取得したキーを入力
2. プロンプトに「こんにちは」と入力
3. 送信ボタンをタップ
4. Genkitサーバー経由でレスポンスが表示されることを確認

#### APIキーなしモード
1. APIキーフィールドを空にする
2. プロンプトに「Hello」と入力
3. 送信ボタンをタップ
4. Firebase AI Logic経由でレスポンスが表示されることを確認

## 🔒 7. セキュリティ設定

### 7.1 Keychain設定

- APIキーは自動的にKeychainに保存されます
- アプリ削除まで永続化されます

### 7.2 HTTPS通信

本番環境では必ずHTTPS通信を使用してください：

```swift
guard let url = URL(string: "https://your-genkit-server.com/generate") else {
```

### 7.3 Firebase セキュリティルール

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usage_logs/{document} {
      allow read, write: if request.auth != null && request.auth.uid == document.userId;
    }
    match /rateLimits/{document} {
      allow read, write: if request.auth != null && request.auth.uid == document;
    }
  }
}
```

## 🐛 8. トラブルシューティング

### よくある問題と解決策

#### Firebase初期化エラー
```
GoogleService-Info.plistがプロジェクトに正しく追加されているか確認
Target membershipが設定されているか確認
```

#### Genkit サーバー接続エラー
```swift
// ContentView.swift の URL を確認
"https://your-genkit-server.com/generate" → 実際のサーバーURLに変更
```

#### APIキー認証エラー
```
- Google AI Studio でAPIキーが有効か確認
- APIキーに適切な権限が設定されているか確認
- Gemini API が有効化されているか確認
```

#### Firebase Vertex AI エラー
```
- Firebase Console で Vertex AI が有効化されているか確認
- プロジェクトの請求が有効になっているか確認
- 利用規約に同意済みか確認
```

## 📊 9. 本番環境への移行

### 9.1 サーバーのデプロイ

推奨デプロイ先：
- Google Cloud Run
- Vercel
- Railway
- Heroku

### 9.2 環境変数の設定

本番環境で以下の環境変数を設定：
```env
NODE_ENV=production
PORT=443
ALLOWED_ORIGINS=https://yourdomain.com
```

### 9.3 監視とログ

- Google Cloud Logging
- Firebase Performance Monitoring
- Error tracking (Sentry等)

## 🔄 10. 今後の拡張

### 10.1 認証の強化
- Face ID / Touch ID によるKeychain保護
- Firebase Authentication の本格導入

### 10.2 機能拡張
- 複数のAIモデル対応
- チャット履歴の保存
- オフライン対応
- Push通知

### 10.3 パフォーマンス改善
- レスポンスキャッシュ
- ストリーミング応答
- バックグラウンド処理

---

## 📞 サポート

問題が発生した場合は、以下を確認してください：

1. Firebase Console のログ
2. Xcode のデバッグコンソール
3. Genkit サーバーのログ
4. ネットワーク接続状況

詳細なエラーメッセージと共に、開発チームまでお問い合わせください。