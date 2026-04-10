import { userSettings } from './Config.js';
import { canvas, ctx, frame, cursorDot, colorPk, sizeSl, opacitySl } from './UIElements.js';
import {
    shapes, activeShape, selectedShape, tool, isDotted, isShadow,
    dpr, w, h, polygonPoints, snapLines, fillStates, ROTATION_HANDLE_OFFSET
} from './renderer.js';

// These now live in UIElements.js
import { 
    backgroundCanvas, bgCtx, shapeLayerCanvas, shapeLayerCtx, scratchCanvas, scratchCtx 
} from './UIElements.js';

import * as MathUtils from './MathUtils.js';

// ==========================================
// 5. CORE RENDER ENGINE (Canvas)
// ==========================================

export function renderMain() {
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

export function drawGrid(c) {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0); 
    const scale = dpr; 
    const s = (parseInt(userSettings.gridSize) || 20) * scale;
    const opacity = userSettings.gridOpacity || 0.6;
    const accent = userSettings.accentColor || '#8CFA96';
    const pW = c.canvas.width; const pH = c.canvas.height;
    const cX = Math.round(pW / 2); const cY = Math.round(pH / 2);

    c.lineWidth = 1; c.beginPath();
    for (let x = cX; x < pW; x += s) { c.moveTo(Math.floor(x) + 0.5, 0); c.lineTo(Math.floor(x) + 0.5, pH); }
    for (let x = cX - s; x > 0; x -= s) { c.moveTo(Math.floor(x) + 0.5, 0); c.lineTo(Math.floor(x) + 0.5, pH); }
    for (let y = cY; y < pH; y += s) { c.moveTo(0, Math.floor(y) + 0.5); c.lineTo(pW, Math.floor(y) + 0.5); }
    for (let y = cY - s; y > 0; y -= s) { c.moveTo(0, Math.floor(y) + 0.5); c.lineTo(pW, Math.floor(y) + 0.5); }
    c.strokeStyle = `rgba(100, 100, 100, ${opacity})`; c.stroke();

    c.beginPath(); c.moveTo(cX, 0); c.lineTo(cX, pH); c.moveTo(0, cY); c.lineTo(pW, cY);
    c.strokeStyle = accent; c.lineWidth = 2; c.globalAlpha = opacity; c.stroke();
    c.restore();
}

export function drawShape(c, s) {
    if (s.type === 'polygon_drag') return; 
    c.save(); 
    
    if (s.rotation) { 
        const center = MathUtils.getShapeCenter(s); 
        c.translate(center.x, center.y); c.rotate(s.rotation); c.translate(-center.x, -center.y); 
    }

    c.lineWidth = s.width; c.strokeStyle = s.color; c.fillStyle = s.color; c.globalAlpha = s.opacity || 1;

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

        if (s === activeShape || (s === selectedShape && window.isDown)) {
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
            c.strokeStyle = hazardOrange; c.lineWidth = 3;
            const bLen = Math.min(12, Math.abs(s.w/5), Math.abs(s.h/5));
            c.beginPath();
            c.moveTo(s.x, s.y + (Math.sign(s.h) * bLen)); c.lineTo(s.x, s.y); c.lineTo(s.x + (Math.sign(s.w) * bLen), s.y); 
            c.moveTo(s.x + s.w - (Math.sign(s.w) * bLen), s.y); c.lineTo(s.x + s.w, s.y); c.lineTo(s.x + s.w, s.y + (Math.sign(s.h) * bLen)); 
            c.moveTo(s.x + s.w, s.y + s.h - (Math.sign(s.h) * bLen)); c.lineTo(s.x + s.w, s.y + s.h); c.lineTo(s.x + s.w - (Math.sign(s.w) * bLen), s.y + s.h); 
            c.moveTo(s.x + (Math.sign(s.w) * bLen), s.y + s.h); c.lineTo(s.x, s.y + s.h); c.lineTo(s.x, s.y + s.h - (Math.sign(s.h) * bLen)); 
            c.stroke();
            c.lineWidth = 1.5; c.setLineDash([10, 6]); c.strokeRect(s.x, s.y, s.w, s.h);
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

export function drawArrowComposite(destCtx, x1, y1, x2, y2, width, color, shadow, opacity, dashArray, drawHead = true, cp = null, s = null) {
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
    
    sc.restore(); destCtx.save(); applyShadow(destCtx, shadow); destCtx.scale(1/dpr, 1/dpr); 
    if (cv.width > 0 && cv.height > 0) destCtx.drawImage(cv, 0, 0); 
    destCtx.restore();
}

export function drawSelectionHandles(c, s) {
    if (userSettings.immersiveMode) return;
    if (s.type === 'polygon_drag' || s.type === 'eraser-stroke' || s.type === 'ocr-selection') return;

    if (s.type === 'text') {
        c.save(); c.font = s.font; c.textBaseline = 'top'; const m = c.measureText(s.text); 
        const match = s.font.match(/(\d+)px/); const h = match ? parseInt(match[1]) : 20;
        const padX = 8; const padY = 4;
        c.strokeStyle = userSettings.accentColor; c.setLineDash([4, 4]); c.lineWidth = 1.5;
        c.strokeRect(s.x - padX, s.y - padY, m.width + (padX * 2), h + (padY * 2));
        drawHandleSquare(c, s.x + m.width + padX, s.y - padY); 
        drawHandleSquare(c, s.x - padX, s.y + h / 2); 
        c.restore(); return;
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
        if (s.curveMode) { c.beginPath(); c.rect(cx - 5, cy - 5, 10, 10); c.fillStyle = '#ffcc00'; c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke(); } 
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
        c.beginPath(); c.moveTo(0, (s.h > 0 ? -halfH : halfH)); c.lineTo(0, handleY);
        c.strokeStyle = userSettings.accentColor; c.lineWidth = 1; c.setLineDash([]); c.stroke();
        drawHandleCircle(c, 0, handleY, userSettings.accentColor);
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

export function drawHandleCircle(c, x, y, color) { 
    c.beginPath(); c.setLineDash([]); c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 3; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
    c.arc(x, y, 5, 0, Math.PI * 2); c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = color; c.lineWidth = 1.5; c.stroke(); 
}

export function drawHandleSquare(c, x, y) { 
    c.beginPath(); c.setLineDash([]); c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 3; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
    const s = 10; c.rect(x - s/2, y - s/2, s, s); c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = userSettings.accentColor; c.lineWidth = 1.5; c.stroke(); 
}

export function applyShadow(ctx, on) { 
    if (on) { 
        let blur = parseInt(userSettings.shadowBlur); if (isNaN(blur)) blur = 10; ctx.shadowBlur = blur; 
        let dist = parseInt(userSettings.shadowDistance); if (isNaN(dist)) dist = 5; ctx.shadowOffsetX = dist; ctx.shadowOffsetY = dist; 
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
    } else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; } 
}

export async function getFinalImageData(exportW, exportH, asBuffer = false) {
    await Promise.all(shapes.map(async s => {
        if (s.type === 'magnifier-snap' && !s._imgCache) {
            return new Promise(resolve => { const img = new Image(); img.onload = () => { s._imgCache = img; resolve(); }; img.src = s.imgData; });
        }
    }));

    const exportCanvas = document.createElement('canvas'); exportCanvas.width = exportW; exportCanvas.height = exportH;
    const exCtx = exportCanvas.getContext('2d');
    const marginX = (exportW - backgroundCanvas.width) / 2; const marginY = (exportH - backgroundCanvas.height) / 2;
    if (backgroundCanvas.width > 0) exCtx.drawImage(backgroundCanvas, marginX, marginY);

    exCtx.save(); exCtx.translate(marginX, marginY); exCtx.scale(dpr, dpr); 
    exCtx.globalCompositeOperation = 'multiply'; 
    shapes.forEach(s => { if (s.opacity < 1 && s.type !== 'eraser-stroke') try { drawShape(exCtx, s); } catch(e){} });
    exCtx.globalCompositeOperation = 'source-over';
    shapes.forEach(s => {
        if (s.opacity < 1 && s.type !== 'eraser-stroke') return;
        exCtx.globalCompositeOperation = (s.type === 'eraser-stroke') ? 'destination-out' : 'source-over';
        try { drawShape(exCtx, s); } catch(e){}
    });
    
    if(userSettings.watermarkText && window.AppFeatures.enableWatermark) {
         exCtx.setTransform(1, 0, 0, 1, 0, 0); exCtx.font = "bold 14px Segoe UI"; exCtx.fillStyle = "rgba(255,255,255,0.7)"; exCtx.textAlign = "right"; exCtx.textBaseline = "bottom"; exCtx.shadowColor = "rgba(0,0,0,0.8)"; exCtx.shadowBlur = 2;
         exCtx.fillText(userSettings.watermarkText, exportW - 10, exportH - 10);
    }
    exCtx.restore();

    if (asBuffer) {
        return new Promise((resolve) => {
            exportCanvas.toBlob((blob) => { blob.arrayBuffer().then(buffer => resolve(new Uint8Array(buffer))); }, userSettings.imageFormat || 'image/png', parseFloat(userSettings.imageQuality) || 0.9);
        });
    }
    return exportCanvas.toDataURL(userSettings.imageFormat || 'image/png', parseFloat(userSettings.imageQuality) || 0.9);
}

export function clearBackground() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); shapeLayerCtx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height); shapeLayerCtx.clearRect(0, 0, shapeLayerCanvas.width, shapeLayerCanvas.height); 
    const cbW = backgroundCanvas.width; backgroundCanvas.width = cbW; 
    bgCtx.scale(dpr, dpr); bgCtx.lineCap = userSettings.cornerStyle || 'round'; bgCtx.lineJoin = userSettings.cornerStyle || 'round';
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
}

// ==========================================
// 6. MATH, GEOMETRY & HIT TESTING
// ==========================================

export function clampCursorDot(clientX, clientY) {
    if (!cursorDot) return;
    const rect = frame.getBoundingClientRect();
    const pad = parseInt(sizeSl.value) / 2 || 2; 
    let dotX = Math.max(rect.left + pad, Math.min(clientX, rect.right - pad));
    let dotY = Math.max(rect.top + pad, Math.min(clientY, rect.bottom - pad));
    cursorDot.style.left = dotX + 'px';
    cursorDot.style.top = dotY + 'px';
}

export const getXY = (e) => { 
    const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; 
};

export function applyGridSnap(val, axis) {
    const gridEl = document.getElementById('grid');
    if (!userSettings.snapToGrid || !(gridEl && !gridEl.classList.contains('hidden'))) return val;
    const size = parseInt(userSettings.gridSize) || 20;
    const center = Math.floor((axis === 'x') ? (w / 2) : (h / 2));
    return center + (Math.round((val - center) / size) * size);
}

export function getHandleAt(p, s) {
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
        ctx.save(); ctx.font = s.font; ctx.textBaseline = 'top'; const m = ctx.measureText(s.text); const hStr = parseInt(s.font) || 20; ctx.restore();
        if (p.x >= s.x - 10 && p.x <= s.x + m.width + 10 && p.y >= s.y - 10 && p.y <= s.y + hStr + 10) return 6; 
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

export function hitTest(p) {
    const HIT_PAD = 20; 
    for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i];
        if (s.type === 'eraser-stroke' || s.type === 'ocr-selection') continue;
        if (s.type === 'text') {
            ctx.save(); ctx.font = s.font; ctx.textBaseline = 'top'; const hStr = parseInt(s.font) || 20; const m = ctx.measureText(s.text); ctx.restore();
            const tx = s.w < 0 ? s.x + s.w : s.x; const tw = Math.abs(s.w > 0 ? s.w : m.width); 
            if (p.x >= tx && p.x <= tx + tw && p.y >= s.y && p.y <= s.y + hStr) return s;
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

export function calculateDrawingSnap(p) {
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

export function calculateSmartSnaps(active) {
    snapLines.length = 0; // Maintain the reference while clearing the array
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