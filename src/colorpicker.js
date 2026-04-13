import { state } from './state.js';

let cpCanvas, cpCtx;
let dragging = null; // 'hue' or 'sv'

export function setupColorPicker() {
  cpCanvas = document.getElementById('cp-hue-sat');
  if(!cpCanvas) return;
  cpCtx = cpCanvas.getContext('2d');
  
  cpCanvas.addEventListener('pointerdown', onPointerDown);
  cpCanvas.addEventListener('pointermove', onPointerMove);
  cpCanvas.addEventListener('pointerup', onPointerUp);
  cpCanvas.addEventListener('pointerout', onPointerUp);

  const alphaInput = document.getElementById('color-alpha');
  if(alphaInput) {
    alphaInput.addEventListener('input', (e) => {
      state.color.a = parseFloat(e.target.value) / 100;
      updateColorState();
    });
  }
  
  // Tab handling
  const cpTabs = document.querySelectorAll('.cp-tab-btn');
  cpTabs.forEach(btn => {
    btn.addEventListener('click', (e) => {
      cpTabs.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.cp-view').forEach(v => {
        v.style.display = 'none';
        v.classList.remove('active');
      });
      btn.classList.add('active');
      const targetId = `cp-view-${btn.dataset.cp}`;
      const target = document.getElementById(targetId);
      if(target) {
        target.style.display = btn.dataset.cp === 'wheel' ? 'block' : 'flex';
        target.classList.add('active');
      }
    });
  });

  const attachSlider = (id, callback) => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', e => callback(parseFloat(e.target.value)));
  };

  attachSlider('hsb-h', v => { state.color.h = v; updateColorState(); drawColorPicker(); });
  attachSlider('hsb-s', v => { state.color.s = v / 100; updateColorState(); drawColorPicker(); });
  attachSlider('hsb-b', v => { state.color.v = v / 100; updateColorState(); drawColorPicker(); });

  const updateFromRGB = () => {
    const r = parseFloat(document.getElementById('rgb-r').value);
    const g = parseFloat(document.getElementById('rgb-g').value);
    const b = parseFloat(document.getElementById('rgb-b').value);
    const [h, s, v] = rgbToHsv(r, g, b);
    state.color.h = h;
    state.color.s = s;
    state.color.v = v;
    updateColorState();
    drawColorPicker();
  };

  ['rgb-r', 'rgb-g', 'rgb-b'].forEach(id => attachSlider(id, updateFromRGB));

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const hex = e.target.dataset.hex;
      const [r, g, b] = hexToRgbVals(hex);
      const [h, s, v] = rgbToHsv(r, g, b);
      state.color.h = h;
      state.color.s = s;
      state.color.v = v;
      updateColorState();
      drawColorPicker();
    });
  });

  const hexInput = document.getElementById('color-hex');
  if(hexInput) {
    hexInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        const [r, g, b] = hexToRgbVals(val);
        const [h, s, v] = rgbToHsv(r, g, b);
        state.color.h = h;
        state.color.s = s;
        state.color.v = v;
        updateColorState();
        drawColorPicker();
      }
    });
  }

  drawColorPicker();
}

function hsvToRgb(h, s, v) {
  let f = (n,k=(n+h/60)%6) => v - v*s*Math.max(Math.min(k,4-k,1),0);
  return [f(5)*255, f(3)*255, f(1)*255];
}

function rgbToHex(r, g, b) {
  const toHex = (c) => Math.round(c).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

function hexToRgbVals(hexStr) {
  let h = hexStr.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c+c).join('');
  return [
    parseInt(h.slice(0,2), 16),
    parseInt(h.slice(2,4), 16),
    parseInt(h.slice(4,6), 16)
  ];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max === min) {
    h = 0; // achromatic
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s, v];
}

function drawColorPicker() {
  const w = cpCanvas.width;
  const h = cpCanvas.height;
  cpCtx.clearRect(0,0,w,h);
  
  const cx = w/2, cy = h/2;
  const R_OUTER = 95;
  const R_INNER = 75;

  // 1. Draw Hue Ring
  for(let angle=0; angle<360; angle+=1) {
    cpCtx.beginPath();
    cpCtx.strokeStyle = `hsl(${angle}, 100%, 50%)`;
    cpCtx.lineWidth = R_OUTER - R_INNER;
    cpCtx.arc(cx, cy, (R_OUTER+R_INNER)/2, angle*Math.PI/180, (angle+1.5)*Math.PI/180);
    cpCtx.stroke();
  }

  // 2. Compute Triangle Vertices
  const r = R_INNER - 2;
  const hRad = state.color.h * Math.PI / 180;
  const ax = cx + r * Math.cos(hRad); // Hue peak (C)
  const ay = cy + r * Math.sin(hRad);
  const bx = cx + r * Math.cos(hRad + 2*Math.PI/3); // White peak (W)
  const by = cy + r * Math.sin(hRad + 2*Math.PI/3);
  const cx_b = cx + r * Math.cos(hRad - 2*Math.PI/3); // Black peak (B)
  const cy_b = cy + r * Math.sin(hRad - 2*Math.PI/3);

  // 3. Draw Triangle Pixels via Barycentric Coords
  const tData = cpCtx.createImageData(w, h);
  const denom = (by - cy_b) * (ax - cx_b) + (cx_b - bx) * (ay - cy_b);
  
  // Optimization: Bound box of triangle
  const minX = Math.floor(Math.min(ax, Math.min(bx, cx_b)));
  const maxX = Math.ceil(Math.max(ax, Math.max(bx, cx_b)));
  const minY = Math.floor(Math.min(ay, Math.min(by, cy_b)));
  const maxY = Math.ceil(Math.max(ay, Math.max(by, cy_b)));

  for(let iy=minY; iy<=maxY; iy++) {
    for(let ix=minX; ix<=maxX; ix++) {
      let wC = ((by - cy_b) * (ix - cx_b) + (cx_b - bx) * (iy - cy_b)) / denom;
      let wW = ((cy_b - ay) * (ix - cx_b) + (ax - cx_b) * (iy - cy_b)) / denom;
      let wB = 1.0 - wC - wW;
      
      // Fudge factor for anti-aliasing edge feel
      if(wC >= -0.01 && wW >= -0.01 && wB >= -0.01) {
        wC = Math.max(0, wC); wW = Math.max(0, wW);
        let V = wC + wW;
        let S = V === 0 ? 0 : wC / V;
        let rgb = hsvToRgb(state.color.h, S, Math.min(1, V));
        let idx = (iy * w + ix) * 4;
        tData.data[idx] = rgb[0];
        tData.data[idx+1] = rgb[1];
        tData.data[idx+2] = rgb[2];
        tData.data[idx+3] = 255;
      }
    }
  }
  
  // Use temporary canvas to draw the imageData (since we don't want to wipe the hue ring)
  const tempCnv = document.createElement('canvas');
  tempCnv.width = w; tempCnv.height = h;
  tempCnv.getContext('2d').putImageData(tData, 0, 0);
  cpCtx.drawImage(tempCnv, 0, 0);

  // 4. Draw Selectors
  // Hue Selector
  const hx = cx + ((R_OUTER+R_INNER)/2) * Math.cos(hRad);
  const hy = cy + ((R_OUTER+R_INNER)/2) * Math.sin(hRad);
  cpCtx.beginPath();
  cpCtx.fillStyle = '#fff';
  cpCtx.strokeStyle = '#000';
  cpCtx.lineWidth = 2;
  cpCtx.arc(hx, hy, 8, 0, Math.PI*2);
  cpCtx.fill();
  cpCtx.stroke();

  // SV Selector
  let targetWc = state.color.s * state.color.v;
  let targetWw = state.color.v - targetWc;
  let targetWb = 1 - state.color.v;
  let svX = targetWc * ax + targetWw * bx + targetWb * cx_b;
  let svY = targetWc * ay + targetWw * by + targetWb * cy_b;
  
  cpCtx.beginPath();
  cpCtx.fillStyle = state.color.hex;
  cpCtx.strokeStyle = state.color.v < 0.5 ? '#fff' : '#000';
  cpCtx.lineWidth = 2;
  cpCtx.arc(svX, svY, 6, 0, Math.PI*2);
  cpCtx.fill();
  cpCtx.stroke();
}

function updateColorState() {
  const rgb = hsvToRgb(state.color.h, state.color.s, state.color.v);
  state.color.hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
  
  const hexInput = document.getElementById('color-hex');
  if (hexInput && document.activeElement !== hexInput) {
    hexInput.value = state.color.hex;
  }

  // Update HSB/RGB Sliders
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if(el && document.activeElement !== el) el.value = val;
  };

  setVal('hsb-h', Math.round(state.color.h));
  setVal('hsb-s', Math.round(state.color.s * 100));
  setVal('hsb-b', Math.round(state.color.v * 100));
  setVal('rgb-r', Math.round(rgb[0]));
  setVal('rgb-g', Math.round(rgb[1]));
  setVal('rgb-b', Math.round(rgb[2]));

  // Update Dynamic Gradients
  const applyBg = (id, grad) => {
    const el = document.getElementById(id);
    if(el) el.style.background = grad;
  };
  
  applyBg('hsb-h', 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)');
  
  const sC0 = rgbToHex(...hsvToRgb(state.color.h, 0, state.color.v));
  const sC1 = rgbToHex(...hsvToRgb(state.color.h, 1, state.color.v));
  applyBg('hsb-s', `linear-gradient(to right, ${sC0}, ${sC1})`);
  
  const bC0 = rgbToHex(...hsvToRgb(state.color.h, state.color.s, 0));
  const bC1 = rgbToHex(...hsvToRgb(state.color.h, state.color.s, 1));
  applyBg('hsb-b', `linear-gradient(to right, ${bC0}, ${bC1})`);

  const rV = Math.round(rgb[0]), gV = Math.round(rgb[1]), bV = Math.round(rgb[2]);
  applyBg('rgb-r', `linear-gradient(to right, rgb(0,${gV},${bV}), rgb(255,${gV},${bV}))`);
  applyBg('rgb-g', `linear-gradient(to right, rgb(${rV},0,${bV}), rgb(${rV},255,${bV}))`);
  applyBg('rgb-b', `linear-gradient(to right, rgb(${rV},${gV},0), rgb(${rV},${gV},255))`);
  
  // Update alpha slider background
  applyBg('color-alpha', `linear-gradient(to right, rgba(${rV},${gV},${bV}, 0), rgba(${rV},${gV},${bV}, 1))`);

  // Force active tool to brush if color changes
  if(state.toolType !== 'brush') {
    document.getElementById('tool-brush').click();
  }

  // Set global CSS variable for Vandalism UI
  const r = Math.round(rgb[0]);
  const g = Math.round(rgb[1]);
  const b = Math.round(rgb[2]);
  const colorStr = `rgba(${r}, ${g}, ${b}, ${state.color.a})`;
  document.documentElement.style.setProperty('--current-pen-color', colorStr);
}

function handlePointer(e) {
  const rect = cpCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (cpCanvas.width / rect.width);
  const y = (e.clientY - rect.top) * (cpCanvas.height / rect.height);
  const cx = cpCanvas.width/2, cy = cpCanvas.height/2;
  const dist = Math.hypot(x - cx, y - cy);

  if(!dragging) {
    if(dist >= 75 && dist <= 95) dragging = 'hue';
    else if(dist < 75) dragging = 'sv';
  }

  if(dragging === 'hue') {
    let angle = Math.atan2(y - cy, x - cx) * 180 / Math.PI;
    if(angle < 0) angle += 360;
    state.color.h = angle;
    updateColorState();
    drawColorPicker();
  } else if(dragging === 'sv') {
    // Inverse barycentric
    const r = 73;
    const hRad = state.color.h * Math.PI / 180;
    const ax = cx + r * Math.cos(hRad); 
    const ay = cy + r * Math.sin(hRad);
    const bx = cx + r * Math.cos(hRad + 2*Math.PI/3); 
    const by = cy + r * Math.sin(hRad + 2*Math.PI/3);
    const cx_b = cx + r * Math.cos(hRad - 2*Math.PI/3); 
    const cy_b = cy + r * Math.sin(hRad - 2*Math.PI/3);

    const denom = (by - cy_b) * (ax - cx_b) + (cx_b - bx) * (ay - cy_b);
    let wC = ((by - cy_b) * (x - cx_b) + (cx_b - bx) * (y - cy_b)) / denom;
    let wW = ((cy_b - ay) * (x - cx_b) + (ax - cx_b) * (y - cy_b)) / denom;
    
    // clamp to triangle
    wC = Math.max(0, Math.min(1, wC));
    wW = Math.max(0, Math.min(1, wW));
    if(wC + wW > 1) {
      const sum = wC + wW;
      wC /= sum; wW /= sum;
    }

    let V = wC + wW;
    let S = V === 0 ? 0 : wC / V;
    state.color.s = S;
    state.color.v = V;
    updateColorState();
    drawColorPicker();
  }
}

function onPointerDown(e) {
  cpCanvas.setPointerCapture(e.pointerId);
  handlePointer(e);
}

function onPointerMove(e) {
  if(dragging) handlePointer(e);
}

function onPointerUp(e) {
  dragging = null;
  cpCanvas.releasePointerCapture(e.pointerId);
}
