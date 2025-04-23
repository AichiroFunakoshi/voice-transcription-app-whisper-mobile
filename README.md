# 音声文字起こしアプリ（モバイル対応版）

スマートフォン内の音声データをAIで文字起こしするウェブアプリです。iPhone・Android両方で使えるPWA（Progressive Web App）対応アプリケーションです。

## 機能

- スマホ内の音声データの読み込み
- OpenAI Whisper APIによる高精度な文字起こし
- OpenAI ChatGPTによるテキスト整形
- 医療用語辞書を使った細かな表記の自動変換
- 文字起こし結果のテキストダウンロード
- 端末にAPIキーを保存
- PWA（ホーム画面に追加可能）
- スマホ操作に最適化された画面デザイン

## 対応ファイル形式

- MP3, WAV, M4A, AAC, OGG, FLAC (最大32MB)

## 注意点とトラブルシューティング

### スマホでのファイル選択について
- iOS/Androidともに標準のファイル選択UIを使ってファイルが選択できます
- 「タップしてファイルを選択」をタップするとファイル選択画面が開きます
- 音声ファイルを直接選択することも、クラウドストレージからダウンロードすることもできます

### m4aファイル対応について
- m4aファイルの読み込みに問題があった場合は、ファイルの拡張子が正しく「.m4a」になっているか確認してください
- ファイル形式や拡張子の問題が発生した場合、URL末尾に「?debug=true」を追加するとデバッグ情報が表示されます

### 医療用語辞書について
- アプリは医療用語辞書ファイル（medical_dictionary.json）を使用して、文字起こし時の医療用語を適切に変換します
- 独自の辞書ファイルを使用したい場合は、medical_dictionary.jsonと同じフォーマット（読み仮名をキー、正式表記を値とするJSON形式）で作成し、プロジェクトルートに配置してください

## 使用方法

1. OpenAI APIキーを入力 (初回のみ)
2. 音声ファイルを選択
3. 「文字起こし開始」ボタンをクリック
4. 結果が表示されたらテキストをダウンロード

## ホーム画面への追加方法

### iOS (iPhone/iPad)
1. Safariで本アプリを開く
2. 「共有」ボタン (□↑) をタップ
3. 「ホーム画面に追加」を選択
4. 「追加」をタップ

### Android
1. Chromeで本アプリを開く
2. メニューボタン (⋮) をタップ
3. 「ホーム画面に追加」を選択
4. 「インストール」をタップ

## デプロイ方法

### 必要なもの

- Python 3.8以上
- Flask
- Requests

### インストール手順

```bash
# リポジトリをクローン
git clone https://github.com/AichiroFunakoshi/voice-transcription-app-whisper-mobile.git
cd voice-transcription-app-whisper-mobile

# 依存パッケージをインストール
pip install -r requirements.txt

# サーバーを起動
python app.py
```

ブラウザで http://localhost:5000 を開いてアプリにアクセスします。

## 開発者向け情報

### 技術スタック

- バックエンド: Python + Flask
- フロントエンド: HTML + CSS + JavaScript + Bootstrap
- PWA (Progressive Web App)対応

### デバッグモード

- URL末尾に「?debug=true」を追加するとデバッグモードが有効になります
- デバッグモードではファイル情報やデバイス情報が表示されます
- 例: `http://localhost:5000/?debug=true`

### API

- [OpenAI API](https://platform.openai.com/) - 音声認識(Whisper)とテキスト整形(GPT-4o)

## 注意事項

- APIキーはブラウザのローカルストレージに保存されます
- 音声ファイルはAPIサーバーに送信されますが、処理後に削除されます
- インターネット接続が必要です

## ライセンス

MIT License