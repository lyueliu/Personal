/**
 * 离线文件传输工具 - 二维码解析端（最终稳版）
 * ✅ 手机：自动相机初始化
 * ✅ PC：默认上传文件夹
 * ✅ 相机按钮永远可预期
 */

// ============================================================
// 常量
// ============================================================
const DATA_BLOCKS_PER_FRAME = 1;
const MAX_DATA_PER_BLOCK = 200;

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
// DOM（上传相关，相机DOM 放后）
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
// 上传事件（仅桌面用到）
// ============================================================
if (dom.selectFolderBtn) {
    dom.selectFolderBtn.addEventListener('click', () => dom.folderInput?.click());
}
if (dom.uploadZone) {
    dom.uploadZone.addEventListener('click', e => {
        if (e.target !== dom.selectFolderBtn) dom.folderInput?.click();
    });
    dom.uploadZone.addEventListener('dragover', e => {
        e.preventDefault(); dom.uploadZone.classList.add('drag-over');
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
// 上传核心（保持你原逻辑，略作收敛）
// ============================================================
function handleFolderSelect(e) {
    if (e.target.files?.length) processFiles(Array.from(e.target.files));
}
function processFilesFromDrop(files) {
    if (files.length) processFiles(Array.from(files));
}

function processFiles(files) {
    resetState();
    state.files = files;

    const folderName = (files[0].webkitRelativePath || files[0].name).split('/')[0];
    dom.folderName.textContent = folderName;

    const pngFiles = files.filter(f =>
        /\.(png|jpe?g)$/i.test(f.name)
    ).sort((a,b)=>extractNumber(a.name)-extractNumber(b.name));

    state.pngFiles = pngFiles;
    dom.imageCount.textContent = pngFiles.length;

    const info = files.find(f => f.name.toLowerCase() === 'info.json');
    if (info) readInfoJson(info);
    else {
        dom.hasInfoJson.textContent = '否（从图片解析）';
        dom.folderInfo.style.display = 'block';
        startDecoding();
    }
}

function extractNumber(name) {
    const m = name.match(/(\d+)/);
    return m ? parseInt(m[1],10) : 0;
}

function readInfoJson(file) {
    dom.hasInfoJson.textContent = '是';
    const r = new FileReader();
    r.onload = e => {
        try {
            state.infoJson = JSON.parse(e.target.result);
            state.decodedFileName = state.infoJson.fileName;
            state.totalFrames = state.infoJson.totalFrames;
        } catch {}
        startDecoding();
    };
    r.readAsText(file);
}

//（⬇️ 你原有的 decodeFrame / decodeImage / finalizeDecoding / 重试 / 下载
//      全部 **保持原样**，太长不重复贴，下面只收口 UI 辅助）

function resetState() {
    state.pngFiles = [];
    state.frameStatusMap = {};
    state.errors = [];
    dom.progressSection.style.display = 'none';
    dom.resultSection.style.display = 'none';
    dom.downloadSection.style.display = 'none';
}

function updateProgress(p) {
    const v = Math.min(100,Math.max(0,p));
    dom.progressFill.style.width = v+'%';
    dom.progressText.textContent = Math.round(v)+'%';
}
function setFooterStatus(t){ dom.footerStatus.textContent = t; }

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
    cameraStatusText: document.getElementById('cameraStatusText')
};

// ============================================================
// CameraManager（你原版，仅微稳）
// ============================================================
class CameraManager {
    constructor() {
        this.stream = null;
        this.videoTrack = null;
        this.isActive = false;
        this.currentFacingMode = 'environment';
        this.processingFrame = 330;
    }
    async start() {
        try {
            this.updateStatus('请求相机权限...');
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: this.currentFacingMode }
            });
            this.videoTrack = this.stream.getVideoTracks()[0];
            cameraDom.cameraPreview.srcObject = this.stream;
            await cameraDom.cameraPreview.play();
            this.isActive = true;
            this.updateStatus('✅ 相机就绪，点击开始扫描');
            return true;
        } catch (e) {
            this.updateStatus('❌ 相机启动失败：'+e.message);
            return false;
        }
    }
    stop() {
        this.stream?.getTracks().forEach(t=>t.stop());
        this.isActive = false;
    }
    updateStatus(t) {
        if (cameraDom.cameraStatusText) cameraDom.cameraStatusText.textContent = t;
    }
}
const cameraManager = new CameraManager();

// ============================================================
// 模式 & 扫描
// ============================================================
let currentMode = 'camera';
let isContinuousScanning = false;

if (cameraDom.cameraModeBtn) {
    cameraDom.cameraModeBtn.addEventListener('click', () => switchToCamera());
}
if (cameraDom.uploadModeBtn) {
    cameraDom.uploadModeBtn.addEventListener('click', () => switchToUpload());
}

async function switchToCamera() {
    cameraDom.uploadSection.style.display = 'none';
    cameraDom.cameraSection.style.display = 'block';
    currentMode = 'camera';
    await cameraManager.start();
}

function switchToUpload() {
    cameraManager.stop();
    cameraDom.cameraSection.style.display = 'none';
    cameraDom.uploadSection.style.display = 'block';
    currentMode = 'upload';
}

// ---- 连续扫描（你原逻辑，收敛入口） ----
if (cameraDom.captureBtn) {
    cameraDom.captureBtn.addEventListener('click', async () => {
        if (isContinuousScanning) return;
        if (!cameraManager.isActive) {
            const ok = await cameraManager.start();
            if (!ok) return;
        }
        startContinuousCapture();
    });
}

//（✅ 你原 startContinuousCapture / processScanFrame / updateCameraResults
//     完全保留，不用改，我只保证它们被“可靠唤起”）

// ============================================================
// 自动初始化（稳）
// ============================================================
window.addEventListener('load', () => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
        // 手机：强制相机
        cameraDom.uploadSection.style.display = 'none';
        cameraDom.cameraSection.style.display = 'block';
        cameraManager.start();
    } else {
        // PC：上传为主
        cameraDom.uploadSection.style.display = 'block';
        cameraDom.cameraSection.style.display = 'none';
        setFooterStatus('请选择包含二维码序列的文件夹');
    }
});

// 初始兜底
setFooterStatus('准备就绪');
