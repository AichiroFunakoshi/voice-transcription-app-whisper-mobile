from flask import Flask, request, jsonify, render_template, send_from_directory
import os
import uuid
import json
import requests
import mimetypes
import logging
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='.', static_url_path='')

# ロギング設定
logging.basicConfig(level=logging.INFO)

# フォルダの設定
UPLOAD_FOLDER = 'uploads'
RESULT_FOLDER = 'results'

# フォルダがなければ作成
for folder in [UPLOAD_FOLDER, RESULT_FOLDER]:
    os.makedirs(folder, exist_ok=True)

# MIMEタイプの追加登録（特にm4a向け）
mimetypes.add_type('audio/m4a', '.m4a')
mimetypes.add_type('audio/aac', '.aac')

# ファイルアップロードの設定
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'mp4', 'mpeg', 'mpga', 'webm'}
ALLOWED_MIMETYPES = {
    'audio/mpeg', 'audio/mp3', 
    'audio/wav', 'audio/x-wav', 
    'audio/mp4', 'audio/m4a', 'audio/x-m4a',
    'audio/aac', 'audio/x-aac',
    'audio/ogg', 'audio/flac',
    'application/octet-stream'  # バイナリとして送信される場合も許可
}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 最大32MB

# ファイル拡張子のチェック
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# インデックスページ
@app.route('/')
def index():
    return app.send_static_file('index.html')

# favicon
@app.route('/favicon.ico')
def favicon():
    return app.send_static_file('favicon.ico')

# 文字起こし処理
@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    # APIキーのチェック
    openai_api_key = request.form.get('openai_api_key')
    
    if not openai_api_key:
        return jsonify({'error': 'OpenAI APIキーが必要です'}), 400
    
    # ファイルのチェック
    if 'file' not in request.files:
        return jsonify({'error': 'ファイルがアップロードされていません'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'ファイルが選択されていません'}), 400
    
    # フロントエンドから渡されたファイル形式情報を取得
    file_type = request.form.get('file_type', '')
    
    # ファイル情報をログに出力
    app.logger.info(f"ファイル情報: 名前={file.filename}, MIME={file.content_type}, タイプ={file_type}")
    
    # ファイル形式チェック - 拡張子とMIMEタイプの両方で判断
    is_allowed_ext = allowed_file(file.filename)
    is_allowed_mime = file.content_type in ALLOWED_MIMETYPES
    
    if not (is_allowed_ext or is_allowed_mime):
        # ファイル情報のロギング
        app.logger.error(f"不正なファイル形式: {file.filename}, MIME: {file.content_type}, 拡張子: {file_type}")
        return jsonify({'error': f'対応していないファイル形式です（{file.content_type}）'}), 400
    
    # ファイルの保存
    unique_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{unique_id}_{filename}")
    file.save(file_path)
    
    app.logger.info(f"ファイル保存完了: {file_path}")
    
    try:
        # OpenAI Whisper APIによる文字起こし
        raw_transcript = transcribe_with_whisper(file_path, openai_api_key)
        
        # OpenAI ChatGPTによるテキスト整形
        formatted_text = format_with_chatgpt(raw_transcript, openai_api_key)
        
        # 結果を保存
        result_file = os.path.join(RESULT_FOLDER, f"{unique_id}_result.txt")
        with open(result_file, 'w', encoding='utf-8') as f:
            f.write(formatted_text)
        
        app.logger.info(f"文字起こし完了: {result_file}")
        
        # 成功レスポンス
        return jsonify({
            'success': True,
            'text': formatted_text,
            'filename': os.path.basename(result_file)
        })
    
    except Exception as e:
        # エラーハンドリング
        app.logger.error(f"エラー発生: {str(e)}")
        return jsonify({
            'error': str(e)
        }), 500
    
    finally:
        # 処理が終わったらアップロードファイルを削除
        try:
            os.remove(file_path)
            app.logger.info(f"一時ファイル削除: {file_path}")
        except Exception as e:
            app.logger.warning(f"一時ファイル削除に失敗: {file_path}, エラー: {str(e)}")

# OpenAI Whisper APIによる文字起こし
def transcribe_with_whisper(file_path, api_key):
    url = "https://api.openai.com/v1/audio/transcriptions"
    headers = {
        "Authorization": f"Bearer {api_key}"
    }
    
    # ファイルの拡張子を取得
    file_ext = os.path.splitext(file_path)[1].lower()
    
    # 拡張子からMIMEタイプを決定
    content_type = mimetypes.guess_type(file_path)[0] or 'audio/mpeg'
    
    app.logger.info(f"Whisper API リクエスト準備: {os.path.basename(file_path)}, タイプ: {content_type}")
    
    with open(file_path, 'rb') as f:
        files = {
            'file': (os.path.basename(file_path), f, content_type),
            'model': (None, 'whisper-1'),
            'language': (None, 'ja'),
            'response_format': (None, 'verbose_json')
        }
        
        response = requests.post(url, headers=headers, files=files)
        
        if response.status_code != 200:
            error_message = f"OpenAI API エラー (文字起こし): {response.status_code} - {response.text}"
            app.logger.error(error_message)
            raise Exception(error_message)
        
        result = response.json()
        
        # 文字起こし結果の取得
        transcript = result.get('text', '')
        
        # タイムスタンプ付きの表示形式を構築（もしタイムスタンプ情報がある場合）
        segments = result.get('segments', [])
        if segments:
            lines = []
            for segment in segments:
                start_time = segment.get('start')
                text = segment.get('text', '').strip()
                
                if text:
                    timestamp = ''
                    if start_time is not None:
                        start_min = int(start_time // 60)
                        start_sec = int(start_time % 60)
                        timestamp = f"[{start_min:02d}:{start_sec:02d}] "
                    
                    line = f"{timestamp}{text}"
                    lines.append(line)
            
            return '\n'.join(lines)
        
        return transcript

# ChatGPT APIによるテキスト整形
def format_with_chatgpt(text, api_key):
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # システムプロンプト
    system_prompt = """
    あなたはプロフェッショナルな文字起こしアシスタントです。以下の文字起こしデータを読みやすく整形してください。

    条件:
    - 元の音声を可能な限り忠実に文字化してください。
    - 「あの」「えー」などの不要なフィラーやノイズを削除し、新しい情報を追加しないでください。
    - 文脈を保持しながら、テキストを統一して読みやすくしてください。
    - カタカナ英語（ケース、プラン、パターン、リハ、リハビリなど）はそのまま保持してください。
    - 内容を要約し、読みやすいテキストに整形してください。
    - テキストを読みやすいように論理的な段落に分けてください。
    - タイムスタンプがある場合は、そのまま残してください。
    """
    
    data = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"以下の文字起こしデータを整形してください：\n\n{text}"}
        ],
        "temperature": 0.3,
        "max_tokens": 4000
    }
    
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code != 200:
        error_message = f"OpenAI API エラー: {response.status_code} - {response.text}"
        app.logger.error(error_message)
        raise Exception(error_message)
    
    result = response.json()
    formatted_text = result['choices'][0]['message']['content']
    
    return formatted_text

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)