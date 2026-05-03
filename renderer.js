import { SYSTEM_FONTS, defaultSettings, userSettings, AppFeatures } from './Config.js';
import { showSystemToast, showToast, showConfirm, resolvePath } from './Utils.js';
import { MathUtils } from './MathUtils.js';
import { Templates } from './templates.js';
import { injectDynamicUI, injectLateStyles } from './UIBuilder.js';
import { FontManager } from './FontManager.js';
import { UIManager } from './UIManager.js';
import { AdvancedTools } from './AdvancedTools.js';
import { ExportManager } from './ExportManager.js';
import { 
    // Virtual Canvases & Contexts
    backgroundCanvas, bgCtx, 
    scratchCanvas, scratchCtx, 
    shapeLayerCanvas, shapeLayerCtx,

    // Core Drawing Elements
    canvas, ctx, frame, textLayer, cursorDot,

    // Dynamic UI Components
    onboardingHtml, measureTip, magLens, 
    microLens, virtualSyringe, virtualStamp,

    // Header Inputs & Controls
    inpW, inpH, winResizeGrip, 
    btnClose, btnMin, btnUndo, btnRedo, 
    btnFullscreen, btnCenter, floatingBar,

    // Tools & Settings UI
    fontFam, btnBold, btnItalic, 
    sizeSl, opacitySl, sizeDot, 
    btnMultishape, gridToggle, shapeMenu,

    // Floating Bar Equivalents
    fbFontFam, fbBtnBold, fbBtnItalic, 
    fbSizeSl, fbOpacitySl, fbSizeDot, 
    fbBtnMultishape, fbGridToggle, fbShapeMenu,

    // Modals & Panels
    settingsPanel, btnSettings, settingsModal, 
    closeSettings, colorPopup,

    // Utility & Stamp Controls
    radiusBubble, radiusInput, radiusVal, 
    stampBubble, stampCurrentValue, stampModeToggle, stampReset,

    // Onboarding Wizard Elements
    onboardingWizard, wizBack, wizNext, wizFinish, 
    wizHotkeyInput, wizHotkeyDisplay, wizFinishHotkey, wizPages,

    // Color Pickers
    colorTrigger, fbColorTrigger, colorPk, fbColorPk, 
    btnRgb, fbBtnRgb, cp, fbCp
} from './UIElements.js';

// =====================================================================
// CHAPTER 1: CONFIGURATION & FEATURE FLAGS
// =====================================================================

const IS_PRO_BUILD = window.electronAPI.sendSync('get-is-pro-sync');

if (AppFeatures.type === 'core') {
    const coreStyle = document.createElement('style');
    coreStyle.innerHTML = `
        #fb-tools-dropdown, #footer-extra-tools, #btn-footer-extras,
        #btn-dotted, #btn-shadow, #fb-btn-dotted, #fb-btn-shadow, #fb-monitor-jump {
            visibility: hidden !important; pointer-events: none !important; opacity: 0 !important;
        }
        .dropdown-item[data-sub="triangle"], .dropdown-item[data-sub="polygon"],
        .dropdown-item[data-sub="check"], .dropdown-item[data-sub="x-shape"],
        .pro-only { display: none !important; }
    `;
    document.head.appendChild(coreStyle);
    
    window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (['o','i','m','b','y','g','v','x'].includes(k) && !(e.ctrlKey || e.metaKey)) e.stopImmediatePropagation();
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);

    window.addEventListener('DOMContentLoaded', () => {
        const allowed = AppFeatures.allowedArrowStyles;
        document.querySelectorAll('.dropdown-item[data-arrow]').forEach(item => { if (!allowed.includes(item.dataset.arrow)) item.remove(); });
        document.querySelectorAll('.tool-btn[data-t="line"], .tool-btn[data-t="arrow"]').forEach(btn => btn.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); });
        document.querySelectorAll('#btn-multishape, #fb-btn-multishape').forEach(btn => btn.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); });
    });
}
console.log(`[Renderer] Running as: ${AppFeatures.type.toUpperCase()}`);

// =====================================================================
// CHAPTER 2: STATE VARIABLES & GLOBALS
// =====================================================================

if (AppFeatures.type === 'core') {
    userSettings.arrowStyle = 'v'; userSettings.autoClipboard = false; userSettings.openAtLogin = false;
}

let originalPalette = [];
let snapRadius = 20; 
let angleSnapRad = Math.PI / 12;

let tool = userSettings.startupTool || 'cursor'; 
let eraserMode = userSettings.defaultEraserMode || 'object'; 
let isDotted = false; 
let isShadow = false;
let isHighlighter = false; 
let previousColor = userSettings.defaultColor || '#000000';
let fillStates = { square: false, circle: false, star: false, triangle: false, 'x-shape': false, polygon: false, check: false };

let shapes = []; 
let snapLines = []; 
let polygonPoints = [];
let activeShape = null; 
let selectedShape = null; 
let clipboardShape = null;

let isDown = false; 
let startX = 0, startY = 0; 
let lastClientX = 0, lastClientY = 0;
let draggingHandle = 0; 
let isDraggingShape = false; 
let dragOffsetX = 0, dragOffsetY = 0, dragExOffset = 0, dragEyOffset = 0, dragCpOffsetX = 0, dragCpOffsetY = 0;

let activeTextWrapper = null; 
let isDraggingText = false;

let historyStack = []; 
let historyIndex = -1;
let isFullscreen = false; 
let hasSnappedInFullscreen = false;
let isWGCFrozen = false; 
let capturedImage = null;

let isDraggingFrame = false; 
let isCreatingFrame = false; 
let frameStartX = 0, frameStartY = 0; 
let isSuppressingResize = false; 
let dragStartW = 0, dragStartH = 0; 
let isResizing = false; 
let resizeDir = '';
let startResizeX, startResizeY, startResizeW, startResizeH, startResizeLeft, startResizeTop;

let stampCounterValue = userSettings.stampCount; 
let stampMode = userSettings.stampMode; 
let stampLetterCode = userSettings.stampLetterCode; 
let currentStampSize = userSettings.stampDefaultSize; 
let sequenceCounter = parseInt(userSettings.sequenceCounter) || 1;

let magSize = 200;  
let magZoom = 2;    
let showMicroLens = false;

const MIN_WIN_W = 975; 
const UI_W_OFFSET = 120; 
const UI_H_OFFSET = 98; 
const BORDER_OFFSET = 4;
const HANDLE_RADIUS = 6; 
const MOVE_HANDLE_SIZE = 8; 
const ROTATION_HANDLE_OFFSET = 25;
const SYRINGE_HOTSPOT_X = 12;
const SYRINGE_HOTSPOT_Y = 52;
const LENS_OFFSET_X = -65;    
const LENS_OFFSET_Y = -40;

let preWizardW = 0, preWizardH = 0;
let w = userSettings.startupW;
let h = userSettings.startupH;
let dpr = window.devicePixelRatio || 1;
const requiredW = Math.max(userSettings.startupW + UI_W_OFFSET, 1000);

// =====================================================================
// CHAPTER 4: CORE RENDER ENGINE
// =====================================================================

function renderMain() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    shapeLayerCtx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (backgroundCanvas.width > 0 && backgroundCanvas.height > 0) ctx.drawImage(backgroundCanvas, 0, 0); 

    const gridEl = document.getElementById('grid');
    if (gridEl && !gridEl.classList.contains('hidden') && userSettings.gridOpacity > 0.05) drawGrid(ctx); 

    const shapesToDraw = [...shapes];
    if (activeShape) shapesToDraw.push(activeShape);

    // --- PASS 1: HIGHLIGHTERS (Multiply Mode) ---
    shapeLayerCtx.clearRect(0, 0, shapeLayerCanvas.width, shapeLayerCanvas.height);
    shapeLayerCtx.save();
    shapeLayerCtx.scale(dpr, dpr); 
    shapesToDraw.forEach(s => {
        if (s.opacity < 1 && s.type !== 'eraser-stroke' && s.type !== 'magnifier-snap') {
            shapeLayerCtx.globalCompositeOperation = 'source-over'; drawShape(shapeLayerCtx, s);
        } else if (s.type === 'eraser-stroke') {
            shapeLayerCtx.globalCompositeOperation = 'destination-out'; drawShape(shapeLayerCtx, s);
        }
    });
    shapeLayerCtx.restore();

    if (shapeLayerCanvas.width > 0 && shapeLayerCanvas.height > 0) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(shapeLayerCanvas, 0, 0);
    }

    // --- PASS 2: PENS & SHAPES (Normal Mode) ---
    shapeLayerCtx.clearRect(0, 0, shapeLayerCanvas.width, shapeLayerCanvas.height);
    shapeLayerCtx.save();
    shapeLayerCtx.scale(dpr, dpr);
    shapesToDraw.forEach(s => {
        if (s.opacity < 1 && s.type !== 'eraser-stroke' && s.type !== 'magnifier-snap') return; 
        shapeLayerCtx.globalCompositeOperation = (s.type === 'eraser-stroke') ? 'destination-out' : 'source-over';
        drawShape(shapeLayerCtx, s);
    });
    shapeLayerCtx.restore();
    if (shapeLayerCanvas.width > 0 && shapeLayerCanvas.height > 0) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(shapeLayerCanvas, 0, 0);
    }

    // --- PASS 3: UI ELEMENTS (Scaled) ---
    ctx.save();
    ctx.scale(dpr, dpr); 
    
    if (tool === 'polygon' && polygonPoints.length > 0) {
        ctx.strokeStyle = colorPk.value; ctx.lineWidth = sizeSl.value; ctx.globalAlpha = parseFloat(opacitySl.value);
        if(isDotted) ctx.setLineDash([ctx.lineWidth * 2, ctx.lineWidth * 1.5]); applyShadow(ctx, isShadow);
        ctx.lineJoin = userSettings.cornerStyle; ctx.lineCap = userSettings.cornerStyle === 'miter' ? 'square' : 'round'; 
        ctx.beginPath(); ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
        for(let i=1; i<polygonPoints.length; i++) ctx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
        if(activeShape && activeShape.type === 'polygon_drag') ctx.lineTo(activeShape.ex, activeShape.ey);
        ctx.stroke(); 
        ctx.setLineDash([]); applyShadow(ctx, false); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.globalAlpha = 1;
        polygonPoints.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill(); ctx.stroke(); });
    }

    if (snapLines.length > 0) {
        ctx.beginPath(); ctx.strokeStyle = '#FF00FF'; ctx.lineWidth = 1; ctx.setLineDash([]); 
        snapLines.forEach(l => { ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); });
        ctx.stroke();
    }

    if (selectedShape) drawSelectionHandles(ctx, selectedShape);
    ctx.restore();
}

function drawGrid(c) {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0); 
    
    const scale = dpr; 
    const s = (parseInt(userSettings.gridSize) || 20) * scale;
    const opacity = userSettings.gridOpacity || 0.3;
    const accent = userSettings.accentColor || '#8CFA96'; // Mint
    
    const pW = c.canvas.width;
    const pH = c.canvas.height;
    const cX = Math.round(pW / 2);
    const cY = Math.round(pH / 2);

    // --- PASS 1: THE SQUARES (SUBTLE GRAY) ---
    // Removed the * 0.5 handicap so 100% visibility actually means 100%
    c.strokeStyle = `rgba(150, 150, 150, ${opacity})`; 
    c.lineWidth = 1; 
    c.beginPath();
    
    // Draw vertical lines
    for (let x = cX; x <= pW; x += s) { c.moveTo(Math.floor(x) + 0.5, 0); c.lineTo(Math.floor(x) + 0.5, pH); }
    for (let x = cX - s; x >= 0; x -= s) { c.moveTo(Math.floor(x) + 0.5, 0); c.lineTo(Math.floor(x) + 0.5, pH); }

    // Draw horizontal lines
    for (let y = cY; y <= pH; y += s) { c.moveTo(0, Math.floor(y) + 0.5); c.lineTo(pW, Math.floor(y) + 0.5); }
    for (let y = cY - s; y >= 0; y -= s) { c.moveTo(0, Math.floor(y) + 0.5); c.lineTo(pW, Math.floor(y) + 0.5); }
    c.stroke();

    // --- PASS 2: THE CENTER CROSSHAIR (MINT) ---
    c.strokeStyle = accent; 
    c.lineWidth = 2; // Thicker as requested
    c.globalAlpha = opacity;
    c.beginPath();
    
    // Vertical center
    c.moveTo(cX, 0); c.lineTo(cX, pH);
    // Horizontal center
    c.moveTo(0, cY); c.lineTo(pW, cY);
    
    c.stroke();
    c.restore();
}

function drawShape(c, s) {
    if (s.type === 'polygon_drag') return; 
    c.save(); 
    
    if (s.rotation) { 
        const center = MathUtils.getShapeCenter(s); 
        c.translate(center.x, center.y); c.rotate(s.rotation); c.translate(-center.x, -center.y); 
    }

    c.lineWidth = s.width; 
c.strokeStyle = s.type === 'eraser-stroke' ? '#000000' : s.color; 
c.fillStyle = s.type === 'eraser-stroke' ? '#000000' : s.color; 
c.globalAlpha = s.type === 'eraser-stroke' ? 1 : (s.opacity || 1);

    if (s.type === 'ocr-selection') {
        const borderMint = 'rgba(140, 250, 150, 0.8)';
        const ghostMint = 'rgba(140, 250, 150, 0.1)';
        
        c.strokeStyle = ghostMint; c.lineWidth = 1; c.beginPath();
        c.moveTo(s.x + s.w/2, s.y); c.lineTo(s.x + s.w/2, s.y + s.h); 
        c.moveTo(s.x, s.y + s.h/2); c.lineTo(s.x + s.w, s.y + s.h/2); 
        c.stroke();

        c.strokeStyle = borderMint; c.lineWidth = 3;
        const bLen = Math.min(15, Math.abs(s.w/4), Math.abs(s.h/4)); 
        c.beginPath();
        c.moveTo(s.x, s.y + bLen); c.lineTo(s.x, s.y); c.lineTo(s.x + bLen, s.y); 
        c.moveTo(s.x + s.w - bLen, s.y); c.lineTo(s.x + s.w, s.y); c.lineTo(s.x + s.w, s.y + bLen); 
        c.moveTo(s.x + s.w, s.y + s.h - bLen); c.lineTo(s.x + s.w, s.y + s.h); c.lineTo(s.x + s.w - bLen, s.y + s.h); 
        c.moveTo(s.x + bLen, s.y + s.h); c.lineTo(s.x, s.y + s.h); c.lineTo(s.x, s.y + s.h - bLen); 
        c.stroke();

        c.lineWidth = 1; c.setLineDash([4, 4]); c.strokeRect(s.x, s.y, s.w, s.h); c.setLineDash([]); 

        c.lineWidth = 2; c.beginPath(); const nS = 4;
        c.moveTo(s.x + s.w/2 - nS, s.y); c.lineTo(s.x + s.w/2 + nS, s.y); 
        c.moveTo(s.x + s.w/2 - nS, s.y + s.h); c.lineTo(s.x + s.w/2 + nS, s.y + s.h); 
        c.moveTo(s.x, s.y + s.h/2 - nS); c.lineTo(s.x, s.y + s.h/2 + nS); 
        c.moveTo(s.x + s.w, s.y + s.h/2 - nS); c.lineTo(s.x + s.w, s.y + s.h/2 + nS); c.stroke();

        c.restore(); return; 
    }

    const dashed = s.isDotted; 
    const dashArray = dashed ? [s.width * 2, s.width * 1.5] : [];
    c.setLineDash(dashArray); 
    
    if (dashed) { c.lineCap = userSettings.dottedStyle || 'round'; c.lineJoin = userSettings.dottedStyle || 'round'; } 
    else if (['square', 'triangle', 'polygon', 'check', 'x-shape', 'line', 'star'].includes(s.type)) {
        c.lineJoin = userSettings.cornerStyle; c.lineCap = userSettings.cornerStyle === 'miter' ? 'square' : 'round'; c.miterLimit = 10;
    } else { c.lineJoin = 'round'; c.lineCap = 'round'; }

    if(s.type !== 'arrow' && s.type !== 'line' && s.type !== 'eraser-stroke') applyShadow(c, s.hasShadow);
    
    if (s.type === 'pen' || s.type === 'polygon' || s.type === 'eraser-stroke') {
        if (s.points && s.points.length > 0) {
            if (['pen', 'polygon', 'eraser-stroke'].includes(s.type) && s.x !== undefined) c.translate(s.x, s.y);
            c.beginPath();
            if (s.points.length === 1 && s.type !== 'polygon') { c.arc(s.points[0].x, s.points[0].y, s.width / 2, 0, Math.PI * 2); c.fill(); } 
            else {
                c.moveTo(s.points[0].x, s.points[0].y);
                if (s.type === 'pen' || s.type === 'eraser-stroke') {
                    for (let i = 1; i < s.points.length - 1; i++) {
                        const midX = (s.points[i].x + s.points[i + 1].x) / 2; const midY = (s.points[i].y + s.points[i + 1].y) / 2;
                        c.quadraticCurveTo(s.points[i].x, s.points[i].y, midX, midY);
                    }
                    if (s.points.length > 1) c.lineTo(s.points[s.points.length - 1].x, s.points[s.points.length - 1].y);
                } else {
                    for (let i = 1; i < s.points.length; i++) c.lineTo(s.points[i].x, s.points[i].y);
                }
                if (s.type === 'polygon' && s.isClosed) { c.closePath(); if (s.isSolid) c.fill(); else c.stroke(); } else c.stroke();
            }
        }
    } 
    else if (s.type === 'line') { drawArrowComposite(c, s.x, s.y, s.ex, s.ey, s.width, s.color, s.hasShadow, s.opacity, (s.isDotted ? [s.width * 2, s.width * 1.5] : []), false, s.cp, s); }
    else if (s.type === 'arrow') { drawArrowComposite(c, s.x, s.y, s.ex, s.ey, s.width, s.color, s.hasShadow, s.opacity, (s.isDotted ? [s.width * 2, s.width * 1.5] : []), true, s.cp, s); }
    else if (s.type === 'text') { 
        c.save(); 
        c.font = s.font; 
        c.textBaseline = 'top'; 
        c.fillStyle = s.color; 
        c.globalAlpha = s.opacity || 1;
        c.fillText(s.text, s.x, s.y); 
        c.restore(); 
    }
    else if (s.type === 'stamp') {
        const radius = s.w / 2; const cx = s.x + radius; const cy = s.y + radius; const scale = s.w / 30; 
        if (s.ex !== undefined) {
            const angle = Math.atan2(s.ey - cy, s.ex - cx);
            const headLen = 10 * scale; const shorten = 3 * scale;
            const stopX = s.ex - shorten * Math.cos(angle); const stopY = s.ey - shorten * Math.sin(angle);
            c.beginPath(); c.moveTo(cx, cy); c.lineTo(stopX, stopY);
            c.lineWidth = 2 * scale; c.strokeStyle = s.color; c.stroke();
            c.beginPath(); c.moveTo(s.ex, s.ey);
            c.lineTo(s.ex - headLen * Math.cos(angle - Math.PI / 6), s.ey - headLen * Math.sin(angle - Math.PI / 6));
            c.lineTo(s.ex - headLen * Math.cos(angle + Math.PI / 6), s.ey - headLen * Math.sin(angle + Math.PI / 6));
            c.fillStyle = s.color; c.fill();
        }
        c.beginPath(); c.arc(cx, cy, radius, 0, Math.PI * 2); c.fillStyle = s.color; c.fill(); 
        c.strokeStyle = '#fff'; c.lineWidth = 2 * scale; c.stroke();
        c.fillStyle = '#fff'; c.font = 'bold ' + (s.w * 0.6) + 'px Arial'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; 
        const metrics = c.measureText(s.text); const actualH = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
        const textY = cy + (actualH / 2) - metrics.actualBoundingBoxDescent;
        c.fillText(s.text, cx, textY);
    }
    else if (s.type === 'blur') {
        c.save(); c.beginPath(); c.rect(s.x, s.y, s.w, s.h); c.clip(); c.filter = 'blur(25px)';
        c.drawImage(backgroundCanvas, s.x * dpr, s.y * dpr, s.w * dpr, s.h * dpr, s.x, s.y, s.w, s.h);
        c.filter = 'none'; c.restore();

        if (s === activeShape || (s === selectedShape && isDown)) {
            const hazardOrange = 'rgba(255, 165, 0, 0.8)';
            const lightOrange = 'rgba(255, 165, 0, 0.15)';
            
            c.save();
            c.beginPath(); c.rect(s.x, s.y, s.w, s.h); c.clip();
            c.strokeStyle = lightOrange; c.lineWidth = 2;
            const diagSpacing = 15;
            const maxDim = Math.max(Math.abs(s.w), Math.abs(s.h)) * 2;
            const startX = s.w < 0 ? s.x + s.w : s.x;
            const startY = s.h < 0 ? s.y + s.h : s.y;
            for (let d = -maxDim; d < maxDim; d += diagSpacing) {
                c.beginPath();
                c.moveTo(startX + d, startY);
                c.lineTo(startX + d + Math.abs(s.h), startY + Math.abs(s.h));
                c.stroke();
            }
            c.restore();

            c.save();
            c.strokeStyle = hazardOrange;
            c.lineWidth = 3;
            const bLen = Math.min(12, Math.abs(s.w/5), Math.abs(s.h/5));
            
            c.beginPath();
            c.moveTo(s.x, s.y + (Math.sign(s.h) * bLen)); c.lineTo(s.x, s.y); c.lineTo(s.x + (Math.sign(s.w) * bLen), s.y); 
            c.moveTo(s.x + s.w - (Math.sign(s.w) * bLen), s.y); c.lineTo(s.x + s.w, s.y); c.lineTo(s.x + s.w, s.y + (Math.sign(s.h) * bLen)); 
            c.moveTo(s.x + s.w, s.y + s.h - (Math.sign(s.h) * bLen)); c.lineTo(s.x + s.w, s.y + s.h); c.lineTo(s.x + s.w - (Math.sign(s.w) * bLen), s.y + s.h); 
            c.moveTo(s.x + (Math.sign(s.w) * bLen), s.y + s.h); c.lineTo(s.x, s.y + s.h); c.lineTo(s.x, s.y + s.h - (Math.sign(s.h) * bLen)); 
            c.stroke();

            c.lineWidth = 1.5;
            c.setLineDash([10, 6]);
            c.strokeRect(s.x, s.y, s.w, s.h);
            c.restore();
        }
        return;
    }
    else if (s.type === 'magnifier-snap') {
        c.globalAlpha = 1.0;
        c.save(); c.shadowColor = 'rgba(0,0,0,0.85)'; c.shadowBlur = 30; c.shadowOffsetX = 2; c.shadowOffsetY = 5;
        c.beginPath(); c.arc(s.x + s.w/2, s.y + s.h/2, s.w/2, 0, Math.PI * 2); c.fillStyle = '#000000'; c.fill(); c.restore();

        c.save(); c.beginPath(); c.arc(s.x + s.w/2, s.y + s.h/2, s.w/2, 0, Math.PI * 2); c.clip(); 
        c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
        const img = new Image(); img.src = s.imgData;
        if (img.complete) c.drawImage(img, s.x, s.y, s.w, s.h); else img.onload = () => renderMain();
        c.restore();

        c.globalAlpha = s.opacity || 1;
        c.save(); 
        let borderW = s.width || parseInt(sizeSl.value) || 3;
        if (borderW > s.w / 2) borderW = s.w / 2;
        const cX = s.x + s.w/2; const cY = s.y + s.h/2;
        const drawRadius = Math.max(0, (s.w/2) - (borderW / 2));

        c.beginPath(); c.arc(cX, cY, drawRadius, 0, Math.PI * 2);
        c.lineWidth = borderW; c.strokeStyle = s.color || userSettings.accentColor; c.stroke();

        if (borderW >= 4) {
            const edgeW = Math.max(1, borderW * 0.15);
            c.beginPath(); c.arc(cX, cY, drawRadius - (borderW/2) + edgeW, 0, Math.PI);
            c.strokeStyle = 'rgba(0, 0, 0, 0.3)'; c.lineWidth = edgeW; c.stroke();
            
            c.beginPath(); c.arc(cX, cY, drawRadius + (borderW/2) - edgeW, Math.PI, Math.PI * 2);
            c.strokeStyle = 'rgba(255, 255, 255, 0.4)'; c.lineWidth = edgeW; c.stroke();
        }
        c.restore();
    }
    else {
        c.beginPath();
        if (s.type === 'square') { 
            if (userSettings.cornerStyle === 'round') {
                const radius = userSettings.cornerRadius !== undefined ? userSettings.cornerRadius : 10;
                c.beginPath(); if (c.roundRect) c.roundRect(s.x, s.y, s.w, s.h, radius); else c.rect(s.x, s.y, s.w, s.h); 
                if(s.isSolid) c.fill(); else c.stroke();
            } else { if(s.isSolid) c.fillRect(s.x, s.y, s.w, s.h); else c.strokeRect(s.x, s.y, s.w, s.h); }
        } 
        else if (s.type === 'circle') { c.ellipse(s.x + s.w/2, s.y + s.h/2, Math.abs(s.w/2), Math.abs(s.h/2), 0, 0, 2*Math.PI); if(s.isSolid) c.fill(); else c.stroke(); } 
        else if (s.type === 'triangle') { c.moveTo(s.x + s.w/2, s.y); c.lineTo(s.x, s.y + s.h); c.lineTo(s.x + s.w, s.y + s.h); c.closePath(); if(s.isSolid) c.fill(); else c.stroke(); } 
        else if (s.type === 'star') { const cx = s.x + s.w/2; const cy = s.y + s.h/2; const outer = Math.abs(s.w/2); const inner = outer * 0.4; for(let i=0; i<5; i++){ c.lineTo(cx + Math.cos((18 + i*72)/180*Math.PI)*outer, cy - Math.sin((18 + i*72)/180*Math.PI)*outer); c.lineTo(cx + Math.cos((54 + i*72)/180*Math.PI)*inner, cy - Math.sin((54 + i*72)/180*Math.PI)*inner); } c.closePath(); if(s.isSolid) c.fill(); else c.stroke(); } 
        else if (s.type === 'check') { const rx = s.w < 0 ? s.x + s.w : s.x; const ry = s.h < 0 ? s.y + s.h : s.y; const rw = Math.abs(s.w); const rh = Math.abs(s.h); c.moveTo(rx + rw * 0.15, ry + rh * 0.55); c.lineTo(rx + rw * 0.40, ry + rh * 0.90); c.lineTo(rx + rw * 0.90, ry + rh * 0.10); c.stroke(); } 
        else if (s.type === 'x-shape') { c.moveTo(s.x, s.y); c.lineTo(s.x+s.w, s.y+s.h); c.moveTo(s.x+s.w, s.y); c.lineTo(s.x, s.y+s.h); c.stroke(); }
    }
    c.restore(); 
}

function drawArrowComposite(destCtx, x1, y1, x2, y2, width, color, shadow, opacity, dashArray, drawHead = true, cp = null, s = null) {
    const sc = scratchCtx; const cv = scratchCanvas; 
    sc.clearRect(0,0,cv.width, cv.height); sc.save(); sc.setTransform(1,0,0,1,0,0); sc.scale(dpr,dpr);
    
    const isDotted = dashArray && dashArray.length > 0;
    const isRoundMode = (isDotted && userSettings.dottedStyle === 'round') || (!isDotted && userSettings.cornerStyle !== 'miter');
    let capStyle = isDotted ? (userSettings.dottedStyle === 'butt' ? 'butt' : 'round') : (userSettings.cornerStyle === 'miter' ? 'butt' : 'round');
    let joinStyle = isRoundMode ? 'round' : 'miter';
    
    sc.lineCap = capStyle; sc.lineJoin = joinStyle; sc.lineWidth = width; sc.strokeStyle = color; sc.fillStyle = color; sc.setLineDash(dashArray);

    const style = s && s.arrowStyle ? s.arrowStyle : (userSettings.arrowStyle || 'v');
    let angle = cp ? Math.atan2(y2 - cp.y, x2 - cp.x) : Math.atan2(y2 - y1, x2 - x1);

    let stopX = x2, stopY = y2;
    const headScale = isRoundMode ? 5.0 : 6.0;

    if (drawHead) {
        let headLength;
        if (style === 'v') headLength = width * 4.5;
        else if (style === 'concave' || style === 'curved') headLength = width * headScale;
        else if (style === 'hand') headLength = width * 5;
        else headLength = width * 5.5; 

        let shortenBy;
        if (style === 'dot') shortenBy = width / 1.5;
        else if (style === 'v' || style === 'hand') shortenBy = width / 2; 
        else if (style === 'concave' || style === 'curved') shortenBy = headLength * 0.75; 
        else shortenBy = headLength * 0.75; 

        stopX = x2 - shortenBy * Math.cos(angle); stopY = y2 - shortenBy * Math.sin(angle);
    }
    
    sc.beginPath(); sc.moveTo(x1, y1); 
    if (cp) sc.quadraticCurveTo(cp.x, cp.y, stopX, stopY); else sc.lineTo(stopX, stopY);
    sc.stroke(); 
    
    if (drawHead) {
        sc.beginPath(); sc.setLineDash([]); sc.lineCap = capStyle; sc.lineJoin = joinStyle;

        if (style === 'v') {
            const head = width * 4.5;
            sc.moveTo(x2 - head * Math.cos(angle - Math.PI/6), y2 - head * Math.sin(angle - Math.PI/6)); sc.lineTo(x2, y2); sc.lineTo(x2 - head * Math.cos(angle + Math.PI/6), y2 - head * Math.sin(angle + Math.PI/6)); sc.stroke(); 
        } 
        else if (style === 'hand') {
            const headLen = width * 6.0; sc.lineCap = 'round'; sc.lineJoin = 'round'; sc.lineWidth = width * 1.1; 
            const lAngle = angle - Math.PI/5; const rAngle = angle + Math.PI/5.5;
            const lx = x2 - (headLen * 0.9) * Math.cos(lAngle); const ly = y2 - (headLen * 0.9) * Math.sin(lAngle);
            const rx = x2 - headLen * Math.cos(rAngle); const ry = y2 - headLen * Math.sin(rAngle);
            const lCpDist = headLen * 0.6; const lCpAngle = angle - (Math.PI/12); const lCpX = x2 - lCpDist * Math.cos(lCpAngle); const lCpY = y2 - lCpDist * Math.sin(lCpAngle);
            const rCpDist = headLen * 0.5; const rCpAngle = angle + (Math.PI/12); const rCpX = x2 - rCpDist * Math.cos(rCpAngle); const rCpY = y2 - rCpDist * Math.sin(rCpAngle);
            sc.moveTo(lx, ly); sc.quadraticCurveTo(lCpX, lCpY, x2, y2); sc.quadraticCurveTo(rCpX, rCpY, rx, ry); sc.stroke(); sc.lineWidth = width;
        }
        else if (style === 'dot') {
            const rad = Math.max(width * 1.5, 5); sc.arc(x2, y2, rad, 0, Math.PI * 2); sc.fill();
        } 
        else if (style === 'concave') {
            const head = width * headScale; const spreadAngle = Math.PI / 7.5; const notchFactor = 0.8; 
            const rwX = x2 - head * Math.cos(angle - spreadAngle); const rwY = y2 - head * Math.sin(angle - spreadAngle);
            const lwX = x2 - head * Math.cos(angle + spreadAngle); const lwY = y2 - head * Math.sin(angle + spreadAngle);
            const notchX = x2 - (head * notchFactor) * Math.cos(angle); const notchY = y2 - (head * notchFactor) * Math.sin(angle);
            const cpDist = head * 0.6; const cpAngle = spreadAngle * 0.3; 
            const rCpX = x2 - cpDist * Math.cos(angle - cpAngle); const rCpY = y2 - cpDist * Math.sin(angle - cpAngle);
            const lCpX = x2 - cpDist * Math.cos(angle + cpAngle); const lCpY = y2 - cpDist * Math.sin(angle + cpAngle);
            sc.moveTo(x2, y2); sc.quadraticCurveTo(rCpX, rCpY, rwX, rwY); sc.lineTo(notchX, notchY); sc.lineTo(lwX, lwY); sc.quadraticCurveTo(lCpX, lCpY, x2, y2); 
            sc.fill(); if (isRoundMode) sc.stroke();
        }
        else {
            const head = width * 5.5; const narrowAngle = Math.PI / 7;
            sc.moveTo(x2, y2); sc.lineTo(x2 - head * Math.cos(angle - narrowAngle), y2 - head * Math.sin(angle - narrowAngle)); sc.lineTo(x2 - head * Math.cos(angle + narrowAngle), y2 - head * Math.sin(angle + narrowAngle)); 
            sc.closePath(); sc.fill(); if (isRoundMode) sc.stroke();
        }
    }
    
    sc.restore(); 
    destCtx.save(); 
    applyShadow(destCtx, shadow); 
    destCtx.scale(1/dpr, 1/dpr); 
    if (cv.width > 0 && cv.height > 0) {
        destCtx.drawImage(cv, 0, 0); 
    }
    destCtx.restore();
}

function drawSelectionHandles(c, s) {
    if (userSettings.immersiveMode) return;
    if (s.type === 'polygon_drag' || s.type === 'eraser-stroke' || s.type === 'ocr-selection') return;

    if (s.type === 'text') {
        c.save(); 
        c.font = s.font; 
        c.textBaseline = 'top'; 
        const m = c.measureText(s.text); 
        
        const match = s.font.match(/(\d+)px/);
        const h = match ? parseInt(match[1]) : 20;
        
        const padX = 8;
        const padY = 4;

        c.strokeStyle = userSettings.accentColor; 
        c.setLineDash([4, 4]); 
        c.lineWidth = 1.5;
        
        c.strokeRect(s.x - padX, s.y - padY, m.width + (padX * 2), h + (padY * 2));
        drawHandleSquare(c, s.x + m.width + padX, s.y - padY); 
        drawHandleSquare(c, s.x - padX, s.y + h / 2); 
        c.restore(); 
        return;
    }

   if (['line', 'arrow'].includes(s.type)) {
        drawHandleCircle(c, s.x, s.y, userSettings.accentColor);
        let h2x = s.ex, h2y = s.ey;
        if (s.type === 'arrow') {
             let angle = s.cp ? Math.atan2(s.ey - s.cp.y, s.ex - s.cp.x) : Math.atan2(s.ey - s.y, s.ex - s.x);
             h2x = s.ex + 15 * Math.cos(angle); h2y = s.ey + 15 * Math.sin(angle); 
        }
        drawHandleCircle(c, h2x, h2y, userSettings.accentColor);
        
        let cx = s.cp ? s.cp.x : (s.x + s.ex) / 2; let cy = s.cp ? s.cp.y : (s.y + s.ey) / 2;
        if (s.curveMode) { 
    c.beginPath(); 
    c.rect(cx - 5, cy - 5, 10, 10); 
    c.fillStyle = '#ffcc00'; 
    c.fill(); 
    
    c.strokeStyle = '#888888';
    c.lineWidth = 1;          
    c.stroke(); 
}
        else drawHandleCircle(c, cx, cy, userSettings.accentColor);
        return;
    }

    if (['pen', 'polygon'].includes(s.type)) {
        if (s.type === 'polygon' && s.points) { s.points.forEach((pt) => { drawHandleCircle(c, s.x + pt.x, s.y + pt.y, userSettings.accentColor); }); }
        if (s.type === 'polygon') return;
    }

    c.save(); const center = MathUtils.getShapeCenter(s); c.translate(center.x, center.y); c.rotate(s.rotation || 0);
    const halfW = s.w / 2; const halfH = s.h / 2; const handleY = (s.h > 0 ? -halfH : halfH) - ROTATION_HANDLE_OFFSET;

    if (s.type !== 'stamp' && s.type !== 'pen') {
    c.beginPath(); 
    // This draws the line from the top of the shape to the rotation handle
    c.moveTo(0, (s.h > 0 ? -halfH : halfH)); 
    c.lineTo(0, handleY);
    
    // THE FIX: Change from accentColor or black to subtle gray
    c.strokeStyle = '#888888'; 
    c.lineWidth = 1; // Thinned to 1px to match the handles
    c.setLineDash([]); 
    c.stroke();
    
    // Then the handle itself is drawn
    drawHandleCircle(c, 0, handleY, '#888888'); 
}

    drawHandleCircle(c, -halfW, -halfH, userSettings.accentColor); drawHandleCircle(c, halfW, -halfH, userSettings.accentColor);
    drawHandleCircle(c, halfW, halfH, userSettings.accentColor); drawHandleCircle(c, -halfW, halfH, userSettings.accentColor);

    if (s.type !== 'stamp') drawHandleSquare(c, 0, 0);
    c.restore();

    if (s.type === 'stamp' && s.ex !== undefined) {
        const scale = s.w / 30; const headLen = 10 * scale; const shaftOffset = headLen * 1.0; 
        const radius = s.w / 2; const cx = s.x + radius; const cy = s.y + radius;
        const angle = Math.atan2(s.ey - cy, s.ex - cx);
        const neckX = s.ex - shaftOffset * Math.cos(angle); const neckY = s.ey - shaftOffset * Math.sin(angle);
        drawHandleCircle(c, neckX, neckY, userSettings.accentColor);
    }
}

function drawHandleCircle(c, x, y, color) { 
    c.beginPath(); 
    c.setLineDash([]); 
    c.shadowColor = 'rgba(0,0,0,0.2)'; // Lightened shadow
    c.shadowBlur = 3; 
    c.arc(x, y, 5, 0, Math.PI * 2); 
    c.fillStyle = '#ffffff'; 
    c.fill(); 
    
    // THE TWEAK: Subtler gray and thinner stroke
    c.strokeStyle = '#888888'; // Deep gray instead of black
    c.lineWidth = 1; // Thinned from 1.5
    c.stroke(); 
}

function drawHandleSquare(c, x, y) { 
    c.beginPath(); 
    c.setLineDash([]); 
    const s = 10; 
    c.rect(x - s/2, y - s/2, s, s); 
    c.fillStyle = '#ffffff'; 
    c.fill(); 
    
    // THE TWEAK: Match the circle handle style
    c.strokeStyle = '#888888';
    c.lineWidth = 1;
    c.stroke(); 
}

function applyShadow(ctx, on) { 
    if (on) { 
        let blur = parseInt(userSettings.shadowBlur);
        if (isNaN(blur)) blur = 10;
        ctx.shadowBlur = blur; 
        
        let dist = parseInt(userSettings.shadowDistance);
        if (isNaN(dist)) dist = 5;
        ctx.shadowOffsetX = dist; 
        ctx.shadowOffsetY = dist; 
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
    } else { 
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; 
    } 
}

function clearBackground() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); shapeLayerCtx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height); shapeLayerCtx.clearRect(0, 0, shapeLayerCanvas.width, shapeLayerCanvas.height); 
    const w = backgroundCanvas.width; backgroundCanvas.width = w; 
    bgCtx.scale(dpr, dpr); bgCtx.lineCap = userSettings.cornerStyle || 'round'; bgCtx.lineJoin = userSettings.cornerStyle || 'round';
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
}

// =====================================================================
// CHAPTER 5: MATH, GEOMETRY & HIT TESTING
// =====================================================================

function clampCursorDot(clientX, clientY) {
    if (!cursorDot) return;
    const rect = frame.getBoundingClientRect();
    const pad = parseInt(sizeSl.value) / 2 || 2; 
    let dotX = Math.max(rect.left + pad, Math.min(clientX, rect.right - pad));
    let dotY = Math.max(rect.top + pad, Math.min(clientY, rect.bottom - pad));
    cursorDot.style.left = dotX + 'px';
    cursorDot.style.top = dotY + 'px';
}

const getXY = (e) => { 
    const r = canvas.getBoundingClientRect(); 
    return { x: e.clientX - r.left, y: e.clientY - r.top }; 
};

function applyGridSnap(val, axis) {
    const gridEl = document.getElementById('grid');
    if (!userSettings.snapToGrid || !(gridEl && !gridEl.classList.contains('hidden'))) return val;
    const size = parseInt(userSettings.gridSize) || 20;
    const center = Math.floor((axis === 'x') ? (w / 2) : (h / 2));
    return center + (Math.round((val - center) / size) * size);
}

function getHandleAt(p, s) {
    if(!s || s.type === 'polygon_drag' || s.isGroup || s.type === 'eraser-stroke') return 0;
    const TOUCH_RAD = 30; 

    if (s.type === 'stamp') {
         if (s.ex !== undefined) {
             const scale = s.w / 30; const headLen = 10 * scale; const shaftOffset = headLen * 2.0; 
             const radius = s.w / 2; const cx = s.x + radius; const cy = s.y + radius;
             const angle = Math.atan2(s.ey - cy, s.ex - cx);
             const neckX = s.ex - shaftOffset * Math.cos(angle); const neckY = s.ey - shaftOffset * Math.sin(angle);
             if (Math.hypot(p.x - neckX, p.y - neckY) < TOUCH_RAD) return 99;
         }
         if (Math.hypot(p.x - s.x, p.y - s.y) < TOUCH_RAD) return 1; 
         if (Math.hypot(p.x - (s.x+s.w), p.y - s.y) < TOUCH_RAD) return 2;
         if (Math.hypot(p.x - (s.x+s.w), p.y - (s.y+s.h)) < TOUCH_RAD) return 3; 
         if (Math.hypot(p.x - s.x, p.y - (s.y+s.h)) < TOUCH_RAD) return 4;
         const cRadius = s.w / 2; if (Math.hypot(p.x - (s.x + cRadius), p.y - (s.y + cRadius)) < cRadius) return 6; 
         return 0;
    }

    if (['line','arrow'].includes(s.type)) {
        if (Math.hypot(p.x - s.x, p.y - s.y) < TOUCH_RAD) return 1; 
        let h2x = s.ex, h2y = s.ey;
        let angle = s.cp ? Math.atan2(s.ey - s.cp.y, s.ex - s.cp.x) : Math.atan2(s.ey - s.y, s.ex - s.x);
        if (s.type === 'arrow') { h2x = s.ex + 15 * Math.cos(angle); h2y = s.ey + 15 * Math.sin(angle); }
        if (Math.hypot(p.x - h2x, p.y - h2y) < TOUCH_RAD) return 2;
        let cx = s.cp ? s.cp.x : (s.x + s.ex)/2; let cy = s.cp ? s.cp.y : (s.y + s.ey)/2;
        if (Math.hypot(p.x - cx, p.y - cy) < TOUCH_RAD) return s.curveMode ? 7 : 6;
    } 
    else if (['pen', 'polygon'].includes(s.type)) {
        if (s.type === 'polygon' && s.points) {
            for(let i=0; i<s.points.length; i++) { if(Math.hypot(p.x - (s.x + s.points[i].x), p.y - (s.y + s.points[i].y)) < TOUCH_RAD) return 100 + i; }
        }
    } 
    else if (s.type === 'text') {
        ctx.save(); ctx.font = s.font; ctx.textBaseline = 'top'; const m = ctx.measureText(s.text); const h = parseInt(s.font) || 20; ctx.restore();
        if (p.x >= s.x - 10 && p.x <= s.x + m.width + 10 && p.y >= s.y - 10 && p.y <= s.y + h + 10) return 6; 
    } 
    else {
        const c = MathUtils.getShapeCenter(s); const rot = s.rotation || 0;
        const dx = p.x - c.x; const dy = p.y - c.y;
        const lx = dx * Math.cos(-rot) - dy * Math.sin(-rot) + c.x; const ly = dx * Math.sin(-rot) + dy * Math.cos(-rot) + c.y;
        const handleY = (s.h > 0 ? -s.h/2 : s.h/2) - ROTATION_HANDLE_OFFSET;
        if ((lx - c.x)*(lx - c.x) + ((ly - c.y) - handleY)*((ly - c.y) - handleY) < (TOUCH_RAD * TOUCH_RAD)) return 5; 
        if (Math.hypot(lx - s.x, ly - s.y) < TOUCH_RAD) return 1; 
        if (Math.hypot(lx - (s.x+s.w), ly - s.y) < TOUCH_RAD) return 2;
        if (Math.hypot(lx - (s.x+s.w), ly - (s.y+s.h)) < TOUCH_RAD) return 3; 
        if (Math.hypot(lx - s.x, ly - (s.y+s.h)) < TOUCH_RAD) return 4;
        if (Math.hypot(lx - (s.x+s.w/2), ly - (s.y+s.h/2)) < TOUCH_RAD) return 6;
    }
    return 0;
}

function hitTest(p) {
    const HIT_PAD = 20; 
    for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i];
        if (s.type === 'eraser-stroke' || s.type === 'ocr-selection') continue;
        if (s.type === 'text') {
            ctx.save(); ctx.font = s.font; ctx.textBaseline = 'top'; const h = parseInt(s.font) || 20; const m = ctx.measureText(s.text); ctx.restore();
            const tx = s.w < 0 ? s.x + s.w : s.x; const tw = Math.abs(s.w > 0 ? s.w : m.width); 
            if (p.x >= tx && p.x <= tx + tw && p.y >= s.y && p.y <= s.y + h) return s;
        } 
        else if (['pen', 'polygon'].includes(s.type)) { 
             const b = MathUtils.getBoundingBox(s); 
             if (p.x >= b.x - HIT_PAD && p.x <= b.x+b.w + HIT_PAD && p.y >= b.y - HIT_PAD && p.y <= b.y+b.h + HIT_PAD) return s;
        } 
        else if (['line', 'arrow'].includes(s.type)) {
             const hitThreshold = Math.max(HIT_PAD, s.width * 1.5);
             if (s.cp) {
                 if (MathUtils.pointToCurveDist(p, s.x, s.y, s.cp, s.ex, s.ey) < hitThreshold) return s;
                 if (Math.hypot(p.x - s.cp.x, p.y - s.cp.y) < hitThreshold) return s;
             } else { if (MathUtils.pointToLineDist(p, {x:s.x, y:s.y}, {x:s.ex, y:s.ey}) < hitThreshold) return s; }
        } 
        else if (s.type === 'stamp') {
             const radius = s.w/2; const cx = s.x + radius; const cy = s.y + radius;
             if (Math.hypot(p.x - cx, p.y - cy) < radius) return s;
             if (s.ex !== undefined && MathUtils.pointToLineDist(p, {x: cx, y: cy}, {x: s.ex, y: s.ey}) < 8) return s;
        } 
        else {
            const c = MathUtils.getShapeCenter(s); const rot = s.rotation || 0;
            const dx = p.x - c.x; const dy = p.y - c.y;
            const lx = dx * Math.cos(-rot) - dy * Math.sin(-rot) + c.x; const ly = dx * Math.sin(-rot) + dy * Math.cos(-rot) + c.y;
            const rX = s.w < 0 ? s.x + s.w : s.x; const rY = s.h < 0 ? s.y + s.h : s.y; const rW = Math.abs(s.w); const rH = Math.abs(s.h);
            if (lx >= rX && lx <= rX + rW && ly >= rY && ly <= rY + rH) return s;
        }
    }
    return null;
}

function calculateDrawingSnap(p) {
    const gridEl = document.getElementById('grid');
    if (!userSettings.showSmartGuides || !(gridEl && !gridEl.classList.contains('hidden'))) return p;

    let newX = p.x; let newY = p.y; let snappedX = false; let snappedY = false;
    const getBox = (s) => {
        let bx = s.x || 0, by = s.y || 0, bw = s.w || 0, bh = s.h || 0;
        if (s.points && s.points.length > 0) {
            let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity; 
            s.points.forEach(pt => { minX=Math.min(minX, pt.x); maxX=Math.max(maxX, pt.x); minY=Math.min(minY, pt.y); maxY=Math.max(maxY, pt.y); });
            bx += minX; by += minY; bw = maxX-minX; bh = maxY-minY;
        }
        if (bw < 0) { bx += bw; bw = Math.abs(bw); } if (bh < 0) { by += bh; bh = Math.abs(bh); }
        return { l: bx, c: bx + bw/2, r: bx + bw, t: by, m: by + bh/2, b: by + bh };
    };

    shapes.forEach(s => {
        if (s === activeShape) return; 
        const b = getBox(s);
        if (!snappedX) [b.l, b.c, b.r].forEach(t => { if (Math.abs(newX - t) < 15) { newX = t; snappedX = true; snapLines.push({ x1: t, y1: -100000, x2: t, y2: 100000 }); } });
        if (!snappedY) [b.t, b.m, b.b].forEach(t => { if (Math.abs(newY - t) < 15) { newY = t; snappedY = true; snapLines.push({ x1: -100000, y1: t, x2: 100000, y2: t }); } });
    });
    return { x: newX, y: newY };
}

function calculateSmartSnaps(active) {
    snapLines = []; 
    if (!active || active.type === 'pen' || active.type === 'eraser-stroke') return; 
    const gridEl = document.getElementById('grid');
    if (!(gridEl && !gridEl.classList.contains('hidden'))) return;

    const getSafeBox = (s) => {
        let bx = s.x || 0, by = s.y || 0, bw = s.w || 0, bh = s.h || 0;
        if (s.points && s.points.length > 0) {
            let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity; 
            s.points.forEach(p => { minX=Math.min(minX, p.x); maxX=Math.max(maxX, p.x); minY=Math.min(minY, p.y); maxY=Math.max(maxY, p.y); });
            bx += minX; by += minY; bw = maxX-minX; bh = maxY-minY;
        }
        if (bw < 0) { bx += bw; bw = Math.abs(bw); } if (bh < 0) { by += bh; bh = Math.abs(bh); }
        return { l: Math.round(bx), c: Math.round(bx + bw/2), r: Math.round(bx + bw), t: Math.round(by), m: Math.round(by + bh/2), b: Math.round(by + bh) };
    };

    const a = getSafeBox(active);
    const targets = [{ val: a.l, type: 'v' }, { val: a.c, type: 'v' }, { val: a.r, type: 'v' }, { val: a.t, type: 'h' }, { val: a.m, type: 'h' }, { val: a.b, type: 'h' }];
    let snappedX = false; let snappedY = false;

    shapes.forEach(s => {
        if (s === active) return; 
        const b = getSafeBox(s);
        const matchPoints = [{ val: b.l, type: 'v' }, { val: b.c, type: 'v' }, { val: b.r, type: 'v' }, { val: b.t, type: 'h' }, { val: b.m, type: 'h' }, { val: b.b, type: 'h' }];

        matchPoints.forEach(mp => {
            targets.forEach(t => {
                if (t.type === mp.type && Math.abs(t.val - mp.val) < 25) {
                    if (t.type === 'v') {
                        if (!snappedX) { const diff = mp.val - t.val; active.x += diff; if(active.ex !== undefined) active.ex += diff; if(active.cp) active.cp.x += diff; snappedX = true; }
                        snapLines.push({ x1: mp.val, y1: -50000, x2: mp.val, y2: 50000 });
                    } else {
                        if (!snappedY) { const diff = mp.val - t.val; active.y += diff; if(active.ey !== undefined) active.ey += diff; if(active.cp) active.cp.y += diff; snappedY = true; }
                        snapLines.push({ x1: -50000, y1: mp.val, x2: 50000, y2: mp.val });
                    }
                }
            });
        });
    });
}

// =====================================================================
// CHAPTER 6: STATE & HISTORY MANAGEMENT
// =====================================================================

function changeLayerOrder(direction) {
    if (!selectedShape || selectedShape.isGroup) return;
    const index = shapes.indexOf(selectedShape);
    if (index === -1) return;
    let newIndex = Math.max(0, Math.min(shapes.length - 1, index + direction));
    if (newIndex !== index) {
        shapes.splice(index, 1);
        shapes.splice(newIndex, 0, selectedShape);
        saveState(); renderMain();
    }
}

function saveState() {
    const settingsModal = document.getElementById('settings-modal');
    const wizardModal = document.getElementById('onboarding-wizard');
    if ((settingsModal && settingsModal.style.display === 'flex') || 
        (wizardModal && wizardModal.classList.contains('show')) || 
        preWizardW > 0) return;

    const isCentered = (frame.style.position === '' || frame.style.position === 'relative');
    const currentState = {
        shapes: JSON.parse(JSON.stringify(shapes)), 
        w: w, h: h, x: frame.offsetLeft, y: frame.offsetTop, isCentered: isCentered 
    };

    if (historyIndex >= 0 && historyStack[historyIndex]) {
        const lastState = historyStack[historyIndex];
        const isSameMeta = lastState.w === w && lastState.h === h && lastState.x === frame.offsetLeft && lastState.y === frame.offsetTop;
        const countChanged = currentState.shapes.length !== lastState.shapes.length;
        if (isSameMeta && !countChanged) {
            if (JSON.stringify(currentState.shapes) === JSON.stringify(lastState.shapes)) return; 
        }
    }

    historyIndex++;
    historyStack = historyStack.slice(0, historyIndex); 
    historyStack.push(currentState);
    if (historyStack.length > 50) { historyStack.shift(); historyIndex--; }
    updateHistoryButtons();
}

function updateHistoryButtons() { 
    const ac = 'active-history-btn'; 
    const uBtn = document.getElementById('fb-undo'); const rBtn = document.getElementById('fb-redo');
    if (historyIndex > 0) { btnUndo.classList.add(ac); if(uBtn) uBtn.classList.add(ac); } 
    else { btnUndo.classList.remove(ac); if(uBtn) uBtn.classList.remove(ac); } 
    if (historyIndex < historyStack.length - 1) { btnRedo.classList.add(ac); if(rBtn) rBtn.classList.add(ac); } 
    else { btnRedo.classList.remove(ac); if(rBtn) rBtn.classList.remove(ac); } 
}

function restoreState(state) {
    let targetShapes = Array.isArray(state) ? state : state.shapes;
    shapes = JSON.parse(JSON.stringify(targetShapes));
    if (!Array.isArray(state)) {
        const targetX = state.x !== undefined ? state.x : frame.offsetLeft;
        const targetY = state.y !== undefined ? state.y : frame.offsetTop;
        if (state.isCentered) {
            frame.style.position = ''; frame.style.left = ''; frame.style.top = ''; frame.style.margin = '0 auto'; frame.style.transform = ''; 
            if(frame.parentElement) { frame.parentElement.style.justifyContent = 'center'; frame.parentElement.style.alignItems = 'center'; }
        } else {
            frame.style.position = 'absolute'; frame.style.margin = '0'; frame.style.left = targetX + 'px'; frame.style.top = targetY + 'px';
        }
        if (state.w !== w || state.h !== h) {
            isSuppressingResize = true;
            if (typeof updateCanvasSize === 'function') updateCanvasSize(state.w, state.h, true); 
            if(inpW) inpW.value = state.w; if(inpH) inpH.value = state.h;
            if (!isFullscreen) window.electronAPI.send('resize-window', { width: state.w + (typeof UI_W_OFFSET !== 'undefined' ? UI_W_OFFSET : 120), height: state.h + (typeof UI_H_OFFSET !== 'undefined' ? UI_H_OFFSET : 110) });
            setTimeout(() => { isSuppressingResize = false; }, 200);
        }
    }
    selectedShape = null; updateHistoryButtons(); renderMain();
}

let lastHistoryTime = 0; 
function undo() { const now = Date.now(); if (now - lastHistoryTime < 250) return; lastHistoryTime = now; if(historyIndex > 0) { historyIndex--; restoreState(historyStack[historyIndex]); } }
function redo() { const now = Date.now(); if (now - lastHistoryTime < 250) return; lastHistoryTime = now; if(historyIndex < historyStack.length - 1) { historyIndex++; restoreState(historyStack[historyIndex]); } }

// =====================================================================
// CHAPTER 7: CORE ACTIONS & EXPORT
// =====================================================================

const doDelete = () => { 
    shapes = []; selectedShape = null; polygonPoints = []; activeShape = null;
    if (typeof clearBackground === 'function') clearBackground();
    const handles = document.querySelectorAll('#frame > .text-wrapper'); 
    handles.forEach(h => h.remove()); activeTextWrapper = null;
    if (typeof saveState === 'function') saveState(); 
    const cursorBtn = document.querySelector('.tool-btn[data-t="cursor"]');
    if(cursorBtn) cursorBtn.click();
    if (typeof renderMain === 'function') renderMain();
};

const doSnap = async () => {
    if (activeTextWrapper) commitActiveText();
    
    if (selectedShape || activeShape) {
        selectedShape = null;
        activeShape = null;
        renderMain(); 
    }
    
    const finalizeSnap = async () => {
        if (userSettings.autoClipboard) {
            await doClipboard();
            showToast("Selection Snapped & Copied!", 1500);
        } else {
            showToast("Selection snapped!"); 
        }
    };

    if (isFullscreen && isWGCFrozen && capturedImage) {
        const rect = frame.getBoundingClientRect();
        w = rect.width; h = rect.height;
        if (typeof updateCanvasSize === 'function') updateCanvasSize(w, h, true); 
        frame.classList.remove('clean-slate'); 
        hasSnappedInFullscreen = true; 
        renderMain(); 
        await finalizeSnap();
        return; 
    }

    try {
        const result = await window.electronAPI.invoke('capture-window-mode-wgc');
        
        if (result && result.error) {
            showToast("Capture Error: " + result.error);
            return;
        }

        if (result && result.success) {
            const base64 = result.base64;
            const img = new Image();
            img.onload = async () => {
    const canvasRect = canvas.getBoundingClientRect();
    const scale = await window.electronAPI.invoke('get-scale-factor');
    const winPos = await window.electronAPI.invoke('get-window-pos');

    // Precision calculation for high-DPI monitors
    const relX = (winPos.x + canvasRect.left) * scale;
    const relY = (winPos.y + canvasRect.top) * scale;
    const relW = canvasRect.width * scale;
    const relH = canvasRect.height * scale;
    
    bgCtx.setTransform(1, 0, 0, 1, 0, 0); 
    bgCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
    
    // Draw using the scaled coordinates
    bgCtx.drawImage(img, Math.round(relX), Math.round(relY), Math.round(relW), Math.round(relH), 0, 0, backgroundCanvas.width, backgroundCanvas.height);
    
    bgCtx.scale(dpr, dpr);
    saveState(); 
    renderMain(); 
    finalizeSnap();
};
            img.src = base64;
        }
    } catch (e) {
        showToast("Snap IPC error.");
    }
};

const doClipboard = async () => {
    try {
        if(activeTextWrapper) commitActiveText();
        const buffer = await ExportManager.getFinalImageData(backgroundCanvas.width, backgroundCanvas.height, true, shapes, backgroundCanvas, dpr, userSettings, AppFeatures, drawShape);
        
        if (window.electronAPI.writeImage) {
            window.electronAPI.writeImage(buffer);
        } else if (window.electronAPI.send) {
            window.electronAPI.send('clipboard-write-image', buffer);
        }
        return true;
    } catch (e) {
        console.error("Auto-copy failed", e);
        return false;
    }
};

const doSave = async (e) => {
    if(activeTextWrapper) commitActiveText();
    let dataURL;
    if (isWGCFrozen && isFullscreen && capturedImage) {
        const tempCanvas = document.createElement('canvas'); const tempCtx = tempCanvas.getContext('2d');
        const rect = frame.getBoundingClientRect();
        tempCanvas.width = Math.round(rect.width * dpr); tempCanvas.height = Math.round(rect.height * dpr);
        tempCtx.drawImage(capturedImage, Math.round(rect.left * dpr), Math.round(rect.top * dpr), tempCanvas.width, tempCanvas.height, 0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, 0);
        dataURL = tempCanvas.toDataURL('image/png');
    } else {
        dataURL = canvas.toDataURL('image/png');
    }

    let saveFolder = userSettings.savePath?.trim() || null;
    const shiftHeld = (e && e.shiftKey === true);

    try {
        const saveResult = await window.electronAPI.invoke('save-image', dataURL, {
            format: userSettings.imageFormat || 'image/png', folder: saveFolder, filename: ExportManager.getFilename(userSettings, AppFeatures, sequenceCounter, backgroundCanvas.width, backgroundCanvas.height), forceDialog: shiftHeld
        });
        
        if (saveResult === true) {
            // THE FIX: Removed the broken AppFeatures check. If the setting contains {seq}, we increment!
            if (userSettings.filenameFmt && userSettings.filenameFmt.includes('{seq}')) { 
                sequenceCounter++; 
                saveSettings(); 
            }
            
            showToast(saveFolder && !shiftHeld ? "Auto-Saved to Folder" : "Capture Saved");
            doDelete(); 
            if (isFullscreen) { frame.style.display = 'none'; hasSnappedInFullscreen = false; }
            return true;
        }
    } catch (err) { 
        console.error("Save failed:", err); 
        showToast("Error saving image."); 
    }
    return false;
};

async function enterFullscreenMode(providedBase64 = null) {
    isSuppressingResize = true;
    
    const frameEl = document.getElementById('frame');
    if (frameEl) {
        frameEl.style.display = 'none';
        frameEl.style.left = '-9999px';
        frameEl.style.top = '-9999px';
        frameEl.classList.add('clean-slate');
    }
    document.body.classList.add('fullscreen');

    const backdrop = document.getElementById('backdrop-img');
    if (backdrop) { backdrop.style.display = 'block'; backdrop.style.opacity = '1'; }
    
    let base64 = providedBase64;
    if (!base64) {
        base64 = await window.electronAPI.invoke('start-fullscreen-capture');
    }
    
    if (!base64) {
        isSuppressingResize = false;
        return;
    }

    const img = new Image();
    // Inside enterFullscreenMode()
img.onload = () => {
    capturedImage = img; 
    window.electronAPI.send('set-window-opacity', 1);
    
    if (backdrop) {
        backdrop.src = base64;
        backdrop.style.zIndex = "1";
        backdrop.style.pointerEvents = 'none'; 
        backdrop.style.width = '100vw';   // Ensures 200% scale fit
        backdrop.style.height = '100vh';  // Ensures 200% scale fit
        backdrop.style.objectFit = 'fill';
    }

    isFullscreen = true;
    isWGCFrozen = true;
    isCreatingFrame = false; 
    hasSnappedInFullscreen = false;

    // ADD THIS TIMEOUT WRAPPER
    setTimeout(() => {
        w = window.innerWidth;
        h = window.innerHeight;
        if(inpW) inpW.value = w;
        if(inpH) inpH.value = h;
        updateCanvasSize(w, h, true); 

        if (frameEl) {
            frameEl.style.display = 'block'; 
            frameEl.style.width = '0px';
            frameEl.style.height = '0px';
            frameEl.classList.remove('clean-slate');
        }

        if (floatingBar) floatingBar.classList.remove('hidden');
        const snapBtn = document.getElementById('fb-snap');
        if (snapBtn) snapBtn.style.display = 'none';

        tool = 'cursor';
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        const curBtn = document.querySelector('.tool-btn[data-t="cursor"]');
        if(curBtn) curBtn.classList.add('active');

        if (typeof doDelete === 'function') doDelete();
        
        isSuppressingResize = false;
        window.electronAPI.send('renderer-content-ready');
    }, 50); // Give Windows time to stretch the window
};
    img.src = base64;
}

function exitFullscreen() { 
    isFullscreen = false; 
    isCreatingFrame = false; 
    
    document.body.classList.remove('fullscreen'); 
    floatingBar.classList.add('hidden'); 
    
    frame.classList.remove('clean-slate'); 
    frame.style.display = 'block'; 
    frame.style.border = `2px dashed ${userSettings.accentColor}`; 
    winResizeGrip.style.display = 'flex'; 
    
    resetFramePosition();
}

function updateCanvasSize(newW, newH, keepPosition = false) {
    updateDPR();
    w = Math.round(newW); h = Math.round(newH);
    const innerW = w * dpr; const innerH = h * dpr;
    
    [canvas, backgroundCanvas, scratchCanvas, shapeLayerCanvas].forEach(c => { 
        c.width = innerW; c.height = innerH; 
        
        // --- NEW: RESET INLINE CSS ---
        c.style.width = w + 'px';
        c.style.height = h + 'px';
        c.style.left = '0px';
        c.style.top = '0px';
    });
    [ctx, bgCtx, scratchCtx, shapeLayerCtx].forEach(c => { 
        c.setTransform(1, 0, 0, 1, 0, 0); c.scale(dpr, dpr); 
        c.imageSmoothingEnabled = false; 
    });
    
    frame.style.width = w + 'px'; 
    frame.style.height = h + 'px'; 
    frame.style.outline = `2px dashed ${userSettings.accentColor}`; 
    frame.style.outlineOffset = '0px';

    if (isWGCFrozen && capturedImage) {
        const rect = frame.getBoundingClientRect();
        const srcX = Math.round(rect.left * dpr); const srcY = Math.round(rect.top * dpr);
        const srcW = Math.round(w * dpr); const srcH = Math.round(h * dpr);
        bgCtx.save(); bgCtx.setTransform(1, 0, 0, 1, 0, 0); 
        bgCtx.drawImage(capturedImage, srcX, srcY, srcW, srcH, 0, 0, innerW, innerH);
        bgCtx.restore();
    }
    renderMain();
}

function initCanvas() {
    if(inpW) inpW.value = w; if(inpH) inpH.value = h;
    updateDPR();
    const innerW = w * dpr; const innerH = h * dpr;

    [canvas, backgroundCanvas, scratchCanvas, shapeLayerCanvas].forEach(c => { 
        c.width = innerW; c.height = innerH; 
        
        // --- NEW: RESET INLINE CSS ---
        c.style.width = w + 'px';
        c.style.height = h + 'px';
        c.style.left = '0px';
        c.style.top = '0px';
    });
    
    [canvas, backgroundCanvas, scratchCanvas, shapeLayerCanvas].forEach(c => { c.width = innerW; c.height = innerH; });
    [ctx, bgCtx, scratchCtx, shapeLayerCtx].forEach(c => { 
        c.setTransform(1, 0, 0, 1, 0, 0); c.scale(dpr, dpr); 
        c.lineCap = userSettings.cornerStyle; c.lineJoin = userSettings.cornerStyle; c.imageSmoothingEnabled = false; 
    });
    
    frame.style.width = w + 'px'; frame.style.height = h + 'px'; frame.style.margin = '0 auto';
    
    if (!isFullscreen) {
        frame.style.display = 'block'; 
        frame.classList.remove('clean-slate', 'immersive-active'); 
        frame.style.outline = `2px dashed ${userSettings.accentColor}`; 
    }
    
    if (typeof saveState === 'function') saveState(); 
}

function updateDPR() { dpr = window.devicePixelRatio || 1; }

function resetFramePosition() { 
    frame.style.position = ''; frame.style.left = ''; frame.style.top = ''; frame.style.transform = ''; frame.style.margin = '0'; 
    if(frame.parentElement) { frame.parentElement.style.justifyContent = 'center'; frame.parentElement.style.alignItems = 'center'; }
}

// =====================================================================
// CHAPTER 8: TOOL & UI LOGIC
// =====================================================================

function createTextInput(frameRelX, frameRelY, initialText = "", forcedColor = null) {
    if(activeTextWrapper) commitActiveText();
    selectedShape = null; renderMain();
    
    const wrapper = document.createElement('div'); wrapper.className = 'text-wrapper'; 
    wrapper.style.left = frameRelX + 'px'; wrapper.style.top = frameRelY + 'px'; 
    
    const handle = document.createElement('div'); handle.className = 'text-handle';
    handle.onpointerdown = (e) => { 
        e.preventDefault(); e.stopPropagation(); isDraggingText = true; 
        const wrapperRect = wrapper.getBoundingClientRect(); dragOffsetX = e.clientX - wrapperRect.left; dragOffsetY = e.clientY - wrapperRect.top; 
        handle.style.cursor = 'grabbing'; handle.setPointerCapture(e.pointerId); 
    };
    
    const inputContainer = document.createElement('div'); inputContainer.className = 'input-container';
    const inp = document.createElement('input'); inp.className = 'float-input';
    inp.setAttribute('spellcheck', 'true'); if (AppFeatures && AppFeatures.type === 'pro') inp.lang = 'en-US';
    
    const sizer = document.createElement('span'); sizer.className = 'text-sizer';
    const isBold = typeof btnBold !== 'undefined' && btnBold.classList.contains('active'); 
    const isItalic = typeof btnItalic !== 'undefined' && btnItalic.classList.contains('active');
    const fSize = (typeof sizeSl !== 'undefined' ? sizeSl.value : 4) * 5; 
    const fFam = typeof fontFam !== 'undefined' ? fontFam.value : 'Arial';
    const constructedFont = `${isItalic?'italic':''} ${isBold?'bold':''} ${fSize}px ${fFam}`;
    
    inp.style.font = constructedFont; sizer.style.font = constructedFont; 
    inp.style.color = forcedColor || (typeof colorPk !== 'undefined' ? colorPk.value : '#000'); 
    inp.style.opacity = typeof opacitySl !== 'undefined' ? opacitySl.value : 1; 
    if (isShadow) inp.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)'; else inp.style.textShadow = 'none';
    inp.dataset.font = constructedFont; inp.value = initialText;
    
    const resize = () => { sizer.innerHTML = inp.value.replace(/ /g, '&nbsp;'); const w = sizer.getBoundingClientRect().width; inp.style.width = (Math.max(45, w+20))+'px'; };
    inp.addEventListener('input', resize); inp.addEventListener('keydown', (e) => { if(e.key==='Enter') commitActiveText(); });
    
    const frameEl = document.getElementById('frame'); if(frameEl) frameEl.appendChild(wrapper); 
    wrapper.appendChild(handle); inputContainer.appendChild(sizer); inputContainer.appendChild(inp); wrapper.appendChild(inputContainer); 
    activeTextWrapper = wrapper; setTimeout(() => inp.focus(), 10); resize();
}

function commitActiveText() {
    if(!activeTextWrapper) return; 
    const inp = activeTextWrapper.querySelector('input');
    if(inp.value.trim() !== "") {
        const inpRect = inp.getBoundingClientRect(); 
        const canvasRect = canvas.getBoundingClientRect();
        
        let fontSize = 20; 
        const fontStyle = inp.style.font || inp.dataset.font || ''; 
        const match = fontStyle.match(/(\d+)px/); 
        if (match) fontSize = parseInt(match[1]);
        
        const vertGap = (inpRect.height - fontSize) / 2; 
        const yOffset = vertGap + (fontSize * 0.1); 
        const xOffset = 2;
        const textOpacity = inp.style.opacity || 1; 
        const textShadow = inp.style.textShadow !== 'none' && inp.style.textShadow !== '';
        
        const textShape = { 
            type: 'text', 
            text: inp.value, 
            x: (inpRect.left - canvasRect.left) + xOffset, 
            y: (inpRect.top - canvasRect.top) + yOffset, 
            font: fontStyle, 
            color: colorPk.value, 
            width: 0, 
            h: 0, 
            opacity: textOpacity, 
            hasShadow: textShadow 
        };
        
        shapes.push(textShape); 
        selectedShape = textShape; 
        saveState();
    }
    if(activeTextWrapper.parentNode) activeTextWrapper.parentNode.removeChild(activeTextWrapper);
    activeTextWrapper = null; 
    renderMain();
}

function finishPolygon() {
    if (polygonPoints.length < 3) return; 
    const newShape = { type: 'polygon', points: [...polygonPoints], color: colorPk.value, width: parseFloat(sizeSl.value), opacity: parseFloat(opacitySl.value), isSolid: fillStates['polygon'] || false, isDotted: isDotted, hasShadow: isShadow, isClosed: true, rotation: 0 };
    const b = MathUtils.getBoundingBox(newShape);
    newShape.points = newShape.points.map(p => ({ x: p.x - b.x, y: p.y - b.y }));
    newShape.x = b.x; newShape.y = b.y; newShape.w = b.w; newShape.h = b.h;
    shapes.push(newShape); selectedShape = newShape; polygonPoints = []; activeShape = null;
    saveState(); renderMain();
}

function updateSwatches() {
    const swatches = document.querySelectorAll('.swatch');
    if (originalPalette.length === 0) swatches.forEach(s => originalPalette.push(s.dataset.c));
    const activePalette = userSettings.useCustomSwatches ? userSettings.customColors : originalPalette;
    swatches.forEach((s, index) => {
        if (activePalette[index]) {
            s.style.backgroundColor = activePalette[index];
            s.dataset.c = activePalette[index];
        }
    });
    const settingInputs = document.querySelectorAll('.palette-picker');
    settingInputs.forEach((input, index) => {
        if (userSettings.customColors[index]) input.value = userSettings.customColors[index];
    });
}

function applySettingsToRuntime() {
    snapRadius = userSettings.magnetStrength === 'low' ? 10 : userSettings.magnetStrength === 'high' ? 40 : 20;
    angleSnapRad = (userSettings.angleSnap * Math.PI) / 180;
    
    const gridEl = document.getElementById('grid');
    if (gridEl) gridEl.style.backgroundImage = 'none';
    
    window.electronAPI.send('set-always-on-top', userSettings.alwaysOnTop);
    window.electronAPI.send('update-setting', { key: 'openAtLogin', value: userSettings.openAtLogin });
    window.electronAPI.send('update-setting', { key: 'globalHotkey', value: userSettings.globalHotkey });

    if (userSettings.immersiveMode) {
        const isHoveringUI = document.querySelector('.header:hover, .footer:hover');
        if (!isHoveringUI) {
            document.body.classList.add('immersive-active');
            frame.classList.add('immersive-active');
        }
    } else {
        document.body.classList.remove('immersive-active');
        frame.classList.remove('immersive-active');
    }

    if (typeof loadCustomFonts === 'function') loadCustomFonts();
    updateSwatches();

    // --- CURSOR LOGIC ---
    if(typeof tool !== 'undefined' && tool !== 'cursor') {
        const cDot = document.getElementById('cursor-dot');
        const frameEl = document.getElementById('frame');
        
        if(cDot && frameEl) {
            if(userSettings.cursorStyle === 'crosshair') {
                frameEl.style.cursor = 'crosshair';
                cDot.style.display = 'none';
            } else if (userSettings.cursorStyle === 'outline') {
                // ENFORCED: Brush Outline Mode
                frameEl.style.cursor = 'none';
                cDot.style.display = 'block';
                cDot.style.border = '1px solid #888888'; // Custom subtle gray border
                cDot.style.background = 'transparent';
                cDot.style.boxShadow = 'none';
            } else {
                // Standard Dot Mode
                frameEl.style.cursor = 'none';
                cDot.style.display = 'block';
                cDot.style.border = 'none';
                cDot.style.backgroundColor = (typeof colorPk !== 'undefined' ? colorPk.value : '#2e69a3');
            }
        }
    }

    if (sizeSl) {
        sizeSl.value = userSettings.defLineWidth;
        if (fbSizeSl) fbSizeSl.value = userSettings.defLineWidth;
    }
    
    if(typeof renderMain === 'function') renderMain();
    if(typeof updateStampBubble === 'function') updateStampBubble(false); 
    if(typeof updateArrowButtonIcon === 'function') updateArrowButtonIcon();
    
    if(typeof stampCounterValue !== 'undefined') stampCounterValue = userSettings.stampCount;
    if(typeof stampMode !== 'undefined') stampMode = userSettings.stampMode;
    if(typeof stampLetterCode !== 'undefined') stampLetterCode = userSettings.stampLetterCode;
    if(typeof currentStampSize !== 'undefined') currentStampSize = userSettings.stampDefaultSize;
    sequenceCounter = parseInt(userSettings.sequenceCounter);
    if(isNaN(sequenceCounter) || sequenceCounter < 1) sequenceCounter = 1;
    
refreshToolIcons();
}

function refreshToolIcons() {
    const shapeTools = ['star', 'polygon', 'check', 'triangle', 'x-shape'];
    if (shapeTools.includes(tool)) {
        if (typeof syncMultiShapeUI === 'function') syncMultiShapeUI(tool, fillStates[tool] || false);
    } else {
        const isPro = AppFeatures.type === 'pro';
        const defaultIcon = isPro ? 'polygon-default-button' : 'star';
        const defaultShapeHtml = `<img src="assets/icons/${defaultIcon}.png" class="icon-img" alt="Shapes">`;
        ['btn-multishape', 'fb-btn-multishape'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.innerHTML = defaultShapeHtml;
        });
    }

    if (AppFeatures.type === 'core') {
        const shapeBtn = document.getElementById('btn-multishape');
        const fbShapeBtn = document.getElementById('fb-multishape');
        if (shapeBtn && typeof getShapeIconHtml === 'function') shapeBtn.innerHTML = getShapeIconHtml('star', fillStates['star']);
        if (fbShapeBtn && typeof getShapeIconHtml === 'function') fbShapeBtn.innerHTML = getShapeIconHtml('star', fillStates['star']);
    }

    // THE FIX: Force the Eraser icon to sync every time the UI refreshes
    const brushIcon = 'assets/icons/eraser.png'; 
    const objectIcon = 'assets/icons/solid-eraser.png';
    document.querySelectorAll('.tool-btn[data-t="eraser"]').forEach(btn => {
        const img = btn.querySelector('.icon-img'); 
        if (img) img.src = (eraserMode === 'object') ? objectIcon : brushIcon;
        btn.classList.toggle('solid-mode', eraserMode === 'object');
    });

    if (typeof updateArrowButtonIcon === 'function') updateArrowButtonIcon();
}

function saveSettings() {
    userSettings.sequenceCounter = sequenceCounter;
    if(typeof stampMode !== 'undefined') userSettings.stampMode = stampMode;
    if(typeof stampCounterValue !== 'undefined') userSettings.stampCount = stampMode === 'number' ? stampCounterValue : defaultSettings.stampCount;
    if(typeof stampLetterCode !== 'undefined') userSettings.stampLetterCode = stampMode !== 'number' ? stampLetterCode : defaultSettings.stampLetterCode;
    if(typeof currentStampSize !== 'undefined') userSettings.stampDefaultSize = currentStampSize;

    try {
        localStorage.setItem('cs_settings', JSON.stringify(userSettings));
    } catch (e) {
        console.warn("LocalStorage full (likely due to custom fonts). Bypassing to HDD...");
    }
    
    window.electronAPI.send('save-app-config', userSettings);
    
    applySettingsToRuntime();
}

window.resetSection = (sectionCode) => {
    if (sectionCode === 'app-palette') {
        userSettings.customColors = [...defaultSettings.customColors]; 
        saveSettings(); return;
    }

    let keys = [];
    if(sectionCode==='gen-flow') keys=['globalHotkey','startupTool','immersiveMode', 'openAtLogin', 'showMeasurements'];
    if(sectionCode==='gen-win') keys=['startupW','startupH','startFullscreen','alwaysOnTop'];
    if(sectionCode==='draw-style') keys=['cursorStyle','arrowStyle','shadowBlur', 'shadowDistance'];
    if(sectionCode==='draw-shape') keys=['cornerStyle','dottedStyle','defLineWidth','highlighterOpacity', 'cornerRadius'];
    if(sectionCode==='draw-snap') keys=['magnetStrength','angleSnap','showSmartGuides'];
    if(sectionCode==='app-theme') keys=[]; 
    if(sectionCode==='app-grid') keys=['gridSize','gridOpacity'];
    if(sectionCode==='out-img') keys=['imageFormat','imageQuality','exportPadding','watermarkText'];
    if(sectionCode==='out-save') keys=['savePath','filenameFmt','autoClipboard'];

    keys.forEach(key => { if(defaultSettings[key] !== undefined) userSettings[key] = defaultSettings[key]; });
    saveSettings();
    
    keys.forEach(key => {
        const el = document.querySelector(`[data-setting="${key}"]`);
        if(el) { if(el.type==='checkbox') el.checked=userSettings[key]; else { el.value=userSettings[key]; el.dispatchEvent(new Event('input')); } }
    });

    if(keys.includes('globalHotkey')) window.electronAPI.send('update-setting', { key: 'globalHotkey', value: userSettings.globalHotkey });
    if(keys.includes('openAtLogin')) window.electronAPI.send('update-setting', { key: 'openAtLogin', value: userSettings.openAtLogin });
    if(typeof renderMain === 'function') renderMain();
};

window.updateArrowButtonIcon = function() {
    const style = userSettings.arrowStyle || 'v';
    let iconSrc = 'assets/open-v-arrow.png'; 
    let sizeStyle = ''; 
    if (style === 'v') iconSrc = 'assets/open-v-arrow.png';
    else if (style === 'hand') iconSrc = 'assets/hand-drawn-arrow.png'; 
    else if (style === 'triangle') iconSrc = 'assets/standard-arrow.png';
    else if (style === 'concave') iconSrc = 'assets/curved-arrow.png';
    else if (style === 'dot') iconSrc = 'assets/dot-arrow.png';
    const html = `<img src="${iconSrc}" class="icon-img" alt="Arrow" ${sizeStyle}>`;
    const mainBtn = document.getElementById('btn-arrow-multi');
    const fbBtn = document.getElementById('fb-btn-arrow-multi');
    if (mainBtn) mainBtn.innerHTML = html;
    if (fbBtn) fbBtn.innerHTML = html;
};

function updateRadiusBubbleUI() {
    if (!radiusBubble) return;
    if (AppFeatures.type !== 'pro') { radiusBubble.classList.add('hidden'); return; }
    if (tool === 'square' && userSettings.cornerStyle === 'round') {
        radiusBubble.classList.remove('hidden');
        radiusInput.value = userSettings.cornerRadius || 10;
        radiusVal.innerText = (userSettings.cornerRadius || 10) + 'px';
    } else { radiusBubble.classList.add('hidden'); }
}

function updateMeasureTooltip(x, y, text) {
    if (!userSettings.showMeasurements) { measureTip.style.display = 'none'; return; }
    measureTip.style.display = 'block'; measureTip.style.left = x + 'px'; measureTip.style.top = y + 'px'; measureTip.innerHTML = text;
}
function hideMeasureTooltip() { measureTip.style.display = 'none'; }

function setInputValues(width, height) { if(inpW) inpW.value = width; if(inpH) inpH.value = height; }
const syncVal = (src, dst) => { if(src && dst) dst.value = src.value; };

function pickColorAt(x, y) {
    if (backgroundCanvas.width === 0) { showToast("Please SNAP first!"); return; }
    
    let targetX = x; 
    let targetY = y;
    
    if (targetX < 0 || targetY < 0 || targetX > w || targetY > h) return;

    // THE FIX: Floor the coordinate and add 0.5 to target the geometric CENTER of the pixel
    const centerX = Math.floor(targetX * dpr) + 0.5;
    const centerY = Math.floor(targetY * dpr) + 0.5;

    const getHex = (dx, dy) => {
        // We use Math.floor here because getImageData expects integer coordinates, 
        // but our dx/dy center-offset ensures we are sampling the correct pixel area.
        const ink = ctx.getImageData(Math.floor(dx), Math.floor(dy), 1, 1).data;
        if (ink[3] > 0) return "#" + ((1 << 24) + (ink[0] << 16) + (ink[1] << 8) + ink[2]).toString(16).slice(1);
        
        const bg = bgCtx.getImageData(Math.floor(dx), Math.floor(dy), 1, 1).data;
        if (bg[3] === 0) return null; 
        return "#" + ((1 << 24) + (bg[0] << 16) + (bg[1] << 8) + bg[2]).toString(16).slice(1);
    };

    let finalHex = getHex(centerX, centerY);
    if (!finalHex) {
        // If the center is transparent, check immediate integer neighbors
        const neighbors = [[0, -1], [-1, 0], [1, 0], [0, 1]];
        for (let offset of neighbors) { 
            finalHex = getHex(centerX + offset[0], centerY + offset[1]); 
            if (finalHex) break; 
        }
    }
    if (!finalHex) return; 

    colorPk.value = finalHex; 
    if (typeof updateStyle === 'function') updateStyle(); 
    if (typeof applyPropertyChange === 'function') applyPropertyChange('color', finalHex);
    
    // Sync the syringe visual state
    AdvancedTools.updateSyringeLiquid(finalHex, true, AppFeatures); 
    setTimeout(() => { 
        AdvancedTools.updateSyringeLiquid(finalHex, false, AppFeatures); 
    }, 150);
}

function injectTools(container) {
    if (!container) return;
    let btnDotted = document.createElement('button'); btnDotted.className = 'tool-btn'; btnDotted.title = 'Dotted Line'; btnDotted.innerHTML = '<img src="assets/icons/dotted-lines.png" class="icon-img" alt="Dotted">'; btnDotted.dataset.injected = "dotted"; btnDotted.id = container.id === 'floating-bar' ? 'fb-btn-dotted' : 'btn-dotted';
    let btnShadow = document.createElement('button'); btnShadow.className = 'tool-btn'; btnShadow.title = 'Drop Shadow'; btnShadow.innerHTML = '<img src="assets/icons/shadow.png" class="icon-img" alt="Shadow">'; btnShadow.dataset.injected = "shadow"; btnShadow.id = container.id === 'floating-bar' ? 'fb-btn-shadow' : 'btn-shadow';
    const anchor = container.querySelector('#footer-extra-tools') || container.querySelector('#fb-tools-dropdown') || container.querySelector('#grid-toggle') || container.querySelector('#fb-grid-toggle');
    if (anchor) { anchor.before(btnDotted); btnDotted.before(btnShadow); }
    return { btnDotted, btnShadow };
}

function updateToolbarSpatialState() {
    const fb = document.getElementById('floating-bar');
    if (!fb) return;

    const rect = fb.getBoundingClientRect();
    const threshold = window.innerHeight * 0.4; 

    if (rect.top < threshold) {
        fb.classList.add('at-top');
    } else {
        fb.classList.remove('at-top');
    }
}

function getNextStampValue() {
    if (stampMode === 'number') return (stampCounterValue++).toString();
    else if (stampMode === 'capital') { if (stampLetterCode >= 26) stampLetterCode = 0; const char = String.fromCharCode('A'.charCodeAt(0) + stampLetterCode); stampLetterCode++; return char; }
    else if (stampMode === 'small') { if (stampLetterCode >= 26) stampLetterCode = 0; const char = String.fromCharCode('a'.charCodeAt(0) + stampLetterCode); stampLetterCode++; return char; }
    return '1'; 
}

function getCurrentStampValue() {
    if (stampMode === 'number') return stampCounterValue.toString();
    else if (stampMode === 'capital') return String.fromCharCode('A'.charCodeAt(0) + stampLetterCode);
    else if (stampMode === 'small') return String.fromCharCode('a'.charCodeAt(0) + stampLetterCode);
    return '1';
}

function updateStampBubble(shouldSave = true) {
    if (tool === 'stamp') {
        stampBubble.classList.remove('hidden');
        const valEl = document.getElementById('stamp-current-value');
        if (valEl) { if (valEl.tagName === 'INPUT') valEl.value = getCurrentStampValue(); else valEl.innerHTML = getCurrentStampValue(); }
        
        if (stampMode === 'number') stampModeToggle.innerHTML = '<i class="fa-solid fa-list-ol"></i>';
        else if (stampMode === 'capital') stampModeToggle.innerHTML = '<span style="font-family:Arial, sans-serif; font-weight:bold; line-height:1;">A</span>';
        else stampModeToggle.innerHTML = '<span style="font-family:Arial, sans-serif; font-weight:bold; line-height:1;">a</span>';

        if (shouldSave) {
            userSettings.stampMode = stampMode;
            userSettings.stampCount = stampMode === 'number' ? stampCounterValue : defaultSettings.stampCount;
            userSettings.stampLetterCode = stampMode !== 'number' ? stampLetterCode : defaultSettings.stampLetterCode;
            userSettings.stampDefaultSize = currentStampSize;
            localStorage.setItem('cs_settings', JSON.stringify(userSettings));
        }
    } else {
        stampBubble.classList.add('hidden');
    }
}

function toggleStampMode() {
    if (stampMode === 'number') stampMode = 'capital';
    else if (stampMode === 'capital') stampMode = 'small';
    else stampMode = 'number';
    resetStampCounter(false); 
    updateStampBubble();
}

function resetStampCounter(showMsg = true) {
    if (stampMode === 'number') stampCounterValue = 1; else stampLetterCode = 0;
    updateStampBubble(); 
    if(showMsg) showToast(`Counter reset to ${getCurrentStampValue()}`);
}

function updateDynamicTooltip(el, text) { UIManager.updateTooltip(el, text); }

[colorTrigger, fbColorTrigger].forEach(btn => {
    if (!btn) return;
    
    // Right-click to set current color as default
    btn.oncontextmenu = (e) => {
        e.preventDefault();
        const activeColor = colorPk.value;
        userSettings.defaultColor = activeColor;
        
        // Save to HDD and notify user
        saveSettings();
        if (typeof showToast === 'function') showToast(`New default color: ${activeColor}`);
    };
});

function updateStyle() { 
    if (!isWGCFrozen && frame.classList.contains('clean-slate')) {
        frame.classList.remove('clean-slate');
    }
    if(colorTrigger) colorTrigger.style.backgroundColor = colorPk.value; 
    if(fbColorTrigger) fbColorTrigger.style.backgroundColor = colorPk.value; 
    
    [sizeDot, fbSizeDot].forEach(d => { 
        if(!d) return;
        const sizeVal = parseFloat(sizeSl.value);
        d.style.width = '20px'; 
        d.style.height = '20px';
        d.style.transform = `scale(${sizeVal / 20})`;
        d.style.opacity = opacitySl.value; 
        
        // THE FIX: Use the active color picker value instead of userSettings.accentColor
        d.style.backgroundColor = colorPk.value; 
        
        updateDynamicTooltip(d, sizeVal + ' px');
    });
    
    const sizeLabel = `Size: ${sizeSl.value}px`;
    updateDynamicTooltip(sizeSl, sizeLabel); updateDynamicTooltip(fbSizeSl, sizeLabel);
    const opacityLabel = `Opacity: ${Math.round(opacitySl.value * 100)}%`;
    updateDynamicTooltip(opacitySl, opacityLabel); updateDynamicTooltip(fbOpacitySl, opacityLabel);

    // --- Inside updateStyle in renderer.js ---
if(cursorDot) {
    cursorDot.style.width = sizeSl.value + 'px'; 
    cursorDot.style.height = sizeSl.value + 'px';
    
    if (tool === 'eraser' && eraserMode === 'brush') {
        cursorDot.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'; 
        cursorDot.style.border = '1px solid #ffffff';
        // THE FIX: Change the outer shadow ring to your subtle gray
        cursorDot.style.boxShadow = '0 0 0 1px #888888'; 
    } 
    else if(userSettings.cursorStyle === 'outline') {
        cursorDot.style.backgroundColor = 'transparent'; 
        // THE FIX: Update the standard outline cursor to match
        cursorDot.style.border = '1px solid #888888'; 
        cursorDot.style.boxShadow = 'none';
    } else {
        cursorDot.style.backgroundColor = colorPk.value; 
        cursorDot.style.border = 'none';
        cursorDot.style.boxShadow = 'none';
    }
}
    AdvancedTools.updateSyringeLiquid(colorPk.value, false, AppFeatures);
}

const applyPropertyChange = (prop, value) => { 
    updateStyle(); 
    if (activeTextWrapper) { 
        const currentInput = activeTextWrapper.querySelector('input');
        if (currentInput) {
            if (prop === 'color') { currentInput.style.color = value; if (typeof updateSyringeLiquid === 'function') updateSyringeLiquid(value); }
            if (prop === 'opacity') currentInput.style.opacity = value;
            if (prop === 'shadow') currentInput.style.textShadow = value ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none';
            
            const isBold = btnBold.classList.contains('active'); 
            const isItalic = btnItalic.classList.contains('active');
            const sizeVal = prop === 'width' ? value : sizeSl.value;
            
            // THE FIX: Extract current font family from the input's dataset so it doesn't default to Arial
            let currentFam = fontFam.value;
            if (currentInput.dataset.font) {
                currentFam = currentInput.dataset.font.replace(/italic|bold|\d+px/g, '').trim() || fontFam.value;
            }
            const fontFamVal = prop === 'fontFamily' ? value : currentFam;
            
            const newFont = `${isItalic?'italic':''} ${isBold?'bold':''} ${(sizeVal * 5)}px ${fontFamVal}`;
            
            currentInput.style.font = newFont; currentInput.dataset.font = newFont; 
            const sizer = activeTextWrapper.querySelector('.text-sizer'); if(sizer) sizer.style.font = newFont;
            currentInput.dispatchEvent(new Event('input')); 
            setTimeout(() => currentInput.focus(), 10);
        }
    }
    else if (selectedShape) { 
        if(selectedShape.type === 'text') {
            if(prop === 'color') selectedShape.color = value;
            else if (prop === 'opacity') selectedShape.opacity = value;
            else if (prop === 'shadow') selectedShape.hasShadow = value;
            
            if(prop === 'fontFamily' || prop === 'fontStyle' || prop === 'width') {
                 const isBold = btnBold.classList.contains('active'); const isItalic = btnItalic.classList.contains('active');
                 const sizeMatch = selectedShape.font.match(/(\d+)px/);
                 let currentShapeSize = sizeMatch ? sizeMatch[1] / 5 : sizeSl.value; 
                 const newSize = prop === 'width' ? value : currentShapeSize;
                 
                 // THE FIX: Extract existing font from the shape, so we don't overwrite it
                 const existingFam = selectedShape.font.replace(/italic|bold|\d+px/g, '').trim();
                 const newFontFam = prop === 'fontFamily' ? value : existingFam;
                 
                 selectedShape.font = `${isItalic?'italic':''} ${isBold?'bold':''} ${newSize * 5}px ${newFontFam}`;
            }
        }
        else if (selectedShape.type === 'arrow' && prop === 'arrowStyle') {
            selectedShape.arrowStyle = value;
        }
        else if(selectedShape.isGroup) { 
            shapes.forEach(s => s[prop] = value); 
        } 
        else { 
            selectedShape[prop] = value; 
        }
        
        if (typeof saveState === 'function') saveState(); 
        if (typeof renderMain === 'function') renderMain(); 
    } 
};

function getShapeIconHtml(type, isSolid) {
    let base = type;
    if (type === 'polygon') base = 'polygon-default-button';
    const suffix = isSolid ? '-filled' : '';
    return `<img src="assets/icons/${base}${suffix}.png" class="icon-img" alt="${type}">`;
}

function syncMultiShapeUI(type, isSolid) {
    const html = getShapeIconHtml(type, isSolid);
    ['btn-multishape', 'fb-btn-multishape'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) { btn.innerHTML = html; btn.dataset.t = type; if (tool === type) btn.classList.add('active'); else btn.classList.remove('active'); }
    });
}

function applyEraserCursor() {
    if (eraserMode === 'object') {
        const eraserSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32' style='filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.4));'><path d='M10 28 L2 20 L20 2 L28 10 Z' fill='%23ffffff' stroke='%23000000' stroke-width='2'/><path d='M8 22 L22 8' stroke='%23000000' stroke-width='1'/></svg>";
        frame.style.cursor = `url("${eraserSvg}") 2 28, auto`; 
        if (cursorDot) cursorDot.style.display = 'none';
    } else {
        frame.style.cursor = 'none'; 
        if (cursorDot) { 
            cursorDot.style.display = 'block'; 
            // Delegate styling to updateStyle so the dual-stroke is applied properly
            updateStyle(); 
        }
    }
}

const handleToolClick = (btn) => {
    document.body.classList.remove('force-no-cursor');
    const frameEl = document.getElementById('frame');
    if (frameEl) frameEl.classList.remove('cursor-eyedropper', 'cursor-crosshair');
    if (typeof virtualSyringe !== 'undefined' && virtualSyringe) virtualSyringe.style.display = 'none';
    if (typeof microLens !== 'undefined' && microLens) microLens.style.display = 'none';
    if (typeof virtualStamp !== 'undefined' && virtualStamp) virtualStamp.style.display = 'none';

    ['fb-tools-menu', 'fb-shape-menu', 'fb-arrow-menu', 'arrow-menu', 'shape-menu', 'footer-extras-menu'].forEach(id => {
        const el = document.getElementById(id); if (el) el.classList.remove('show');
    });

    if (btn.id === 'undo' || btn.id === 'fb-undo') { if(typeof undo === 'function') undo(); return; }
    if (btn.id === 'redo' || btn.id === 'fb-redo') { if(typeof redo === 'function') redo(); return; }
    if (btn.dataset.t === 'bring-forward') { changeLayerOrder(1); return; }
    if (btn.dataset.t === 'send-backward') { changeLayerOrder(-1); return; }

    if (isHighlighter && btn.dataset.t && btn.dataset.t !== 'line') {
        isHighlighter = false; colorPk.value = previousColor;
        document.querySelectorAll('.tool-btn[data-t="line"]').forEach(b => {
            b.classList.remove('highlighter-mode');
            b.innerHTML = '<img src="assets/icons/line.png" class="icon-img" alt="Line">';
            b.title = "Line Tool (Right-Click for Highlighter)";
        });
        updateStyle(); if(typeof updateSyringeLiquid === 'function') updateSyringeLiquid(colorPk.value);
    }

    if (!btn.dataset.t) return;
    
    if (btn.dataset.t !== tool) { selectedShape = null; if(typeof renderMain === 'function') renderMain(); }
    if (activeTextWrapper) commitActiveText();
    if (shapes.some(s => s.type === 'ocr-selection')) { shapes = shapes.filter(s => s.type !== 'ocr-selection'); if(typeof renderMain === 'function') renderMain(); }

    tool = btn.dataset.t;
    if (tool === 'polygon') polygonPoints = [];
    frame.style.cursor = ''; 

    if (tool === 'cursor') { cursorDot.style.display = 'none'; frame.style.cursor = 'grab'; }
    else if (tool === 'eraser') { applyEraserCursor(); }
    else if (tool === 'eyedropper') { 
        cursorDot.style.display = 'none'; 
        frame.style.cursor = 'none'; 
        if (AppFeatures.type === 'pro') {
            document.body.classList.add('force-no-cursor');
            if (typeof virtualSyringe !== 'undefined') {
                virtualSyringe.style.display = 'block';
                virtualSyringe.style.left = ((typeof lastClientX !== 'undefined' ? lastClientX : 0) - SYRINGE_HOTSPOT_X) + 'px';
                virtualSyringe.style.top = ((typeof lastClientY !== 'undefined' ? lastClientY : 0) - SYRINGE_HOTSPOT_Y) + 'px';
            }
        } else { frame.classList.add('cursor-eyedropper'); }
    }
    else if (tool === 'ocr' || tool === 'blur') { 
        cursorDot.style.display = 'none'; 
        frame.style.cursor = 'none'; 
        document.body.classList.add('force-no-cursor');
    }
    else if (tool === 'stamp' || tool === 'magnifier') { 
        frame.style.cursor = (tool === 'stamp') ? 'copy' : 'none'; 
        cursorDot.style.display = 'none'; 
    }
    else if (tool === 'magnifier') { 
        frame.style.cursor = 'none'; 
        cursorDot.style.display = 'none'; 
    }
    else if (userSettings.cursorStyle === 'crosshair') { frame.style.cursor = 'crosshair'; cursorDot.style.display = 'none'; }
    else if (userSettings.cursorStyle === 'outline') { frame.style.cursor = 'none'; if (cursorDot) cursorDot.style.display = 'block'; }
    else { frame.style.cursor = 'none'; if (cursorDot) { cursorDot.style.left = (typeof lastClientX !== 'undefined' ? lastClientX : 0) + 'px'; cursorDot.style.top = (typeof lastClientY !== 'undefined' ? lastClientY : 0) + 'px'; cursorDot.style.display = 'block'; } }

    const toolboxTools = ['ocr', 'eyedropper', 'stamp', 'blur', 'magnifier'];
    const isToolbox = toolboxTools.includes(tool);

    document.querySelectorAll('.tool-btn, .dropdown-item').forEach(b => {
        const isUtility = ['undo', 'redo', 'grid-toggle', 'btn-dotted', 'btn-shadow', 'fb-undo', 'fb-redo', 'fb-grid-toggle', 'fb-btn-dotted', 'fb-btn-shadow', 'bring-forward', 'send-backward'].includes(b.dataset.t);
        const isShapeMenu = ['btn-multishape', 'fb-btn-multishape'].includes(b.id);
        const isToolboxParent = ['btn-footer-extras', 'fb-btn-tools'].includes(b.id);

        if (!isUtility && !isShapeMenu && !isToolboxParent) {
            b.classList.remove('active', 'active-tool');
        }
        if (!isUtility && !isShapeMenu && !isToolboxParent && b.dataset.t === tool) {
            b.classList.add(b.classList.contains('dropdown-item') ? 'active-tool' : 'active');
        }
        if (isToolboxParent) {
            b.classList.toggle('active', isToolbox);
        }
        
        if (isShapeMenu) {
            b.classList.toggle('active', ['star', 'polygon', 'check', 'triangle', 'x-shape'].includes(tool));
        }
    });

    if (typeof refreshToolIcons === 'function') refreshToolIcons();
    updateStyle(); updateStampBubble(); 
    if (typeof updateRadiusBubbleUI === 'function') updateRadiusBubbleUI();
    updateAuxUI();
};

function updateAuxUI() {
    let targetDotted = isDotted; let targetShadow = isShadow;
    if (selectedShape) {
        targetDotted = selectedShape.isDotted; targetShadow = selectedShape.hasShadow;
        if (selectedShape.type === 'text') targetDotted = false;
        const shapeType = selectedShape.type;
        if (tool !== shapeType && shapeType !== 'polygon_drag' && shapeType !== 'eraser-stroke') {
            tool = shapeType;
            document.querySelectorAll('.tool-btn').forEach(b => {
                const isGrid = (b.id === 'grid-toggle' || b.id === 'fb-grid-toggle');
                const isStyle = (b.id === 'btn-dotted' || b.id === 'fb-btn-dotted' || b.id === 'btn-shadow' || b.id === 'fb-btn-shadow');
                const isUtility = ['undo', 'redo', 'bring-forward', 'send-backward'].includes(b.dataset.t);
                if (!isUtility && !isGrid && !isStyle) b.classList.remove('active');
            });
            document.querySelectorAll(`.tool-btn[data-t="${shapeType}"]`).forEach(b => b.classList.add('active'));
        }
        const solidTypes = ['square', 'circle', 'triangle', 'star', 'polygon', 'check', 'x-shape'];
        if (solidTypes.includes(selectedShape.type)) {
            const isSolid = selectedShape.isSolid || false;
            if (typeof fillStates !== 'undefined') fillStates[selectedShape.type] = isSolid;
            document.querySelectorAll(`.tool-btn[data-t="${selectedShape.type}"]`).forEach(btn => {
                if (selectedShape.type === 'square' || selectedShape.type === 'circle') btn.innerHTML = getShapeIconHtml(selectedShape.type, isSolid);
            });
        }
    } 
    else if (tool === 'text') { targetDotted = false; }

    if (typeof refreshToolIcons === 'function') refreshToolIcons();
    const gridEl = document.getElementById('grid');
    const isGridOn = gridEl && !gridEl.classList.contains('hidden');
    const gridBtn = document.getElementById('grid-toggle'); if(gridBtn) gridBtn.classList.toggle('active', isGridOn);
    const fbGridBtn = document.getElementById('fb-grid-toggle'); if(fbGridBtn) fbGridBtn.classList.toggle('active', isGridOn);

    const footerDotted = document.getElementById('btn-dotted'); if(footerDotted) footerDotted.classList.toggle('active', !!targetDotted);
    const fbDotted = document.getElementById('fb-btn-dotted'); if(fbDotted) fbDotted.classList.toggle('active', !!targetDotted);
    const footerShadow = document.getElementById('btn-shadow'); if(footerShadow) footerShadow.classList.toggle('active', !!targetShadow);
    const fbShadow = document.getElementById('fb-btn-shadow'); if(fbShadow) fbShadow.classList.toggle('active', !!targetShadow);
}

const toggleStyle = (btn, fbBtn, prop) => {
    let newValue;
    if (selectedShape) {
        if (prop === 'dotted') { selectedShape.isDotted = !selectedShape.isDotted; newValue = selectedShape.isDotted; isDotted = newValue; } 
        else if (prop === 'shadow') { selectedShape.hasShadow = !selectedShape.hasShadow; newValue = selectedShape.hasShadow; isShadow = newValue; }
        if(typeof renderMain === 'function') renderMain(); if(typeof saveState === 'function') saveState();
    } else {
        if (prop === 'dotted') { isDotted = !isDotted; newValue = isDotted; } 
        else if (prop === 'shadow') { isShadow = !isShadow; newValue = isShadow; }
    }
    updateAuxUI(); applyPropertyChange(prop, newValue);
};

let lastToggleTime = 0;
function toggleSolidMode(targetTool) {
    const now = Date.now(); if (now - lastToggleTime < 200) return; lastToggleTime = now;
    const t = targetTool || tool;
    if (fillStates[t] !== undefined) {
        fillStates[t] = !fillStates[t]; const isSolid = fillStates[t];
        document.querySelectorAll(`.tool-btn[data-t="${t}"]`).forEach(btn => { if (t === 'square' || t === 'circle') btn.innerHTML = getShapeIconHtml(t, isSolid); });
        if (['star', 'triangle', 'polygon', 'check', 'x-shape'].includes(t)) syncMultiShapeUI(t, isSolid);
        if (selectedShape && selectedShape.type === t) { selectedShape.isSolid = isSolid; if(typeof renderMain === 'function') renderMain(); if(typeof saveState === 'function') saveState(); }
    }
}

const toggleEraserMode = () => {
    // 1. Toggle the variable for the active session ONLY
    eraserMode = eraserMode === 'brush' ? 'object' : 'brush';
    
    // (We removed the saveSettings code from here so it stops overwriting the boot default!)

    const brushIcon = 'assets/icons/eraser.png'; 
    const objectIcon = 'assets/icons/solid-eraser.png';
    const newTitle = (eraserMode === 'object') ? "Eraser (Object Mode)" : "Eraser (Brush Mode)";
    
    document.querySelectorAll('.tool-btn[data-t="eraser"]').forEach(btn => {
        const img = btn.querySelector('.icon-img'); 
        if (img) img.src = (eraserMode === 'object') ? objectIcon : brushIcon;
        btn.classList.toggle('solid-mode', eraserMode === 'object');
        if (typeof updateDynamicTooltip === 'function') updateDynamicTooltip(btn, newTitle);
    });
    
    if (tool === 'eraser') applyEraserCursor();
};

const toggleHighlighterMode = (e) => {
    if(e) { e.preventDefault(); e.stopPropagation(); }
    if (!AppFeatures.enableHighlighter) return;

    if (!isHighlighter) { 
        previousColor = colorPk.value; 
        isHighlighter = true; 
        colorPk.value = userSettings.highlighterColor || '#FFFF00'; 
    } else {
        isHighlighter = false;
        colorPk.value = previousColor; 
    }

    const iconLine = '<img src="assets/icons/line.png" class="icon-img" alt="Line">'; 
    const iconHighlighter = '<img src="assets/icons/highlighter.png" class="icon-img" alt="Highlighter">';

    document.querySelectorAll('.tool-btn[data-t="line"]').forEach(btn => {
        btn.innerHTML = isHighlighter ? iconHighlighter : iconLine;
        btn.classList.toggle('highlighter-mode', isHighlighter);
        btn.title = isHighlighter ? "Highlighter (Right-Click for Line Tool)" : "Line Tool (Right-Click for Highlighter)";
    });

    updateStyle(); 
    if(typeof updateSyringeLiquid === 'function') updateSyringeLiquid(colorPk.value); 
    if(typeof renderMain === 'function') renderMain();
};

function renderPresets() {
    const containers = [document.getElementById('color-popup'), document.getElementById('fb-color-popup')];
    const limit = AppFeatures.stylePresetsCount || 1;
    containers.forEach(parent => {
        if (!parent) return;
        parent.querySelectorAll('.preset-container-wrapper').forEach(el => el.remove());
        const wrapper = document.createElement('div'); wrapper.className = 'preset-container-wrapper'; wrapper.style.cssText = "grid-column: 1 / -1; border-top: 1px solid #444; margin-top: 8px; padding-top: 8px; width: 100%;";
        const grid = document.createElement('div'); grid.style.cssText = `display: grid; grid-template-columns: repeat(${limit}, 1fr); gap: 2px;`;
        for (let i = 0; i < limit; i++) {
            const preset = userSettings.stylePresets[i]; const slot = document.createElement('div');
            slot.style.cssText = `height: 18px; border-radius: 3px; cursor: pointer; background-color: ${preset ? preset.color : '#333'}; border: ${preset ? '1px solid rgba(255,255,255,0.3)' : '1px solid #444'}; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; color: ${preset ? 'rgba(255,255,255,0.8)' : '#666'}; transition: transform 0.1s;`;
            slot.innerText = i + 1;
            slot.onmouseenter = () => { slot.style.transform = 'scale(1.1)'; slot.style.zIndex = '10'; }; slot.onmouseleave = () => { slot.style.transform = 'scale(1)'; slot.style.zIndex = '1'; };
            slot.onclick = (e) => {
                e.stopPropagation(); e.preventDefault();
                if (preset) {
                    colorPk.value = preset.color; sizeSl.value = preset.width; opacitySl.value = preset.opacity;
                    if(fbColorTrigger) { const fbc = document.getElementById('fb-color-pk'); if(fbc) fbc.value = preset.color; }
                    if(fbSizeSl) fbSizeSl.value = preset.width; if(fbOpacitySl) fbOpacitySl.value = preset.opacity;
                    applyPropertyChange('color', preset.color); applyPropertyChange('width', preset.width); applyPropertyChange('opacity', preset.opacity);
                    updateStyle(); showToast(`Loaded Style ${i + 1}`);
                } else { showToast(`Slot ${i + 1} is empty`); }
            };
            slot.oncontextmenu = (e) => {
                e.preventDefault(); e.stopPropagation();
                userSettings.stylePresets[i] = { color: colorPk.value, width: parseFloat(sizeSl.value), opacity: parseFloat(opacitySl.value) };
                if (typeof saveSettings === 'function') saveSettings(); renderPresets(); showToast(`Saved to Slot ${i + 1}`);
            };
            grid.appendChild(slot);
        }
        wrapper.appendChild(grid); parent.appendChild(wrapper);
    });
}

async function loadCustomFonts() {
    await FontManager.loadCustomFonts(() => {
        updateFontDropdowns();
        renderFontManager();
    });
}

function renderFontManager() {
    FontManager.renderList(
        (name) => {
            if (userSettings.pinnedFonts.includes(name)) {
                userSettings.pinnedFonts = userSettings.pinnedFonts.filter(n => n !== name);
            } else { userSettings.pinnedFonts.push(name); }
            saveSettings(); renderFontManager(); updateFontDropdowns();
        },
        (name) => {
            if (userSettings.hiddenFonts.includes(name)) {
                userSettings.hiddenFonts = userSettings.hiddenFonts.filter(n => n !== name);
            } else { userSettings.hiddenFonts.push(name); }
            saveSettings(); renderFontManager(); updateFontDropdowns();
        },
        (index) => {
            const fontName = userSettings.customFonts[index].name;
            userSettings.customFonts.splice(index, 1);
            userSettings.pinnedFonts = userSettings.pinnedFonts.filter(n => n !== fontName);
            userSettings.hiddenFonts = userSettings.hiddenFonts.filter(n => n !== fontName);
            saveSettings(); loadCustomFonts(); showToast("Font removed.");
        }
    );
    
    // Add this to highlight the default font immediately after the list renders
    setTimeout(highlightDefaultFont, 50);
}

function updateFontDropdowns() {
    const uiMenus = [document.getElementById('font-family-menu'), document.getElementById('fb-font-family-menu')];
    const settingsSelect = document.querySelector('select[data-setting="defaultFont"]');

    const allAvailableFonts = [...new Set([
        ...userSettings.pinnedFonts, 
        ...SYSTEM_FONTS, 
        ...userSettings.customFonts.map(f => f.name)
    ])].filter(font => !userSettings.hiddenFonts.includes(font));

   // THE FIX: Updated Dictionary Translator for optimized Pro Suite fonts
const getSafeFontStack = (fontName) => {
    const aliases = {
        // --- Retired Aliases removed for clarity ---
        'Garamond': 'Garamond, "EB Garamond", serif',
        'Georgia': 'Georgia, serif',
        'Courier New': '"Courier New", Courier, monospace',
        'Lucida Console': '"Lucida Console", "Courier New", monospace',
        
        // --- NEW: Casual & Hand-Drawn Fallbacks ---
        'Segoe Print': '"Segoe Print", "Bradley Hand", cursive',
        'Ink Free': '"Ink Free", "Segoe Script", cursive',
        'Permanent Marker': '"Permanent Marker", Impact, sans-serif'
    };
    
    // If it's in the dictionary, use the safe stack. 
    // Otherwise, wrap in quotes and default to sans-serif for safety.
    return aliases[fontName] || `"${fontName}", sans-serif`;
};

    uiMenus.forEach(menu => {
        if (!menu) return;
        menu.innerHTML = ''; 

        allAvailableFonts.forEach(font => {
            const btn = document.createElement('button');
            btn.className = 'dropdown-item font-option';
            
            // WIRED UP: We are actually calling the translator now!
            const fontStack = getSafeFontStack(font);
            btn.style.setProperty('font-family', fontStack, 'important');
            btn.textContent = font;
            
            if (font === userSettings.defaultFont) btn.classList.add('selected');

            btn.onclick = (e) => {
                e.stopPropagation(); e.preventDefault();
                userSettings.defaultFont = font;
                
                document.querySelectorAll('.font-label').forEach(lbl => {
                    lbl.textContent = font;
                    // WIRED UP: Update the UI label using the translator
                    lbl.style.setProperty('font-family', fontStack, 'important');
                });

                if (settingsSelect) settingsSelect.value = font;
                applyPropertyChange('fontFamily', font);
                menu.classList.remove('show');
                saveSettings();
            };
            menu.appendChild(btn);
        });
    });

    if (settingsSelect) {
        const currentVal = userSettings.defaultFont;
        settingsSelect.innerHTML = '';
        allAvailableFonts.forEach(font => {
            const opt = document.createElement('option');
            opt.value = font;
            opt.textContent = font;
            // WIRED UP: Settings menu uses the translator
            opt.style.setProperty('font-family', getSafeFontStack(font), 'important');
            settingsSelect.appendChild(opt);
        });
        settingsSelect.value = currentVal;
    }

    document.querySelectorAll('.custom-font-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const menu = newBtn.parentElement.querySelector('.dropdown-content');
            
            document.querySelectorAll('.dropdown-content.show').forEach(m => {
                if (m !== menu) m.classList.remove('show');
            });
            
            if (menu) menu.classList.toggle('show');
        });
    });
}

// Kick it off
updateFontDropdowns();

async function getLocalBlobURL(relativePath) {
    const fullPath = resolvePath(relativePath);
    try {
        const response = await fetch(fullPath);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (e) {
        throw new Error(`Failed to load ${relativePath}: ${e.message}`);
    }
}

async function getLocalText(relativePath) {
    const fullPath = resolvePath(relativePath);
    try {
        const response = await fetch(fullPath);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
    } catch (e) {
        throw new Error(`Failed to load ${relativePath}: ${e.message}`);
    }
}

function preprocessImageForOCR(sourceCanvas) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0);
    
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const avg = (0.299 * data[i]) + (0.587 * data[i + 1]) + (0.114 * data[i + 2]);
        const threshold = 100; 
        const val = avg > threshold ? 255 : 0;
        
        data[i] = val;    
        data[i + 1] = val; 
        data[i + 2] = val; 
    }
    
    ctx.putImageData(imgData, 0, 0);
    return tempCanvas.toDataURL('image/png');
}

function loadExternalImage(blob) {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.onload = () => {
        const dpr = window.devicePixelRatio || 1;
        
        let newW = Math.round(img.width / dpr);
        let newH = Math.round(img.height / dpr);

        const maxW = window.screen.availWidth - 100;
        const maxH = window.screen.availHeight - 100;
        
        if (newW > maxW || newH > maxH) {
            const ratio = Math.min(maxW / newW, maxH / newH);
            newW = Math.round(newW * ratio);
            newH = Math.round(newH * ratio);
            showToast(`Image scaled to ${newW}x${newH}`);
        }
        
        w = newW; 
        h = newH;
        
        if(inpW) inpW.value = w;
        if(inpH) inpH.value = h;
        
        isSuppressingResize = true;
        
        window.electronAPI.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
        window.electronAPI.send('center-window');
        
        doDelete(); 
        
        updateCanvasSize(w, h); 
        
        bgCtx.drawImage(img, 0, 0, w, h);
        renderMain(); 
        
        setTimeout(() => {
            isSuppressingResize = false;
            showToast("Image loaded!");
        }, 200);
        
        URL.revokeObjectURL(url);
    };
    
    img.src = url;
}

// =====================================================================
// CHAPTER 9: EVENT LISTENERS (INPUTS)
// =====================================================================

let resizeTimer;
window.addEventListener('resize', () => { 
    let newW = window.innerWidth - 120; 
    let newH = window.innerHeight - 110; 
    
    newW = Math.floor(newW / 2) * 2;
    newH = Math.floor(newH / 2) * 2;

    if (newW < 50) newW = 50; 
    if (newH < 50) newH = 50;

    if (typeof measureTip !== 'undefined' && userSettings.showMeasurements && isResizing) {
        const tipX = (window.innerWidth / 2) - 60; 
        const tipY = (window.innerHeight / 2) + 40;
        
        measureTip.style.display = 'block';
        measureTip.style.left = tipX + 'px';
        measureTip.style.top = tipY + 'px';
        measureTip.innerHTML = `<span>W:</span> ${Math.round(newW)}px  <span>H:</span> ${Math.round(newH)}px`;
    } else {
        if(measureTip) measureTip.style.display = 'none';
    }

    if (isFullscreen || isSuppressingResize) return; 

    ctx.clearRect(0, 0, canvas.width, canvas.height); 

    if (resizeTimer) clearTimeout(resizeTimer);
    
    resizeTimer = setTimeout(() => {
    const WINDOW_FLOOR_W = 855; 
    if (newW <= WINDOW_FLOOR_W && w < newW) {
         newW = w; 
    }
    
    if (w !== newW || h !== newH) {
        if(inpW) inpW.value = Math.round(newW);
        if(inpH) inpH.value = Math.round(newH);
        
        updateCanvasSize(newW, newH, true);
    } else {
        renderMain();
    }
    
}, 50); 
});

winResizeGrip.onpointerdown = (e) => { 
    if (isFullscreen) return; e.stopPropagation(); e.preventDefault(); winResizeGrip.setPointerCapture(e.pointerId); 
    const startX = e.screenX; const startY = e.screenY; const startW = window.outerWidth; const startH = window.outerHeight; 
    winResizeGrip.onpointermove = (ev) => { 
        let newWidth = startW + (ev.screenX - startX);
        let newHeight = startH + (ev.screenY - startY);
        window.electronAPI.send('resize-window', { width: newWidth, height: newHeight }); 
    }; 
    winResizeGrip.onpointerup = (ev) => { winResizeGrip.releasePointerCapture(ev.pointerId); winResizeGrip.onpointermove = null; winResizeGrip.onpointerup = null; }; 
};

const applyDimensions = () => { 
    if (isFullscreen) return; 
    let reqW = parseInt(inpW.value); let reqH = parseInt(inpH.value); 
    if(isNaN(reqW) || reqW < 50) reqW = 50; if(isNaN(reqH) || reqH < 50) reqH = 50; 
    
    let winW = reqW + UI_W_OFFSET; 
    let winH = reqH + UI_H_OFFSET; 
    
    isSuppressingResize = true;
    updateCanvasSize(reqW, reqH);
    window.electronAPI.send('resize-window', { width: winW, height: winH }); 
    setTimeout(() => {
        isSuppressingResize = false;
    }, 100);
};

if(document.getElementById('btn-apply')) document.getElementById('btn-apply').onclick = applyDimensions; 

const handleEnter = (e) => { if (e.key === 'Enter') applyDimensions(); };
if(inpW) inpW.addEventListener('keydown', handleEnter); 
if(inpH) inpH.addEventListener('keydown', handleEnter);

if(btnClose) btnClose.onclick = (e) => { e.stopPropagation(); window.electronAPI.send('close-app'); };
if(btnMin) btnMin.onclick = (e) => { e.stopPropagation(); window.electronAPI.send('minimize-app'); };

btnFullscreen.onclick = async () => { 
    window.electronAPI.send('set-window-opacity', 0);
    const frameEl = document.getElementById('frame');
    if (frameEl) {
        frameEl.style.display = 'none';
        frameEl.style.left = '-9999px';
        frameEl.style.top = '-9999px';
        frameEl.classList.add('clean-slate');
    }
    document.body.classList.add('fullscreen');
    if (typeof doDelete === 'function') doDelete(); 
    window.electronAPI.send('force-maximize'); 
    await enterFullscreenMode(); 
};

btnCenter.onclick = () => { 
    isSuppressingResize = true;
    exitFullscreen();
    hasSnappedInFullscreen = false;
    
    w = userSettings.startupW;
    h = userSettings.startupH;
    
    if (inpW) inpW.value = w;
    if (inpH) inpH.value = h;

    resetFramePosition();
    
    window.electronAPI.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
    window.electronAPI.send('center-window');
    
    setTimeout(() => { 
        updateCanvasSize(w, h);
        isSuppressingResize = false;
    }, 50); 
};

const exitBtn = document.getElementById('fb-exit');
if (exitBtn) {
    exitBtn.addEventListener('click', () => {
        isWGCFrozen = false;
        isFullscreen = false;
        isSuppressingResize = true; 
        
        const backdrop = document.getElementById('backdrop-img');
        if (backdrop) {
            backdrop.src = "";
            backdrop.style.display = 'none';
        }

        document.body.classList.remove('fullscreen');
        if (floatingBar) floatingBar.classList.add('hidden'); // Guarantee the bar hides

        w = userSettings.startupW || 840;
        h = userSettings.startupH || 340;
        
        if (inpW) inpW.value = w;
        if (inpH) inpH.value = h;

        const targetW = w + UI_W_OFFSET;
        const targetH = h + UI_H_OFFSET;
        window.electronAPI.send('resize-window', { width: targetW, height: targetH });
        window.electronAPI.send('center-window');
        
        // [THE FIX] Thoroughly cleanse the frame of fullscreen modifications
        frame.style.display = 'block';
        frame.classList.remove('clean-slate', 'immersive-active'); 
        frame.style.outline = `2px dashed ${userSettings.accentColor || '#8CFA96'}`; 
        if (typeof winResizeGrip !== 'undefined' && winResizeGrip) {
            winResizeGrip.style.display = 'flex'; 
        }
        
        resetFramePosition();
        
        updateCanvasSize(w, h, true);
        setTimeout(() => { 
            isSuppressingResize = false;
        }, 100);
    });
}

const btnQuit = document.getElementById('fb-quit');
if(btnQuit) { btnQuit.onclick = () => { window.electronAPI.send('close-app'); }; }

const toggleSettings = (e) => { 
    if(e) e.stopPropagation(); 
    
    const isOpening = settingsModal.style.display === 'none' || settingsModal.style.display === ''; 
    
    if (isOpening) {
        settingsModal.style.display = 'flex';
        
        if (!isFullscreen) {
            if (preWizardW === 0 && preWizardH === 0) {
                preWizardW = w;
                preWizardH = h;
            }
            
            const settMinW = 960; 
            const settMinH = 660;

            if (w < settMinW || h < settMinH) {
                w = Math.max(w, settMinW);
                h = Math.max(h, settMinH);
                
                inpW.value = w; 
                inpH.value = h;
                
                window.electronAPI.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
                updateCanvasSize(w, h);
                window.electronAPI.send('center-window');
            }
        }
    } else {
        settingsModal.style.display = 'none';
        
        if (!isFullscreen && preWizardW > 0 && preWizardH > 0) {
            isSuppressingResize = true; 
            
            w = preWizardW;
            h = preWizardH;
            
            inpW.value = w; 
            inpH.value = h;
            
            window.electronAPI.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
            window.electronAPI.send('center-window');
            
            updateCanvasSize(w, h);
            
            setTimeout(() => {
                updateCanvasSize(w, h); 
                isSuppressingResize = false;
                preWizardW = 0; 
                preWizardH = 0;
            }, 100);
        }
    }
};

window.electronAPI.on('wgc-data-received', async (event, base64) => {
    await enterFullscreenMode(base64);
    window.electronAPI.send('set-window-opacity', 1); // Reveal the window!
});

btnSettings.onclick = toggleSettings; 
closeSettings.onclick = toggleSettings; 
const fbSettings = document.getElementById('fb-settings');
if (fbSettings) fbSettings.onclick = toggleSettings;
settingsModal.addEventListener('mousedown', (e) => { if (e.target === settingsModal) toggleSettings(); });

// ==========================================
// ABOUT TAB: WIZARD & TOUR BUTTONS
// ==========================================
const btnReplayIntro = document.getElementById('btn-replay-intro');
if (btnReplayIntro) {
    btnReplayIntro.onclick = (e) => {
        e.preventDefault();
        toggleSettings(); // Close the settings modal first
        setTimeout(() => {
            initOnboarding(true); // 'true' forces it to play even if they already saw it
        }, 150); // Tiny delay to let the settings modal fade out smoothly
    };
}

const btnRunSetup = document.getElementById('btn-run-setup');
if (btnRunSetup) {
    btnRunSetup.onclick = (e) => {
        e.preventDefault();
        toggleSettings(); // Close the settings modal first
        setTimeout(() => {
            if (typeof showOnboardingWizard === 'function') showOnboardingWizard();
        }, 150);
    };
}

document.querySelectorAll('[data-setting]').forEach(input => {
    input.addEventListener('change', (e) => {
        const key = input.dataset.setting;
        let val = input.type === 'checkbox' ? input.checked : input.value;
        
        if (val === true) {
            if (key === 'snapToGrid') {
                userSettings.showSmartGuides = false;
                const other = document.querySelector('[data-setting="showSmartGuides"]');
                if (other) other.checked = false;
            } 
            else if (key === 'showSmartGuides') {
                userSettings.snapToGrid = false;
                const other = document.querySelector('[data-setting="snapToGrid"]');
                if (other) other.checked = false;
            }
        }

        userSettings[key] = val;
        saveSettings(); 
        
        if (key === 'cornerStyle' && typeof updateRadiusBubbleUI === 'function') updateRadiusBubbleUI();
        if (key === 'cornerRadius' || key === 'cornerStyle') renderMain();
    });
});

const btnBrowse = document.getElementById('btn-browse-dir');
const btnClearDir = document.getElementById('btn-clear-dir');
const inpSavePath = document.getElementById('inp-save-path');
btnBrowse.onclick = async () => {
    try {
       const result = await window.electronAPI.invoke('select-directory');
       if(result && !result.canceled) {
           userSettings.savePath = result.filePaths[0];
           inpSavePath.value = userSettings.savePath;
           saveSettings();
       }
    } catch(e) { alert("Directory selection failed."); }
};
btnClearDir.onclick = () => { userSettings.savePath = ''; inpSavePath.value = ''; saveSettings(); };
// ==========================================
// TTF IMPORT WIRING
// ==========================================
const btnImportFont = document.getElementById('btn-import-font');

if (btnImportFont) {
    // Clone to strip any ghost listeners
    const newImportBtn = btnImportFont.cloneNode(true);
    btnImportFont.parentNode.replaceChild(newImportBtn, btnImportFont);
    
    newImportBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        try {
            // Call the IPC handler in main.js
            const result = await window.electronAPI.invoke('select-font');
            
            if (result && !result.canceled && result.name && result.data) {
                // Ensure array exists
                if (!userSettings.customFonts) userSettings.customFonts = [];
                
                // Prevent importing the same font twice
                if (!userSettings.customFonts.find(f => f.name === result.name)) {
                    userSettings.customFonts.push({ name: result.name, data: result.data });
                    saveSettings(); // Save to HDD
                    
                    // Reload fonts into DOM and UI
                    if (typeof loadCustomFonts === 'function') {
                        await loadCustomFonts();
                    }
                    if (typeof showToast === 'function') {
                        showToast(`Imported: ${result.name}`);
                    }
                } else {
                    if (typeof showToast === 'function') showToast("Font already imported!");
                }
            }
        } catch (err) {
            console.error("Font Import Failed:", err);
        }
    });
}

// ==========================================
// UNIVERSAL DROPDOWN CLOSER
// ==========================================
window.addEventListener('click', (e) => {
    // If the click is NOT on a font toggle button...
    if (!e.target.closest('.custom-font-btn')) {
        // Find all open dropdowns
        document.querySelectorAll('.dropdown-content.show').forEach(menu => {
            // Only close if we didn't click inside the menu itself (allows scrolling)
            if (!menu.contains(e.target)) {
                menu.classList.remove('show');
            }
        });
    }
});

// Also ensure they close if the app window loses focus (like minimizing or clicking another app)
window.addEventListener('blur', () => {
    document.querySelectorAll('.dropdown-content.show').forEach(menu => {
        menu.classList.remove('show');
    });
});

// ==========================================
// VISUAL INDICATOR FOR DEFAULT FONT
// ==========================================
function highlightDefaultFont() {
    const rows = document.querySelectorAll('#font-manager-list .font-row');
    rows.forEach(row => {
        const nameEl = row.querySelector('.font-name');
        if (!nameEl) return;
        
        // Clone and strip any existing icons so we get just the pure font name
        const clone = nameEl.cloneNode(true);
        const icon = clone.querySelector('i');
        if (icon) icon.remove();
        const fontName = clone.textContent.trim();
        
        if (fontName === userSettings.defaultFont) {
            // Apply Active Styles
            row.style.borderLeft = '3px solid var(--accent)';
            row.style.background = '#1a1a1a'; // <-- Swapped to dark grey
            nameEl.style.color = 'var(--accent)';
            nameEl.style.fontWeight = 'bold';
            
            // Add Checkmark if it doesn't have one
            if (!nameEl.querySelector('.fa-check')) {
                nameEl.innerHTML = `<i class="fa-solid fa-check" style="margin-right: 8px; font-size: 11px;"></i>${fontName}`;
            }
        } else {
            // Remove Active Styles from non-defaults
            row.style.borderLeft = '3px solid transparent';
            row.style.background = 'transparent';
            nameEl.style.color = '#ccc';
            nameEl.style.fontWeight = 'normal';
            
            // Remove Checkmark by resetting the text
            nameEl.textContent = fontName; 
        }
    });
}

// ==========================================
// THE FONT MANAGER & HOTKEY MASTER FIX
// ==========================================

// 1. Wire up the Font Manager Accordion Toggle
const fmToggle = document.getElementById('font-manager-toggle');
const fmList = document.getElementById('font-manager-list');

if (fmToggle && fmList) {
    fmToggle.onclick = (e) => {
        e.preventDefault(); 
        e.stopPropagation();
        fmList.classList.toggle('open');
        
        // Animate the chevron
        const chevron = fmToggle.querySelector('.fa-chevron-down');
        if (chevron) {
            chevron.style.transform = fmList.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    };

    // 2. Wire up the Font List Click (Set as Default)
    fmList.onclick = (e) => {
        const fontInfo = e.target.closest('.font-info');
        if (!fontInfo) return;
        
        const nameEl = fontInfo.querySelector('.font-name');
        if (!nameEl) return;
        
        // Safely extract just the text, ignoring our injected checkmark
        const clone = nameEl.cloneNode(true);
        const icon = clone.querySelector('i');
        if (icon) icon.remove();
        const font = clone.textContent.trim();
        
        // Update App State
        userSettings.defaultFont = font;
        
        // Update the Toolbar Labels Instantly
        document.querySelectorAll('.font-label').forEach(lbl => {
            lbl.textContent = font;
            lbl.style.fontFamily = `'${font}', sans-serif`;
        });
        
        // Sync the cached DOM variables so the text tool picks it up
        if (typeof fontFam !== 'undefined' && fontFam) fontFam.value = font;
        if (typeof fbFontFam !== 'undefined' && fbFontFam) fbFontFam.value = font;

        applyPropertyChange('fontFamily', font);
        saveSettings();
        if (typeof showToast === 'function') showToast(`Default Font: ${font}`);
        
        // Move the visual indicator!
        highlightDefaultFont();
    };
}

// 3. The "Lightshot" Hotkey Recorder (KeyUP Fix for PrintScreen)
const hotkeyInputs = document.querySelectorAll('input[data-setting="globalHotkey"], #wiz-hotkey-input');

hotkeyInputs.forEach(input => {
    const newInp = input.cloneNode(true);
    input.parentNode.replaceChild(newInp, input);

    // Stop normal typing from breaking the box
    newInp.addEventListener('keydown', (e) => { e.preventDefault(); });

    // Use KeyUP to bypass Windows intercepting the PrintScreen key
    newInp.addEventListener('keyup', (e) => {
        e.preventDefault();

        const modifiers = [];
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.shiftKey) modifiers.push('Shift');
        if (e.altKey) modifiers.push('Alt');

        let key = e.key;
        if (key === " ") key = "Space";
        
        // Ignore bare modifier presses
        if (["Control", "Shift", "Alt", "Meta", "Escape", "Enter", "Tab", "CapsLock"].includes(key)) return;

        const formattedKey = key.length === 1 ? key.toUpperCase() : key;
        const finalHotkey = modifiers.length > 0 ? `${modifiers.join('+')}+${formattedKey}` : formattedKey;

        newInp.value = finalHotkey;

        const wizDisplay = document.getElementById('wiz-finish-hotkey');
        if (wizDisplay && newInp.id === 'wiz-hotkey-input') {
            wizDisplay.textContent = finalHotkey;
        }

        // Apply immediately
        userSettings.globalHotkey = finalHotkey;
        window.electronAPI.send('update-setting', { key: 'globalHotkey', value: finalHotkey });
        saveSettings();
    });
});

window.addEventListener('keydown', (e) => {
    if (tool === 'eyedropper') {
    if (e.key === 'Enter') {
        e.preventDefault();
        const rect = frame.getBoundingClientRect();
        const x = lastClientX - rect.left;
        const y = lastClientY - rect.top;
        pickColorAt(x, y);
        return;
    }
    if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        
        // THE PRECISION CALCULATION:
        // We divide by 'dpr' to move exactly 1 physical pixel.
        // At 200% (dpr=2), step is 0.5. At 100% (dpr=1), step is 1.
        const step = e.shiftKey ? 10 : (1 / dpr);
        
        if (e.key === 'ArrowUp') lastClientY -= step;
        if (e.key === 'ArrowDown') lastClientY += step;
        if (e.key === 'ArrowLeft') lastClientX -= step;
        if (e.key === 'ArrowRight') lastClientX += step;
        
        showMicroLens = true; 
        
        // Refresh with the fractional coordinate (AdvancedTools handles the floor+0.5 center logic)
        AdvancedTools.updateEyedropperUnit(lastClientX, lastClientY, frame, w, h, dpr, backgroundCanvas, canvas);
        return;
    }
}

    if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal && settingsModal.style.display === 'flex') { toggleSettings(); return; }
        const wizard = document.getElementById('onboarding-wizard');
        if (wizard && wizard.classList.contains('show')) { finishOnboarding(); return; }
        const openMenu = document.querySelector('.dropdown-content.show, .ctx-menu.show');
        const colorPop = document.getElementById('color-popup');
        const fbColorPop = document.getElementById('fb-color-popup');
        if (openMenu) { openMenu.classList.remove('show'); return; }
        if (colorPop && !colorPop.classList.contains('hidden')) { colorPop.classList.add('hidden'); return; }
        if (fbColorPop && !fbColorPop.classList.contains('hidden')) { fbColorPop.classList.add('hidden'); return; }
        if (activeTextWrapper) { commitActiveText(); return; }
        if (isDown || isCreatingFrame) {
            isDown = false; isCreatingFrame = false;
            if(isFullscreen) { frame.style.display = 'none'; inpW.value = 0; inpH.value = 0; }
            renderMain(); return;
        }
        if (selectedShape) { selectedShape = null; renderMain(); return; }
        if (tool !== 'cursor') { document.querySelector('.tool-btn[data-t="cursor"]').click(); return; }
        
        window.electronAPI.send('close-app');
        return;
    }

    if (e.key === 'Alt') { const sheet = document.getElementById('hotkey-cheat-sheet'); if(sheet) sheet.style.display = 'grid'; return; }

    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

    if (e.key === 'Enter') {
        e.preventDefault();
        doSnap();
        return;
    }

    if (!(e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && !e.metaKey) {
        const k = e.key.toLowerCase();
        
        if (k === 's') { const btn = document.querySelector('.tool-btn[data-t="square"]'); if(btn) handleToolClick(btn); return; }
        if (k === 'c') { const btn = document.querySelector('.tool-btn[data-t="circle"]'); if(btn) handleToolClick(btn); return; }
        if (k === 'r') { const btn = document.querySelector(`.dropdown-item[data-sub="star"]`); if(btn) btn.click(); return; }
        
        if (AppFeatures.allowedShapes.includes('triangle') && k === 'y') { const btn = document.querySelector(`.dropdown-item[data-sub="triangle"]`); if(btn) btn.click(); return; }
        if (AppFeatures.allowedShapes.includes('polygon') && k === 'g') { const btn = document.querySelector(`.dropdown-item[data-sub="polygon"]`); if(btn) btn.click(); return; }
        if (AppFeatures.allowedShapes.includes('x-shape') && k === 'x') { const btn = document.querySelector(`.dropdown-item[data-sub="x-shape"]`); if(btn) btn.click(); return; }
        if (AppFeatures.allowedShapes.includes('check') && k === 'v') { const btn = document.querySelector(`.dropdown-item[data-sub="check"]`); if(btn) btn.click(); return; }

        if (k === 'a') {
    const styles = AppFeatures.allowedArrowStyles;
    
    // 1. If only one style is allowed (Core), just switch to the tool
    if (styles.length <= 1) { 
        tool = 'arrow'; 
        const arrowBtn = document.getElementById('btn-arrow-multi'); 
        if (arrowBtn) handleToolClick(arrowBtn); 
        return; 
    }
    
    // 2. If already using the arrow tool, cycle the style for the NEXT arrow
    if (tool === 'arrow') {
        let currentIdx = styles.indexOf(userSettings.arrowStyle);
        let nextIdx = (currentIdx + 1) % styles.length;
        const newStyle = styles[nextIdx];
        
        userSettings.arrowStyle = newStyle;
        saveSettings(); // Persists the choice for the next click-and-drag
        updateArrowButtonIcon(); // Updates the UI icon to show the new "loaded" style
        showToast(`Next Arrow: ${newStyle}`);

        // 3. If a specific arrow is SELECTED, update only that one
        if (selectedShape && selectedShape.type === 'arrow') {
            selectedShape.arrowStyle = newStyle;
            saveState(); // Record for undo/redo
            renderMain(); // Repaint just this change
        }
    } else {
        // 4. If not in arrow tool, switch to it
        tool = 'arrow';
    }
    
    const arrowBtn = document.getElementById('btn-arrow-multi'); 
    if (arrowBtn) handleToolClick(arrowBtn); 
    return;
}

        if (k === 'p') { const btn = document.querySelector('.tool-btn[data-t="pen"]'); if(btn) handleToolClick(btn); return; }
        if (k === 'l') { const btn = document.querySelector('.tool-btn[data-t="line"]'); if(btn) handleToolClick(btn); return; }
        if (k === 't') { const btn = document.querySelector('.tool-btn[data-t="text"]'); if(btn) handleToolClick(btn); return; }
        if (k === 'e') { const btn = document.querySelector('.tool-btn[data-t="eraser"]'); if(btn) handleToolClick(btn); return; }

        if (AppFeatures.enableToolbox) {
            if (k === 'z') { const btn = document.getElementById('btn-magnifier'); if(btn) { tool='magnifier'; const menu=document.getElementById('footer-extras-menu'); if(menu)menu.classList.remove('show'); handleToolClick(btn); } return; }
            if (k === 'b') { const btn = document.getElementById('btn-blur'); if(btn) btn.click(); return; }
            if (k === 'o' && AppFeatures.enableOCR) { const btn = document.getElementById('btn-ocr'); if(btn) btn.click(); return; }
            if (k === 'i') { const btn = document.getElementById('btn-eyedropper'); if(btn) btn.click(); return; }
            if (k === 'm' && AppFeatures.enableStamps) { const btn = document.getElementById('btn-stamp'); if(btn) handleToolClick({ dataset: { t: 'stamp' } }); return; }
            
            if (k === 'u') {
                const utils = ['ocr', 'eyedropper', 'stamp', 'blur', 'magnifier'].filter(u => {
                    if(u === 'ocr') return AppFeatures.enableOCR;
                    if(u === 'magnifier') return AppFeatures.enableMagnifier;
                    if(u === 'stamp') return AppFeatures.enableStamps;
                    return true; 
                });
                let idx = utils.indexOf(tool); let nextIdx = idx + 1; if (nextIdx >= utils.length) nextIdx = 0;
                const btn = document.getElementById(`btn-${utils[nextIdx]}`); if(btn) btn.click(); return;
            }
        }
    }

    if (selectedShape && e.key.startsWith('Arrow')) {
        e.preventDefault(); const s = selectedShape;
        let dx = 0; let dy = 0; const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowUp') dy = -step; else if (e.key === 'ArrowDown') dy = step; else if (e.key === 'ArrowLeft') dx = -step; else if (e.key === 'ArrowRight') dx = step;
        s.x += dx; s.y += dy; if (s.ex !== undefined) { s.ex += dx; s.ey += dy; }
        renderMain(); saveState(); return;
    }

    if (selectedShape) {
        if (e.key === ']') { e.preventDefault(); changeLayerOrder(1); }
        else if (e.key === '[') { e.preventDefault(); changeLayerOrder(-1); }
    }

    if ((e.ctrlKey || e.metaKey) || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); undo(); } 
        else if (e.key === 'y') { e.preventDefault(); redo(); }
        else if (e.key === 'c') { e.preventDefault(); if(selectedShape) clipboardShape = JSON.parse(JSON.stringify(selectedShape)); }
        else if (e.key === 'v') { 
            e.preventDefault(); 
            if(clipboardShape) { const n = JSON.parse(JSON.stringify(clipboardShape)); n.x+=20; n.y+=20; if(n.ex){n.ex+=20;n.ey+=20;} shapes.push(n); selectedShape=n; saveState(); renderMain(); } 
        }
        else if (e.key === 'x') { e.preventDefault(); if(selectedShape) { clipboardShape = JSON.parse(JSON.stringify(selectedShape)); shapes = shapes.filter(s => s !== selectedShape); selectedShape = null; saveState(); renderMain(); } }
        else if (e.key === 'a') { e.preventDefault(); selectedShape = { isGroup: true }; renderMain(); }
        else if (e.key === 'r') { e.preventDefault(); if(typeof resetStampCounter === 'function') resetStampCounter(true); }
        
        const num = parseInt(e.key);
        if (!isNaN(num) && num >= 1 && num <= AppFeatures.stylePresetsCount) {
            e.preventDefault();
            const p = userSettings.stylePresets[num-1];
            if (p) {
                colorPk.value = p.color; sizeSl.value = p.width; opacitySl.value = p.opacity;
                applyPropertyChange('color', p.color); applyPropertyChange('width', p.width); applyPropertyChange('opacity', p.opacity);
                updateStyle(); showToast(`Preset ${num} Applied`);
            } else { showToast(`Preset ${num} is Empty`); }
        }
    }
    
    if (e.key === 'Delete' || e.key === 'Backspace') { 
        if (selectedShape) { shapes = shapes.filter(s => s !== selectedShape); selectedShape = null; saveState(); renderMain(); } 
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt') {
        const sheet = document.getElementById('hotkey-cheat-sheet');
        if(sheet) sheet.style.display = 'none';
    }
});


const openNativePicker = () => {
    if (!colorPk) return;
    colorPk.style.display = 'block';
    colorPk.style.opacity = '0';
    colorPk.style.position = 'absolute';
    colorPk.style.pointerEvents = 'none';
    colorPk.click();
};

if (btnRgb) btnRgb.onclick = openNativePicker;
if (fbBtnRgb) fbBtnRgb.onclick = openNativePicker;

const swatches = document.querySelectorAll('.swatch');
swatches.forEach(s => { 
    s.addEventListener('click', () => { 
        const selectedColor = s.dataset.c;
        colorPk.value = selectedColor; 
        if (fbColorPk) fbColorPk.value = selectedColor;
        
        applyPropertyChange('color', selectedColor);
        updateStyle();
    }); 
    
    s.oncontextmenu = (e) => {
        e.preventDefault();
        const newDefault = s.dataset.c;
        userSettings.defaultColor = newDefault;
        
        // Force the app to switch to this color immediately
        colorPk.value = newDefault;
        if (fbColorPk) fbColorPk.value = newDefault;
        applyPropertyChange('color', newDefault);
        
        saveSettings();
        showToast(`Default set and applied: ${newDefault}`);
    };
});

if (colorPk) {
    colorPk.addEventListener('input', () => { 
        if (selectedShape) {
            applyPropertyChange('color', colorPk.value);
        } 
        if (activeTextWrapper) {
            applyPropertyChange('color', colorPk.value);
        }
        updateStyle();
        AdvancedTools.updateSyringeLiquid(colorPk.value, false, AppFeatures); 
    });
}

sizeSl.addEventListener('input', () => { applyPropertyChange('width', sizeSl.value); });
opacitySl.addEventListener('input', () => { applyPropertyChange('opacity', opacitySl.value); });

const sync = (a, b, fn) => { a.addEventListener('input', () => { b.value = a.value; fn(); }); b.addEventListener('input', () => { a.value = b.value; fn(); }); };
sync(sizeSl, fbSizeSl, () => applyPropertyChange('width', sizeSl.value)); sync(opacitySl, fbOpacitySl, () => applyPropertyChange('opacity', opacitySl.value)); 

// ==========================================
// RADIUS SLIDER WIRING
// ==========================================
if (radiusInput) {
    // Updates the canvas in real-time as you drag
    radiusInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        userSettings.cornerRadius = val;
        
        if (radiusVal) radiusVal.innerText = val + 'px';
        if (typeof renderMain === 'function') renderMain();
    });
    
    // Saves to your hard drive only when you let go of the mouse
    radiusInput.addEventListener('change', () => {
        saveSettings();
    });
}

window.addEventListener('wheel', (e) => { 
    if (document.querySelector('.dropdown-content.show')) return;
    if (e.target.type === 'range' && e.target.closest('#settings-modal')) {
        e.preventDefault();
        const step = parseFloat(e.target.step) || 1;
        const min = parseFloat(e.target.min);
        const max = parseFloat(e.target.max);
        const dir = e.deltaY < 0 ? 1 : -1;
        let val = parseFloat(e.target.value) + (dir * step);
        if (step < 1) val = parseFloat(val.toFixed(2));
        if (!isNaN(min)) val = Math.max(min, val);
        if (!isNaN(max)) val = Math.min(max, val);
        e.target.value = val;
        e.target.dispatchEvent(new Event('input'));
        e.target.dispatchEvent(new Event('change'));
        return;
    }

    if (tool === 'magnifier') {
        e.preventDefault();
        const dir = e.deltaY < 0 ? 1 : -1;
        
        if ((e.ctrlKey || e.metaKey) || e.metaKey) {
            magZoom = Math.min(Math.max(magZoom + (dir * 0.5), 1.5), 5);
            showToast(`Zoom Level: ${magZoom.toFixed(1)}x`);
        } 
        else if (e.shiftKey) {
            let newVal = parseInt(sizeSl.value) + dir;
            if (newVal < 1) newVal = 1;
            if (newVal > 20) newVal = 20;
            
            sizeSl.value = newVal;
            fbSizeSl.value = newVal;
            applyPropertyChange('width', newVal); 
            
            showToast(`Border Width: ${newVal}px`);
        }
        else {
            magSize = Math.min(Math.max(magSize + (dir * 20), 50), 200);
        }
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: lastClientX, clientY: lastClientY }));
        return; 
    }

    if(e.shiftKey) { 
        e.preventDefault(); 
        
        if (selectedShape && selectedShape.type === 'magnifier-snap') {
            const dir = e.deltaY < 0 ? 1 : -1;
            let newW = (selectedShape.width || 3) + dir;
            
            if (newW < 1) newW = 1;
            if (newW > 20) newW = 20; 
            
            selectedShape.width = newW;
            
            sizeSl.value = newW;
            fbSizeSl.value = newW;
            
            saveState();
            renderMain();
            showToast(`Border Width: ${newW}px`);
            return;
        }

        const dir = e.deltaY < 0 ? 0.1 : -0.1; 
        let val = parseFloat(opacitySl.value) + dir; 
        val = Math.min(Math.max(val, 0.1), 1); 
        opacitySl.value = val.toFixed(1); 
        fbOpacitySl.value = val.toFixed(1); 
        applyPropertyChange('opacity', val); 
        return;
    } 

    if ((tool === 'stamp') || (selectedShape && (selectedShape.type === 'stamp' || selectedShape.type === 'magnifier-snap'))) {
        e.preventDefault(); 
        const dir = e.deltaY < 0 ? 5 : -5; 
        
        const isMag = (selectedShape && selectedShape.type === 'magnifier-snap');
        const MIN_SIZE = 20; 
        const MAX_SIZE = isMag ? 200 : 100; 

        if (selectedShape) {
            let newSize = selectedShape.w + dir;
            
            if (newSize < MIN_SIZE) newSize = MIN_SIZE; 
            if (newSize > MAX_SIZE) newSize = MAX_SIZE; 
            
            selectedShape.w = newSize;
            selectedShape.h = newSize; 
            
            if (selectedShape.type === 'stamp') {
                currentStampSize = newSize;
                userSettings.stampDefaultSize = newSize; 
            }
            
            saveState(); 
            renderMain();
        } else {
            if (tool === 'stamp') {
                currentStampSize += dir;
                
                if (currentStampSize < MIN_SIZE) currentStampSize = MIN_SIZE;
                if (currentStampSize > 100) currentStampSize = 100; 
                
                userSettings.stampDefaultSize = currentStampSize; 
                saveSettings(); 
            }
        }
        return;
    }

    if(!e.target.closest('#font-family')) { 
        const dir = e.deltaY < 0 ? 1 : -1; 
        let val = parseInt(sizeSl.value) + dir; 
        if (val < 2) val = 2; 
        if (val > 20) val = 20; 
        sizeSl.value = val; 
        fbSizeSl.value = val; 
        applyPropertyChange('width', val); 
    } 
}, { passive: false });

window.addEventListener('pointerdown', e => {


    if (e.button === 2) {
        // [NEW] Toggle the Micro-Lens when right-clicking with the eyedropper
        if (tool === 'eyedropper') {
            e.preventDefault();
            showMicroLens = !showMicroLens;
            
            if (showMicroLens) {
                AdvancedTools.updateEyedropperUnit(lastClientX, lastClientY, frame, w, h, dpr, backgroundCanvas, canvas);
                if (typeof virtualSyringe !== 'undefined' && virtualSyringe) virtualSyringe.style.display = 'none';
            } else {
                if (typeof microLens !== 'undefined' && microLens) microLens.style.display = 'none';
                if (typeof virtualSyringe !== 'undefined' && virtualSyringe) virtualSyringe.style.display = 'block';
            }
            return;
        }

        // Standard right-click clear for other tools
        if (['stamp', 'blur', 'ocr', 'magnifier'].includes(tool)) {
            e.preventDefault();
            const cursorBtn = document.querySelector('.tool-btn[data-t="cursor"]');
            if (cursorBtn) cursorBtn.click();
        }
        return; 
    }

    const isControlClick = e.target.closest('.header') || e.target.closest('.footer') || e.target.closest('#floating-bar') || e.target.closest('.modal') || e.target.closest('.color-popup') || e.target.closest('#stamp-bubble') || e.target.closest('#radius-bubble'); 
    if(isControlClick || (e.target.closest('.text-wrapper') && !e.target.classList.contains('text-handle'))) return;
    if(e.target.tagName === 'BUTTON' || (e.target.tagName === 'INPUT' && !e.target.closest('.text-wrapper'))) return;
    
    if(e.target.classList.contains('resize-handle')) {
        h = e.target; isResizing = true; resizeDir = h.dataset.dir; startResizeX = e.clientX; startResizeY = e.clientY;
        const rect = frame.getBoundingClientRect(); const parentRect = frame.parentElement.getBoundingClientRect();
        startResizeW = rect.width; startResizeH = rect.height; startResizeLeft = rect.left - parentRect.left; startResizeTop = rect.top - parentRect.top;
        frame.style.position = 'absolute'; frame.style.left = startResizeLeft + 'px'; frame.style.top = startResizeTop + 'px'; frame.style.width = startResizeW + 'px'; frame.style.height = startResizeH + 'px';
        frame.style.margin = '0'; frame.style.transform = 'none'; e.stopPropagation(); e.preventDefault(); frame.setPointerCapture(e.pointerId); 
        
        // --- NEW: Cloak the canvases ---
        [canvas, backgroundCanvas, scratchCanvas, shapeLayerCanvas].forEach(c => c.style.opacity = '0');
        return;
    }

    const visualX = lastClientX; 
    const visualY = lastClientY;

    lastClientX = e.clientX; lastClientY = e.clientY;
    if(activeTextWrapper && tool !== 'text' && !e.target.classList.contains('text-handle')) commitActiveText();
    
    const p = getXY(e);

    if (selectedShape) {
        const h = getHandleAt(p, selectedShape);
        if (h > 0) {
            isDown = true; draggingHandle = h; dragStartW = selectedShape.w; dragStartH = selectedShape.h;
            if(h === 6) { 
                dragOffsetX = p.x - selectedShape.x; dragOffsetY = p.y - selectedShape.y; 
                if(selectedShape.ex !== undefined) { dragExOffset = p.x - selectedShape.ex; dragEyOffset = p.y - selectedShape.ey; }
                if(selectedShape.cp) { dragCpOffsetX = p.x - selectedShape.cp.x; dragCpOffsetY = p.y - selectedShape.cp.y; }
            }
            frame.setPointerCapture(e.pointerId); renderMain(); e.preventDefault(); return;
        }
    }

    if (tool === 'ocr') { isDown = true; startX = p.x; startY = p.y; activeShape = { type: 'ocr-selection', x: startX, y: startY, w: 0, h: 0 }; frame.setPointerCapture(e.pointerId); renderMain(); return; }
    
    if (tool === 'eyedropper') { 
        if (showMicroLens && typeof visualX !== 'undefined') {
            const rect = frame.getBoundingClientRect();
            pickColorAt(visualX - rect.left, visualY - rect.top);
        } else {
            pickColorAt(p.x, p.y);
        }
        return; 
    }

    if (tool === 'stamp') {
        const hit = hitTest(p);
        if (hit && hit.type === 'stamp') { 
            selectedShape = hit; isDraggingShape = true; isDown = true; 
            dragOffsetX = p.x - selectedShape.x; dragOffsetY = p.y - selectedShape.y; 
            if (selectedShape.ex !== undefined) { dragExOffset = p.x - selectedShape.ex; dragEyOffset = p.y - selectedShape.ey; }
            renderMain(); return; 
        }
        const s = { type: 'stamp', x: p.x - (currentStampSize/2), y: p.y - (currentStampSize/2), w: currentStampSize, h: currentStampSize, ex: p.x + currentStampSize, ey: p.y + currentStampSize, color: colorPk.value, text: getNextStampValue(), width: 0, opacity: 1, hasShadow: isShadow };
        shapes.push(s); selectedShape = s; saveState(); renderMain(); updateStampBubble(); return;
    }
    if (tool === 'magnifier') {
        const snap = magLens.toDataURL();
        const s = { type: 'magnifier-snap', x: p.x - (magSize/2), y: p.y - (magSize/2), w: magSize, h: magSize, imgData: snap, color: colorPk.value, width: parseInt(sizeSl.value) || 3, hasShadow: isShadow };
        shapes.push(s); selectedShape = s; saveState(); renderMain(); document.querySelector('.tool-btn[data-t="cursor"]').click(); return;
    }

    const hit = hitTest(p);
    let allowSelect = false;
    
    if (tool === 'cursor') { allowSelect = true; } 
    else if (hit && tool !== 'eraser' && tool !== 'text') {
        if (tool === 'polygon') { if (polygonPoints.length === 0) allowSelect = true; } 
        else { allowSelect = true; }
    }

    const rect = frame.getBoundingClientRect();
    const isInsideFrame = (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom);

    let shouldDragFrame = false;
    if (tool === 'cursor' && !hit) {
        if (!isFullscreen) {
            shouldDragFrame = true;
        } else {
            if (isInsideFrame && frame.offsetWidth > 0) {
                shouldDragFrame = true;
            }
        }
    }

    if (shouldDragFrame) {
        selectedShape = null; 
        isDraggingFrame = true; 
        const parentRect = frame.parentElement.getBoundingClientRect(); 
        frameStartX = e.clientX - rect.left; 
        frameStartY = e.clientY - rect.top; 
        frame.style.position = 'absolute'; 
        frame.style.left = (rect.left - parentRect.left) + 'px'; 
        frame.style.top = (rect.top - parentRect.top) + 'px'; 
        frame.style.cursor = 'grabbing'; 
        renderMain(); 
        return;
    }

   if (isFullscreen && tool === 'cursor' && !hit && !isDraggingFrame && !isResizing) {
        frame.classList.remove('clean-slate');
        isCreatingFrame = true;
        shapes = [];
        if (typeof clearBackground === 'function') clearBackground();
        renderMain();

        frame.style.display = 'block'; frame.style.position = 'absolute'; frame.style.margin = '0'; 
        const viewportRect = frame.parentElement.getBoundingClientRect();
        frameStartX = e.clientX - viewportRect.left; frameStartY = e.clientY - viewportRect.top;
        frame.style.left = frameStartX + 'px'; frame.style.top = frameStartY + 'px'; 
        frame.style.width = '0px'; frame.style.height = '0px';
        selectedShape = null; frame.setPointerCapture(e.pointerId);
        
        // --- NEW: Cloak the canvases ---
        [canvas, backgroundCanvas, scratchCanvas, shapeLayerCanvas].forEach(c => c.style.opacity = '0');
        return;
    }

    if (allowSelect && hit) { 
        selectedShape = hit; isDraggingShape = true; isDown = true; 
        dragOffsetX = p.x - selectedShape.x; dragOffsetY = p.y - selectedShape.y; 
        if(selectedShape.ex !== undefined) { dragExOffset = p.x - selectedShape.ex; dragEyOffset = p.y - selectedShape.ey; } 
        if(selectedShape.cp) { dragCpOffsetX = p.x - selectedShape.cp.x; dragCpOffsetY = p.y - selectedShape.cp.y; }
        
        cursorDot.style.display = 'none'; updateAuxUI(); renderMain(); return;
    }

    if (tool === 'polygon') {
        let targetP = { x: p.x, y: p.y };

        if (polygonPoints.length > 0) {
            const startPt = polygonPoints[polygonPoints.length - 1];

            if (e.shiftKey) {
                const dx = targetP.x - startPt.x;
                const dy = targetP.y - startPt.y;
                const dist = Math.hypot(dx, dy);
                const rawAngle = Math.atan2(dy, dx);
                
                const snappedAngle = Math.round(rawAngle / angleSnapRad) * angleSnapRad;
                
                targetP.x = startPt.x + dist * Math.cos(snappedAngle);
                targetP.y = startPt.y + dist * Math.sin(snappedAngle);
            } 
            else if (userSettings.snapToGrid) {
                targetP.x = applyGridSnap(targetP.x, 'x');
                targetP.y = applyGridSnap(targetP.y, 'y');
            }
        } 
        else if (userSettings.snapToGrid) {
            targetP.x = applyGridSnap(targetP.x, 'x');
            targetP.y = applyGridSnap(targetP.y, 'y');
        }

        if (polygonPoints.length > 2) { 
            const start = polygonPoints[0]; 
            if (Math.hypot(targetP.x - start.x, targetP.y - start.y) < snapRadius) { 
                finishPolygon(); 
                return; 
            } 
        }

        polygonPoints.push(targetP); 
        
        activeShape = { type: 'polygon_drag', x: targetP.x, y: targetP.y, ex: targetP.x, ey: targetP.y }; 

        [btnBold, fbBtnBold].forEach(btn => {
            if (btn) btn.onclick = () => {
                btnBold.classList.toggle('active');
                fbBtnBold.classList.toggle('active');
                applyPropertyChange('fontStyle', 'update'); 
            };
        });

        [btnItalic, fbBtnItalic].forEach(btn => {
            if (btn) btn.onclick = () => {
                btnItalic.classList.toggle('active');
                fbBtnItalic.classList.toggle('active');
                applyPropertyChange('fontStyle', 'update');
            };
        });
        
        renderMain(); 
        return;
    }
    
    if (tool === 'text') { createTextInput(p.x, p.y); return; }

    if (tool === 'eraser') { 
        if (eraserMode === 'brush') { selectedShape = null; isDown = true; startX = p.x; startY = p.y; activeShape = { type: 'eraser-stroke', points: [p], width: sizeSl.value, x: 0, y: 0 }; renderMain(); return; } 
        else { if (hit) { shapes = shapes.filter(s => s !== hit); selectedShape = null; saveState(); renderMain(); } isDown = false; return; }
    }

    selectedShape = null; isDown = true; 
    if (userSettings.snapToGrid) { startX = applyGridSnap(p.x, 'x'); startY = applyGridSnap(p.y, 'y'); } else { startX = p.x; startY = p.y; }
    
    const drawColor = colorPk.value;
    
    if (tool === 'pen') { 
        activeShape = { type: tool, color: drawColor, width: sizeSl.value, opacity: opacitySl.value, hasShadow: isShadow, points: [p], x:0, y:0 }; 
    } 
    else if (tool === 'line') { 
        activeShape = { type: tool, x: startX, y: startY, w: 0, h: 0, ex: startX, ey: startY, color: drawColor, width: sizeSl.value, opacity: isHighlighter ? userSettings.highlighterOpacity : opacitySl.value, isSolid: false, hasShadow: isHighlighter ? false : isShadow, isDotted: isDotted }; 
    }
    else if (tool === 'blur') { 
        activeShape = { type: 'blur', x: startX, y: startY, w: 0, h: 0, ex: startX, ey: startY, color: 'transparent', width: 0, opacity: 1 }; 
    }
    else { 
        activeShape = { 
            type: tool, 
            x: startX, y: startY, w: 0, h: 0, ex: startX, ey: startY, 
            color: drawColor, width: sizeSl.value, opacity: opacitySl.value, 
            isSolid: fillStates[tool], hasShadow: isShadow, rotation: 0, isDotted: isDotted,
            arrowStyle: userSettings.arrowStyle 
        }; 
    }
    
    renderMain();
});

window.addEventListener('pointermove', e => {
    if (isDown || isResizing || isDraggingFrame || isDraggingShape) e.preventDefault();
    
    let p; const clientX = e.clientX !== undefined ? e.clientX : lastClientX; const clientY = e.clientY !== undefined ? e.clientY : lastClientY;
    p = getXY(e); lastClientX = e.clientX; lastClientY = e.clientY;

    if (tool === 'eyedropper' && typeof AppFeatures !== 'undefined' && AppFeatures.type !== 'core') {
        cursorDot.style.display = 'none'; frame.classList.remove('cursor-eyedropper');
        const rect = frame.getBoundingClientRect(); const pickX = clientX - rect.left; const pickY = clientY - rect.top;

        if (pickX < 0 || pickY < 0 || pickX > w || pickY > h) {
            if (microLens) microLens.style.display = 'none'; if (virtualSyringe) virtualSyringe.style.display = 'none';
            document.body.classList.remove('force-no-cursor'); frame.style.cursor = 'default'; return;
        }
        if (showMicroLens) {
            AdvancedTools.updateEyedropperUnit(clientX, clientY, frame, w, h, dpr, backgroundCanvas, canvas); if (!isDown) return; 
        } else {
            document.body.classList.add('force-no-cursor'); frame.style.cursor = 'none'; microLens.style.display = 'none';
            virtualSyringe.style.display = 'block'; virtualSyringe.style.left = (clientX - SYRINGE_HOTSPOT_X) + 'px'; virtualSyringe.style.top = (clientY - SYRINGE_HOTSPOT_Y) + 'px'; 
        }
    } 
    else if (tool === 'stamp' && !isDown && !isDraggingShape) {
        const rect = frame.getBoundingClientRect(); 
        const isInsideCanvas = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
        
        const isOverUI = document.elementFromPoint(clientX, clientY)?.closest('.header, .footer, #floating-bar, .modal, #settings-modal, .color-popup, #stamp-bubble');

        if (!isInsideCanvas || isOverUI) {
            if (virtualStamp) virtualStamp.style.display = 'none';
            document.body.classList.remove('force-no-cursor'); 
            frame.style.cursor = 'default';
            return;
        }

        document.body.classList.add('force-no-cursor'); frame.style.cursor = 'none';
        if (microLens) microLens.style.display = 'none'; if (virtualSyringe) virtualSyringe.style.display = 'none';

        virtualStamp.style.display = 'flex';
        virtualStamp.style.width = currentStampSize + 'px';
        virtualStamp.style.height = currentStampSize + 'px';
        virtualStamp.style.left = (clientX - currentStampSize / 2) + 'px';
        virtualStamp.style.top = (clientY - currentStampSize / 2) + 'px';
        
        virtualStamp.style.borderColor = colorPk.value;
        virtualStamp.style.color = '#fff'; 
        virtualStamp.style.textShadow = `0 0 6px ${colorPk.value}, 0 0 12px ${colorPk.value}`;
        virtualStamp.style.boxShadow = `0 0 15px ${colorPk.value}, inset 0 0 10px ${colorPk.value}`;
        
        virtualStamp.innerText = getCurrentStampValue();
        virtualStamp.style.fontSize = (currentStampSize * 0.55) + 'px';
    }
    else {
        document.body.classList.remove('force-no-cursor');
        frame.classList.remove('cursor-eyedropper'); 
        if(microLens) microLens.style.display = 'none';
        if(virtualSyringe) virtualSyringe.style.display = 'none';
        if(virtualStamp) virtualStamp.style.display = 'none';
    }

    if (tool === 'magnifier') {
        AdvancedTools.updateMagnifierLens(clientX, clientY, magSize, magZoom, tool, frame, backgroundCanvas, canvas, dpr, sizeSl.value, colorPk.value);
        return; 
    } else {
        if(typeof magLens !== 'undefined' && magLens) magLens.style.display = 'none';
    }

    if (isResizing) {
        if (e.shiftKey) frame.style.cursor = 'crosshair'; else frame.style.cursor = resizeDir + '-resize';
        const dx = e.clientX - startResizeX; const dy = e.clientY - startResizeY;
        let newX = startResizeLeft; let newY = startResizeTop; let newW = startResizeW; let newH = startResizeH;
        
        if (resizeDir.includes('w')) { newX = startResizeLeft + dx; newW = startResizeW - dx; }
        if (resizeDir.includes('n')) { newY = startResizeTop + dy; newH = startResizeH - dy; }
        if (resizeDir.includes('e')) { newW = startResizeW + dx; }
        if (resizeDir.includes('s')) { newH = startResizeH + dy; }
        
        if (e.shiftKey) { const size = Math.max(newW, newH); newW = size; newH = size; if (resizeDir.includes('w')) { newX = (startResizeLeft + startResizeW) - size; } if (resizeDir.includes('n')) { newY = (startResizeTop + startResizeH) - size; } }
        const MIN_SIZE = 50; 
        if (newW < MIN_SIZE) { if (resizeDir.includes('w')) newX = startResizeLeft + (startResizeW - MIN_SIZE); newW = MIN_SIZE; }
        if (newH < MIN_SIZE) { if (resizeDir.includes('n')) newY = startResizeTop + (startResizeH - MIN_SIZE); newH = MIN_SIZE; }

        frame.style.width = newW + 'px'; frame.style.height = newH + 'px'; 
        frame.style.left = newX + 'px'; frame.style.top = newY + 'px';
        if (inpW) inpW.value = Math.round(newW); if (inpH) inpH.value = Math.round(newH);

        if (isResizing) {
            const vpRect = frame.parentElement.getBoundingClientRect();
            let dotX = vpRect.left + newX; let dotY = vpRect.top + newY;
            if (resizeDir.includes('e')) { dotX += newW; } else if (!resizeDir.includes('w')) { dotX += newW / 2; }
            if (resizeDir.includes('s')) { dotY += newH; } else if (!resizeDir.includes('n')) { dotY += newH / 2; }
            if (cursorDot) { cursorDot.style.left = dotX + 'px'; cursorDot.style.top = dotY + 'px'; cursorDot.style.display = 'block'; }
        }
        updateMeasureTooltip(e.clientX, e.clientY, `<span>W:</span> ${Math.round(newW)}px  <span>H:</span> ${Math.round(newH)}px`);
        return;
    }

   if (isCreatingFrame) {
        // Force the border to be visible and clear the hidden state
        frame.style.display = 'block';
        frame.style.border = `2px dashed ${userSettings.accentColor}`;
        frame.classList.remove('clean-slate');
        
        // Ensure the cursor stays a crosshair, not a hand
        document.body.style.cursor = 'crosshair';
        frame.style.cursor = 'crosshair';

        const viewportRect = frame.parentElement.getBoundingClientRect();
        const currentX = clientX - viewportRect.left; 
        const currentY = clientY - viewportRect.top;
        
        let width = Math.abs(currentX - frameStartX); 
        let height = Math.abs(currentY - frameStartY);
        
        // 2. Handle Shift-Key for perfect 1:1 ratio (Square)
        if (e.shiftKey) { 
            const size = Math.max(width, height); 
            width = size; 
            height = size; 
        }
        
        // 3. Position and size the frame based on the drag origin
        frame.style.left = Math.min(currentX, frameStartX) + 'px'; 
        frame.style.top = Math.min(currentY, frameStartY) + 'px'; 
        frame.style.width = width + 'px'; 
        frame.style.height = height + 'px'; 
        
        // 4. Update the header inputs for real-time dimension tracking
        if (inpW) inpW.value = Math.round(width); 
        if (inpH) inpH.value = Math.round(height); 
        
        // 5. Show the precision measure tooltip next to the cursor
        updateMeasureTooltip(clientX, clientY, `<span>W:</span> ${Math.round(width)}px  <span>H:</span> ${Math.round(height)}px`);
        return;
    }

    if(userSettings.immersiveMode) { 
        const rect = frame.getBoundingClientRect(); 
        const isOverUI = e.target.closest('.header') || e.target.closest('.footer');
        
        const nearEdge = (clientX < rect.left + 10 || clientX > rect.right - 10 || clientY < rect.top + 10 || clientY > rect.bottom - 10);
        
        if (nearEdge || isOverUI || isDraggingFrame || isResizing) { 
             document.body.classList.remove('immersive-active'); 
             frame.classList.remove('immersive-active'); 
        } 
        else { 
             document.body.classList.add('immersive-active'); 
             frame.classList.add('immersive-active'); 
        }
    } else { 
        document.body.classList.remove('immersive-active'); 
        frame.classList.remove('immersive-active'); 
    }

    let hoverHandle = 0;
    if (selectedShape && !isDraggingShape && !isDraggingFrame && !isResizing && !isCreatingFrame && !isDown) { hoverHandle = getHandleAt(p, selectedShape); }
    if (hoverHandle > 0) { frame.style.cursor = 'default'; cursorDot.style.display = 'none'; frame.classList.remove('cursor-eyedropper'); } 
    else {
        if (tool === 'cursor' && !hitTest(p) && !isDraggingShape && !draggingHandle && !isCreatingFrame) { frame.style.cursor = isDraggingFrame ? 'grabbing' : 'grab'; } 
        else if (tool === 'cursor' && !isDraggingFrame) { frame.style.cursor = 'default'; }
        if (tool !== 'cursor') { 
            if (tool === 'eyedropper') { /* Handled at top */ } 
            else if (tool === 'ocr' || tool === 'stamp' || userSettings.cursorStyle === 'crosshair') { cursorDot.style.display = 'none'; frame.style.cursor = (tool === 'stamp') ? 'copy' : 'crosshair'; } 
            else { frame.style.cursor = 'none'; clampCursorDot(clientX, clientY); cursorDot.style.display = 'block'; }
        } else { cursorDot.style.display = 'none'; }
    }

    if (isDraggingFrame) { 
        const parentRect = frame.parentElement.getBoundingClientRect(); 
        
        let newX = clientX - parentRect.left - frameStartX; 
        let newY = clientY - parentRect.top - frameStartY; 

        const minX = 2; 
        const maxX = parentRect.width - frame.offsetWidth - 2; 
        const minY = 48; 
        const maxY = parentRect.height - frame.offsetHeight - 48; 

        newX = Math.max(minX, Math.min(newX, maxX));
        newY = Math.max(minY, Math.min(newY, maxY));

        frame.style.left = newX + 'px'; 
        frame.style.top = newY + 'px'; 
        
        if (userSettings.showMeasurements) { 
            const rect = frame.getBoundingClientRect(); 
            
            let tipX = rect.right + 10;
            let tipY = rect.bottom + 10;
            
            if (tipX + 120 > window.innerWidth) {
                tipX = rect.right - 130; 
            }
            if (tipY + 40 > window.innerHeight) {
                tipY = rect.bottom - 40; 
            }
            
            updateMeasureTooltip(tipX, tipY, `W: ${Math.round(rect.width)}  H: ${Math.round(rect.height)}`); 
        }

        // [THE FIX] Live Viewfinder: Instantly repaint the canvas from the frozen background while dragging!
        if (isFullscreen && isWGCFrozen && capturedImage) {
            const srcX = Math.round((newX + parentRect.left) * dpr);
            const srcY = Math.round((newY + parentRect.top) * dpr);
            const innerW = w * dpr;
            const innerH = h * dpr;

            bgCtx.save();
            bgCtx.setTransform(1, 0, 0, 1, 0, 0);
            bgCtx.clearRect(0, 0, innerW, innerH);
            bgCtx.drawImage(capturedImage, srcX, srcY, innerW, innerH, 0, 0, innerW, innerH);
            bgCtx.restore();

            if (typeof renderMain === 'function') renderMain();
        }

        return; 
    }

    if (isDraggingText && activeTextWrapper) { 
        const frameRect = frame.getBoundingClientRect(); 
        let newX = clientX - frameRect.left - dragOffsetX; let newY = clientY - frameRect.top - dragOffsetY; 
        if(userSettings.snapToGrid) { newX = applyGridSnap(newX, 'x'); newY = applyGridSnap(newY, 'y'); }
        activeTextWrapper.style.left = newX + 'px'; activeTextWrapper.style.top = newY + 'px'; return; 
    }

    if (tool === 'polygon' && activeShape) { 
        let targetX = p.x; let targetY = p.y;
        
        const startPt = (polygonPoints.length > 0) 
            ? polygonPoints[polygonPoints.length - 1] 
            : { x: activeShape.x, y: activeShape.y };

        if (e.shiftKey) {
            const dx = targetX - startPt.x;
            const dy = targetY - startPt.y;
            const dist = Math.hypot(dx, dy);
            const rawAngle = Math.atan2(dy, dx);
            
            const snappedAngle = Math.round(rawAngle / angleSnapRad) * angleSnapRad;
            
            targetX = startPt.x + dist * Math.cos(snappedAngle);
            targetY = startPt.y + dist * Math.sin(snappedAngle);
        }
        else if (userSettings.snapToGrid) { 
            targetX = applyGridSnap(targetX, 'x'); 
            targetY = applyGridSnap(targetY, 'y'); 
        }

        activeShape.ex = targetX; 
        activeShape.ey = targetY; 
        
        if (userSettings.showMeasurements) { 
            const dist = Math.round(Math.hypot(activeShape.ex - startPt.x, activeShape.ey - startPt.y)); 
            let deg = Math.round(Math.atan2(activeShape.ey - startPt.y, activeShape.ex - startPt.x) * (180/Math.PI));
            if (deg < 0) deg += 360;
            updateMeasureTooltip(clientX, clientY, `Len: ${dist}px  ∠: ${deg}°`); 
        }

        const canvasRect = canvas.getBoundingClientRect();
        clampCursorDot(canvasRect.left + targetX, canvasRect.top + targetY);
        
        if (cursorDot) {
            cursorDot.style.left = screenX + 'px';
            cursorDot.style.top = screenY + 'px';
        }
        
        renderMain(); 
        return; 
    }

    if (isDraggingShape && selectedShape) { 
        let newX = p.x - dragOffsetX; 
        let newY = p.y - dragOffsetY;
        let diffX = 0, diffY = 0;

        if (userSettings.snapToGrid) {
            const snappedX = applyGridSnap(newX, 'x'); 
            const snappedY = applyGridSnap(newY, 'y');
            diffX = snappedX - selectedShape.x; 
            diffY = snappedY - selectedShape.y;
            selectedShape.x = snappedX; 
            selectedShape.y = snappedY;
        } else {
            selectedShape.x = newX; 
            selectedShape.y = newY;
        }

        if (selectedShape.ex !== undefined) {
            if(userSettings.snapToGrid) { 
                selectedShape.ex += diffX; 
                selectedShape.ey += diffY; 
                if(selectedShape.cp) { 
                    selectedShape.cp.x += diffX; 
                    selectedShape.cp.y += diffY; 
                } 
            } 
            else { 
                selectedShape.ex = p.x - dragExOffset; 
                selectedShape.ey = p.y - dragEyOffset;
                
                if (selectedShape.cp) {
                    selectedShape.cp.x = p.x - dragCpOffsetX;
                    selectedShape.cp.y = p.y - dragCpOffsetY;
                }
            }
        }
        
        if (!userSettings.snapToGrid) calculateSmartSnaps(selectedShape);
        renderMain(); 
        return; 
    }

    if (isDown && selectedShape && draggingHandle > 0) {
        const s = selectedShape; let targetX = p.x; let targetY = p.y;
        if (userSettings.snapToGrid) { targetX = applyGridSnap(p.x, 'x'); targetY = applyGridSnap(p.y, 'y'); }

        if (draggingHandle === 99) {
            const radius = s.w / 2; const cx = s.x + radius; const cy = s.y + radius;
            const angle = Math.atan2(targetY - cy, targetX - cx);
            const distToMouse = Math.hypot(targetX - cx, targetY - cy);
            const scale = s.w / 30; const headLen = 10 * scale; const shaftOffset = headLen * 1.0; 
            s.ex = cx + (distToMouse + shaftOffset) * Math.cos(angle); s.ey = cy + (distToMouse + shaftOffset) * Math.sin(angle);
        }
        else if (draggingHandle >= 100) { const ptIndex = draggingHandle - 100; if (s.points && s.points[ptIndex]) { s.points[ptIndex].x = targetX - s.x; s.points[ptIndex].y = targetY - s.y; } }
        else if (draggingHandle === 6) { 
            let newX = p.x - dragOffsetX; let newY = p.y - dragOffsetY;
            if (userSettings.snapToGrid) {
                const snappedX = applyGridSnap(newX, 'x'); const snappedY = applyGridSnap(newY, 'y');
                const diffX = snappedX - s.x; const diffY = snappedY - s.y;
                s.x = snappedX; s.y = snappedY;
                if(s.ex !== undefined) { s.ex += diffX; s.ey += diffY; }
                if(s.cp) { s.cp.x += diffX; s.cp.y += diffY; }
            } else {
                s.x = newX; s.y = newY;
                if(s.ex !== undefined) { s.ex = p.x - dragExOffset; s.ey = p.y - dragEyOffset; }
                if(s.cp) { s.cp.x = p.x - dragCpOffsetX; s.cp.y = p.y - dragCpOffsetY; }
            }
        } 
        else if (draggingHandle === 7) { if (!s.cp) s.cp = { x: targetX, y: targetY }; s.cp.x = targetX; s.cp.y = targetY; dragCpOffsetX = p.x - s.cp.x; dragCpOffsetY = p.y - s.cp.y; }
        else if (['line', 'arrow'].includes(s.type) && (draggingHandle === 1 || draggingHandle === 2)) {
             if (draggingHandle === 1) { s.x = targetX; s.y = targetY; }
             else if (draggingHandle === 2) {
                 if (e.shiftKey) {
                     const rawAngle = Math.atan2(targetY - s.y, targetX - s.x);
                     const snappedAngle = Math.round(rawAngle / angleSnapRad) * angleSnapRad;
                     const length = Math.hypot(targetX - s.x, targetY - s.y);
                     s.ex = s.x + length * Math.cos(snappedAngle); s.ey = s.y + length * Math.sin(snappedAngle);
                 } else { s.ex = targetX; s.ey = targetY; }
             }
             if (userSettings.showMeasurements) { const len = Math.round(Math.hypot(s.ex - s.x, s.ey - s.y)); const deg = Math.round(Math.atan2(s.ey - s.y, s.ex - s.x) * (180/Math.PI)); updateMeasureTooltip(e.clientX, e.clientY, `Len: ${len}px  ${deg}°`); }
        }
        else if (draggingHandle <= 4) {
            let newX = s.x, newY = s.y, newW = s.w, newH = s.h;
            if (draggingHandle === 1) { newX = targetX; newY = targetY; newW = (s.x + s.w) - newX; newH = (s.y + s.h) - newY; }
            else if (draggingHandle === 2) { newY = targetY; newW = targetX - s.x; newH = (s.y + s.h) - newY; }
            else if (draggingHandle === 3) { newW = targetX - s.x; newH = targetY - s.y; }
            else if (draggingHandle === 4) { newX = targetX; newW = (s.x + s.w) - newX; newH = targetY - s.y; }
            if (e.shiftKey) { const ratio = Math.abs(dragStartW / dragStartH); if (Math.abs(newW) > Math.abs(newH)) { const signH = newH < 0 ? -1 : 1; newH = (Math.abs(newW) / ratio) * signH; } else { const signW = newW < 0 ? -1 : 1; newW = (Math.abs(newH) * ratio) * signW; } if (draggingHandle === 1) { newX = (s.x + s.w) - newW; newY = (s.y + s.h) - newH; } else if (draggingHandle === 2) { newY = (s.y + s.h) - newH; } else if (draggingHandle === 4) { newX = (s.x + s.w) - newW; } }
            if (s.type === 'stamp' || s.type === 'magnifier-snap') { const MAX_SIZE = s.type === 'magnifier-snap' ? 200 : 100; const MIN_SIZE = 20; let size = Math.max(Math.abs(newW), Math.abs(newH)); if (size > MAX_SIZE) size = MAX_SIZE; if (size < MIN_SIZE) size = MIN_SIZE; newW = size; newH = size; if (draggingHandle === 1) { newX = (s.x + s.w) - newW; newY = (s.y + s.h) - newH; } else if (draggingHandle === 2) { newY = (s.y + s.h) - newH; } else if (draggingHandle === 4) { newX = (s.x + s.w) - newW; } }
            s.x = newX; s.y = newY; s.w = newW; s.h = newH;
            if (userSettings.showMeasurements) updateMeasureTooltip(e.clientX, e.clientY, `W: ${Math.round(Math.abs(newW))}  H: ${Math.round(Math.abs(newH))}`);
        }
        else if (draggingHandle === 5) { 
            const c = MathUtils.getShapeCenter(s); const rawAngle = Math.atan2(p.y - c.y, p.x - c.x) + Math.PI/2; 
            s.rotation = e.shiftKey ? Math.round(rawAngle / angleSnapRad) * angleSnapRad : rawAngle; 
            if (userSettings.showMeasurements) { const deg = Math.round(s.rotation * (180/Math.PI)); updateMeasureTooltip(e.clientX, e.clientY, `${deg}°`); }
        }
        renderMain(); return;
    }

    if (isDown && activeShape && tool !== 'cursor') {
        if (tool === 'pen' || (tool === 'eraser' && eraserMode === 'brush')) { 
            activeShape.points.push(p); 
        } 
        else {
            snapLines = []; 
            let targetP = p;
            if (userSettings.snapToGrid) { targetP = { x: applyGridSnap(p.x, 'x'), y: applyGridSnap(p.y, 'y') }; } 
            else { targetP = calculateDrawingSnap(p); } 
            
            let curW = targetP.x - startX; let curH = targetP.y - startY;
            if (e.shiftKey) {
                if (tool === 'line' || tool === 'arrow') { const rawAngle = Math.atan2(curH, curW); const dist = Math.hypot(curW, curH); const snappedAngle = Math.round(rawAngle / angleSnapRad) * angleSnapRad; const lockedX = startX + dist * Math.cos(snappedAngle); const lockedY = startY + dist * Math.sin(snappedAngle); curW = lockedX - startX; curH = lockedY - startY; targetP = { x: lockedX, y: lockedY }; }
                else if (tool === 'triangle') { const size = Math.abs(curW); const height = size * (Math.sqrt(3) / 2); curW = (curW < 0 ? -1 : 1) * size; curH = (curH < 0 ? -1 : 1) * height; targetP = { x: startX + curW, y: startY + curH }; }
                else { const size = Math.max(Math.abs(curW), Math.abs(curH)); curW = (curW < 0 ? -1 : 1) * size; curH = (curH < 0 ? -1 : 1) * size; targetP = { x: startX + curW, y: startY + curH }; }
            }
            activeShape.w = curW; activeShape.h = curH; activeShape.ex = targetP.x; activeShape.ey = targetP.y;
            let measureText = '';
            if (tool === 'line' || tool === 'arrow') { let angleDeg = Math.round(Math.atan2(curH, curW) * (180/Math.PI)); if (angleDeg < 0) angleDeg += 360; const len = Math.round(Math.hypot(curW, curH)); measureText = `<span>L:</span> ${len}px  <span>∠:</span> ${angleDeg}°`; } 
            else { measureText = `<span>W:</span> ${Math.abs(Math.round(activeShape.w))}px  <span>H:</span> ${Math.abs(Math.round(activeShape.h))}px`; }
            if(tool !== 'pen' && tool !== 'eraser') updateMeasureTooltip(clientX, clientY, measureText);
        }
        renderMain();
    }
});

const handleShiftChange = (e) => { 
    if (e.key === 'Shift') {
        const isShiftDown = e.type === 'keydown';
        
        if (isResizing) {
            if (isShiftDown) {
                frame.style.cursor = 'crosshair';
            } else {
                frame.style.cursor = resizeDir + '-resize';
            }
        }

        if (isDown) { 
            window.dispatchEvent(new PointerEvent('pointermove', { clientX: lastClientX, clientY: lastClientY, shiftKey: isShiftDown }));
        }
    }
};
window.addEventListener('keydown', handleShiftChange); window.addEventListener('keyup', handleShiftChange);

frame.addEventListener('pointerenter', () => { if (tool !== 'cursor' && userSettings.cursorStyle !== 'crosshair') cursorDot.style.display = 'block'; });
frame.addEventListener('pointerleave', () => { cursorDot.style.display = 'none'; });

window.addEventListener('pointerup', e => {
    const currentFrameW = parseFloat(frame.style.width) || 0;
    const currentFrameH = parseFloat(frame.style.height) || 0;
    
    const wasMovingSelection = isCreatingFrame || isResizing || isDraggingFrame;
    const wasResizing = isResizing; 

    isDraggingFrame = false;
    isResizing = false;
    isCreatingFrame = false;
    isDraggingShape = false;
    isDraggingText = false;
    isDown = false;
    draggingHandle = 0;

    // --- NEW: Restore the canvases ---
    [canvas, backgroundCanvas, scratchCanvas, shapeLayerCanvas].forEach(c => c.style.opacity = '1');

    canvas.style.removeProperty('outline');

    try {
        if (frame.hasPointerCapture(e.pointerId)) {
            frame.releasePointerCapture(e.pointerId);
        }
    } catch (err) { }

    if (!isFullscreen && wasResizing) {
        isSuppressingResize = true;
        updateCanvasSize(currentFrameW, currentFrameH, true); 
        setTimeout(() => { 
            isSuppressingResize = false; 
            renderMain(); 
        }, 50);
        return; 
    }

    if (isFullscreen && isWGCFrozen && capturedImage) {
        if (wasMovingSelection && currentFrameW > 5 && currentFrameH > 5) {
            w = currentFrameW;
            h = currentFrameH;
            updateCanvasSize(w, h, true); 
            frame.style.width = w + 'px';
            frame.style.height = h + 'px';
            frame.classList.remove('clean-slate');
            hasSnappedInFullscreen = true; 
            renderMain(); 
            
            if (userSettings.autoClipboard) {
                doClipboard().then(() => showToast("Selection Snapped & Copied!", 1500));
            } else {
                showToast("Selection snapped!");
            }
            return; 
        }
    }

    frame.style.cursor = 'default';
    hideMeasureTooltip();
    snapLines = []; 
    
    if (tool === 'ocr' && activeShape) {
        const sel = activeShape; 
        activeShape = null;
        if(Math.abs(sel.w) > 5 && Math.abs(sel.h) > 5) {
            const rX = sel.w < 0 ? sel.x + sel.w : sel.x; 
            const rY = sel.h < 0 ? sel.y + sel.h : sel.y;
            AdvancedTools.performOCR(rX, rY, Math.abs(sel.w), Math.abs(sel.h), backgroundCanvas, shapes, dpr, drawShape, frame, window.electronAPI);
        }
        document.querySelector('.tool-btn[data-t="cursor"]').click(); 
        return;
    }

    if (activeShape) {
        const isDotClick = (activeShape.type === 'pen' || activeShape.type === 'eraser-stroke') && 
                          activeShape.points && activeShape.points.length >= 1;

        const hasSize = Math.abs(activeShape.w) > 2 || Math.abs(activeShape.h) > 2;

        if (isDotClick || hasSize) {
            shapes.push(activeShape); 
            selectedShape = activeShape; 
            saveState(); 
        }
        activeShape = null; 
    }
    
    renderMain();
});

document.querySelectorAll('.tool-btn').forEach(btn => {
    // [FIX] Added fb-max and fb-reset to the ignore list so their logic survives!
    if (!['btn-multishape', 'fb-btn-multishape', 'font-family', 'fb-font-family', 'fb-max', 'fb-reset'].includes(btn.id)) {
        btn.onclick = (e) => handleToolClick(e.currentTarget);
    }
});

document.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        const subTool = item.dataset.sub || item.dataset.t;

        if (shapeMenu) shapeMenu.classList.remove('show');
        if (fbShapeMenu) fbShapeMenu.classList.remove('show');

        if (item.dataset.sub) {
            syncMultiShapeUI(subTool, fillStates[subTool] || false);
        }
        handleToolClick({ dataset: { t: subTool } });
    });
});

document.querySelectorAll('.tool-btn[data-t="square"], .tool-btn[data-t="circle"], .tool-btn[data-t="text"]').forEach(b => {
    b.onclick = (e) => handleToolClick(e.currentTarget);
    b.ondblclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        toggleSolidMode(b.dataset.t);
    };
});

document.addEventListener('dblclick', (e) => {
    const targetBtn = e.target.closest('#btn-multishape, #fb-btn-multishape');
    
    if (targetBtn) {
        e.preventDefault(); 
        e.stopPropagation();
        
        if (['star', 'polygon', 'check', 'triangle', 'x-shape'].includes(tool)) {
            toggleSolidMode(tool);
        }
    }
}, true); 

const mainMultiBtn = document.getElementById('btn-multishape');
if (mainMultiBtn) {
    mainMultiBtn.onclick = (e) => handleToolClick(e.currentTarget);
    
    mainMultiBtn.oncontextmenu = (e) => {
        e.preventDefault(); e.stopPropagation();
        [arrowMenu, fbArrowMenu, fbShapeMenu].forEach(m => { if (m) m.classList.remove('show'); });
        if (shapeMenu) shapeMenu.classList.toggle('show');
    };
}

document.querySelectorAll('.tool-btn[data-t="eraser"]').forEach(b => { b.addEventListener('dblclick', toggleEraserMode); });

document.querySelectorAll('.tool-btn[data-t="line"]').forEach(b => { b.oncontextmenu = toggleHighlighterMode; });

const btnFooterExtras = document.getElementById('btn-footer-extras');
const footerExtrasMenu = document.getElementById('footer-extras-menu');

if(btnFooterExtras) { 
    btnFooterExtras.onclick = (e) => { 
        e.stopPropagation(); 
        if(typeof shapeMenu !== 'undefined' && shapeMenu) shapeMenu.classList.remove('show');
        if(footerExtrasMenu) footerExtrasMenu.classList.toggle('show'); 
    }; 
}

window.addEventListener('click', (e) => { 
    if (footerExtrasMenu && !footerExtrasMenu.contains(e.target) && btnFooterExtras && !btnFooterExtras.contains(e.target)) { 
        footerExtrasMenu.classList.remove('show'); 
    } 
});

const btnEye = document.getElementById('btn-eyedropper');
if(btnEye) btnEye.onclick = () => handleToolClick(btnEye);

const btnStamp = document.getElementById('btn-stamp');
if(btnStamp) {
    btnStamp.onclick = () => handleToolClick(btnStamp);
    btnStamp.oncontextmenu = (e) => { 
        e.preventDefault(); 
        showConfirm(`Reset stamp counter (${stampMode})?`, () => { resetStampCounter(); });
    };
}

const btnBlur = document.getElementById('btn-blur');
if(btnBlur) btnBlur.onclick = () => handleToolClick(btnBlur);

const btnMag = document.getElementById('btn-magnifier');
if(btnMag) btnMag.onclick = () => handleToolClick(btnMag);

const btnOCR = document.getElementById('btn-ocr');
if(btnOCR) btnOCR.onclick = () => handleToolClick(btnOCR);

if(document.getElementById('btn-snap')) document.getElementById('btn-snap').onclick = doSnap;
if(document.getElementById('btn-save')) document.getElementById('btn-save').onclick = doSave;
if(document.getElementById('fb-save')) document.getElementById('fb-save').onclick = doSave;
if(document.getElementById('btn-snap')) document.getElementById('btn-snap').onclick = doSnap;
if(document.getElementById('fb-snap')) document.getElementById('fb-snap').onclick = doSnap;

const handleSaveAndClose = async (e) => {
    const success = await doSave(e); 
    if (success !== false) window.electronAPI.send('close-app'); 
};
if(document.getElementById('btn-save-close')) document.getElementById('btn-save-close').onclick = handleSaveAndClose;
if(document.getElementById('fb-save-close')) document.getElementById('fb-save-close').onclick = handleSaveAndClose;

if(document.getElementById('btn-del')) document.getElementById('btn-del').onclick = doDelete;
if(document.getElementById('fb-del')) document.getElementById('fb-del').onclick = doDelete;

const toggleGrid = () => { 
    const g = document.getElementById('grid'); 
    g.classList.toggle('hidden'); 
    const isVisible = !g.classList.contains('hidden'); 
    
    document.getElementById('grid-toggle').classList.toggle('active', isVisible); 
    if(document.getElementById('fb-grid-toggle')) document.getElementById('fb-grid-toggle').classList.toggle('active', isVisible);
    
    if (!isVisible) {
        snapLines = [];
    }
    
    renderMain();
};

document.getElementById('grid-toggle').onclick = toggleGrid; 
if(document.getElementById('fb-grid-toggle')) document.getElementById('fb-grid-toggle').onclick = toggleGrid;

const footerTools = injectTools(document.querySelector('.footer'));
const fbTools = injectTools(document.getElementById('floating-bar'));
if(footerTools && footerTools.btnDotted) { footerTools.btnDotted.onclick = () => toggleStyle(footerTools.btnDotted, fbTools.btnDotted, 'dotted'); fbTools.btnDotted.onclick = footerTools.btnDotted.onclick; }
if(footerTools && footerTools.btnShadow) { footerTools.btnShadow.onclick = () => toggleStyle(footerTools.btnShadow, fbTools.btnShadow, 'shadow'); fbTools.btnShadow.onclick = footerTools.btnShadow.onclick; }

const handles = document.querySelectorAll('.resize-handle');
handles.forEach(h => {
    h.addEventListener('mousedown', (e) => {
        isResizing = true; resizeDir = h.dataset.dir; startResizeX = e.clientX; startResizeY = e.clientY;
        const rect = frame.getBoundingClientRect(); const parentRect = frame.parentElement.getBoundingClientRect();
        startResizeW = rect.width; startResizeH = rect.height; startResizeLeft = rect.left - parentRect.left; startResizeTop = rect.top - parentRect.top;
        
        frame.style.position = 'absolute'; 
        frame.style.left = startResizeLeft + 'px'; 
        frame.style.top = startResizeTop + 'px'; 
        frame.style.width = startResizeW + 'px'; 
        frame.style.height = startResizeH + 'px';
        frame.style.margin = '0'; 
        frame.style.transform = 'none'; 
        
        e.stopPropagation(); 
        e.preventDefault();

        // --- NEW: Cloak the canvases to prevent stretching and double-borders ---
        [canvas, backgroundCanvas, scratchCanvas, shapeLayerCanvas].forEach(c => {
            if (c) c.style.opacity = '0';
        });
    });
});

window.addEventListener('mousemove', (e) => {
    if (!isResizing) return; 

    if (e.shiftKey) {
        frame.style.cursor = 'crosshair';
    } else {
        frame.style.cursor = resizeDir + '-resize';
    }
    
    const dx = e.clientX - startResizeX; 
    const dy = e.clientY - startResizeY;
    
    let newX = startResizeLeft;
    let newY = startResizeTop;
    let newW = startResizeW;
    let newH = startResizeH;

    if (resizeDir.includes('w')) {
        newX = startResizeLeft + dx;
        newW = startResizeW - dx;
    }
    if (resizeDir.includes('n')) {
        newY = startResizeTop + dy;
        newH = startResizeH - dy;
    }
    if (resizeDir.includes('e')) {
        newW = startResizeW + dx;
    }
    if (resizeDir.includes('s')) {
        newH = startResizeH + dy;
    }
    
    const MIN_SIZE = 50;

    if (newW < MIN_SIZE) {
        if (resizeDir.includes('w')) {
            newX = startResizeLeft + (startResizeW - MIN_SIZE); 
        }
        newW = MIN_SIZE;
    }
    
    if (newH < MIN_SIZE) {
        if (resizeDir.includes('n')) {
            newY = startResizeTop + (startResizeH - MIN_SIZE);
        }
        newH = MIN_SIZE;
    }

    frame.style.width = newW + 'px'; 
    frame.style.height = newH + 'px'; 
    frame.style.left = newX + 'px'; 
    frame.style.top = newY + 'px';
    inpW.value = Math.round(newW); 
    inpH.value = Math.round(newH);

    if (isResizing) {
        const vpRect = frame.parentElement.getBoundingClientRect();
        
        let dotX = vpRect.left + newX;
        let dotY = vpRect.top + newY;
        
        if (resizeDir.includes('e')) {
            dotX += newW;       
        } else if (!resizeDir.includes('w')) {
            dotX += newW / 2;   
        }
        
        if (resizeDir.includes('s')) {
            dotY += newH;       
        } else if (!resizeDir.includes('n')) {
            dotY += newH / 2;   
        }

        cursorDot.style.left = dotX + 'px';
        cursorDot.style.top = dotY + 'px';
        cursorDot.style.display = 'block';
    }
    
    cursorDot.style.display = 'block';
    updateMeasureTooltip(e.clientX, e.clientY, `<span>W:</span> ${Math.round(newW)}px  <span>H:</span> ${Math.round(newH)}px`);
});

document.body.addEventListener('dragover', (e) => {
    e.preventDefault(); 
    e.stopPropagation();
    frame.style.borderColor = '#00ff00';
});

document.body.addEventListener('dragleave', (e) => {
    e.preventDefault(); 
    e.stopPropagation();
    frame.style.borderColor = userSettings.accentColor;
});

window.addEventListener('paste', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.clipboardData && e.clipboardData.items) {
        const items = e.clipboardData.items;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                loadExternalImage(blob);
                e.preventDefault(); 
                return;
            }
        }
    }
});

const dropzone = document.getElementById('dropzone-overlay');
let dragCounter = 0; 
if (dropzone) {
    dropzone.classList.remove('drag-active');
    dropzone.style.display = 'none'; 
}

window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
        dragCounter++;
        dropzone.classList.add('drag-active');
    }
});

window.addEventListener('dragover', (e) => {
    e.preventDefault(); 
});

window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
        dragCounter = 0;
        dropzone.classList.remove('drag-active');
    }
});

window.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounter = 0;
    if (dropzone) dropzone.classList.remove('drag-active');

    const files = e.dataTransfer.files;
    if (files && files.length > 0 && files[0].name.endsWith('.mint')) {
        try {
            // THE FIX: Read the text directly in the browser to bypass Electron's Sandbox path restrictions
            const rawText = await files[0].text();
            
            // Send the raw JSON string to the Main Process instead of the stripped file path
            window.electronAPI.send('validate-license-string', rawText);
        } catch (err) {
            console.error("Failed to read dropped license:", err);
            if (typeof showToast === 'function') showToast("Could not read dropped file.");
        }
    }
});

// ==========================================
// LICENSE ACTIVATION FIREWORKS
// ==========================================
if (window.electronAPI.on) {
    window.electronAPI.on('license-response', (event, response) => {
        if (response && response.success) {
            // The glorious success toast
            if (typeof showToast === 'function') {
                showToast(`PRO ACTIVATED! RESTARTING...`, 2000);
            }
            
            // Optional: Give the UI a quick green flash for that "Pomp and Circumstance"
            const frame = document.getElementById('frame');
            if (frame) {
                frame.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
                frame.style.borderColor = '#8CFA96';
                frame.style.boxShadow = '0 0 50px rgba(140, 250, 150, 0.8), inset 0 0 30px rgba(140, 250, 150, 0.5)';
            }
        } else {
            // The rejection toast
            if (typeof showToast === 'function') {
                showToast(`Activation Failed: ${response.reason || "Invalid Key"}`, 3000);
            }
        }
    });
}

[
    { btn: btnBold, fb: fbBtnBold },
    { btn: btnItalic, fb: fbBtnItalic }
].forEach(pair => {
    const handler = (e) => {
        pair.btn.classList.toggle('active');
        if (pair.fb) pair.fb.classList.toggle('active');
        
        if (activeTextWrapper) {
            applyPropertyChange('fontStyle', 'update');
        } 
        else if (selectedShape && selectedShape.type === 'text') {
            applyPropertyChange('fontStyle', 'update');
        }
    };
    if (pair.btn) pair.btn.onclick = handler;
    if (pair.fb) pair.fb.onclick = handler;
});

window.addEventListener('keydown', (e) => {
    // Bidirectional Monitor Jump
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            window.electronAPI.send('move-to-next-display');
            return;
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            window.electronAPI.send('move-to-prev-display');
            return;
        }
    }

    if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault(); 

        if (document.getElementById('admin-bypass-modal')) return;

        const overlay = document.createElement('div');
        overlay.id = 'admin-bypass-modal';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center;
            z-index: 999999; font-family: sans-serif; backdrop-filter: blur(3px);
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #1e1e1e; padding: 20px; border-radius: 8px; border: 1px solid #444;
            width: 350px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;

        modal.innerHTML = `
            <h3 style="color: #fff; margin: 0 0 5px 0; font-size: 14px;">Manual Pro Activation</h3>
            <p style="color: #aaa; margin: 0 0 10px 0; font-size: 12px;">Paste the raw text of your .mint file below:</p>
            <textarea id="manualKeyInput" style="height: 100px; background: #0a0a0a; color: #00ffcc; border: 1px solid #333; padding: 8px; border-radius: 4px; font-family: monospace; resize: none; font-size: 11px;"></textarea>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
                <button id="cancelKeyBtn" style="padding: 6px 12px; background: transparent; border: 1px solid #555; color: #ccc; border-radius: 4px; cursor: pointer; font-size: 12px;">Cancel</button>
                <button id="submitKeyBtn" style="padding: 6px 12px; background: #00ffcc; border: none; color: #000; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 12px;">Activate</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const inputField = document.getElementById('manualKeyInput');
        inputField.focus();

        const closeOverlay = () => document.body.removeChild(overlay);

        document.getElementById('cancelKeyBtn').onclick = closeOverlay;
        
        document.getElementById('submitKeyBtn').onclick = () => {
            const keyJson = inputField.value.trim();
            closeOverlay();

            if (keyJson) {
                try {
                    JSON.parse(keyJson); 
                    
                    if (window.electronAPI && window.electronAPI.send) {
                        window.electronAPI.send('validate-license-string', keyJson);
                    }
                } catch (err) {
                    if (typeof showToast === 'function') {
                        showToast("INVALID JSON FORMAT");
                    } else {
                        alert("INVALID JSON FORMAT");
                    }
                }
            }
        };
    }
});

const arrowBtn = document.getElementById('btn-arrow-multi');
const fbArrowBtn = document.getElementById('fb-btn-arrow-multi');
const arrowMenu = document.getElementById('arrow-menu');
const fbArrowMenu = document.getElementById('fb-arrow-menu');

const shapeBtn = document.getElementById('btn-multishape');
const fbShapeBtn = document.getElementById('fb-btn-multishape');

const setupRightClickMenu = (btn, menu, otherMenus = []) => {
    if (!btn) return;
    
    btn.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        otherMenus.forEach(m => { if(m) m.classList.remove('show'); });
        if(document.getElementById('footer-extras-menu')) document.getElementById('footer-extras-menu').classList.remove('show');
        if(document.getElementById('fb-tools-menu')) document.getElementById('fb-tools-menu').classList.remove('show');

        if(menu) menu.classList.toggle('show');
    };

    btn.onclick = (e) => {
        handleToolClick(btn);
    };
};

setupRightClickMenu(arrowBtn, arrowMenu, [fbArrowMenu, shapeMenu, fbShapeMenu]);
setupRightClickMenu(fbArrowBtn, fbArrowMenu, [arrowMenu, shapeMenu, fbShapeMenu]);

setupRightClickMenu(shapeBtn, shapeMenu, [arrowMenu, fbArrowMenu, fbShapeMenu]);
setupRightClickMenu(fbShapeBtn, fbShapeMenu, [arrowMenu, fbArrowMenu, shapeMenu]);

const handleArrowStyleSelect = (e) => {
    e.stopPropagation();
    const style = e.currentTarget.dataset.arrow;
    
    userSettings.arrowStyle = style;
    saveSettings();
    updateArrowButtonIcon();
    
    if (selectedShape && selectedShape.type === 'arrow') {
        applyPropertyChange('arrowStyle', style);
    }
    
    const mainBtn = document.getElementById('btn-arrow-multi');
    if(mainBtn) handleToolClick(mainBtn); 
    
    if(arrowMenu) arrowMenu.classList.remove('show');
    if(fbArrowMenu) fbArrowMenu.classList.remove('show');
};

document.querySelectorAll('.dropdown-item[data-arrow]').forEach(item => {
    item.addEventListener('click', handleArrowStyleSelect);
});

window.addEventListener('click', (e) => {
    const menus = [arrowMenu, fbArrowMenu, shapeMenu, fbShapeMenu];
    const btns = [arrowBtn, fbArrowBtn, shapeBtn, fbShapeBtn];
    
    menus.forEach(m => {
        if (m && m.classList.contains('show') && !m.contains(e.target)) {
            const isBtn = btns.some(b => b && b.contains(e.target));
            if(!isBtn) m.classList.remove('show');
        }
    });
});

window.addEventListener('dblclick', (e) => {
    const p = getXY(e);
    const hit = hitTest(p);

    if (hit && hit.type === 'text') {
        const s = hit;
        
        const sizeMatch = s.font.match(/(\d+)px/);
        const fontSize = sizeMatch ? parseInt(sizeMatch[1]) : 20;
        const fontFamily = s.font.replace(/italic|bold|\d+px|\s/g, ''); 
        
        if(typeof sizeSl !== 'undefined') sizeSl.value = fontSize / 5;
        if(typeof fontFam !== 'undefined') fontFam.value = fontFamily;
        if(typeof colorPk !== 'undefined') colorPk.value = s.color;
        
        shapes = shapes.filter(sh => sh !== s);
        selectedShape = null;
        tool = 'text';

        createTextInput(s.x, s.y, s.text, s.color);
        return;
    }

    if (hit && hit.type === 'text') {
        const s = hit;
        
        const isItalic = s.font.includes('italic');
        const isBold = s.font.includes('bold');
        const sizeMatch = s.font.match(/(\d+)px/);
        const fontSize = sizeMatch ? parseInt(sizeMatch[1]) : 20;
        const fontFamily = s.font.replace(/italic|bold|\d+px|\s/g, ''); 

        if(isItalic !== btnItalic.classList.contains('active')) btnItalic.click();
        if(isBold !== btnBold.classList.contains('active')) btnBold.click();
        
        sizeSl.value = fontSize / 5; 
        fbSizeSl.value = fontSize / 5;
        [fontFam, fbFontFam].forEach(btn => {
            if(btn) {
                btn.value = fontFamily;
                const lbl = btn.querySelector('.font-label');
                if(lbl) { lbl.textContent = fontFamily; lbl.style.fontFamily = `'${fontFamily}', sans-serif`; }
            }
        });
        opacitySl.value = s.opacity;
        
        let hexColor = s.color;
        if (s.color.startsWith('rgb')) {
            const rgb = s.color.match(/\d+/g);
            if (rgb) {
                hexColor = "#" + ((1 << 24) + (parseInt(rgb[0]) << 16) + (parseInt(rgb[1]) << 8) + parseInt(rgb[2])).toString(16).slice(1);
            }
        }
        colorPk.value = hexColor;
        
        isDotted = false;
        isShadow = false;
        updateAuxUI(); 
        updateStyle(); 

        shapes = shapes.filter(sh => sh !== s);
        selectedShape = null;
        
        tool = 'text';
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.t === 'text'));

        createTextInput(s.x, s.y, s.text, hexColor);
        return;
    }

    if (hit && ['line', 'arrow'].includes(hit.type)) {
        if (!AppFeatures.enableBezierCurves) return;

        const s = hit;
        
        let cx, cy;
        if (s.cp) { cx = s.cp.x; cy = s.cp.y; }
        else { cx = (s.x + s.ex)/2; cy = (s.y + s.ey)/2; }

        if (Math.hypot(p.x - cx, p.y - cy) < 30) {
            s.curveMode = !s.curveMode;
            
            if (s.curveMode) {
                if(!s.cp) s.cp = { x: cx, y: cy };
            } 
            
            saveState();
            renderMain();
        }
    }
});

(function() {
   const handleDragStart = async (e) => {
        e.preventDefault();

        if (activeTextWrapper) commitActiveText();
        selectedShape = null;
        renderMain();

        const contentW = backgroundCanvas.width;
        const contentH = backgroundCanvas.height;
        const dataURL = await ExportManager.getFinalImageData(contentW, contentH, false, shapes, backgroundCanvas, dpr, userSettings, AppFeatures, drawShape);

        const targetSize = 120; 
        const iconCanvas = document.createElement('canvas');
        iconCanvas.width = targetSize;
        iconCanvas.height = targetSize;
        const iCtx = iconCanvas.getContext('2d');
        
        iCtx.fillStyle = '#161a1e';
        iCtx.beginPath();
        iCtx.roundRect(4, 4, 112, 112, 16);
        iCtx.fill();
        iCtx.strokeStyle = userSettings.accentColor;
        iCtx.lineWidth = 4;
        iCtx.stroke();

        const accentHex = userSettings.accentColor || '#8CFA96';
        const encodedColor = encodeURIComponent(accentHex);
        
        const uplinkSvg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' fill='none' stroke='${encodedColor}' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'>
            <circle cx='46' cy='16' r='6' fill='${encodedColor}' />
            <circle cx='18' cy='32' r='6' fill='${encodedColor}' />
            <circle cx='46' cy='48' r='6' fill='${encodedColor}' />
            <line x1='23' y1='29' x2='41' y2='19' />
            <line x1='23' y1='35' x2='41' y2='45' />
        </svg>`;

        const uplinkImg = new Image();
        const imageLoaded = new Promise((resolve) => {
            uplinkImg.onload = resolve;
            uplinkImg.src = uplinkSvg; 
        });

        await imageLoaded;
        
        iCtx.shadowColor = accentHex;
        iCtx.shadowBlur = 15;
        iCtx.drawImage(uplinkImg, 16, 16, 88, 88);
        iCtx.shadowBlur = 0; 
        
        const iconDataURL = iconCanvas.toDataURL('image/png');

        window.electronAPI.send('ondragstart', {
            dataURL: dataURL, 
            icon: iconDataURL,
            filename: ExportManager.getFilename(userSettings, AppFeatures, sequenceCounter, backgroundCanvas.width, backgroundCanvas.height)
        });

        // THE FIX: Increment the sequence counter for drag-to-share!
        if (userSettings.filenameFmt && userSettings.filenameFmt.includes('{seq}')) {
            sequenceCounter++;
            saveSettings();
        }

        doDelete();
        
        if (userSettings.autoHideOnShare !== false) {
            window.electronAPI.send('close-app');
        }
    };

    const setupDragBtn = (id) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('dragstart', handleDragStart);
        }
    };

    setupDragBtn('btn-drag');    
    setupDragBtn('fb-drag');     

    const btnDrag = document.getElementById('btn-drag');
    if (btnDrag) {
        const newBtnDrag = btnDrag.cloneNode(true);
        btnDrag.parentNode.replaceChild(newBtnDrag, btnDrag);
        
        newBtnDrag.style.cursor = 'grab';
        newBtnDrag.addEventListener('dragstart', handleDragStart);
    }

    const fbDrag = document.getElementById('fb-drag');
    if (fbDrag) {
        fbDrag.style.marginLeft = '-8px';
        fbDrag.style.marginRight = '2px';

        const newFbDrag = fbDrag.cloneNode(true);
        fbDrag.parentNode.replaceChild(newFbDrag, fbDrag);
        newFbDrag.addEventListener('dragstart', handleDragStart);
    }
})();

(function() {
    const ctxStyle = document.createElement('style');
    ctxStyle.innerHTML = Templates.getContextMenuStyle(); 
    document.head.appendChild(ctxStyle);

    const ctxMenu = document.createElement('div');
    ctxMenu.id = 'shape-ctx-menu';
    ctxMenu.className = 'ctx-menu';
    ctxMenu.innerHTML = Templates.getContextMenuHtml(); 
    document.body.appendChild(ctxMenu);

    window.addEventListener('contextmenu', (e) => {
        const isCanvas = e.target.id === 'canvas' || e.target.closest('.frame');
        const isUI = e.target.closest('.header') || e.target.closest('.footer') || e.target.closest('#floating-bar');
        
        if (selectedShape && isCanvas && !isUI) {
            e.preventDefault();
            isDown = false; isDraggingShape = false; draggingHandle = 0;

            const menuW = 190; 
            const menuH = 240; 
            
            let x = e.clientX; 
            let y = e.clientY;
            
            const winW = window.innerWidth;
            const winH = window.innerHeight;

            if (x + menuW > winW) {
                x -= menuW;
            }

            if (y + menuH > winH) {
                y -= menuH;
            }

            if (x < 0) x = 0;
            if (y < 0) y = 0;

            ctxMenu.style.left = x + 'px';
            ctxMenu.style.top = y + 'px';
            ctxMenu.classList.add('show');
        }
    });

    const style = document.createElement('style');
    style.innerHTML = Templates.getMainStyle(userSettings.accentColor || '#8CFA96') + `
        #frame { box-sizing: border-box !important; border: none !important; flex-shrink: 0 !important; }
        #canvas { outline: 2px dashed var(--accent) !important; outline-offset: -2px !important; }
        body.fullscreen #frame.clean-slate #canvas { outline: none !important; }
        body.immersive-active #canvas { outline-color: transparent !important; }
    `;
    document.head.appendChild(style);

    window.addEventListener('click', (e) => { if (!ctxMenu.contains(e.target)) ctxMenu.classList.remove('show'); });
    window.addEventListener('scroll', () => ctxMenu.classList.remove('show'), {capture: true});

    const close = () => ctxMenu.classList.remove('show');

    document.getElementById('cm-up').onclick = () => { changeLayerOrder(1); close(); };
    document.getElementById('cm-down').onclick = () => { changeLayerOrder(-1); close(); };

    document.getElementById('cm-top').onclick = () => {
        if (selectedShape) {
            const idx = shapes.indexOf(selectedShape);
            if (idx > -1 && idx < shapes.length - 1) {
                shapes.splice(idx, 1); 
                shapes.push(selectedShape); 
                saveState(); renderMain();
            }
        }
        close();
    };

    document.getElementById('cm-bottom').onclick = () => {
        if (selectedShape) {
            const idx = shapes.indexOf(selectedShape);
            if (idx > 0) {
                shapes.splice(idx, 1); 
                shapes.unshift(selectedShape); 
                saveState(); renderMain();
            }
        }
        close();
    };
    
    document.getElementById('cm-dupe').onclick = () => {
        if (selectedShape) {
            const newShape = JSON.parse(JSON.stringify(selectedShape));
            newShape.x += 20; newShape.y += 20;
            if(newShape.ex !== undefined) { newShape.ex += 20; newShape.ey += 20; }
            if(newShape.cp) { newShape.cp.x += 20; newShape.cp.y += 20; }
            shapes.push(newShape); selectedShape = newShape;
            saveState(); renderMain();
        }
        close();
    };

    document.getElementById('cm-del').onclick = () => {
        if (selectedShape) {
            shapes = shapes.filter(s => s !== selectedShape);
            selectedShape = null;
            saveState(); renderMain();
        }
        close();
    };
})();

// chapter 9: Anchor logic
document.getElementById('fb-pos-reset').onclick = () => {
    const fb = document.getElementById('floating-bar');
    fb.style.top = 'auto';
    fb.style.bottom = '30px';
    fb.style.left = '50%';
    fb.style.transform = 'translateX(-50%)';
    fb.classList.remove('at-top');
    showToast("Toolbar Docked");
};

// Monitor Jump logic
document.getElementById('fb-monitor-jump').onclick = () => {
    window.electronAPI.send('move-to-next-display');
};

// =====================================================================
// CHAPTER 10: INITIALIZATION & ONBOARDING
// =====================================================================

function initOnboarding(force = false) {
    let existingEl = document.getElementById('onboarding-modal');
    if(existingEl) existingEl.remove();

    if (!force && localStorage.getItem('cs_has_seen_intro')) return;

    if (!isFullscreen) {
        if (preWizardW === 0 && preWizardH === 0) { preWizardW = w; preWizardH = h; }
        const tourMinW = 1000; const tourMinH = 700; 
        if (w < tourMinW || h < tourMinH) {
            w = Math.max(w, tourMinW); h = Math.max(h, tourMinH);
            if(inpW) inpW.value = w; if(inpH) inpH.value = h;
            window.electronAPI.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
            if (typeof updateCanvasSize === 'function') updateCanvasSize(w, h);
            window.electronAPI.send('center-window');
        }
    }

    const div = document.createElement('div');
    div.innerHTML = onboardingHtml;
    document.body.appendChild(div.firstElementChild);
    
    const modal = document.getElementById('onboarding-modal');
    if (!modal) return;
    
    const obContent = modal.querySelector('.onboarding-content');
    if(obContent) {
        obContent.addEventListener('mousedown', (e) => e.stopPropagation());
        obContent.addEventListener('click', (e) => e.stopPropagation());
    }
    modal.style.display = 'flex'; 
    
    let currentStep = 0;
    const slides = modal.querySelectorAll('.ob-slide');
    const btnNext = document.getElementById('ob-next');
    const btnSkip = document.getElementById('ob-skip');
    const btnStart = document.getElementById('ob-start-btn'); 
    const btnSetup = document.getElementById('ob-setup-btn'); 
    const dots = modal.querySelectorAll('.dot');
    const btnBack = document.getElementById('ob-back'); 

    function updateSlide() {
        slides.forEach((s, i) => s.classList.toggle('active', i === currentStep));
        dots.forEach((d, i) => d.classList.toggle('active', i === currentStep));
        if (btnBack) btnBack.disabled = currentStep === 0;
        if (currentStep === slides.length - 1) { btnNext.style.display = 'none'; btnSkip.style.display = 'none'; } 
        else { btnNext.style.display = 'block'; btnSkip.style.display = 'block'; }
    }
    updateSlide();

    const finish = (runWizard = false) => {
        const dontShowCheck = document.getElementById('ob-dont-show-check');
        const shouldHideIntroForever = dontShowCheck ? dontShowCheck.checked : false;

        if (shouldHideIntroForever || runWizard) {
            localStorage.setItem('cs_has_seen_intro', 'true');
            userSettings.introComplete = true; 
        }
        if (!runWizard) userSettings.onboardingComplete = true; 
        saveSettings(); 

        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none'; 
            modal.remove();
            
            if (runWizard) {
                setTimeout(() => { if (typeof showOnboardingWizard === 'function') showOnboardingWizard(); }, 100);
            } else {
                if (!isFullscreen && preWizardW > 0 && preWizardH > 0) {
                    isSuppressingResize = true; w = preWizardW; h = preWizardH;
                    if(inpW) inpW.value = w; if(inpH) inpH.value = h;
                    window.electronAPI.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
                    window.electronAPI.send('center-window');
                    if (typeof updateCanvasSize === 'function') updateCanvasSize(w, h);
                    setTimeout(() => { if (typeof updateCanvasSize === 'function') updateCanvasSize(w, h); isSuppressingResize = false; preWizardW = 0; preWizardH = 0; }, 100);
                }
            }
        }, 300);
    };

    if(btnNext) btnNext.onclick = (e) => { e.stopPropagation(); if (currentStep < slides.length - 1) { currentStep++; updateSlide(); } };
    if(btnBack) btnBack.onclick = (e) => { e.stopPropagation(); if (currentStep > 0) { currentStep--; updateSlide(); } };
    if(btnSkip) btnSkip.onclick = (e) => { e.stopPropagation(); finish(false); };
    if(btnStart) btnStart.onclick = (e) => { e.stopPropagation(); finish(false); };
    if(btnSetup) btnSetup.onclick = (e) => { e.preventDefault(); e.stopPropagation(); finish(true); };
    dots.forEach((dot, index) => { dot.onclick = (e) => { e.stopPropagation(); currentStep = index; updateSlide(); }; });
}

function updateWizardControls() {
    if (!document.getElementById('wiz-step-info')) return;

    document.getElementById('wiz-step-info').textContent = `Step ${currentWizardStep + 1} of ${wizPages.length}`;
    
    wizPages.forEach((page, index) => {
        if(page) page.classList.toggle('active', index === currentWizardStep);
    });

    if(wizBack) wizBack.disabled = currentWizardStep === 0;

    if (currentWizardStep === wizPages.length - 1) {
        if(wizNext) wizNext.classList.add('hidden');
        if(wizFinish) wizFinish.classList.remove('hidden');
        
        const hotkeyDisplay = document.getElementById('wiz-finish-hotkey');
        if(hotkeyDisplay) hotkeyDisplay.textContent = userSettings.globalHotkey;
    } else {
        if(wizNext) wizNext.classList.remove('hidden');
        if(wizFinish) wizFinish.classList.add('hidden');
    }
    
    if (currentWizardStep === 1) {
        if(wizHotkeyInput) wizHotkeyInput.value = userSettings.globalHotkey;
        if(wizHotkeyDisplay) wizHotkeyDisplay.textContent = userSettings.globalHotkey;
    }
}

function nextWizardStep() {
    if (currentWizardStep < wizPages.length - 1) {
        if (currentWizardStep === 1) {
            const newHotkey = wizHotkeyInput.value.trim();
            if (newHotkey && newHotkey !== userSettings.globalHotkey) {
                wizHotkeyInput.dispatchEvent(new Event('change'));
                 userSettings.globalHotkey = newHotkey; 
            }
            if(wizHotkeyDisplay) wizHotkeyDisplay.textContent = userSettings.globalHotkey;
        }
        currentWizardStep++;
        updateWizardControls();
    }
}

function prevWizardStep() {
    if (currentWizardStep > 0) {
        currentWizardStep--;
        updateWizardControls();
    }
}

let currentWizardStep = 0; // Ensure state tracker is global

function showOnboardingWizard() {
    if (!isFullscreen) {
        if (preWizardW === 0 && preWizardH === 0) {
            preWizardW = w; preWizardH = h;
        }
        const wizMinW = 900; 
        const wizMinH = 560;
        if (w < wizMinW || h < wizMinH) {
            w = Math.max(w, wizMinW); h = Math.max(h, wizMinH);
            if(inpW) inpW.value = w;
            if(inpH) inpH.value = h;
            window.electronAPI.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
            updateCanvasSize(w, h);
            window.electronAPI.send('center-window');
        }
    }

    currentWizardStep = 0;
    updateWizardControls();
    
    if(onboardingWizard) {
        onboardingWizard.classList.add('show');
        
        const wizFinishBtn = document.getElementById('wiz-finish');
        if (wizFinishBtn) {
            wizFinishBtn.onclick = (e) => {
                e.preventDefault();
                finishOnboarding();
            };
        }
    }
}

function finishOnboarding() {
    const wizDontShowCheck = document.getElementById('wiz-dont-show-check');
    
    userSettings.onboardingComplete = wizDontShowCheck ? wizDontShowCheck.checked : false;
    saveSettings(); 
    
    if(onboardingWizard) onboardingWizard.classList.remove('show');

    if (!isFullscreen && preWizardW > 0 && preWizardH > 0) {
        isSuppressingResize = true; 
        
        w = preWizardW;
        h = preWizardH;
        if(inpW) inpW.value = w;
        if(inpH) inpH.value = h;

        window.electronAPI.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
        window.electronAPI.send('center-window'); 
        
        updateCanvasSize(w, h);
        
        setTimeout(() => {
            updateCanvasSize(w, h);
            isSuppressingResize = false;
            preWizardW = 0; preWizardH = 0;
        }, 100);
    }
}

if(wizBack) wizBack.onclick = prevWizardStep;
if(wizNext) wizNext.onclick = nextWizardStep;
if(wizFinish) wizFinish.onclick = finishOnboarding;

const wizBrowseBtn = document.getElementById('wiz-btn-browse');
if (wizBrowseBtn) {
    wizBrowseBtn.onclick = async () => {
        try {
            const result = await window.electronAPI.invoke('select-directory');
            if (result && !result.canceled) {
                const path = result.filePaths[0];
                userSettings.savePath = path;
                saveSettings();
                document.getElementById('wiz-save-path').value = path;
                if(inpSavePath) inpSavePath.value = path;
            }
        } catch (e) {
            console.error("Wizard Browse Error:", e);
        }
    };
}

if(wizHotkeyInput) {
    wizHotkeyInput.addEventListener('keydown', (e) => {
        e.preventDefault(); // Stop the key from actually typing
        
        // Capture modifiers
        const modifiers = [];
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.shiftKey) modifiers.push('Shift');
        if (e.altKey) modifiers.push('Alt');
        
        // Map common keys to Git/Electron format
        let key = e.key;
        if (key === " ") key = "Space";
        if (key === "Control") return; // Don't record just the modifier
        if (key === "Shift") return;
        if (key === "Alt") return;

        const finalHotkey = modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key;
        
        wizHotkeyInput.value = finalHotkey;
        wizHotkeyDisplay.textContent = finalHotkey;
        
        // Trigger the update to Main Process
        window.electronAPI.send('update-setting', { key: 'globalHotkey', value: finalHotkey });
        userSettings.globalHotkey = finalHotkey;
        saveSettings();
    });
}

// =====================================================================
// CHAPTER 11: BOOT SEQUENCE & INJECTIONS
// =====================================================================

if (userSettings.startFullscreen) {
    window.electronAPI.send('set-window-opacity', 0);
    document.body.classList.add('fullscreen');
    window.electronAPI.send('force-maximize');
    
    setTimeout(() => {
        enterFullscreenMode();
    }, 100);
}

setTimeout(() => {
    window.electronAPI.send('renderer-ready-to-show');
    if (!userSettings.introComplete) {
        initOnboarding(); 
    } else if (!userSettings.onboardingComplete) {
        saveSettings(); 
        if (typeof showOnboardingWizard === 'function') showOnboardingWizard();
    }
}, 50);

setTimeout(() => {
    document.querySelectorAll('.tool-btn').forEach(b => { 
        if(b.dataset.t === tool) b.classList.add('active');
        else if(b.dataset.t) b.classList.remove('active');
    });
    refreshToolIcons();
    updateStampBubble();
}, 100);

if (!userSettings.startFullscreen) {
    isSuppressingResize = true; 
    window.electronAPI.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
    window.electronAPI.send('center-window');
    setTimeout(() => { initCanvas(); isSuppressingResize = false; }, 100); 
}

// Render Dev UI (If Active)
(function injectDevTools() {
    const isDev = window.electronAPI.sendSync('get-is-dev-sync');
    if (isDev) {
        const devBtn = document.createElement('button');
        devBtn.innerHTML = AppFeatures.type === 'pro' ? '🛠️ DEV: Switch to CORE' : '🛠️ DEV: Switch to PRO';
        devBtn.style.cssText = "position: fixed; top: 50px; right: 15px; z-index: 999999; padding: 6px 12px; background: #ff0055; color: #fff; border: 2px solid #fff; border-radius: 20px; font-weight: 900; cursor: pointer; font-family: 'Orbitron', sans-serif; font-size: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);";
        devBtn.onclick = () => window.electronAPI.send('toggle-dev-pro');
        document.body.appendChild(devBtn);

        const nukeBtn = document.createElement('button');
        nukeBtn.innerHTML = '💣 NUKE LICENSE';
        nukeBtn.style.cssText = "position: fixed; top: 85px; right: 15px; z-index: 999999; padding: 6px 12px; background: #ffaa00; color: #000; border: 2px solid #fff; border-radius: 20px; font-weight: 900; cursor: pointer; font-family: 'Orbitron', sans-serif; font-size: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);";
        nukeBtn.onclick = () => window.electronAPI.send('nuke-license');
        document.body.appendChild(nukeBtn);
    }
})();

// Landmark: Browser Drag Blocker
// This prevents the "Hand" cursor and the ghost-image drag effect
window.addEventListener('dragstart', (e) => {
    if (isCreatingFrame || isFullscreen) {
        e.preventDefault();
        return false;
    }
});

// Also ensure the frame itself doesn't trigger native dragging
frame.addEventListener('dragstart', (e) => {
    e.preventDefault();
    return false;
});

// Kickoff Extracted Modules
UIManager.initTooltips();
UIManager.initTabsAndSliders();
UIManager.initFloatingMenus(handleToolClick);
window.initSpinners();
injectLateStyles(AppFeatures, userSettings);

// Boot the visuals and apply settings!
if (userSettings.defaultColor) {
    if (colorPk) colorPk.value = userSettings.defaultColor;
    if (fbColorPk) fbColorPk.value = userSettings.defaultColor;
}
updateStyle();
applySettingsToRuntime(); // <--- THIS paints the swatches and applies your settings
renderPresets();


// ==========================================
// CLEAN ARCHITECTURE: UI INITIALIZATION
// ==========================================

// 1. Move Single Popup to the Body (Portal Pattern)
// This detaches it from the Floating Bar's layout entirely.
const popupMain = document.getElementById('color-popup');
if (popupMain) { 
    document.body.appendChild(popupMain); 
    popupMain.style.position = 'absolute'; 
}

// [THE FIX] Destroy the empty phantom popup that is stretching the floating bar!
const deadWeight = document.getElementById('fb-color-popup');
if (deadWeight) {
    deadWeight.remove();
}

// 2. Clean Color Picker Logic - ONE POPUP TO RULE THEM ALL
const showColorPopup = (e) => {
    e.preventDefault(); e.stopPropagation(); 
    if (!popupMain) return;

    const isFloating = e.currentTarget.id === 'fb-color-trigger';
    
    // If it's already open AND we clicked the same button, close it.
    const isCurrentlyOpen = !popupMain.classList.contains('hidden');
    const wasLastOpenedByThis = popupMain.dataset.openedBy === e.currentTarget.id;

    if (isCurrentlyOpen && wasLastOpenedByThis) {
        popupMain.classList.add('hidden');
        popupMain.dataset.openedBy = '';
        return;
    }

    // Show it and record which button opened it
    popupMain.classList.remove('hidden');
    popupMain.dataset.openedBy = e.currentTarget.id;
    
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Calculate positioning
    if (isFloating && typeof floatingBar !== 'undefined' && floatingBar && floatingBar.classList.contains('at-top')) {
        popupMain.style.bottom = 'auto';
        popupMain.style.top = (rect.bottom + 10) + 'px';
    } else {
        popupMain.style.top = 'auto';
        popupMain.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
    }

    // Center over the button
    let left = rect.left + (rect.width / 2) - (popupMain.offsetWidth / 2);
    left = Math.max(10, Math.min(window.innerWidth - popupMain.offsetWidth - 10, left));
    
    popupMain.style.left = left + 'px'; 
    popupMain.style.right = 'auto'; 
};

// Bind to both triggers
const tMain = document.getElementById('color-trigger');
const tFb = document.getElementById('fb-color-trigger');
if (tMain) tMain.onclick = showColorPopup;
if (tFb) tFb.onclick = showColorPopup;

// Click-away closer
window.addEventListener('click', (e) => { 
    if (popupMain && !popupMain.contains(e.target) && !e.target.closest('#color-trigger, #fb-color-trigger')) {
        popupMain.classList.add('hidden'); 
        popupMain.dataset.openedBy = '';
    }
});

// ==========================================
// [FIXED] STAMP BUBBLE WIRING
// ==========================================
if (typeof stampModeToggle !== 'undefined' && stampModeToggle) {
    stampModeToggle.onclick = (e) => { e.preventDefault(); e.stopPropagation(); toggleStampMode(); };
}
if (typeof stampReset !== 'undefined' && stampReset) {
    stampReset.onclick = (e) => { e.preventDefault(); e.stopPropagation(); resetStampCounter(); };
}

// 3. Floating Bar Custom Drag
let isDraggingFB = false;
let fbDragOffsetX = 0;
let fbDragOffsetY = 0;

if (typeof floatingBar !== 'undefined' && floatingBar) {
    floatingBar.style.cursor = 'grab';
    
    floatingBar.addEventListener('pointerdown', (e) => {
        // Explicitly ignore the trigger IDs so the drag script NEVER swallows the click
        if (e.target.closest('button, input, .dropdown-content, .color-popup, #color-trigger, #fb-color-trigger')) return;
        
        isDraggingFB = true;
        const rect = floatingBar.getBoundingClientRect();
        fbDragOffsetX = e.clientX - rect.left;
        fbDragOffsetY = e.clientY - rect.top;
        
        floatingBar.style.transform = 'none'; 
        floatingBar.style.bottom = 'auto';
        floatingBar.style.left = rect.left + 'px';
        floatingBar.style.top = rect.top + 'px';
        
        floatingBar.style.cursor = 'grabbing';
        floatingBar.setPointerCapture(e.pointerId);
    });

    floatingBar.addEventListener('pointermove', (e) => {
        if (!isDraggingFB) return;
        floatingBar.style.left = (e.clientX - fbDragOffsetX) + 'px';
        floatingBar.style.top = (e.clientY - fbDragOffsetY) + 'px';
        if (typeof updateToolbarSpatialState === 'function') updateToolbarSpatialState();
    });

    floatingBar.addEventListener('pointerup', (e) => {
        if (!isDraggingFB) return;
        isDraggingFB = false;
        floatingBar.style.cursor = 'grab';
        floatingBar.releasePointerCapture(e.pointerId);
    });
}

// 4. Anchor & Window Controls
const fbPosReset = document.getElementById('fb-pos-reset');
if (fbPosReset) {
    fbPosReset.onclick = () => {
        floatingBar.style.top = 'auto';
        floatingBar.style.bottom = '60px';
        floatingBar.style.left = '50%';
        floatingBar.style.transform = 'translateX(-50%)';
        floatingBar.classList.remove('at-top');
        if (typeof showToast === 'function') showToast("Toolbar Docked");
    };
}

const fbMax = document.getElementById('fb-max');
if (fbMax) {
    fbMax.onclick = () => {
        if (isFullscreen) {
            w = window.innerWidth;
            h = window.innerHeight;
            frame.style.position = 'absolute';
            frame.style.margin = '0';
            frame.style.left = '0px';
            frame.style.top = '0px';
            updateCanvasSize(w, h, true);
            frame.style.display = 'block';
            frame.classList.remove('clean-slate');
            renderMain();
        }
    };
}

const fbReset = document.getElementById('fb-reset');
if (fbReset) {
    fbReset.onclick = () => {
        doDelete(); 
        if (isFullscreen) {
            frame.style.display = 'none';
            frame.classList.add('clean-slate');
            hasSnappedInFullscreen = false;
            if (inpW) inpW.value = 0; 
            if (inpH) inpH.value = 0;
        }
    };
}

// ==========================================
// --- UPDATES & PRO UPGRADE ROUTING ---
// ==========================================

// [FIXED] Matches the kebab-case ID in index.html exactly
const btnCheckUpd = document.getElementById('btn-check-updates');

if (btnCheckUpd) {
    // Clear any previous listeners and bind the correct routing
    btnCheckUpd.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Use the live sync check to be 100% sure of the license state
        const isActuallyPro = window.electronAPI.sendSync('get-is-pro-sync');

        if (isActuallyPro) {
            window.electronAPI.send('open-external', 'https://app.lemonsqueezy.com/my-orders/');
        } else {
            window.electronAPI.send('open-external', 'https://github.com/Mint-Logic/CapSize/releases');
        }
    };
}

// (Optional) Wire up the "Get Key" button in the About tab
const btnUpgradePro = document.getElementById('btnUpgradePro');
if (btnUpgradePro) {
    btnUpgradePro.onclick = (e) => {
        e.preventDefault();
        window.electronAPI.send('open-external', 'https://mintlogic.lemonsqueezy.com/checkout/buy/a6bee67d-b0a0-4e82-a8e0-c7e3a98f0479'); 
    };
}

// ==========================================
// HIDDEN STATE SCRUBBER (GHOST FRAME FIX)
// ==========================================
window.electronAPI.on('scrub-workspace', () => {
    // 1. Wipe shapes
    if (typeof doDelete === 'function') doDelete();
    
    // 2. Clear backdrop
    const backdrop = document.getElementById('backdrop-img');
    if (backdrop) { backdrop.src = ''; backdrop.style.display = 'none'; }
    
    // 3. THE SOURCE FIX: Reset the frame, but KEEP it display: block
    document.body.classList.remove('fullscreen');
    const frameEl = document.getElementById('frame');
    if (frameEl) {
        frameEl.classList.remove('immersive-active');
        // We use 'clean-slate' to hide the content, but keep the element block-level
        frameEl.classList.add('clean-slate'); 
        frameEl.style.display = 'block'; 
        frameEl.style.outline = `2px dashed ${userSettings.accentColor || '#8CFA96'}`;
    }
});

// ==========================================
// WINDOW MODE WAKE-UP HANDLER
// ==========================================
window.electronAPI.on('window-shown', () => {
    const frameEl = document.getElementById('frame');
    
    // THE FIX: Force the internal variables back to startup defaults
    w = userSettings.startupW || 840;
    h = userSettings.startupH || 340;

    if (frameEl) {
        frameEl.classList.remove('clean-slate');
        frameEl.style.display = 'block';
        // Reset the physical style dimensions
        frameEl.style.width = w + 'px';
        frameEl.style.height = h + 'px';
        frameEl.style.outline = `2px dashed ${userSettings.accentColor || '#8CFA96'}`;
    }
    
    // Sync the header inputs so they don't show the old "giant" numbers
    if (inpW) inpW.value = w;
    if (inpH) inpH.value = h;

    isFullscreen = false;
    isWGCFrozen = false;
    
    // Repaint the canvases to the new smaller size
    if (typeof updateCanvasSize === 'function') updateCanvasSize(w, h, true);
    if (typeof renderMain === 'function') renderMain();
});
