// AdvancedTools.js
import { Templates } from './templates.js';
import { showToast, resolvePath } from './Utils.js';

export const AdvancedTools = {
    updateSyringeLiquid: function(hexColor, isClicking, AppFeatures) {
        const encodedColor = hexColor.replace('#', '%23');
        const styleId = 'dynamic-syringe-style';
        let styleEl = document.getElementById(styleId);

        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }

        const shift = isClicking ? 6 : 0;
        const cssSVG = Templates.getSyringeSvg(encodedColor, shift);

        if (AppFeatures.type === 'pro') {
            styleEl.innerHTML = `.cursor-eyedropper { cursor: none !important; }`;
        } else {
            styleEl.innerHTML = `.cursor-eyedropper { cursor: url("data:image/svg+xml;utf8,${cssSVG.replace(/\n/g, '').trim()}") 12 52, crosshair !important; }`;
        }

        const virtualSyringe = document.getElementById('virtual-syringe');
        if (virtualSyringe) {
            const domSVG = Templates.getSyringeSvg(hexColor, shift).replace(/%23/g, '#'); 
            virtualSyringe.src = "data:image/svg+xml;utf8," + encodeURIComponent(domSVG);
        }
    },

    updateMagnifierLens: function(mX, mY, magSize, magZoom, tool, frame, backgroundCanvas, canvas, dpr, sizeSlValue, colorPkValue) {
        if (tool !== 'magnifier') return;
        const magLens = document.getElementById('magnifier-lens');
        if (!magLens) return;

        const openMenu = document.querySelector('.dropdown-content.show, .ctx-menu.show');
        const isOverUI = document.elementFromPoint(mX, mY)?.closest('.header, .footer, #floating-bar, .modal, .color-popup, #stamp-bubble');
        if (openMenu || isOverUI) { magLens.style.display = 'none'; frame.style.cursor = 'default'; return; }
        
        const rect = frame.getBoundingClientRect();
        if (mX < rect.left || mX > rect.right || mY < rect.top || mY > rect.bottom) { magLens.style.display = 'none'; frame.style.cursor = 'default'; return; }

        magLens.style.display = 'block'; frame.style.cursor = 'none'; 
        magLens.width = magSize; magLens.height = magSize;
        magLens.style.width = magSize + 'px'; magLens.style.height = magSize + 'px';
        magLens.style.left = (mX - magSize / 2) + 'px'; magLens.style.top = (mY - magSize / 2) + 'px';

        const ctxM = magLens.getContext('2d'); 
        const p = { x: mX - rect.left, y: mY - rect.top };
        const c = magSize / 2; 
        
        ctxM.clearRect(0, 0, magSize, magSize); 
        ctxM.save(); ctxM.beginPath(); ctxM.arc(c, c, c, 0, Math.PI*2); ctxM.clip();
        
        const srcW = magSize / magZoom; const srcH = magSize / magZoom;
        const srcX = p.x - (srcW / 2); const srcY = p.y - (srcH / 2);
        ctxM.globalAlpha = 1.0; ctxM.imageSmoothingEnabled = false; 
        if (backgroundCanvas.width > 0) ctxM.drawImage(backgroundCanvas, srcX * dpr, srcY * dpr, srcW * dpr, srcH * dpr, 0, 0, magSize, magSize);
        ctxM.drawImage(canvas, srcX * dpr, srcY * dpr, srcW * dpr, srcH * dpr, 0, 0, magSize, magSize);
        ctxM.restore();

        ctxM.save();
        let borderW = parseInt(sizeSlValue) || 3;
        if (borderW > magSize / 2) borderW = magSize / 2;
        const drawRadius = c - (borderW / 2);

        ctxM.beginPath(); ctxM.arc(c, c, drawRadius, 0, Math.PI * 2);
        ctxM.lineWidth = borderW; ctxM.strokeStyle = colorPkValue; ctxM.stroke();

        if (borderW >= 4) {
            const edgeW = Math.max(1, borderW * 0.15);
            ctxM.beginPath(); ctxM.arc(c, c, drawRadius - (borderW/2) + edgeW, 0, Math.PI);
            ctxM.strokeStyle = 'rgba(0, 0, 0, 0.3)'; ctxM.lineWidth = edgeW; ctxM.stroke();
            
            ctxM.beginPath(); ctxM.arc(c, c, drawRadius + (borderW/2) - edgeW, Math.PI, Math.PI * 2);
            ctxM.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctxM.lineWidth = edgeW; ctxM.stroke();
        }
        ctxM.restore();
    },

    updateEyedropperUnit: function(screenX, screenY, frame, w, h, dpr, backgroundCanvas, canvas) {
        const microLens = document.getElementById('micro-lens');
        const virtualSyringe = document.getElementById('virtual-syringe');
        if (!microLens || !virtualSyringe) return;

        const rect = frame.getBoundingClientRect();
        const pickX = screenX - rect.left;
        const pickY = screenY - rect.top;

        if (pickX < -1 || pickY < -1 || pickX > w + 1 || pickY > h + 1) {
            microLens.style.display = 'none'; virtualSyringe.style.display = 'none';
            document.body.classList.remove('force-no-cursor'); return;
        }

        document.body.classList.add('force-no-cursor');
        microLens.style.display = 'block'; virtualSyringe.style.display = 'block';
        
        microLens.style.left = (screenX - 30) + 'px'; 
        microLens.style.top = (screenY - 30) + 'px';
        virtualSyringe.style.left = (screenX + 9) + 'px'; 
        virtualSyringe.style.top = (screenY - 73) + 'px'; 

        const ctxM = microLens.getContext('2d');
        ctxM.imageSmoothingEnabled = false; ctxM.clearRect(0, 0, 60, 60);
        ctxM.save(); ctxM.beginPath(); ctxM.arc(30, 30, 30, 0, Math.PI*2); ctxM.clip();
        
        const sampleSize = 5; 
        if (backgroundCanvas.width > 0) ctxM.drawImage(backgroundCanvas, Math.floor(pickX * dpr) - (sampleSize/2 * dpr), Math.floor(pickY * dpr) - (sampleSize/2 * dpr), sampleSize * dpr, sampleSize * dpr, 0, 0, 60, 60);
        ctxM.drawImage(canvas, Math.floor(pickX * dpr) - (sampleSize/2 * dpr), Math.floor(pickY * dpr) - (sampleSize/2 * dpr), sampleSize * dpr, sampleSize * dpr, 0, 0, 60, 60);

        ctxM.strokeStyle = 'rgba(255, 255, 255, 0.2)'; ctxM.lineWidth = 1;
        ctxM.beginPath();
        ctxM.moveTo(30, 8); ctxM.lineTo(30, 22); ctxM.moveTo(30, 38); ctxM.lineTo(30, 52);
        ctxM.moveTo(8, 30); ctxM.lineTo(22, 30); ctxM.moveTo(38, 30); ctxM.lineTo(52, 30);
        ctxM.stroke();

        for (let i = 0; i < 8; i++) {
            ctxM.save(); 
            ctxM.translate(30, 30); 
            ctxM.rotate((i * 45 * Math.PI) / 180);
            ctxM.beginPath(); 
            ctxM.moveTo(0, -30); 
            if (i % 2 === 0) {
                ctxM.strokeStyle = '#000000'; ctxM.lineWidth = 2; ctxM.lineTo(0, -22); 
            } else {
                ctxM.strokeStyle = '#8CFA96'; ctxM.lineWidth = 1.5; ctxM.lineTo(0, -26);
            }
            ctxM.stroke(); 
            ctxM.restore();
        }

        const centerSize = 60 / sampleSize; 
        const rectX = 30 - (centerSize/2); const rectY = 30 - (centerSize/2);
        ctxM.strokeStyle = 'rgba(0, 0, 0, 0.8)'; ctxM.lineWidth = 3; 
        ctxM.strokeRect(rectX, rectY, centerSize, centerSize);
        ctxM.strokeStyle = '#8CFA96'; ctxM.lineWidth = 1.5; 
        ctxM.strokeRect(rectX, rectY, centerSize, centerSize);
        
        ctxM.fillStyle = '#FF0055'; ctxM.fillRect(29, 29, 2, 2); 

        const rimGrad = ctxM.createRadialGradient(30, 30, 20, 30, 30, 30);
        rimGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        rimGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.15)');
        rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
        ctxM.fillStyle = rimGrad;
        ctxM.fillRect(0, 0, 60, 60);

        ctxM.save();
        ctxM.translate(30, 30); 
        ctxM.rotate(45 * Math.PI / 180); 

        ctxM.beginPath();
        ctxM.arc(0, 0, 26, Math.PI * 1.15, Math.PI * 1.85); 
        ctxM.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctxM.lineWidth = 2.5;
        ctxM.lineCap = 'round';
        ctxM.stroke();

        ctxM.beginPath();
        ctxM.ellipse(0, -16, 20, 8, 0, 0, Math.PI * 2); 
        const washGrad = ctxM.createLinearGradient(0, -24, 0, -8); 
        washGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        washGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctxM.fillStyle = washGrad;
        ctxM.fill();
        
        ctxM.restore();
    },

    performOCR: async function(x, y, w, h, backgroundCanvas, shapes, dpr, drawShapeFn, frame, electronAPI) {
        if (typeof Tesseract === 'undefined') { showToast("Error: Tesseract library missing."); return; }
        const btnOCR = document.getElementById('btn-ocr');
        const originalIcon = btnOCR ? btnOCR.innerHTML : '';
        if(btnOCR) { btnOCR.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>'; btnOCR.style.color = '#e6e600'; }

        const scanner = document.createElement('div'); scanner.className = 'ocr-scan-overlay';
        scanner.style.left = x + 'px'; scanner.style.top = y + 'px'; scanner.style.width = w + 'px'; scanner.style.height = h + 'px';
        frame.appendChild(scanner);

        await new Promise(resolve => setTimeout(resolve, 50));
        const minTimePromise = new Promise(resolve => setTimeout(resolve, 2000));

        try {
            const ocrCanvas = document.createElement('canvas'); ocrCanvas.width = w; ocrCanvas.height = h; const ocrCtx = ocrCanvas.getContext('2d');
            if (backgroundCanvas.width > 0) ocrCtx.drawImage(backgroundCanvas, x*dpr, y*dpr, w*dpr, h*dpr, 0, 0, w, h);
            const shapesToRender = [...shapes];
            ocrCtx.save(); ocrCtx.translate(-x, -y); 
            ocrCtx.globalCompositeOperation = 'multiply'; shapesToRender.forEach(s => { if (s.opacity < 1 && s.type !== 'eraser-stroke') try { drawShapeFn(ocrCtx, s); } catch(e){} });
            ocrCtx.globalCompositeOperation = 'source-over'; shapesToRender.forEach(s => { if (s.opacity < 1 && s.type !== 'eraser-stroke') return; ocrCtx.globalCompositeOperation = (s.type === 'eraser-stroke') ? 'destination-out' : 'source-over'; try { drawShapeFn(ocrCtx, s); } catch(e){} });
            ocrCtx.restore();

            const dataUrl = ocrCanvas.toDataURL('image/png');
            const workerPath = resolvePath('assets/ocr/worker.min.js'); const corePath = resolvePath('assets/ocr/tesseract-core.wasm.js'); const wasmPath = resolvePath('assets/ocr/tesseract-core.wasm');
            const workerBlob = await fetch(workerPath).then(r => r.blob()); const workerBlobURL = URL.createObjectURL(workerBlob);
            const wasmBlob = await fetch(wasmPath).then(r => r.blob()); const wasmBlobURL = URL.createObjectURL(wasmBlob);
            let coreJsText = await fetch(corePath).then(r => r.text()); coreJsText = coreJsText.replace(/tesseract-core\.wasm/g, wasmBlobURL);
            const coreBlobURL = URL.createObjectURL(new Blob([coreJsText], { type: 'application/javascript' }));

            const worker = await Tesseract.createWorker({ workerPath: workerBlobURL, corePath: coreBlobURL, langPath: resolvePath('assets/ocr/'), logger: m => console.log(m) });
            await worker.loadLanguage('eng'); await worker.initialize('eng');
            const result = await Promise.all([worker.recognize(dataUrl), minTimePromise]);
            const text = result[0].data.text.trim();
            await worker.terminate();

            URL.revokeObjectURL(workerBlobURL); URL.revokeObjectURL(coreBlobURL); URL.revokeObjectURL(wasmBlobURL);

            if (text) { electronAPI.writeText(text); if(btnOCR) { btnOCR.innerHTML = '<i class="fa-solid fa-check"></i>'; btnOCR.style.color = '#00ff00'; } showToast("Text copied to clipboard!"); } 
            else { if(btnOCR) btnOCR.style.color = '#ff5555'; showToast("No text detected."); }
        } catch (err) {
            console.error("OCR Failed:", err); if(btnOCR) btnOCR.style.color = '#ff5555'; showToast("OCR Error: " + (err.message || "Unknown"));
        } finally {
            scanner.remove(); setTimeout(() => { if(btnOCR) { btnOCR.innerHTML = originalIcon; btnOCR.style.color = ''; } }, 2000);
        }
    }
};