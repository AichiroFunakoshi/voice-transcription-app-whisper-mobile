from flask import Flask, request, jsonify, render_template, send_from_directory
import os
import uuid
import json
import requests
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='.', static_url_path='')

# フォルダの設定
UPLOAD_FOLDER = 'uploads'
RESULT_FOLDER = 'results'

# フォルダがなければ作成
for folder in [UPLOAD_FOLDER, RESULT_FOLDER]:
    os.makedirs(folder, exist_ok=True)

# ファイルアップロードの設定
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'mp4', 'mpeg', 'mpga', 'webm'}
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
    
    if not allowed_file(file.filename):
        return jsonify({'error': '対応していないファイル形式です'}), 400
    
    # ファイルの保存
    unique_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{unique_id}_{filename}")
    file.save(file_path)
    
    try:
        # OpenAI Whisper APIによる文字起こし
        raw_transcript = transcribe_with_whisper(file_path, openai_api_key)
        
        # OpenAI ChatGPTによるテキスト整形
        formatted_text = format_with_chatgpt(raw_transcript, openai_api_key)
        
        # 結果を保存
        result_file = os.path.join(RESULT_FOLDER, f"{unique_id}_result.txt")
        with open(result_file, 'w', encoding='utf-8') as f:
            f.write(formatted_text)
        
        # 成功レスポンス
        return jsonify({
            'success': True,
            'text': formatted_text,
            'filename': os.path.basename(result_file)
        })
    
    except Exception as e:
        # エラーハンドリング
        return jsonify({
            'error': str(e)
        }), 500
    
    finally:
        # 処理が終わったらアップロードファイルを削除
        try:
            os.remove(file_path)
        except:
            pass

# OpenAI Whisper APIによる文字起こし
def transcribe_with_whisper(file_path, api_key):
    url = "https://api.openai.com/v1/audio/transcriptions"
    headers = {
        "Authorization": f"Bearer {api_key}"
    }
    
    with open(file_path, 'rb') as f:
        files = {
            'file': (os.path.basename(file_path), f, 'audio/mpeg'),
            'model': (None, 'whisper-1'),
            'language': (None, 'ja'),
            'response_format': (None, 'verbose_json')
        }
        
        response = requests.post(url, headers=headers, files=files)
        
        if response.status_code != 200:
            error_message = f"OpenAI API エラー (文字起こし): {response.status_code} - {response.text}"
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
        raise Exception(error_message)
    
    result = response.json()
    formatted_text = result['choices'][0]['message']['content']
    
    return formatted_text

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)