#!/bin/bash

# スクリプトディレクトリの取得
SCRIPT_DIR=$(cd $(dirname $0); pwd)
cd $SCRIPT_DIR

echo "📱 音声文字起こしアプリのデプロイを開始します..."

# 必要なフォルダの作成
mkdir -p uploads results

# 必要なパッケージをインストール
echo "📦 依存パッケージをインストールします..."
pip install -r requirements.txt

# アイコンの作成（なければ）
if [ ! -f "icon-192.png" ] || [ ! -f "icon-512.png" ]; then
    echo "🖼️ アイコンファイルを生成します..."
    echo "   ※自動生成できない場合は、generate-icons.htmlをブラウザで開いてください。"
    # ここではPWAのサンプルアイコンをプレースホルダとして使用
    touch icon-192.png icon-512.png
fi

# サーバー起動のお知らせ
echo "🚀 サーバーを起動します..."
echo "   完了したら、ブラウザで http://localhost:5000 にアクセスしてください。"
echo "   終了するには Ctrl+C を押してください。"
echo ""
echo "================================================================="
echo "  🎤 音声文字起こしアプリ - モバイル対応版"
echo "================================================================="
echo ""

# サーバー起動
python app.py