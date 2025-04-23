// グローバル変数
let audioFile = null;
let transcriptText = '';
let processingStatus = false; // 処理中かどうかのフラグ

// ページロード時の初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    registerServiceWorker();
    checkMobileDevice();
});

// アプリの初期化
function initializeApp() {
    loadApiKeys();
    document.getElementById('uploadCard').style.display = 'none';
    document.getElementById('transcribeCard').style.display = 'none';
    document.getElementById('resultCard').style.display = 'none';
}

// モバイルデバイスのチェックと最適化
function checkMobileDevice() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        document.documentElement.classList.add('mobile-device');
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
            viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
        }
        document.body.style.paddingTop = 'env(safe-area-inset-top)';
        document.body.style.paddingBottom = 'env(safe-area-inset-bottom)';
    }
}

// イベントリスナーのセットアップ
function setupEventListeners() {
    // APIキーフォーム送信
    document.getElementById('apiKeyForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveApiKeys();
    });

    // 音声ファイルアップロード
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleFileUpload();
        });
    }

    // ファイルのドラッグ＆ドロップ
    setupFileDragAndDrop();

    // 文字起こし実行
    const transcribeButton = document.getElementById('transcribeButton');
    if (transcribeButton) {
        transcribeButton.addEventListener('click', startTranscription);
    }

    // その他のボタン
    document.getElementById('copyButton')?.addEventListener('click', copyTranscriptToClipboard);
    document.getElementById('downloadButton')?.addEventListener('click', downloadTranscript);
    document.getElementById('resetButton')?.addEventListener('click', () => window.location.reload());
    
    // モバイルデバイス向けのタッチフィードバック
    addTouchFeedback();
}

// ボタンへのタッチフィードバックを追加
function addTouchFeedback() {
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.97)';
            this.style.opacity = '0.9';
        });
        
        ['touchend', 'touchcancel'].forEach(event => {
            button.addEventListener(event, function() {
                this.style.transform = 'scale(1)';
                this.style.opacity = '1';
            });
        });
    });
}

// ローカルストレージからAPIキーを読み込む
function loadApiKeys() {
    const openaiApiKey = localStorage.getItem('openai_api_key') || '';
    document.getElementById('openaiApiKey').value = openaiApiKey;
    
    if (openaiApiKey) {
        document.getElementById('uploadCard').style.display = 'block';
        updateSteps(2);
    }
}

// APIキーの保存
function saveApiKeys() {
    const openaiApiKey = document.getElementById('openaiApiKey').value.trim();
    
    if (!openaiApiKey) {
        showAlert('APIキーを入力してください。', 'danger');
        return;
    }
    
    if (!openaiApiKey.startsWith('sk-')) {
        showAlert('OpenAI APIキーの形式が正しくありません（sk-で始まる必要があります）。', 'danger');
        return;
    }
    
    localStorage.setItem('openai_api_key', openaiApiKey);
    
    showAlert('APIキーを保存しました！', 'success');
    document.getElementById('uploadCard').style.display = 'block';
    updateSteps(2);
}

// ファイルのドラッグ＆ドロップ設定
function setupFileDragAndDrop() {
    const fileInput = document.getElementById('audioFile');
    
    // モバイルデバイスでの直接ファイル選択サポート
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        fileInput.removeAttribute('capture');
    }
    
    const dropArea = document.createElement('div');
    dropArea.id = 'fileDropArea';
    dropArea.className = 'file-drop-area mb-3';
    dropArea.innerHTML = `
        <div class="file-icon"><i class="bi bi-file-earmark-music"></i></div>
        <p class="file-message">音声ファイルをドラッグ＆ドロップ<br>または<br>タップしてファイルを選択</p>
    `;
    
    fileInput.style.display = 'none';
    fileInput.parentNode.insertBefore(dropArea, fileInput);
    dropArea.appendChild(fileInput);
    
    // スマホでタップできるように修正
    dropArea.style.position = 'relative';
    fileInput.style.opacity = 0;
    fileInput.style.position = 'absolute';
    fileInput.style.top = 0;
    fileInput.style.left = 0;
    fileInput.style.width = '100%';
    fileInput.style.height = '100%';
    fileInput.style.cursor = 'pointer';
    fileInput.style.zIndex = 1;
    
    // タップフィードバック
    ['touchstart', 'touchend'].forEach(event => {
        dropArea.addEventListener(event, function() {
            this.classList.toggle('active', event === 'touchstart');
        });
    });
    
    // ドラッグイベント
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });
    
    // ハイライト表示
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('highlight'), false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('highlight'), false);
    });
    
    // ファイルドロップ時の処理
    dropArea.addEventListener('drop', function(e) {
        const files = e.dataTransfer.files;
        if (files.length) {
            fileInput.files = files;
            updateFileDisplay(files[0]);
        }
    }, false);
    
    // ファイル選択UI
    dropArea.addEventListener('click', function(e) {
        if (e.target !== fileInput) fileInput.click();
    });
    
    fileInput.addEventListener('change', function() {
        if (this.files.length) updateFileDisplay(this.files[0]);
    });
    
    // ファイル表示の更新
    function updateFileDisplay(file) {
        audioFile = file;
        const existingFile = dropArea.querySelector('.selected-file');
        if (existingFile) existingFile.remove();
        
        const fileName = document.createElement('div');
        fileName.classList.add('selected-file');
        fileName.innerHTML = `<i class="bi bi-file-earmark-music"></i> ${file.name}`;
        dropArea.appendChild(fileName);
    }
}

// ファイルアップロード処理
function handleFileUpload() {
    if (!audioFile) {
        const fileInput = document.getElementById('audioFile');
        if (fileInput.files.length) {
            audioFile = fileInput.files[0];
        } else {
            showAlert('ファイルを選択してください。', 'danger');
            return;
        }
    }
    
    // ファイルチェック
    if (audioFile.size > 32 * 1024 * 1024) {
        showAlert('ファイルサイズが大きすぎます（上限:32MB）。', 'danger');
        return;
    }
    
    const fileName = audioFile.name.toLowerCase();
    const fileExt = fileName.split('.').pop();
    
    // ファイル形式チェック
    const allowedExts = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];
    const allowedTypes = [
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
        'audio/mp4', 'audio/m4a', 'audio/x-m4a',
        'audio/aac', 'audio/x-aac',
        'audio/ogg', 'audio/flac'
    ];
    
    console.log('ファイル情報:', {
        名前: fileName,
        サイズ: (audioFile.size / 1024 / 1024).toFixed(2) + 'MB',
        タイプ: audioFile.type,
        拡張子: fileExt
    });
    
    if (!(allowedTypes.includes(audioFile.type) || allowedExts.includes(fileExt))) {
        showAlert(`対応していないファイル形式です。拡張子: ${fileExt}, タイプ: ${audioFile.type}`, 'danger');
        return;
    }
    
    // UI更新
    const progressBar = document.querySelector('#uploadProgress .progress-bar');
    document.getElementById('uploadProgress').style.display = 'block';
    document.getElementById('uploadButton').disabled = true;
    
    showFileInfo();
    showToast('ファイル読み込み中...', 'info');
    
    // 読み込み状態を表現
    let progress = 0;
    const readInterval = setInterval(() => {
        progress += 10;
        if (progress > 90) clearInterval(readInterval);
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress);
    }, 100);
    
    // ファイル検証シミュレーション
    setTimeout(() => {
        clearInterval(readInterval);
        progressBar.style.width = '100%';
        progressBar.setAttribute('aria-valuenow', 100);
        
        document.getElementById('uploadSuccess').style.display = 'block';
        document.getElementById('uploadButton').disabled = false;
        document.getElementById('transcribeCard').style.display = 'block';
        updateSteps(3);
        
        showToast('ファイル読み込み完了！文字起こしを開始できます', 'success');
        
        // モバイルでは自動スクロール
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            document.getElementById('transcribeCard').scrollIntoView({ behavior: 'smooth' });
        }
    }, 1000);
    // ファイルアップロード後に自動で文字起こし開始
    startTranscription();
}

// ファイル情報表示
function showFileInfo() {
    if (!audioFile) return;
    
    const fileSizeMB = (audioFile.size / (1024 * 1024)).toFixed(2);
    document.getElementById('fileInfo').textContent = `ファイル名: ${audioFile.name} (${fileSizeMB} MB)`;
}

// サーバーのヘルスチェック関数
async function checkServerHealth() {
    try {
        showToast('サーバー接続を確認中...', 'info');
        const response = await fetch('/api/healthcheck', {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            cache: 'no-cache'
        });
        
        if (response.ok) {
            const healthData = await response.json();
            console.log('サーバーのヘルスチェック結果:', healthData);
            
            if (healthData.status !== 'ok') {
                let errorMessage = 'サーバーに問題があります: ';
                if (!healthData.upload_folder) errorMessage += 'アップロードフォルダにアクセスできません。';
                if (!healthData.result_folder) errorMessage += '結果フォルダにアクセスできません。';
                showAlert(errorMessage, 'warning');
                return false;
            }
            return true;
        } else {
            console.error('ヘルスチェックエラー:', response.status);
            showAlert('サーバーに接続できません。ページを再読み込みするか、しばらく経ってからお試しください。', 'danger');
            return false;
        }
    } catch (error) {
        console.error('ヘルスチェック例外:', error);
        showAlert('サーバー接続エラー: ' + error.message, 'danger');
        return false;
    }
}

// トースト通知を表示
function showToast(message, type = 'info') {
    const toast = document.getElementById('processToast');
    const toastBody = document.getElementById('processToastBody');
    
    if (!toast || !toastBody) return;
    
    toastBody.textContent = message;
    
    toast.classList.remove('bg-info', 'bg-success', 'bg-warning', 'bg-danger');
    toast.classList.add(`bg-${type}`, type === 'warning' ? 'text-dark' : 'text-white');
    
    toast.style.display = 'block';
    
    const duration = type === 'success' ? 3000 : 5000;
    setTimeout(() => {
        toast.style.display = 'none';
    }, duration);
}

// 文字起こし処理開始
async function startTranscription() {
    console.log('文字起こし処理を開始します');
    
    // 処理中なら二重実行を防止
    if (processingStatus) {
        showAlert('すでに処理中です。しばらくお待ちください。', 'warning');
        return;
    }
    
    // サーバーのヘルスチェック
    const serverOk = await checkServerHealth();
    if (!serverOk) return;
    
    // APIキーチェック
    const openaiApiKey = localStorage.getItem('openai_api_key');
    
    if (!openaiApiKey) {
        showAlert('APIキーが設定されていません。', 'danger');
        updateSteps(1);
        return;
    }
    
    if (!audioFile) {
        showAlert('音声ファイルを選択してください。', 'danger');
        return;
    }
    
    // 処理中フラグをセット
    processingStatus = true;
    
    // UI更新
    document.getElementById('transcribeProgress').style.display = 'block';
    document.getElementById('transcribeSpinner').style.display = 'block';
    document.getElementById('transcribeButton').disabled = true;
    
    // プログレスバーの初期化
    updateProgressStatus(5, '処理を開始しています...');
    showToast('文字起こし処理を開始します...', 'info');
    
    try {
        // FormDataの作成
        const formData = new FormData();
        
        // ファイル拡張子に基づいてMIMEタイプを設定
        const fileName = audioFile.name.toLowerCase();
        const fileExt = fileName.split('.').pop();
        let mimeType = audioFile.type;
        
        // m4aがうまく認識されない場合
        if (fileExt === 'm4a' && (!mimeType || mimeType === 'application/octet-stream')) {
            mimeType = 'audio/m4a';
            console.log('m4aファイルのMIMEタイプを変更:', mimeType);
        }
        
        // ファイル情報のデバッグ出力
        console.log('アップロードファイル情報:', {
            ファイル名: fileName,
            サイズ: (audioFile.size / 1024 / 1024).toFixed(2) + 'MB',
            MIMEタイプ: mimeType,
            拡張子: fileExt
        });
        
        // フォームデータ準備
        formData.append('file', audioFile, audioFile.name);
        formData.append('openai_api_key', openaiApiKey);
        formData.append('file_type', fileExt);
        
        // 進捗表示を更新するインターバル
        let progressValue = 10;
        updateProgressStatus(progressValue, 'サーバーへファイルを送信中...');
        showToast('ファイルをアップロード中...', 'info');
        
        const progressInterval = setInterval(() => {
            if (progressValue < 85) {
                progressValue += 1;
                updateProgressStatus(progressValue, '文字起こし処理中...');
                
                // 進行状況に応じてメッセージを変更
                if (progressValue === 20) {
                    showToast('音声をWhisper APIに送信中...', 'info');
                } else if (progressValue === 40) {
                    showToast('音声の分析中...', 'info');
                } else if (progressValue === 60) {
                    showToast('テキストを整形中...', 'info');
                } else if (progressValue === 80) {
                    showToast('もうすぐ完了します...', 'info');
                }
            }
        }, 2000);
        
        // タイムアウト設定
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分
        
        // サーバーリクエスト送信
        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        clearInterval(progressInterval);
        
        console.log('サーバーレスポンス受信:', response.status);
        
        if (!response.ok) {
            let errorMessage = 'サーバーエラーが発生しました';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
                console.error('サーバーエラー詳細:', errorData);
            } catch (e) {
                console.error('エラーレスポンスの解析に失敗:', e);
            }
            throw new Error(errorMessage);
        }
        
        updateProgressStatus(90, 'レスポンスを処理中...');
        showToast('文字起こし結果を受信中...', 'info');
        
        const data = await response.json();
        console.log('文字起こし結果受信成功');
        
        if (!data.text) {
            throw new Error('文字起こし結果が空です');
        }
        
        transcriptText = data.text;
        
        // 結果表示
        document.getElementById('transcriptResult').textContent = transcriptText;
        document.getElementById('resultCard').style.display = 'block';
        updateSteps(4);
        
        // 完了
        updateProgressStatus(100, '処理完了！');
        showToast('文字起こしが完了しました！', 'success');
        
        // モバイルでは自動スクロール
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            document.getElementById('resultCard').scrollIntoView({ behavior: 'smooth' });
        }
        
    } catch (error) {
        console.error('文字起こし処理エラー:', error);
        
        // エラーメッセージの詳細化
        let errorMessage = error.message || 'unknown error';
        let detailedMessage = '';
        
        // エラータイプに基づいて適切なメッセージを設定
        if (error.name === 'AbortError') {
            detailedMessage = 'リクエストがタイムアウトしました。ネットワーク接続を確認するか、小さいファイルで試してください。';
            showToast('タイムアウトしました', 'danger');
        } else if (error.name === 'TypeError' && errorMessage.includes('Failed to fetch')) {
            detailedMessage = 'サーバーとの通信に失敗しました。インターネット接続を確認してください。';
            showToast('サーバー接続エラー', 'danger');
        } else if (errorMessage.includes('API')) {
            detailedMessage = 'OpenAI APIとの通信に問題があります。APIキーが有効か確認してください。';
            showToast('API接続エラー', 'danger');
        } else {
            showToast('エラーが発生しました', 'danger');
        }
        
        showAlert(`エラー: ${errorMessage}${detailedMessage ? '<br>' + detailedMessage : ''}`, 'danger');
        
        // エラー時のデバッグ情報収集
        if (window.location.search.includes('debug=true')) {
            const debugInfo = document.getElementById('fileDebugInfo');
            if (debugInfo) {
                debugInfo.textContent = JSON.stringify({
                    error: errorMessage,
                    file: audioFile ? {
                        name: audioFile.name,
                        size: audioFile.size,
                        type: audioFile.type
                    } : 'no file',
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                }, null, 2);
            }
        }
    } finally {
        // 処理中フラグを解除
        processingStatus = false;
        document.getElementById('transcribeButton').disabled = false;
        document.getElementById('transcribeSpinner').style.display = 'none';
    }
}

// プログレスバーとステータス更新
function updateProgressStatus(progress, statusText) {
    const progressBar = document.querySelector('#transcribeProgress .progress-bar');
    progressBar.style.width = `${progress}%`;
    progressBar.setAttribute('aria-valuenow', progress);
    document.getElementById('transcribeStatus').textContent = statusText;
}

// テキストをクリップボードにコピー
function copyTranscriptToClipboard() {
    if (!transcriptText) {
        showAlert('テキストが生成されていません。', 'danger');
        return;
    }
    
    try {
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            // モバイル向け
            const tempElement = document.createElement('textarea');
            tempElement.value = transcriptText;
            document.body.appendChild(tempElement);
            tempElement.select();
            tempElement.setSelectionRange(0, 99999);
            document.execCommand('copy');
            document.body.removeChild(tempElement);
        } else {
            // デスクトップ向け
            navigator.clipboard.writeText(transcriptText);
        }
        showAlert('テキストをクリップボードにコピーしました！', 'success');
        showToast('テキストをコピーしました', 'success');
    } catch (err) {
        console.error('コピーエラー:', err);
        showAlert('コピーに失敗しました。', 'danger');
    }
}

// テキストのダウンロード
function downloadTranscript() {
    if (!transcriptText) {
        showAlert('テキストが生成されていません。', 'danger');
        return;
    }
    
    const blob = new Blob([transcriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // ファイル名に日付を追加
    const date = new Date();
    const dateStr = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    const timeStr = `${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`;
    
    a.download = `音声文字起こし_${dateStr}_${timeStr}.txt`;
    
    // iOSの場合は特別な処理
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        a.target = '_blank';
        a.setAttribute('download', a.download);
        a.dataset.downloadurl = ['text/plain', a.download, a.href].join(':');
    }
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showAlert('ファイルをダウンロードしました！', 'success');
    showToast('ファイルをダウンロードしました', 'success');
}

// ステップ表示の更新
function updateSteps(currentStep) {
    const steps = document.querySelectorAll('.step');
    
    steps.forEach((step, index) => {
        const stepNum = index + 1;
        
        if (stepNum < currentStep) {
            step.classList.remove('active');
            step.classList.add('completed');
        } else if (stepNum === currentStep) {
            step.classList.add('active');
            step.classList.remove('completed');
        } else {
            step.classList.remove('active', 'completed');
        }
    });
}

// アラート表示
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // 既存のアラートを削除
    document.querySelectorAll('.alert').forEach(alert => alert.remove());
    
    // ターゲットカードを特定
    const currentStep = document.querySelector('.step.active');
    const stepNum = Array.from(document.querySelectorAll('.step')).indexOf(currentStep) + 1;
    const targetCardId = ['apiKeyCard', 'uploadCard', 'transcribeCard', 'resultCard'][stepNum - 1] || 'apiKeyCard';
    const targetCard = document.getElementById(targetCardId);
    
    if (targetCard) {
        const cardBody = targetCard.querySelector('.card-body');
        if (cardBody) cardBody.prepend(alertDiv);
    }
    
    // 5秒後に自動的に消える
    setTimeout(() => alertDiv.remove(), 5000);
    
    // モバイルデバイスではバイブレーション
    if (navigator.vibrate && type === 'danger') {
        navigator.vibrate(200);
    }
}

// Service Workerの登録
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
            navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(function(err) {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }
}