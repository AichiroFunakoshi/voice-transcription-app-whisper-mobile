// グローバル変数
let audioFile = null;
let transcriptText = '';

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
        // モバイル向け最適化
        document.documentElement.classList.add('mobile-device');
        
        // iOS向けのメタタグを追加
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
            viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
        }
        
        // 安全領域を考慮したCSSを適用
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

    // テキストのコピーボタン
    const copyButton = document.getElementById('copyButton');
    if (copyButton) {
        copyButton.addEventListener('click', copyTranscriptToClipboard);
    }

    // ダウンロードボタン
    const downloadButton = document.getElementById('downloadButton');
    if (downloadButton) {
        downloadButton.addEventListener('click', downloadTranscript);
    }

    // リセットボタン
    const resetButton = document.getElementById('resetButton');
    if (resetButton) {
        resetButton.addEventListener('click', function() {
            window.location.reload();
        });
    }
    
    // モバイルデバイス向けのタッチイベント
    addTouchFeedback();
}

// ボタンへのタッチフィードバックを追加
function addTouchFeedback() {
    const buttons = document.querySelectorAll('.btn');
    
    buttons.forEach(button => {
        // タッチ開始時
        button.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.97)';
            this.style.opacity = '0.9';
        });
        
        // タッチ終了時
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
    
    // APIキーが存在すれば次のステップへ
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
    
    // APIキーの形式チェック
    if (!openaiApiKey.startsWith('sk-')) {
        showAlert('OpenAI APIキーの形式が正しくありません（sk-で始まる必要があります）。', 'danger');
        return;
    }
    
    // ローカルストレージに保存
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
        // iOSデバイスの場合は追加の処理
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            fileInput.setAttribute('capture', 'user');
        }
    }
    
    const dropArea = document.createElement('div');
    dropArea.id = 'fileDropArea';
    dropArea.className = 'file-drop-area mb-3';
    dropArea.innerHTML = `
        <div class="file-icon"><i class="bi bi-file-earmark-music"></i></div>
        <p class="file-message">音声ファイルをドラッグ＆ドロップ<br>または<br>タップしてファイルを選択</p>
    `;
    
    // ファイル入力を非表示にし、カスタムドロップエリアを追加
    fileInput.style.display = 'none';
    fileInput.parentNode.insertBefore(dropArea, fileInput);
    dropArea.appendChild(fileInput);
    fileInput.style.opacity = 0;
    fileInput.style.position = 'absolute';
    fileInput.style.top = 0;
    fileInput.style.left = 0;
    fileInput.style.width = '100%';
    fileInput.style.height = '100%';
    
    // ドラッグオーバーイベント
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // ハイライト表示
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.classList.add('highlight');
    }
    
    function unhighlight() {
        dropArea.classList.remove('highlight');
    }
    
    // ファイルドロップ時の処理
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length) {
            fileInput.files = files;
            updateFileDisplay(files[0]);
        }
    }
    
    // 通常のファイル選択時
    fileInput.addEventListener('change', function() {
        if (this.files.length) {
            updateFileDisplay(this.files[0]);
        }
    });
    
    // ファイル表示の更新
    function updateFileDisplay(file) {
        audioFile = file;
        
        // 既存のファイル表示があれば削除
        const existingFile = dropArea.querySelector('.selected-file');
        if (existingFile) {
            existingFile.remove();
        }
        
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
    
    // ファイルサイズチェック（32MB上限）
    if (audioFile.size > 32 * 1024 * 1024) {
        showAlert('ファイルサイズが大きすぎます（上限:32MB）。', 'danger');
        return;
    }
    
    // ファイル形式チェック
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/ogg', 'audio/flac'];
    if (!allowedTypes.includes(audioFile.type) && !audioFile.name.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i)) {
        showAlert('対応していないファイル形式です。', 'danger');
        return;
    }
    
    // プログレスバーの表示
    const progressBar = document.querySelector('#uploadProgress .progress-bar');
    document.getElementById('uploadProgress').style.display = 'block';
    document.getElementById('uploadButton').disabled = true;
    
    // ファイル情報表示
    showFileInfo();
    
    // プログレスバーをアニメーションで進める
    let progress = 0;
    const interval = setInterval(() => {
        progress += 5;
        if (progress > 90) {
            clearInterval(interval);
            progress = 100;
        }
        progressBar.style.width = `${progress}%`;
    }, 100);
    
    // 完了時の処理
    setTimeout(() => {
        clearInterval(interval);
        progressBar.style.width = '100%';
        document.getElementById('uploadSuccess').style.display = 'block';
        document.getElementById('uploadButton').disabled = false;
        document.getElementById('transcribeCard').style.display = 'block';
        updateSteps(3);
        
        // モバイルでは自動スクロール
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            document.getElementById('transcribeCard').scrollIntoView({ behavior: 'smooth' });
        }
    }, 1500);
}

// ファイル情報表示
function showFileInfo() {
    if (!audioFile) return;
    
    const fileSizeMB = (audioFile.size / (1024 * 1024)).toFixed(2);
    document.getElementById('fileInfo').textContent = `ファイル名: ${audioFile.name} (${fileSizeMB} MB)`;
}

// 文字起こし処理開始
async function startTranscription() {
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
    
    // UI更新
    document.getElementById('transcribeProgress').style.display = 'block';
    document.getElementById('transcribeSpinner').style.display = 'block';
    document.getElementById('transcribeButton').disabled = true;
    
    // プログレスバーの初期化
    updateProgressStatus(10, '処理を開始しています...');
    
    try {
        // FormDataの作成
        const formData = new FormData();
        formData.append('file', audioFile);
        formData.append('openai_api_key', openaiApiKey);
        
        // サーバーサイドに処理リクエスト
        updateProgressStatus(20, 'サーバーへファイルを送信中...');
        
        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'サーバーエラーが発生しました');
        }
        
        updateProgressStatus(90, 'レスポンスを処理中...');
        
        const data = await response.json();
        transcriptText = data.text;
        
        // 結果表示
        document.getElementById('transcriptResult').textContent = transcriptText;
        document.getElementById('resultCard').style.display = 'block';
        updateSteps(4);
        
        // 完了
        updateProgressStatus(100, '処理完了！');
        
        // モバイルでは自動スクロール
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            document.getElementById('resultCard').scrollIntoView({ behavior: 'smooth' });
        }
        
    } catch (error) {
        console.error('Error:', error);
        showAlert(`エラー: ${error.message}`, 'danger');
    } finally {
        document.getElementById('transcribeButton').disabled = false;
        document.getElementById('transcribeSpinner').style.display = 'none';
    }
}

// プログレスバーとステータス更新
function updateProgressStatus(progress, statusText) {
    const progressBar = document.querySelector('#transcribeProgress .progress-bar');
    progressBar.style.width = `${progress}%`;
    document.getElementById('transcribeStatus').textContent = statusText;
}

// テキストをクリップボードにコピー
function copyTranscriptToClipboard() {
    if (!transcriptText) {
        showAlert('テキストが生成されていません。', 'danger');
        return;
    }
    
    navigator.clipboard.writeText(transcriptText)
        .then(() => {
            showAlert('テキストをクリップボードにコピーしました！', 'success');
        })
        .catch(err => {
            console.error('クリップボードへのコピーに失敗しました:', err);
            showAlert('コピーに失敗しました。', 'danger');
        });
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
        a.dataset.downloadurl = ['text/plain', a.download, a.href].join(':');
    }
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showAlert('ファイルをダウンロードしました！', 'success');
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
    
    // アラートが既に表示されていれば削除
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => {
        alert.remove();
    });
    
    // カードの最初の要素としてアラートを挿入
    const currentStep = document.querySelector('.step.active');
    const stepNum = Array.from(document.querySelectorAll('.step')).indexOf(currentStep) + 1;
    let targetCard;
    
    switch (stepNum) {
        case 1:
            targetCard = document.getElementById('apiKeyCard');
            break;
        case 2:
            targetCard = document.getElementById('uploadCard');
            break;
        case 3:
            targetCard = document.getElementById('transcribeCard');
            break;
        case 4:
            targetCard = document.getElementById('resultCard');
            break;
        default:
            targetCard = document.getElementById('apiKeyCard');
    }
    
    if (targetCard) {
        const cardBody = targetCard.querySelector('.card-body');
        if (cardBody) {
            cardBody.prepend(alertDiv);
        }
    }
    
    // 5秒後に自動的に消える
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
    
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