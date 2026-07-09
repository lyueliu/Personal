/**
 * 离线文件传输工具 - 二维码解析端
 * 手机端：相机扫描二维码流
 * PC端：上传文件夹
 */

// ============================================================
// 常量
// ============================================================
const DATA_BLOCKS_PER_FRAME = 1;
const MAX_DATA_PER_BLOCK = 200;
const SCAN_INTERVAL_MS = 150; // 扫描间隔（约6-7 fps）

// ============================================================
// 状态
// ============================================================
const state = {
    files: [],
    pngFiles: [],
    infoJson: null,
    totalFrames: 0,
    frameResults: [],
    allDataBlocks: [],
    errors: [],
    isProcessing: false,
    decodedFileName: '',
    frameStatusMap: {}
};

// ============================================================
// 工具函数
// ============================================================
function setFooterStatus(text) {
    const el = document.getElementById('footerStatus');
    if (el) el.textContent = text;
    else console.warn('footerStatus 元素不存在');
}

function extractNumber(name) {
    const m = name.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
}

// ============================================================
// DOM（上传模式）
// ============================================================
const dom = {
    uploadZone: document.getElementById('uploadZone'),
    folderInput: document.getElementById('folderInput'),
    selectFolderBtn: document.getElementById('selectFolderBtn'),
    folderInfo: document.getElementById('folderInfo'),
    folderName: document.getElementById('folderName'),
    imageCount: document.getElementById('imageCount'),
    hasInfoJson: document.getElementById('hasInfoJson'),
    progressSection: document.getElementById('progressSection'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    statusText: document.getElementById('statusText'),
    resultSection: document.getElementById('resultSection'),
    resultFileName: document.getElementById('resultFileName'),
    resultFileSize: document.getElementById('resultFileSize'),
    resultTotalFrames: document.getElementById('resultTotalFrames'),
    resultStatus: document.getElementById('resultStatus'),
    resultErrors: document.getElementById('resultErrors'),
    errorList: document.getElementById('errorList'),
    downloadSection: document.getElementById('downloadSection'),
    downloadBtn: document.getElementById('downloadBtn'),
    filePreview: document.getElementById('filePreview'),
    footerStatus: document.getElementById('footerStatus'),
    decodeCanvas: document.getElementById('decodeCanvas'),
    frameList: document.getElementById('frameList'),
    frameListContainer: document.getElementById('frameListContainer')
};

// ============================================================
// 上传事件
// ============================================================
if (dom.selectFolderBtn) {
    dom.selectFolderBtn.addEventListener('click', () => dom.folderInput && dom.folderInput.click());
}
if (dom.uploadZone) {
    dom.uploadZone.addEventListener('click', e => {
        if (e.target !== dom.selectFolderBtn) dom.folderInput && dom.folderInput.click();
    });
    dom.uploadZone.addEventListener('dragover', e => {
        e.preventDefault();
        dom.uploadZone.classList.add('drag-over');
    });
    dom.uploadZone.addEventListener('dragleave', () => {
        dom.uploadZone.classList.remove('drag-over');
    });
    dom.uploadZone.addEventListener('drop', e => {
        e.preventDefault();
        dom.uploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) processFilesFromDrop(e.dataTransfer.files);
    });
}
if (dom.folderInput) {
    dom.folderInput.addEventListener('change', handleFolderSelect);
}
if (dom.downloadBtn) {
    dom.downloadBtn.addEventListener('click', downloadFile);
}

// ============================================================
// 上传处理
// ============================================================
function handleFolderSelect(e) {
    if (e.target.files && e.target.files.length) processFiles(Array.from(e.target.files));
}

function processFilesFromDrop(files) {
    if (files.length) processFiles(Array.from(files));
}

function processFiles(files) {
    resetState();
    state.files = files;

    const folderName = (files[0].webkitRelativePath || files[0].name).split('/')[0];
    if (dom.folderName) dom.folderName.textContent = folderName;

    const pngFiles = files.filter(f =>
        /\.(png|jpe?g)$/i.test(f.name)
    ).sort((a, b) => extractNumber(a.name) - extractNumber(b.name));

    state.pngFiles = pngFiles;
    if (dom.imageCount) dom.imageCount.textContent = pngFiles.length;

    const info = files.find(f => f.name.toLowerCase() === 'info.json');
    if (info) readInfoJson(info);
    else {
        if (dom.hasInfoJson) dom.hasInfoJson.textContent = '否（从图片解析）';
        if (dom.folderInfo) dom.folderInfo.style.display = 'block';
        startDecoding();
    }
}

function readInfoJson(file) {
    if (dom.hasInfoJson) dom.hasInfoJson.textContent = '是';
    const r = new FileReader();
    r.onload = e => {
        try {
            state.infoJson = JSON.parse(e.target.result);
            state.decodedFileName = state.infoJson.fileName;
            state.totalFrames = state.infoJson.totalFrames;
        } catch (err) {
            console.warn('info.json 解析失败:', err);
        }
        startDecoding();
    };
    r.readAsText(file);
}

function resetState() {
    state.pngFiles = [];
    state.frameStatusMap = {};
    state.errors = [];
    if (dom.progressSection) dom.progressSection.style.display = 'none';
    if (dom.resultSection) dom.resultSection.style.display = 'none';
    if (dom.downloadSection) dom.downloadSection.style.display = 'none';
}

function updateProgress(p) {
    const v = Math.min(100, Math.max(0, p));
    if (dom.progressFill) dom.progressFill.style.width = v + '%';
    if (dom.progressText) dom.progressText.textContent = Math.round(v) + '%';
}

// ============================================================
// 解码帧（上传模式）- 占位，保留原有逻辑结构
// ============================================================
function startDecoding() {
    // 上传模式的解码逻辑
    // 此处保留框架，具体实现依赖原有图片解码逻辑
    if (dom.progressSection) dom.progressSection.style.display = 'block';
    updateProgress(0);
    if (dom.statusText) dom.statusText.textContent = '开始解码...';
    setFooterStatus('正在解码二维码图片...');
}

function downloadFile() {
    // 下载文件占位
    setFooterStatus('下载功能待实现');
}

// ============================================================
// 相机 DOM
// ============================================================
const cameraDom = {
    uploadModeBtn: document.getElementById('uploadModeBtn'),
    cameraModeBtn: document.getElementById('cameraModeBtn'),
    cameraSection: document.getElementById('cameraSection'),
    uploadSection: document.getElementById('uploadSection'),
    cameraPreview: document.getElementById('cameraPreview'),
    captureBtn: document.getElementById('captureBtn'),
    stopScanBtn: document.getElementById('stopScanBtn'),
    switchCameraBtn: document.getElementById('switchCameraBtn'),
    cameraStatusText: document.getElementById('cameraStatusText'),
    scanProgressText: document.getElementById('scanProgressText')
};

// 保存按钮原始 HTML 以便恢复
const captureBtnOriginalHTML = cameraDom.captureBtn ? cameraDom.captureBtn.innerHTML : '';

// ============================================================
// CameraManager
// ============================================================
class CameraManager {
    constructor() {
        this.stream = null;
        this.videoTrack = null;
        this.isActive = false;
        this.currentFacingMode = 'environment';
    }

    async start() {
        try {
            this.updateStatus('请求相机权限...');
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: this.currentFacingMode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            this.videoTrack = this.stream.getVideoTracks()[0];
            cameraDom.cameraPreview.srcObject = this.stream;
            await cameraDom.cameraPreview.play();
            this.isActive = true;
            this.updateStatus('相机就绪，点击按钮开始扫描');
            return true;
        } catch (e) {
            console.error('相机启动失败:', e);
            let msg = '相机启动失败';
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                msg = '请允许摄像头权限后重试';
            } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
                msg = '未检测到摄像头设备';
            } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
                msg = '摄像头被其他应用占用';
            } else {
                msg = '相机启动失败：' + e.message;
            }
            this.updateStatus(msg);
            return false;
        }
    }

    async switchCamera() {
        this.stop();
        this.currentFacingMode = (this.currentFacingMode === 'environment') ? 'user' : 'environment';
        return await this.start();
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
        }
        this.isActive = false;
        this.stream = null;
        this.videoTrack = null;
    }

    updateStatus(text) {
        if (cameraDom.cameraStatusText) {
            cameraDom.cameraStatusText.textContent = text;
        }
    }
}

const cameraManager = new CameraManager();

// ============================================================
// 模式切换
// ============================================================
let currentMode = 'camera';
let isContinuousScanning = false;
let scanInterval = null;

if (cameraDom.cameraModeBtn) {
    cameraDom.cameraModeBtn.addEventListener('click', () => switchToCamera());
}
if (cameraDom.uploadModeBtn) {
    cameraDom.uploadModeBtn.addEventListener('click', () => switchToUpload());
}

async function switchToCamera() {
    if (cameraDom.uploadSection) cameraDom.uploadSection.style.display = 'none';
    if (cameraDom.cameraSection) cameraDom.cameraSection.style.display = 'block';
    currentMode = 'camera';
    // 不自动启动相机，等用户点击按钮
    setFooterStatus('请点击下方按钮开始扫描');
    cameraManager.updateStatus('准备就绪，点击按钮开始扫描');
}

function switchToUpload() {
    stopContinuousCapture();
    cameraManager.stop();
    if (cameraDom.cameraSection) cameraDom.cameraSection.style.display = 'none';
    if (cameraDom.uploadSection) cameraDom.uploadSection.style.display = 'block';
    currentMode = 'upload';
    setFooterStatus('请选择包含二维码序列的文件夹');
}

// ============================================================
// 扫描状态管理
// ============================================================
function resetScanState() {
    state.allDataBlocks = [];
    state.frameStatusMap = {};
    state.errors = [];
    state.totalFrames = 0;
    state.decodedFileName = '';
    state.frameResults = [];
    if (cameraDom.scanProgressText) {
        cameraDom.scanProgressText.style.display = 'none';
        cameraDom.scanProgressText.textContent = '';
    }
}

// ============================================================
// 连续扫描核心逻辑
// ============================================================
function startContinuousCapture() {
    if (isContinuousScanning) return;

    // 确保相机已启动
    if (!cameraManager.isActive) {
        setFooterStatus('正在启动相机...');
        cameraManager.start().then(ok => {
            if (!ok) {
                setFooterStatus('相机启动失败，请检查权限设置');
                return;
            }
            doStartScanning();
        });
        return;
    }

    doStartScanning();
}

function doStartScanning() {
    isContinuousScanning = true;
    resetScanState();

    // 更新 UI
    if (cameraDom.captureBtn) {
        cameraDom.captureBtn.classList.add('scanning');
        cameraDom.captureBtn.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>';
    }
    if (cameraDom.stopScanBtn) {
        cameraDom.stopScanBtn.style.display = 'flex';
    }
    setFooterStatus('正在扫描二维码...');
    cameraManager.updateStatus('扫描中...');

    // 启动扫描循环
    scanInterval = setInterval(() => {
        processScanFrame();
    }, SCAN_INTERVAL_MS);
}

function stopContinuousCapture() {
    isContinuousScanning = false;

    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }

    // 恢复 UI
    if (cameraDom.captureBtn) {
        cameraDom.captureBtn.classList.remove('scanning');
        cameraDom.captureBtn.innerHTML = captureBtnOriginalHTML;
    }
    if (cameraDom.stopScanBtn) {
        cameraDom.stopScanBtn.style.display = 'none';
    }
    if (cameraDom.scanProgressText) {
        cameraDom.scanProgressText.style.display = 'none';
    }
}

// ============================================================
// 帧处理
// ============================================================
let lastDecodedData = ''; // 防止重复解码同一帧

function processScanFrame() {
    if (!cameraManager.isActive || !isContinuousScanning) return;

    const video = cameraDom.cameraPreview;
    if (!video || video.readyState < 2) return; // 视频未就绪

    const canvas = document.getElementById('decodeCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    } catch (e) {
        return; // 视频尺寸无效
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    let imageData;
    try {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (e) {
        return;
    }

    // 检查 jsQR 是否可用
    if (typeof jsQR === 'undefined') {
        console.warn('jsQR 库未加载');
        return;
    }

    const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
    });

    if (code && code.data) {
        // 防止重复处理同一帧
        if (code.data === lastDecodedData) return;
        lastDecodedData = code.data;

        handleQRData(code.data);
    }
}

// ============================================================
// 二维码数据解析
// 格式: frameIndex|totalFrames|fileName|base64Data
// ============================================================
function handleQRData(rawData) {
    try {
        const parts = rawData.split('|');
        if (parts.length < 4) {
            // 尝试简单格式: frameIndex|data
            if (parts.length === 2) {
                const frameIndex = parseInt(parts[0], 10);
                if (isNaN(frameIndex)) return;
                const data = parts[1];
                state.allDataBlocks[frameIndex] = data;
                state.frameStatusMap[frameIndex] = 'success';
                updateCameraResults(frameIndex, true);
            }
            return;
        }

        const frameIndex = parseInt(parts[0], 10);
        const totalFrames = parseInt(parts[1], 10);
        const fileName = parts[2];
        const data = parts.slice(3).join('|'); // 数据可能包含 |

        if (isNaN(frameIndex)) return;

        // 更新全局信息（从头帧获取）
        if (frameIndex === 0 || (totalFrames > 0 && !state.totalFrames)) {
            if (totalFrames > 0) state.totalFrames = totalFrames;
            if (fileName && fileName.length > 0) state.decodedFileName = fileName;
        }

        // 存储数据
        state.allDataBlocks[frameIndex] = data;
        state.frameStatusMap[frameIndex] = 'success';
        state.frameResults.push({ index: frameIndex, data: data });

        updateCameraResults(frameIndex, true);

    } catch (e) {
        console.warn('QR数据解析失败:', e);
    }
}

// ============================================================
// 更新扫描结果 UI
// ============================================================
function updateCameraResults(frameIndex, success) {
    const scannedCount = Object.keys(state.frameStatusMap).length;

    // 更新进度文本
    if (cameraDom.scanProgressText) {
        cameraDom.scanProgressText.style.display = 'block';
        if (state.totalFrames > 0) {
            const pct = Math.round((scannedCount / state.totalFrames) * 100);
            cameraDom.scanProgressText.textContent = '已扫描 ' + scannedCount + '/' + state.totalFrames + ' (' + pct + '%)';
        } else {
            cameraDom.scanProgressText.textContent = '已扫描 ' + scannedCount + ' 帧';
        }
    }

    setFooterStatus('已扫描 ' + scannedCount + ' 帧');

    // 检查是否收集完成
    checkScanComplete();
}

function checkScanComplete() {
    if (state.totalFrames <= 0) return;

    const scannedCount = Object.keys(state.frameStatusMap).length;
    if (scannedCount >= state.totalFrames) {
        // 扫描完成
        stopContinuousCapture();
        setFooterStatus('扫描完成！共 ' + scannedCount + ' 帧，正在重组文件...');
        cameraManager.updateStatus('扫描完成，正在重组文件...');

        // 重组文件
        assembleAndDownload();
    }
}

// ============================================================
// 文件重组与下载
// ============================================================
function assembleAndDownload() {
    try {
        // 按索引排序数据块
        const sortedBlocks = [];
        for (let i = 0; i < state.totalFrames; i++) {
            if (state.allDataBlocks[i] !== undefined) {
                sortedBlocks.push(state.allDataBlocks[i]);
            }
        }

        if (sortedBlocks.length === 0) {
            setFooterStatus('错误：未收集到有效数据');
            cameraManager.updateStatus('扫描失败，未收集到数据');
            return;
        }

        // 拼接所有 base64 数据
        const combinedBase64 = sortedBlocks.join('');
        const byteChars = atob(combinedBase64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray]);

        // 确定文件名
        const fileName = state.decodedFileName || 'received_file';

        // 触发下载
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const sizeKB = (blob.size / 1024).toFixed(1);
        setFooterStatus('下载完成：' + fileName + ' (' + sizeKB + ' KB)');
        cameraManager.updateStatus('下载完成！');

    } catch (e) {
        console.error('文件重组失败:', e);
        setFooterStatus('文件重组失败：' + e.message);
        cameraManager.updateStatus('重组失败');
    }
}

// ============================================================
// 按钮事件绑定
// ============================================================

// 开始扫描按钮
if (cameraDom.captureBtn) {
    cameraDom.captureBtn.addEventListener('click', async () => {
        try {
            if (isContinuousScanning) {
                // 正在扫描中，点击停止
                stopContinuousCapture();
                setFooterStatus('扫描已停止');
                cameraManager.updateStatus('扫描已停止');
                return;
            }

            if (!cameraManager.isActive) {
                setFooterStatus('正在启动相机...');
                cameraManager.updateStatus('正在启动相机...');
                const ok = await cameraManager.start();
                if (!ok) {
                    setFooterStatus('相机启动失败，请检查权限');
                    return;
                }
            }

            startContinuousCapture();
        } catch (e) {
            console.error('按钮点击处理异常:', e);
            setFooterStatus('操作失败：' + e.message);
            cameraManager.updateStatus('操作失败');
        }
    });
}

// 停止扫描按钮
if (cameraDom.stopScanBtn) {
    cameraDom.stopScanBtn.addEventListener('click', () => {
        stopContinuousCapture();
        setFooterStatus('扫描已停止');
        cameraManager.updateStatus('扫描已停止');
    });
}

// 切换摄像头按钮
if (cameraDom.switchCameraBtn) {
    cameraDom.switchCameraBtn.addEventListener('click', async () => {
        const wasScanning = isContinuousScanning;
        if (wasScanning) stopContinuousCapture();

        cameraManager.updateStatus('切换摄像头...');
        const ok = await cameraManager.switchCamera();

        if (ok && wasScanning) {
            startContinuousCapture();
        }
    });
}

// ============================================================
// 自动初始化
// ============================================================
window.addEventListener('load', () => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // 检查 jsQR 是否加载成功
    if (typeof jsQR === 'undefined') {
        console.warn('jsQR 库未加载，请检查网络连接');
        setFooterStatus('二维码解析库加载失败，请刷新页面重试');
        cameraManager.updateStatus('库加载失败');
    }

    // 检查摄像头 API 是否可用
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('当前浏览器不支持摄像头 API');
        setFooterStatus('当前浏览器不支持摄像头，请使用最新版 Chrome 或 Edge');
        cameraManager.updateStatus('不支持摄像头');
        if (cameraDom.captureBtn) cameraDom.captureBtn.disabled = true;
    }

    if (isMobile) {
        // 手机端：显示相机界面，但不自动启动摄像头
        if (cameraDom.uploadSection) cameraDom.uploadSection.style.display = 'none';
        if (cameraDom.cameraSection) cameraDom.cameraSection.style.display = 'block';
        setFooterStatus('准备就绪，点击下方按钮开始扫描');
        cameraManager.updateStatus('准备就绪，点击按钮开始扫描');
    } else {
        // PC端：显示上传界面
        if (cameraDom.uploadSection) cameraDom.uploadSection.style.display = 'block';
        if (cameraDom.cameraSection) cameraDom.cameraSection.style.display = 'none';
        setFooterStatus('请选择包含二维码序列的文件夹');
    }
});
