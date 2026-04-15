// ExportManager.js

export const ExportManager = {
    getFilename: function(userSettings, AppFeatures, sequenceCounter, width, height) {
        // 1. Trust the user's setting first. Only fallback if it is completely empty.
        let template = (userSettings.filenameFmt && userSettings.filenameFmt.trim() !== '') 
            ? userSettings.filenameFmt 
            : 'CapSize_{Y}-{M}-{D}_{h}-{m}-{s}';
        
        // (Removed the aggressive AppFeatures.type === 'core' override that was 
        // misfiring and overwriting your custom Pro templates)
        
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        
        // 2. Ensure sequence counter safely defaults and pads to 3 digits
        const safeSeq = (sequenceCounter || 1).toString().padStart(3, '0');

        const replacements = {
            '{seq}': safeSeq,
            '{timestamp}': `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`,
            '{date}': `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
            '{time}': `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`,
            '{Y}': now.getFullYear().toString(), 
            '{M}': pad(now.getMonth() + 1), 
            '{D}': pad(now.getDate()),
            '{h}': pad(now.getHours()), 
            '{m}': pad(now.getMinutes()), 
            '{s}': pad(now.getSeconds()),
            '{width}': (width || 0).toString(), 
            '{height}': (height || 0).toString()
        };

        let filename = template;
        
        // 3. Process replacements sequentially
        for (const [key, val] of Object.entries(replacements)) {
            filename = filename.split(key).join(val);
        }
        
        // Clean illegal characters to prevent OS save errors
        filename = filename.replace(/[<>:"/\\|?*]/g, '-');
        
        let ext = 'png';
        if (userSettings && userSettings.imageFormat) {
            if(userSettings.imageFormat.includes('jpeg')) ext = 'jpg';
            else if(userSettings.imageFormat.includes('webp')) ext = 'webp';
        }
        
        return `${filename}.${ext}`;
    },

    getFinalImageData: async function(exportW, exportH, asBuffer, shapes, backgroundCanvas, dpr, userSettings, AppFeatures, drawShapeFn) {
        // PRE-LOADER FIX: Wait for all magnifier snapshots to instantiate before drawing
        await Promise.all(shapes.map(async s => {
            if (s.type === 'magnifier-snap' && !s._imgCache) {
                return new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => { s._imgCache = img; resolve(); };
                    img.src = s.imgData;
                });
            }
        }));

        const exportCanvas = document.createElement('canvas'); 
        exportCanvas.width = exportW; 
        exportCanvas.height = exportH;
        
        const exCtx = exportCanvas.getContext('2d');
        const marginX = (exportW - backgroundCanvas.width) / 2; 
        const marginY = (exportH - backgroundCanvas.height) / 2;
        
        if (backgroundCanvas.width > 0) exCtx.drawImage(backgroundCanvas, marginX, marginY);

        exCtx.save(); 
        exCtx.translate(marginX, marginY); 
        exCtx.scale(dpr, dpr); 
        exCtx.globalCompositeOperation = 'multiply'; 
        
        shapes.forEach(s => { 
            if (s.opacity < 1 && s.type !== 'eraser-stroke') {
                try { drawShapeFn(exCtx, s); } catch(e){} 
            }
        });
        
        exCtx.globalCompositeOperation = 'source-over';
        shapes.forEach(s => {
            if (s.opacity < 1 && s.type !== 'eraser-stroke') return;
            exCtx.globalCompositeOperation = (s.type === 'eraser-stroke') ? 'destination-out' : 'source-over';
            try { drawShapeFn(exCtx, s); } catch(e){}
        });
        
        if (userSettings.watermarkText && AppFeatures.enableWatermark) {
             exCtx.setTransform(1, 0, 0, 1, 0, 0); 
             exCtx.font = "bold 14px Segoe UI"; 
             exCtx.fillStyle = "rgba(255,255,255,0.7)"; 
             exCtx.textAlign = "right"; 
             exCtx.textBaseline = "bottom"; 
             exCtx.shadowColor = "rgba(0,0,0,0.8)"; 
             exCtx.shadowBlur = 2;
             exCtx.fillText(userSettings.watermarkText, exportW - 10, exportH - 10);
        }
        
        exCtx.restore();

        if (asBuffer) {
            return new Promise((resolve) => {
                exportCanvas.toBlob((blob) => {
                    blob.arrayBuffer().then(buffer => resolve(new Uint8Array(buffer)));
                }, userSettings.imageFormat || 'image/png', parseFloat(userSettings.imageQuality) || 0.9);
            });
        }

        return exportCanvas.toDataURL(userSettings.imageFormat || 'image/png', parseFloat(userSettings.imageQuality) || 0.9);
    }
};