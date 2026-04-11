import { userSettings } from './Config.js';

// 1. Elements actually live in UIElements.js now
import { canvas, backgroundCanvas, bgCtx } from './UIElements.js';

// 2. State and logic functions stay in renderer.js
import { 
    dpr, shapes, activeTextWrapper, isWGCFrozen, isFullscreen, capturedImage,
    activeShape, selectedShape, polygonPoints,
    commitActiveText, saveState, doDelete, updateCanvasSize,
    showToast, getSaveFilename
} from './renderer.js';

// 3. Drawing logic lives in CanvasEngine.js
import { renderMain, getFinalImageData, drawShape } from './CanvasEngine.js';

// ==========================================
// 11. CORE ACTIONS (Save, Snap, Clipboard, OCR)
// ==========================================

export const doSnap = async () => {
    if (activeTextWrapper) commitActiveText();
    
    // Reset selection for a clean snap
    if (selectedShape || activeShape) {
        // We use window.dispatchEvent to communicate back to renderer if needed, 
        // but for now, we just null them out locally via the imported reference
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
        const rect = document.getElementById('frame').getBoundingClientRect();
        updateCanvasSize(rect.width, rect.height, true); 
        document.getElementById('frame').classList.remove('clean-slate'); 
        // Note: hasSnappedInFullscreen update happens via window event or direct logic
        renderMain(); 
        await finalizeSnap();
        return; 
    }

    try {
        const result = await window.electronAPI.invoke('capture-window-mode-wgc');
        if (result?.success) {
            const img = new Image();
            img.onload = async () => {
                const canvasRect = canvas.getBoundingClientRect();
                const scale = await window.electronAPI.invoke('get-scale-factor');
                const winPos = await window.electronAPI.invoke('get-window-pos');
                const relX = winPos.x + canvasRect.left;
                const relY = winPos.y + canvasRect.top;
                
                bgCtx.setTransform(1, 0, 0, 1, 0, 0); 
                bgCtx.imageSmoothingEnabled = false; 
                bgCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
                bgCtx.drawImage(img, Math.round(relX * scale), Math.round(relY * scale), Math.round(canvasRect.width * scale), Math.round(canvasRect.height * scale), 0, 0, backgroundCanvas.width, backgroundCanvas.height);
                bgCtx.scale(dpr, dpr);
                saveState(); 
                renderMain(); 
                finalizeSnap();
            };
            img.src = result.base64;
        }
    } catch (e) { showToast("Snap IPC error."); }
};

export const doClipboard = async () => {
    try {
        if(activeTextWrapper) commitActiveText();
        const buffer = await getFinalImageData(backgroundCanvas.width, backgroundCanvas.height, true);
        window.electronAPI.send('clipboard-write-image', buffer);
        return true;
    } catch (e) {
        console.error("Auto-copy failed", e);
        return false;
    }
};

export const doSave = async (e) => {
    if(activeTextWrapper) commitActiveText();
    let dataURL;
    if (isWGCFrozen && isFullscreen && capturedImage) {
        const tempCanvas = document.createElement('canvas'); 
        const tempCtx = tempCanvas.getContext('2d');
        const rect = document.getElementById('frame').getBoundingClientRect();
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
            format: userSettings.imageFormat || 'image/png', folder: saveFolder, filename: getSaveFilename(), forceDialog: shiftHeld
        });
        if (saveResult === true) {
            showToast(saveFolder && !shiftHeld ? "Auto-Saved to Folder" : "Capture Saved");
            doDelete(); 
            return true;
        }
    } catch (err) { showToast("Error saving image."); }
    return false;
};

export const performOCR = async (x, y, w, h) => {
    const btnOCR = document.getElementById('btn-ocr');
    const originalIcon = btnOCR?.innerHTML || '';
    if(btnOCR) { btnOCR.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>'; btnOCR.style.color = '#e6e600'; }

    const scanner = document.createElement('div'); scanner.className = 'ocr-scan-overlay';
    scanner.style.left = x + 'px'; scanner.style.top = y + 'px'; scanner.style.width = w + 'px'; scanner.style.height = h + 'px';
    document.getElementById('frame').appendChild(scanner);

   try {
        const ocrCanvas = document.createElement('canvas'); 
        ocrCanvas.width = w; 
        ocrCanvas.height = h; 
        const ocrCtx = ocrCanvas.getContext('2d');

        // Draw background if it exists
        if (backgroundCanvas.width > 0) {
            ocrCtx.drawImage(backgroundCanvas, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, w, h);
        }

        // Draw active shapes on top of the OCR crop
        ocrCtx.save(); 
        ocrCtx.translate(-x, -y); 
        ocrCtx.globalCompositeOperation = 'source-over'; 
        
        // Use the imported drawShape directly
        shapes.forEach(s => { 
            if (s.type !== 'eraser-stroke') drawShape(ocrCtx, s); 
        });
        ocrCtx.restore();

        // Perform recognition
        const result = await Tesseract.recognize(ocrCanvas.toDataURL('image/png'), 'eng');
        logger: m => console.log(m)
        const text = result.data.text.trim();

        if (text) { 
            window.electronAPI.send('clipboard-write-text', text); 
            showToast("Text copied to clipboard!"); 
        } else { 
            showToast("No text detected."); 
        }
    } catch (err) { 
        console.error("OCR Error:", err);
        showToast("OCR Error"); 
    } finally {
        scanner.remove(); 
        if (btnOCR) { 
            btnOCR.innerHTML = originalIcon; 
            btnOCR.style.color = ''; 
        }
    }
};