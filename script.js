const canvas = document.getElementById("fieldCanvas");
const ctx = canvas.getContext("2d");
function resizeCanvas() {
  canvas.width = window.innerWidth - 200;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();
let charges = [];
let tooltipLocked = false;
let showField = true;
let showEquip = true;
let showPotentialMap = false;
let equipDensity = 4;
let fieldDensity = 4;
let pixelsPerMeter = 100;
const defaultChargeMagnitudeC = 1e-6;
let nextChargeId = 1;
document.querySelectorAll(".particle").forEach((item) => {
  item.addEventListener("dragstart", (e) => {
    const isProton = item.classList.contains("proton");
    e.dataTransfer.setData("chargeType", isProton ? "proton" : "electron");
    const dragIcon = document.createElement("canvas");
    dragIcon.width = 40;
    dragIcon.height = 40;
    const ctx = dragIcon.getContext("2d");
    ctx.beginPath();
    ctx.arc(20, 20, 14, 0, Math.PI * 2);
    ctx.fillStyle = isProton ? "#ff4444" : "#4488ff";
    ctx.fill();
    ctx.closePath();
    ctx.fillStyle = "white";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isProton ? "+" : "−", 20, 21);
    dragIcon.style.position = "absolute";
    dragIcon.style.top = "-100px";
    dragIcon.style.left = "-100px";
    document.body.appendChild(dragIcon);
    e.dataTransfer.setDragImage(dragIcon, 20, 20);
    setTimeout(() => document.body.removeChild(dragIcon), 0);
  });
});
canvas.addEventListener("dragover", (e) => e.preventDefault());
canvas.addEventListener("drop", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const dropX = e.clientX - rect.left;
  const dropY = e.clientY - rect.top;
  const type = e.dataTransfer.getData("chargeType");
  const chargeSign = type === "proton" ? +1 : -1;
  const id = nextChargeId++;
  const label = `q${id}`;
  charges.push({
    id,
    label,
    x: dropX,
    y: dropY,
    q: chargeSign,
    magnitudeC: defaultChargeMagnitudeC,
  });
  updateHudCharges();
  drawScene();
});
function drawScene() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (showPotentialMap && charges.length > 0) {
    drawPotentialMap();
  }
  if (showEquip && charges.length > 0) {
    drawEquipotentials();
  }
  if (showField && charges.length > 0) {
    drawFieldLines();
  }
  for (const c of charges) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = c.q > 0 ? "#ff4444" : "#4488ff";
    ctx.fill();
    ctx.closePath();
    ctx.fillStyle = "white";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(c.label, c.x, c.y);
  }
}
function formatChargeValue(coulombs) {
  const sign = coulombs >= 0 ? "+" : "−";
  const a = Math.abs(coulombs);
  let val, unit;
  if (a >= 1)          { val = a;        unit = "C";  }
  else if (a >= 1e-3)  { val = a / 1e-3; unit = "mC"; }
  else if (a >= 1e-6)  { val = a / 1e-6; unit = "μC"; }
  else if (a >= 1e-9)  { val = a / 1e-9; unit = "nC"; }
  else                 { val = a;        unit = "C";  }
  const text = val >= 100 ? val.toFixed(0)
             : val >= 10  ? val.toFixed(1)
             : val >= 1   ? val.toFixed(2)
             : val.toPrecision(2);
  return `${sign}${text} ${unit}`;
}
function updateHudCharges() {
  const box = document.getElementById("hudCharges");
  if (!box) return;
  if (charges.length === 0) {
    box.innerHTML = "";
    return;
  }
  const rows = charges
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((c) => {
      const valueC = c.q * (c.magnitudeC ?? defaultChargeMagnitudeC);
      return `<div class="row">Charge of ${c.label}: ${formatChargeValue(valueC)}</div>`;
    })
    .join("");
  box.innerHTML = rows;
}
document.getElementById("clearBtn").addEventListener("click", () => {
  charges = [];
  updateHudCharges();
  drawScene();
});
const screenshotBtn = document.getElementById("screenshotBtn");
screenshotBtn.addEventListener("click", () => {
  const hud = document.getElementById("hud");
  if (hud) hud.style.display = "none";
  setTimeout(() => {
    const link = document.createElement("a");
    link.download = "field_visualization.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    if (hud) hud.style.display = "block";
  }, 100);
});
let draggingCharge = null;
let isDragging = false;
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  for (const c of charges) {
    const dx = x - c.x;
    const dy = y - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 15) {
      draggingCharge = c;
      isDragging = true;
      break;
    }
  }
});
canvas.addEventListener("mousemove", (e) => {
  if (!isDragging || !draggingCharge) return;
  const rect = canvas.getBoundingClientRect();
  draggingCharge.x = e.clientX - rect.left;
  draggingCharge.y = e.clientY - rect.top;
  drawScene();
});
canvas.addEventListener("mouseup", () => {
  isDragging = false;
  draggingCharge = null;
});
canvas.addEventListener("dblclick", (e) => {
  if (isDragging) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  for (let i = charges.length - 1; i >= 0; i--) {
    const c = charges[i];
    const dx = x - c.x;
    const dy = y - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 15) {
      openChargeModal(c);
      break;
    }
  }
});
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  for (let i = 0; i < charges.length; i++) {
    const c = charges[i];
    const dx = x - c.x;
    const dy = y - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 15) {
      charges.splice(i, 1);
      updateHudCharges();
      drawScene();
      break;
    }
  }
});
function computeElectricField(x, y) {
  let Ex = 0, Ey = 0;
  const k = 8.99e9;
  for (const c of charges) {
    const dx_px = x - c.x;
    const dy_px = y - c.y;
    const dx = dx_px / pixelsPerMeter;
    const dy = dy_px / pixelsPerMeter;
    const r2 = dx*dx + dy*dy;
    if (r2 === 0) continue;
    const r  = Math.sqrt(r2);
    const qC = c.q * (c.magnitudeC ?? defaultChargeMagnitudeC);
    const E_mag = (k * qC) / r2;
    Ex += E_mag * (dx / r);
    Ey += E_mag * (dy / r);
  }
  return { Ex, Ey };
}
function computePotential(x, y) {
  const k = 8.99e9;
  let V = 0;
  for (const c of charges) {
    const dx_px = x - c.x;
    const dy_px = y - c.y;
    const dx = dx_px / pixelsPerMeter;
    const dy = dy_px / pixelsPerMeter;
    const r = Math.hypot(dx, dy);
    if (r === 0) continue;
    const qC = c.q * (c.magnitudeC ?? defaultChargeMagnitudeC);
    V += (k * qC) / r;
  }
  return V;
}
function traceFieldLine(x, y, step = 8, maxSteps = 2000) {
  const points = [];
  let px = x;
  let py = y;
  for (let i = 0; i < maxSteps; i++) {
    const { Ex, Ey } = computeElectricField(px, py);
    const E = Math.sqrt(Ex * Ex + Ey * Ey);
    if (E < 0.0001) break;
    const nx = Ex / E;
    const ny = Ey / E;
    px += nx * step;
    py += ny * step;
    if (px < 0 || py < 0 || px > canvas.width || py > canvas.height) break;
    points.push({ x: px, y: py });
  }
  return points;
}
function drawFieldLines() {
  if (charges.length === 0) return;
  const numSeeds = Math.max(6, Math.round(6 + fieldDensity * 2.5));
  const lineColor = "rgba(255, 180, 80, 0.7)";
  for (const c of charges) {
    for (let i = 0; i < numSeeds; i++) {
      const angle = (i / numSeeds) * 2 * Math.PI;
      const startX = c.x + 20 * Math.cos(angle);
      const startY = c.y + 20 * Math.sin(angle);
      const forward = traceFieldLine(startX, startY, 8);
      const backward = traceFieldLine(startX, startY, -8);
      const linePoints = backward.reverse().concat(forward);
      ctx.beginPath();
      if (linePoints.length > 0) ctx.moveTo(linePoints[0].x, linePoints[0].y);
      for (const p of linePoints) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.stroke();
      drawArrowsAlongLine(linePoints, 100);
    }
  }
}
function drawArrowsAlongLine(points, spacing = 100) {
  if (points.length < 2) return;
  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const segLength = Math.sqrt(dx * dx + dy * dy);
    distance += segLength;
    if (distance > spacing) {
      distance = 0;
      const angle = Math.atan2(dy, dx);
      const size = 6;
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i].x - size * Math.cos(angle - Math.PI / 6), points[i].y - size * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i].x - size * Math.cos(angle + Math.PI / 6), points[i].y - size * Math.sin(angle + Math.PI / 6));
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}
function traceEquipotential(x, y, step = 10, maxSteps = 1200) {
  const forward  = _traceIso(x, y, +step, maxSteps);
  const backward = _traceIso(x, y, -step, maxSteps);
  return backward.reverse().concat(forward);
}
function _traceIso(x, y, step, maxSteps) {
  const pts = [];
  let px = x, py = y;
  for (let i = 0; i < maxSteps; i++) {
    const { Ex, Ey } = computeElectricField(px, py);
    const mag = Math.hypot(Ex, Ey);
    if (mag < 1e-3) break;
    const nx = -Ey / mag;
    const ny =  +Ex / mag;
    px += nx * step;
    py += ny * step;
    if (px < 0 || py < 0 || px > canvas.width || py > canvas.height) break;
    if (_nearAnyCharge(px, py, 18)) break;
    pts.push({ x: px, y: py });
  }
  return pts;
}
function _nearAnyCharge(x, y, r = 18) {
  for (const c of charges) {
    const dx = x - c.x, dy = y - c.y;
    if (dx*dx + dy*dy < r*r) return true;
  }
  return false;
}
function drawEquipotentials() {
  if (charges.length === 0) return;
  const angularSkip   = Math.max(1, Math.round(11 - equipDensity)); 
  const seedsPerCharge = 24;
  const startRadius    = 40;
  const color          = "rgba(90, 190, 255, 0.45)";
  const lineW          = 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth   = lineW;
  let drawnCount = 0, maxCurves = 120;
  for (const c of charges) {
    for (let i = 0; i < seedsPerCharge; i++) {
      if (i % angularSkip !== 0) continue;
      const ang = (i / seedsPerCharge) * 2 * Math.PI;
      const sx = c.x + startRadius * Math.cos(ang);
      const sy = c.y + startRadius * Math.sin(ang);
      if (_nearAnyCharge(sx, sy, 20)) continue;
      const step = equipDensity <= 3 ? 12 : equipDensity <= 6 ? 10 : 8;
      const maxSteps = 1400;
      const pts = traceEquipotential(sx, sy, step, maxSteps);
      if (pts.length < 6) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
      ctx.stroke();
      drawnCount++;
      if (drawnCount >= maxCurves) return;
    }
  }
}
function drawPotentialMap() {
  const k = 8.99e9;
  const step = 6;
  const maxV = Math.max(1e3, 5e5 * charges.length / pixelsPerMeter);
  const alpha = 0.4;
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      let V = 0;
      for (const c of charges) {
        const dx = (x - c.x) / pixelsPerMeter;
        const dy = (y - c.y) / pixelsPerMeter;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r < 1e-6) continue;
        const qC = c.q * (c.magnitudeC ?? defaultchargeMagnitudeC);
        V += (k * qC) / r;
      }
      const color = voltageToColor(V, maxV, alpha);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, step, step);
    }
  }
ctx.strokeStyle = "rgba(0, 255, 100)";
ctx.lineWidth = 1.8;
for (let y = 0; y < canvas.height - step; y += step) {
  for (let x = 0; x < canvas.width - step; x += step) {
    const V00 = computePotential(x, y);
    const V10 = computePotential(x + step, y);
    const V01 = computePotential(x, y + step);
    const V11 = computePotential(x + step, y + step);
    const allPos = V00 > 0 && V10 > 0 && V01 > 0 && V11 > 0;
    const allNeg = V00 < 0 && V10 < 0 && V01 < 0 && V11 < 0;
    if (allPos || allNeg) continue;
    ctx.beginPath();
    if ((V00 > 0) !== (V10 > 0)) {
      const t = Math.abs(V00) / (Math.abs(V00) + Math.abs(V10));
      ctx.moveTo(x + t * step, y);
    }
    if ((V10 > 0) !== (V11 > 0)) {
      const t = Math.abs(V10) / (Math.abs(V10) + Math.abs(V11));
      ctx.lineTo(x + step, y + t * step);
    }
    if ((V11 > 0) !== (V01 > 0)) {
      const t = Math.abs(V11) / (Math.abs(V11) + Math.abs(V01));
      ctx.lineTo(x + (1 - t) * step, y + step);
    }
    if ((V01 > 0) !== (V00 > 0)) {
      const t = Math.abs(V01) / (Math.abs(V01) + Math.abs(V00));
      ctx.lineTo(x, y + (1 - t) * step);
    }
    ctx.stroke();
  }
}
}
function voltageToColor(V, maxV, alpha = 0.4) {
  const clamp = Math.max(-maxV, Math.min(maxV, V));
  const norm = clamp / maxV;
  const red   = norm > 0 ? 255 * norm : 0;
  const blue  = norm < 0 ? 255 * -norm : 0;
  const green = 60;
  return `rgba(${red.toFixed(0)},${green.toFixed(0)},${blue.toFixed(0)},${alpha})`;
}
const toggleFieldEl = document.getElementById("toggleField");
if (toggleFieldEl) {
  toggleFieldEl.checked = true;
  toggleFieldEl.addEventListener("change", (e) => {
    showField = e.target.checked;
    drawScene();
  });
}
const toggleEquipEl = document.getElementById("toggleEquip");
if (toggleEquipEl) {
  toggleEquipEl.checked = true;
  toggleEquipEl.addEventListener("change", (e) => {
    showEquip = e.target.checked;
    drawScene();
  });
}
const togglePotentialEl = document.getElementById("togglePotential");
if (togglePotentialEl) {
  togglePotentialEl.addEventListener("change", (e) => {
    showPotentialMap = e.target.checked;
    drawScene();
  });
}
const pxInput    = document.getElementById("pxPerMeterInput");
const scaleInfo  = document.getElementById("scaleInfo");
const scaleError = document.getElementById("scaleError");
function applyScaleValue(val) {
  pixelsPerMeter = val;
  if (scaleInfo) scaleInfo.textContent = `${val} pixels = 1 meter`;
  drawScene();
}
function validateAndApplyScale() {
  if (!pxInput) return;
  const raw = pxInput.value.trim();
  const val = Number(raw);
  const valid =
    Number.isFinite(val) &&
    Number.isInteger(val) &&
    val >= 1 && val <= 500;
  if (valid) {
    pxInput.classList.remove("invalid");
    if (scaleError) scaleError.style.display = "none";
    applyScaleValue(val);
  } else {
    pxInput.classList.add("invalid");
    if (scaleError) scaleError.style.display = "block";
  }
}
if (pxInput) {
  pxInput.value = String(pixelsPerMeter);
  if (scaleInfo) scaleInfo.textContent = `${pixelsPerMeter} pixels = 1 meter`;
  pxInput.addEventListener("input", validateAndApplyScale);
  pxInput.addEventListener("change", validateAndApplyScale);
  pxInput.addEventListener("blur", validateAndApplyScale);
}
const fieldSlider = document.getElementById("fieldDensity");
const fieldValue  = document.getElementById("fieldDensityVal");
if (fieldSlider && fieldValue) {
  fieldValue.textContent = String(fieldDensity);
  fieldSlider.value = String(fieldDensity);
  fieldSlider.addEventListener("input", (e) => {
    fieldDensity = Number(e.target.value);
    fieldValue.textContent = String(fieldDensity);
    drawScene();
  });
}
const densSlider = document.getElementById("equipDensity");
const densValue  = document.getElementById("equipDensityVal");
if (densSlider && densValue) {
  densValue.textContent = String(equipDensity);
  densSlider.value = String(equipDensity);
  densSlider.addEventListener("input", (e) => {
    equipDensity = Number(e.target.value);
    densValue.textContent = String(equipDensity);
    drawScene();
  });
}
const chargeModal = document.getElementById("chargeModal");
const closeBtn = document.getElementById("closeChargeModal");
const saveBtn = document.getElementById("saveChargeBtn");
const titleEl = document.getElementById("chargeTitle");
const mantissaEl = document.getElementById("mantissaInput");
const exponentEl = document.getElementById("exponentInput");
const chargeErrEl = document.getElementById("chargeError");
let editingCharge = null;
function openChargeModal(charge) {
  tooltipLocked = true;
  const tooltip = document.getElementById("chargeTooltip");
  if (tooltip) tooltip.classList.add("hidden");
  editingCharge = charge;
  const mag = charge.magnitudeC ?? defaultChargeMagnitudeC;
  const absMag = Math.abs(mag);
  let exponent = 0, mantissa = absMag;
  if (absMag > 0) {
    exponent = Math.floor(Math.log10(absMag));
    mantissa = absMag / Math.pow(10, exponent);
    if (mantissa >= 10) { mantissa /= 10; exponent += 1; }
  }
  titleEl.textContent = `Edit charge (${charge.label})`;
  mantissaEl.value = mantissa.toString();
  exponentEl.value = exponent.toString();
  chargeErrEl.style.display = "none";
  chargeModal.classList.remove("hidden");
  chargeModal.setAttribute("aria-hidden", "false");
  mantissaEl.focus();
}
function closeChargeModal() {
  chargeModal.classList.add("hidden");
  chargeModal.setAttribute("aria-hidden", "true");
  editingCharge = null;
  tooltipLocked = false;
}
if (closeBtn) {
  closeBtn.addEventListener("click", closeChargeModal);
}
if (chargeModal) {
  chargeModal.addEventListener("click", (e) => {
    if (e.target === chargeModal) closeChargeModal();
  });
}
function saveChargeFromModal() {
  if (!editingCharge) return;
  const mant = Number(mantissaEl.value);
  const exp  = Number(exponentEl.value);
  const validMant = Number.isFinite(mant) && mant > 0;
  const validExp  = Number.isFinite(exp) && Number.isInteger(exp) && exp >= -12 && exp <= 12;
  if (!validMant || !validExp) {
    chargeErrEl.style.display = "block";
    return;
  }
  editingCharge.magnitudeC = mant * Math.pow(10, exp);
  updateHudCharges();
  drawScene();
  closeChargeModal();
}
if (saveBtn) {
  saveBtn.addEventListener("click", saveChargeFromModal);
}
const tooltip = document.getElementById("chargeTooltip");
canvas.addEventListener("mousemove", (e) => {
  if (!tooltip) return;
  if (tooltipLocked) {
    tooltip.classList.add("hidden");
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  let found = null;
  for (const c of charges) {
    const dx = x - c.x;
    const dy = y - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 20) {
      found = c;
      break;
    }
  }
  if (found) {
    const qC = found.q * (found.magnitudeC ?? defaultChargeMagnitudeC);
    const formattedQ = formatChargeValue(qC);
    const x_m = (found.x / pixelsPerMeter).toFixed(2);
    const y_m = (found.y / pixelsPerMeter).toFixed(2);
    tooltip.innerHTML = `
      <b>${found.label}</b><br>
      Charge: ${formattedQ}<br>
      Position: (${x_m}, ${y_m}) m
    `;
    tooltip.style.left = `${e.clientX + 15}px`;
    tooltip.style.top = `${e.clientY + 15}px`;
    tooltip.classList.remove("hidden");
  } else {
    tooltip.classList.add("hidden");
  }
});
const hud     = document.getElementById("hud");
const hudDist = document.getElementById("hudDist");
const hudE    = document.getElementById("hudE");
const hudV    = document.getElementById("hudV");
canvas.addEventListener("mousemove", (e) => {
  if (!hud) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (charges.length === 1 && hudDist) {
    const c = charges[0];
    const dx_px = x - c.x;
    const dy_px = y - c.y;
    const d_px  = Math.hypot(dx_px, dy_px);
    const d_m   = d_px / pixelsPerMeter;
    const pxText = `${Math.round(d_px)} pixels`;
    const mText  = d_m >= 1
      ? `${d_m.toFixed(2)} m`
      : `${d_m.toExponential(2)} m`;
    hudDist.textContent = `Distance: ${pxText}, ${mText}`;
  } else if (hudDist) {
    hudDist.textContent = "";
  }
  if (charges.length === 0) {
    if (hudE) hudE.textContent = "E: —";
    if (hudV) hudV.textContent = "V: —";
    return;
  }
const V = computePotential(x, y);
let vTxt;
if (Math.abs(V) >= 1e6) {
  vTxt = `${(V / 1e6).toFixed(2)} ×10^6 V`;
} else if (Math.abs(V) >= 1e3) {
  vTxt = `${(V / 1e3).toFixed(2)} ×10^3 V`;
} else if (Math.abs(V) >= 1) {
  vTxt = `${V.toFixed(2)} V`;
} else {
  vTxt = `${V.toExponential(2)} V`;
}
if (hudV) hudV.textContent = `V: ${vTxt}`;
  const { Ex, Ey } = computeElectricField(x, y);
  const Emag = Math.hypot(Ex, Ey);
  let txt;
  if (Emag >= 1e6) {
    txt = `${(Emag / 1e6).toFixed(2)} ×10^6 N/C`;
  } else if (Emag >= 1e3) {
    txt = `${(Emag / 1e3).toFixed(2)} ×10^3 N/C`;
  } else if (Emag >= 1) {
    txt = `${Emag.toFixed(2)} N/C`;
  } else {
    txt = `${Emag.toExponential(2)} N/C`;
  }
  if (hudE) hudE.textContent = `E: ${txt}`;
});
canvas.addEventListener("mouseleave", () => {
  if (hudDist) hudDist.textContent = "";
  if (hudE)    hudE.textContent = "E: —";
  if (hudV)    hudV.textContent = "V: —";
});
drawScene();