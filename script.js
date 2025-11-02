// script.js

const canvas = document.getElementById("fieldCanvas");
const ctx = canvas.getContext("2d");

// Resize canvas to fill the screen dynamically
function resizeCanvas() {
  canvas.width = window.innerWidth - 200; // minus sidebar width
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Track charges
let charges = [];

let showField = true; // default ON

let showEquip = true; // default ON for equipotentials

let showPotentialMap = false; // default OFF for voltage heatmap

let equipDensity = 4; // 1 = very sparse, 10 = very dense

// 100 px = 1 m (default); must be let so we can change it
let pixelsPerMeter = 100;


// physical charge magnitude applied to each ±1 logical charge
const defaultChargeMagnitudeC = 1e-6; // default magnitude for newly dropped charges

let nextChargeId = 1;   // assigns q1, q2, q3...; never renumbers





// Handle drag start (with reliable drag preview)
document.querySelectorAll(".particle").forEach((item) => {
  item.addEventListener("dragstart", (e) => {
    const isProton = item.classList.contains("proton");
    e.dataTransfer.setData("chargeType", isProton ? "proton" : "electron");

    // Create a tiny canvas for the preview icon
    const dragIcon = document.createElement("canvas");
    dragIcon.width = 40;
    dragIcon.height = 40;
    const ctx = dragIcon.getContext("2d");

    // Draw particle circle
    ctx.beginPath();
    ctx.arc(20, 20, 14, 0, Math.PI * 2);
    ctx.fillStyle = isProton ? "#ff4444" : "#4488ff";
    ctx.fill();
    ctx.closePath();

    // Draw + / − symbol
    ctx.fillStyle = "white";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isProton ? "+" : "−", 20, 21);

    // Add it to DOM temporarily for macOS drag behavior
    dragIcon.style.position = "absolute";
    dragIcon.style.top = "-100px";
    dragIcon.style.left = "-100px";
    document.body.appendChild(dragIcon);

    // Attach as drag image
    e.dataTransfer.setDragImage(dragIcon, 20, 20);

    // Remove it after a short delay so it doesn’t affect layout
    setTimeout(() => document.body.removeChild(dragIcon), 0);
  });
});



// Handle drop on canvas
canvas.addEventListener("dragover", (e) => e.preventDefault());
canvas.addEventListener("drop", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const dropX = e.clientX - rect.left;
  const dropY = e.clientY - rect.top;

  const type = e.dataTransfer.getData("chargeType"); // "proton" or "electron"
  const chargeSign = type === "proton" ? +1 : -1;

  // Assign label (q1, q2, …) and store
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

// Draw all charges

function drawScene() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Voltage heatmap (optional)
  if (showPotentialMap && charges.length > 0) {
    drawPotentialMap();
  }


  // 1) Equipotentials (optional)
  if (showEquip && charges.length > 0) {
    drawEquipotentials();
  }

  // 2) Electric field lines (optional)
  if (showField && charges.length > 0) {
    drawFieldLines();
  }

  // 3) Charges (always on top)
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


// Handle Clear All button
document.getElementById("clearBtn").addEventListener("click", () => {
  charges = [];        // remove all particles
  updateHudCharges();
  drawScene();         // redraw (now blank)
});

// --- Download Screenshot ---
const screenshotBtn = document.getElementById("screenshotBtn");

screenshotBtn.addEventListener("click", () => {
  // Hide the HUD temporarily for a clean capture
  const hud = document.getElementById("hud");
  if (hud) hud.style.display = "none";

  // Wait a brief moment to ensure redraw
  setTimeout(() => {
    // Create a link with the canvas image data
    const link = document.createElement("a");
    link.download = "field_visualization.png";
    link.href = canvas.toDataURL("image/png");
    link.click();

    // Restore HUD visibility
    if (hud) hud.style.display = "block";
  }, 100);
});






// Variables to track dragging existing charges
let draggingCharge = null;
let isDragging = false;

// When mouse is pressed down on the canvas
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Check if mouse is near any charge
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

// When mouse moves while dragging
canvas.addEventListener("mousemove", (e) => {
  if (!isDragging || !draggingCharge) return;

  const rect = canvas.getBoundingClientRect();
  draggingCharge.x = e.clientX - rect.left;
  draggingCharge.y = e.clientY - rect.top;
  drawScene();
});

// When mouse button released
canvas.addEventListener("mouseup", () => {
  isDragging = false;
  draggingCharge = null;
});

// --- Click to open the Edit Charge modal ---
canvas.addEventListener("dblclick", (e) => {
  // Avoid opening right after a drag
  if (isDragging) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Find the topmost charge under the click
  for (let i = charges.length - 1; i >= 0; i--) {
    const c = charges[i];
    const dx = x - c.x;
    const dy = y - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 15) {
      openChargeModal(c); // <-- this function was defined in Step 3C
      break;
    }
  }
});



// --- Right-click (context menu) to delete a charge ---
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault(); // prevent the browser's right-click menu from appearing

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Find if the right-click happened near any charge
  for (let i = 0; i < charges.length; i++) {
    const c = charges[i];
    const dx = x - c.x;
    const dy = y - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 15) {
      // Remove this charge
      charges.splice(i, 1);
      updateHudCharges();
      drawScene();
      break;
    }
  }
});


// --- Electric field line visualization --- //

// Compute electric field in realistic N/C units
// Compute electric field (N/C) at pixel position (x,y)
function computeElectricField(x, y) {
  let Ex = 0, Ey = 0;
  const k = 8.99e9; // N·m²/C²

  for (const c of charges) {
    const dx_px = x - c.x;
    const dy_px = y - c.y;

    const dx = dx_px / pixelsPerMeter; // px → m
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

// Compute electric potential V (Volts) at pixel position (x,y)
// V = Σ k * q / r
function computePotential(x, y) {
  const k = 8.99e9; // N·m²/C²
  let V = 0;

  for (const c of charges) {
    const dx_px = x - c.x;
    const dy_px = y - c.y;
    const dx = dx_px / pixelsPerMeter; // px → m
    const dy = dy_px / pixelsPerMeter;
    const r = Math.hypot(dx, dy);
    if (r === 0) continue; // avoid singularity exactly at the charge center

    const qC = c.q * (c.magnitudeC ?? defaultChargeMagnitudeC);
    V += (k * qC) / r;
  }
  return V;
}


// Trace a single field line starting at (x, y)
// Follow the net electric field to trace a line (used for all charges)
function traceFieldLine(x, y, step = 8, maxSteps = 2000) {
  const points = [];
  let px = x;
  let py = y;

  for (let i = 0; i < maxSteps; i++) {
    const { Ex, Ey } = computeElectricField(px, py);
    const E = Math.sqrt(Ex * Ex + Ey * Ey);
    if (E < 0.0001) break; // stop if field too weak

    // Normalize the vector (direction of net field)
    const nx = Ex / E;
    const ny = Ey / E;

    // Move a small step *along* the field direction (same for all charges)
    px += nx * step;
    py += ny * step;

    // Stop if off-screen
    if (px < 0 || py < 0 || px > canvas.width || py > canvas.height) break;

    points.push({ x: px, y: py });
  }

  return points;
}

// Draw all field lines
function drawFieldLines() {
  if (charges.length === 0) return;

  const numSeeds = 16; // number of lines per charge
  const lineColor = "rgba(255, 180, 80, 0.7)"; // light orange

  for (const c of charges) {
    for (let i = 0; i < numSeeds; i++) {
      const angle = (i / numSeeds) * 2 * Math.PI;
      const startX = c.x + 20 * Math.cos(angle);
      const startY = c.y + 20 * Math.sin(angle);

      // Always trace in *both* directions from each seed
      const forward = traceFieldLine(startX, startY, 8);
      const backward = traceFieldLine(startX, startY, -8);

      // Combine the two halves into one smooth line
      const linePoints = backward.reverse().concat(forward);

      // Draw the unified line
      ctx.beginPath();
      if (linePoints.length > 0) ctx.moveTo(linePoints[0].x, linePoints[0].y);
      for (const p of linePoints) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Add arrowheads along it
      drawArrowsAlongLine(linePoints, 100);
    }
  }
}

// Draw small arrowheads along a field line to indicate direction
function drawArrowsAlongLine(points, spacing = 100) {
  if (points.length < 2) return;

  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const segLength = Math.sqrt(dx * dx + dy * dy);
    distance += segLength;

    if (distance > spacing) {
      distance = 0; // reset
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

// --- Equipotential line visualization ---------------------------------------
// We trace curves perpendicular to E: dr/ds = (+/-) (-Ey, Ex) / |E|
// This follows level sets of V because ∇V · dr/ds = 0.

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

    // unit vector perpendicular to E
    const nx = -Ey / mag;
    const ny =  +Ex / mag;

    // advance
    px += nx * step;
    py += ny * step;

    // stop if leaving canvas or approaching a charge too closely
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

// Draw a family of equipotential curves by seeding small rings around charges.
function drawEquipotentials() {
  if (charges.length === 0) return;

  // Map slider → angularSkip (bigger skip = fewer lines)
  // density 1 → skip ~10 (very sparse), density 10 → skip 1 (max lines)
  const angularSkip   = Math.max(1, Math.round(11 - equipDensity)); 
  const seedsPerCharge = 24;           // base set of angles to choose from
  const startRadius    = 40;           // how far from charge to seed
  const color          = "rgba(90, 190, 255, 0.45)";
  const lineW          = 0.9;

  ctx.strokeStyle = color;
  ctx.lineWidth   = lineW;

  let drawnCount = 0, maxCurves = 120; // safety cap

  for (const c of charges) {
    for (let i = 0; i < seedsPerCharge; i++) {
      if (i % angularSkip !== 0) continue;   // <- density control

      const ang = (i / seedsPerCharge) * 2 * Math.PI;
      const sx = c.x + startRadius * Math.cos(ang);
      const sy = c.y + startRadius * Math.sin(ang);

      if (_nearAnyCharge(sx, sy, 20)) continue;

      // Take slightly bigger steps when sparse for speed/spacing
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



// --- Voltage Heatmap Visualization -----------------------------------------
function drawPotentialMap() {
  const k = 8.99e9;           // N·m²/C²
  const step = 6;             // pixel step (higher = faster but coarser)
  const maxV = Math.max(1e3, 5e5 * charges.length / pixelsPerMeter);
  const alpha = 0.4;          // transparency for blending

  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      let V = 0;

      for (const c of charges) {
        const dx = (x - c.x) / pixelsPerMeter;
        const dy = (y - c.y) / pixelsPerMeter;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r < 1e-6) continue;
        const qC = c.q * (c.magnitudeC ?? chargeMagnitudeC);
        V += (k * qC) / r;
      }

      const color = voltageToColor(V, maxV, alpha);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, step, step);
    }
  }
  // --- Zero-Voltage Equipotential Line -----------------------------------
ctx.strokeStyle = "rgba(0, 255, 100)";  // bright neon green
ctx.lineWidth = 1.8;

// Trace the V=0 contour across the grid by interpolating crossings
for (let y = 0; y < canvas.height - step; y += step) {
  for (let x = 0; x < canvas.width - step; x += step) {
    // Compute potential at 4 corners of this grid cell
    const V00 = computePotential(x, y);
    const V10 = computePotential(x + step, y);
    const V01 = computePotential(x, y + step);
    const V11 = computePotential(x + step, y + step);

    // Check if all values are on one side (no crossing)
    const allPos = V00 > 0 && V10 > 0 && V01 > 0 && V11 > 0;
    const allNeg = V00 < 0 && V10 < 0 && V01 < 0 && V11 < 0;
    if (allPos || allNeg) continue;

    // Otherwise, interpolate approximate crossing points within the cell
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

// Map voltage to color
function voltageToColor(V, maxV, alpha = 0.4) {
  const clamp = Math.max(-maxV, Math.min(maxV, V));
  const norm = clamp / maxV; // normalized to -1..1
  const red   = norm > 0 ? 255 * norm : 0;
  const blue  = norm < 0 ? 255 * -norm : 0;
  const green = 60; // slightly dark background for contrast
  return `rgba(${red.toFixed(0)},${green.toFixed(0)},${blue.toFixed(0)},${alpha})`;
}





// Toggle Electric Field lines
const toggleFieldEl = document.getElementById("toggleField");
if (toggleFieldEl) {
  toggleFieldEl.checked = true; // ensure default ON
  toggleFieldEl.addEventListener("change", (e) => {
    showField = e.target.checked;
    drawScene();
  });
}

// Toggle Equipotential lines
const toggleEquipEl = document.getElementById("toggleEquip");
if (toggleEquipEl) {
  toggleEquipEl.checked = true; // ensure default ON
  toggleEquipEl.addEventListener("change", (e) => {
    showEquip = e.target.checked;
    drawScene();
  });
}

// Toggle Voltage Heatmap
const togglePotentialEl = document.getElementById("togglePotential");
if (togglePotentialEl) {
  togglePotentialEl.addEventListener("change", (e) => {
    showPotentialMap = e.target.checked;
    drawScene();
  });
}



// === Pixels-per-meter typed control (1–500) ===
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

// initialize default
if (pxInput) {
  pxInput.value = String(pixelsPerMeter);
  if (scaleInfo) scaleInfo.textContent = `${pixelsPerMeter} pixels = 1 meter`;
  pxInput.addEventListener("input", validateAndApplyScale);
  pxInput.addEventListener("change", validateAndApplyScale);
  pxInput.addEventListener("blur", validateAndApplyScale);
}



// Equipotential density slider
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

// ===== Edit Charge Modal wiring =====
const chargeModal  = document.getElementById("chargeModal");
const closeBtn     = document.getElementById("closeChargeModal");
const saveBtn      = document.getElementById("saveChargeBtn");
const titleEl      = document.getElementById("chargeTitle");
const mantissaEl   = document.getElementById("mantissaInput");
const exponentEl   = document.getElementById("exponentInput");
const chargeErrEl  = document.getElementById("chargeError");

let editingCharge = null;

function openChargeModal(charge) {
  editingCharge = charge;

  // prefill from existing magnitude (or global default)
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
}

if (closeBtn) {
  closeBtn.addEventListener("click", closeChargeModal);
}
if (chargeModal) {
  // click on the backdrop closes the modal
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

  // store per-charge magnitude (sign is in c.q)
  editingCharge.magnitudeC = mant * Math.pow(10, exp);

  updateHudCharges();
  drawScene();
  closeChargeModal();
}

if (saveBtn) {
  saveBtn.addEventListener("click", saveChargeFromModal);
}


// --- Hover Info Tooltip for Charges ---
const tooltip = document.getElementById("chargeTooltip");

canvas.addEventListener("mousemove", (e) => {
  if (!tooltip) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  let found = null;

  // find if near a charge
  for (const c of charges) {
    const dx = x - c.x;
    const dy = y - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 20) { // proximity threshold
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




// --- HUD for distance (single charge) and field magnitude ---
const hud     = document.getElementById("hud");
const hudDist = document.getElementById("hudDist");
const hudE    = document.getElementById("hudE");
const hudV    = document.getElementById("hudV");

canvas.addEventListener("mousemove", (e) => {
  if (!hud) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // --- Distance display (only if exactly one charge) ---
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
    hudDist.textContent = ""; // hide when 0 or >1 charge
  }

  // --- |E| magnitude (always show if any charges) ---
  if (charges.length === 0) {
    if (hudE) hudE.textContent = "E: —";
    if (hudV) hudV.textContent = "V: —";
    return;
  }

  // (after you compute Emag and set hudE...)
const V = computePotential(x, y);

// nice formatting for Volts
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





// initial draw
drawScene();