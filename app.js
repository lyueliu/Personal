// ============== QR 文件传输 - PWA 客户端 ==============

const GRID = 3;           // 3x3 九宫格
const PACKETS_PER_FRAME = 8;
const SCAN_INTERVAL = 120; // 扫描间隔 ms

// ============== DOM 引用 ==============
const video = document.getElementById('camera');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const gridOverlay = document.getElementById('grid-overlay');
const statusText = document.getElementById('status-text');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const frameInfo = document.getElementById('frame-info');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnDownload = document.getElementById('btn-download');
const btnReset = document.getElementById('btn-reset');

// ============== 状态 ==============
let stream = null;
let scanning = false;
let scanTimer = null;

// 九宫格 cells
const gridCells = Array.from(gridOverlay.querySelectorAll('.grid-cell'));
const CELL_MAP = [0,1,2, 3,4,5, 6,7,8]; // 行优先

// 数据包存储
const packetMap = new Map();       // blockIndex -> Uint8Array
let totalFrames = 0;
let currentFrame = 0;
let completedFrames = new Set();
let fileName = '';

// ============== 摄像头初始化 ==============
async function startCamera() {
  statusText.textContent = '正在请求摄像头权限...';
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });
    video.srcObject = stream;
    await video.play();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    statusText.textContent = '摄像头已就绪，点击开始扫描';
    btnStart.disabled = false;
    btnStop.disabled = false;
  } catch (err) {
    statusText.textContent = '摄像头权限被拒绝: ' + err.message;
    btnStart.disabled = true;
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  video.srcObject = null;
}

// ============== 扫描逻辑 ==============
function startScanning() {
  if (scanning) return;
  scanning = true;
  statusText.textContent = '扫描中...';
  btnStart.disabled = true;
  scanTimer = setInterval(scanFrame, SCAN_INTERVAL);
}

function stopScanning() {
  scanning = false;
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
  btnStart.disabled = false;
  statusText.textContent = '扫描已停止';
  resetGridHighlight();
}

function scanFrame() {
  if (video.readyState < 2) return;

  // 绘制当前帧到 canvas
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const w = canvas.width;
  const h = canvas.height;

  // 计算九宫格扫描区域（正方形，居中）
  const gridSize = Math.min(w, h) * 0.9;
  const offsetX = (w - gridSize) / 2;
  const offsetY = (h - gridSize) / 2;
  const cellSize = gridSize / GRID;

  resetGridHighlight();

  // 并行解码 9 个格子
  const results = new Array(9).fill(null);
  let decodedCount = 0;

  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const sx = offsetX + col * cellSize;
    const sy = offsetY + row * cellSize;

    const imageData = ctx.getImageData(sx, sy, cellSize, cellSize);
    const code = jsQR(imageData.data, cellSize, cellSize, {
      inversionAttempts: 'dontInvert'
    });

    if (code) {
      results[i] = code.data;
      decodedCount++;
      // 高亮格子
      if (i === 4) {
        gridCells[i].classList.add('synced');
      } else {
        gridCells[i].classList.add('decoded');
      }
    }
  }

  if (results[4] === null) {
    // 中心同步码未解码，跳过
    if (decodedCount === 0) {
      statusText.textContent = '扫描中...';
    }
    return;
  }

  // 解析同步码: F:{frameIndex}|T:{totalFrames}
  const sync = parseSyncCode(results[4]);
  if (sync === null) return;

  const { frameIndex: fIdx, totalFrames: tFrames } = sync;

  // 去重
  if (completedFrames.has(fIdx)) return;

  if (totalFrames === 0) {
    totalFrames = tFrames;
    frameInfo.textContent = `帧: ${fIdx + 1} / ${totalFrames}`;
  }

  // 解析数据码
  let newPackets = 0;
  for (let i = 0; i < 9; i++) {
    if (i === 4 || results[i] === null) continue;
    // slot 0,1,2,3,5,6,7,8 → dataIndex 0,1,2,3,4,5,6,7
    const dataIndex = i < 4 ? i : i - 1;
    const globalIndex = fIdx * PACKETS_PER_FRAME + dataIndex;

    if (packetMap.has(globalIndex)) continue;

    const packet = parseDataCode(results[i], globalIndex);
    if (packet) {
      packetMap.set(globalIndex, packet);
      newPackets++;
    }
  }

  completedFrames.add(fIdx);
  currentFrame = fIdx + 1;

  // 更新进度
  const expected = totalFrames * PACKETS_PER_FRAME;
  const received = packetMap.size;
  const pct = expected > 0 ? Math.min(100, Math.round((received / expected) * 100)) : 0;
  progressFill.style.width = pct + '%';
  progressText.textContent = pct + '%';
  frameInfo.textContent = `帧: ${currentFrame} / ${totalFrames}`;
  statusText.textContent = `帧 ${fIdx + 1}/${totalFrames} | 包 ${received}/${expected}`;

  // 检查是否全部完成
  if (received >= expected && expected > 0) {
    completeScan();
  }
}

function parseSyncCode(text) {
  const m = text.match(/^F:(\d+)\|T:(\d+)$/);
  if (!m) return null;
  return { frameIndex: parseInt(m[1]), totalFrames: parseInt(m[2]) };
}

function parseDataCode(text, globalIndex) {
  try {
    const raw = atob(text); // Base64 解码
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i) & 0xFF;
    }
    if (bytes.length < 2) return null;
    const blockIndex = bytes[0];
    const dataLength = bytes[1];
    return bytes.slice(2, 2 + dataLength);
  } catch (e) {
    return null;
  }
}

function resetGridHighlight() {
  gridCells.forEach(c => {
    c.classList.remove('decoded', 'synced');
  });
}

// ============== 完成 & 下载 ==============
function completeScan() {
  stopScanning();
  statusText.textContent = '扫描完成！';
  btnDownload.disabled = false;
}

function downloadFile() {
  if (packetMap.size === 0) return;

  const maxIndex = Math.max(...packetMap.keys());
  const chunks = [];
  for (let i = 0; i <= maxIndex; i++) {
    const data = packetMap.get(i);
    if (data) chunks.push(data);
  }
  const blob = new Blob(chunks);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'received_file';
  a.click();
  URL.revokeObjectURL(url);
  statusText.textContent = '文件已下载';
}

function reset() {
  stopScanning();
  stopCamera();
  packetMap.clear();
  completedFrames.clear();
  totalFrames = 0;
  currentFrame = 0;
  fileName = '';
  progressFill.style.width = '0%';
  progressText.textContent = '0%';
  frameInfo.textContent = '帧: 0 / 0';
  statusText.textContent = '点击下方按钮开始扫描';
  btnStart.disabled = false;
  btnDownload.disabled = true;
  resetGridHighlight();
  startCamera();
}

// ============== 事件绑定 ==============
btnStart.addEventListener('click', async () => {
  // 如果摄像头还没启动，先启动
  if (!stream) {
    btnStart.disabled = true;
    btnStart.textContent = '正在打开摄像头...';
    await startCamera();
    btnStart.textContent = '开始扫描';
  }
  startScanning();
});
btnStop.addEventListener('click', stopScanning);
btnDownload.addEventListener('click', downloadFile);
btnReset.addEventListener('click', reset);

// ============== Service Worker ==============
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ============== 启动 ==============
// 摄像头由用户点击按钮触发，不自动启动
