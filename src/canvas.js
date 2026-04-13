import { state } from './state.js';
import { saveRecord } from './db.js';

let bgCanvas, fgCanvas, activeStrokeCanvas, bgCtx, fgCtx, activeStrokeCtx;
let isDrawing = false;
let undoStack = []; // stores ImageData
let redoStack = []; // stores ImageData for redo
let strokeLastX = 0, strokeLastY = 0;

export function setupCanvas() {
  bgCanvas = document.getElementById('bg-canvas');
  fgCanvas = document.getElementById('fg-canvas');
  bgCtx = bgCanvas.getContext('2d', { alpha: false }); // Optimization
  fgCtx = fgCanvas.getContext('2d', { willReadFrequently: true }); // better for getImageData

  // Setup active stroke canvas for smooth opacity rendering
  activeStrokeCanvas = document.createElement('canvas');
  activeStrokeCanvas.width = fgCanvas.width;
  activeStrokeCanvas.height = fgCanvas.height;
  activeStrokeCanvas.style.position = 'absolute';
  activeStrokeCanvas.style.top = '0';
  activeStrokeCanvas.style.left = '0';
  activeStrokeCanvas.style.zIndex = '5';
  activeStrokeCanvas.style.touchAction = 'none';
  activeStrokeCanvas.style.pointerEvents = 'none';
  document.querySelector('.canvas-container').appendChild(activeStrokeCanvas);
  activeStrokeCtx = activeStrokeCanvas.getContext('2d');

  // Fill background with white
  bgCtx.fillStyle = '#FFFFFF';
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  
  // Save initial blank state
  saveState();

  // Setup pointer events
  fgCanvas.addEventListener('pointerdown', startDrawing);
  fgCanvas.addEventListener('pointermove', draw);
  fgCanvas.addEventListener('pointerup', stopDrawing);
  fgCanvas.addEventListener('pointercancel', stopDrawing);

  document.getElementById('tool-brush').addEventListener('click', () => setTool('brush'));
  document.getElementById('tool-eraser').addEventListener('click', () => setTool('eraser'));
  
  const sizeInput = document.getElementById('brush-size');
  sizeInput.addEventListener('input', (e) => {
    state.brushSize = parseInt(e.target.value, 10);
    document.getElementById('size-val').textContent = state.brushSize;
  });

  document.getElementById('btn-undo').addEventListener('click', undo);
  const btnRedo = document.getElementById('btn-redo');
  if(btnRedo) btnRedo.addEventListener('click', redo);
  document.getElementById('btn-clear').addEventListener('click', clearCanvas);
  document.getElementById('btn-save').addEventListener('click', saveToday);
  const btnDownload = document.getElementById('btn-download');
  if(btnDownload) btnDownload.addEventListener('click', downloadCanvas);

  const sizeSelect = document.getElementById('canvas-size');
  if (sizeSelect) {
    sizeSelect.addEventListener('change', (e) => {
      const [w, h] = e.target.value.split('x').map(Number);
      if(confirm('サイズを変更すると現在の内容はリセットされます。よろしいですか？')) {
        resizeCanvas(w, h);
      } else {
        // 変更を元に戻す
        e.target.value = `${fgCanvas.width}x${fgCanvas.height}`;
      }
    });
  }

  // Short-cuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
      } else if (e.key === 'y' || e.key === 'Y') {
        redo();
        e.preventDefault();
      }
    }
  });
}

function setTool(tool) {
  state.toolType = tool;
  document.querySelectorAll('.tool-group .brutal-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tool-' + tool).classList.add('active');
}

function saveState() {
  if (undoStack.length >= 11) {
    undoStack.shift(); // Keep max 10 strokes + 1 initial blank
  }
  undoStack.push(fgCtx.getImageData(0, 0, fgCanvas.width, fgCanvas.height));
  redoStack = []; // clear redo stack on new action
}

function startDrawing(e) {
  isDrawing = true;
  fgCanvas.setPointerCapture(e.pointerId);
  
  if (state.toolType !== 'eraser') {
    activeStrokeCanvas.style.opacity = state.color.a;
  }
  
  const rect = fgCanvas.getBoundingClientRect();
  strokeLastX = (e.clientX - rect.left) * (fgCanvas.width / rect.width);
  strokeLastY = (e.clientY - rect.top) * (fgCanvas.height / rect.height);
  
  draw(e);
}

function draw(e) {
  if (!isDrawing) return;
  
  const rect = fgCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (fgCanvas.width / rect.width);
  const y = (e.clientY - rect.top) * (fgCanvas.height / rect.height);
  
  // Pressure logic (fallback to 0.5 if mouse/unsupported)
  let pressure = (e.pressure !== undefined && e.pointerType !== 'mouse' && e.pressure > 0) ? e.pressure : 0.5;
  const currentLineWidth = Math.max(1, state.brushSize * (0.5 + pressure));
  
  if (state.toolType === 'eraser') {
    fgCtx.globalCompositeOperation = 'destination-out';
    fgCtx.lineWidth = currentLineWidth;
    fgCtx.lineCap = 'round';
    fgCtx.lineJoin = 'round';
    fgCtx.beginPath();
    fgCtx.moveTo(strokeLastX, strokeLastY);
    fgCtx.lineTo(x, y);
    fgCtx.stroke();
  } else {
    // Parse hex
    let hex = state.color.hex;
    if(hex.length === 4) { // shorthand support #rgb
       hex = '#'+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];
    }
    const r = parseInt(hex.slice(1,3), 16) || 0;
    const g = parseInt(hex.slice(3,5), 16) || 0;
    const b = parseInt(hex.slice(5,7), 16) || 0;
    
    // Draw solid stroke on activeStrokeCanvas
    activeStrokeCtx.globalCompositeOperation = 'source-over';
    activeStrokeCtx.lineWidth = currentLineWidth;
    activeStrokeCtx.lineCap = 'round';
    activeStrokeCtx.lineJoin = 'round';
    activeStrokeCtx.strokeStyle = `rgba(${r},${g},${b},1)`; // Solid color
    
    activeStrokeCtx.beginPath();
    activeStrokeCtx.moveTo(strokeLastX, strokeLastY);
    activeStrokeCtx.lineTo(x, y);
    activeStrokeCtx.stroke();
  }
  
  strokeLastX = x;
  strokeLastY = y;
}

function stopDrawing(e) {
  if (!isDrawing) return;
  isDrawing = false;
  fgCanvas.releasePointerCapture(e.pointerId);
  
  if (state.toolType !== 'eraser') {
    // Bake active stroke back into the main fgCanvas with the correct opacity
    fgCtx.globalCompositeOperation = 'source-over';
    fgCtx.globalAlpha = state.color.a;
    fgCtx.drawImage(activeStrokeCanvas, 0, 0);
    fgCtx.globalAlpha = 1.0;
    // Clear the scratch canvas
    activeStrokeCtx.clearRect(0, 0, activeStrokeCanvas.width, activeStrokeCanvas.height);
  } else {
    fgCtx.beginPath(); // Finalize clear path
  }
  
  saveState();
}

function undo() {
  if (undoStack.length > 1) {
    const popped = undoStack.pop(); // remove current state
    redoStack.push(popped);
    const previousState = undoStack[undoStack.length - 1];
    fgCtx.putImageData(previousState, 0, 0);
  }
}

function redo() {
  if (redoStack.length > 0) {
    const stateToRestore = redoStack.pop();
    undoStack.push(stateToRestore);
    fgCtx.putImageData(stateToRestore, 0, 0);
  }
}

function clearCanvas() {
  if(confirm("キャンバスを全て消去しますか？")) {
    fgCtx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);
    saveState();
  }
}

function resizeCanvas(w, h) {
  bgCanvas.width = w;
  bgCanvas.height = h;
  fgCanvas.width = w;
  fgCanvas.height = h;
  if(activeStrokeCanvas) {
    activeStrokeCanvas.width = w;
    activeStrokeCanvas.height = h;
  }
  
  bgCanvas.style.width = w + 'px';
  bgCanvas.style.height = h + 'px';
  fgCanvas.style.width = w + 'px';
  fgCanvas.style.height = h + 'px';
  if(activeStrokeCanvas) {
    activeStrokeCanvas.style.width = w + 'px';
    activeStrokeCanvas.style.height = h + 'px';
  }

  document.querySelector('.canvas-container').style.width = w + 'px';
  document.querySelector('.canvas-container').style.height = h + 'px';
  
  bgCtx.fillStyle = '#FFFFFF';
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  
  undoStack = [];
  redoStack = [];
  saveState();
}

function saveToday() {
  // Composite bg and fg into a temporary canvas
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = fgCanvas.width;
  tempCanvas.height = fgCanvas.height;
  const tCtx = tempCanvas.getContext('2d');
  
  tCtx.drawImage(bgCanvas, 0, 0);
  tCtx.drawImage(fgCanvas, 0, 0);
  
  tempCanvas.toBlob(async (blob) => {
    if (!blob) {
      alert("画像の保存に失敗しました（メモリ不足等）");
      return;
    }
    
    // Local date string YYYY-MM-DD
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, -1);
    const dateStr = localISOTime.split('T')[0];
    
    const record = {
      date: dateStr,
      theme: state.theme,
      imageBlob: blob,
      savedAt: new Date().toISOString()
    };
    
    try {
      await saveRecord(record);
      alert("今日の練習をギャラリーに保存しました！");
    } catch(e) {
      console.error(e);
      alert("保存エラー: " + e.message);
    }
  }, 'image/png');
}

function downloadCanvas() {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = fgCanvas.width;
  tempCanvas.height = fgCanvas.height;
  const tCtx = tempCanvas.getContext('2d');
  
  tCtx.drawImage(bgCanvas, 0, 0);
  tCtx.drawImage(fgCanvas, 0, 0);
  
  tempCanvas.toBlob((blob) => {
    if (!blob) {
      alert("ダウンロードに失敗しました");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, -1);
    const dateStr = localISOTime.split('T')[0];
    
    a.download = `oekaki_${dateStr}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
