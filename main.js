const { 
    app, 
    BrowserWindow, 
    ipcMain, 
    globalShortcut, 
    desktopCapturer, 
    dialog, 
    screen, 
    Tray, 
    Menu, 
    nativeImage,
    clipboard, 
    shell
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { machineIdSync } = require('node-machine-id');

// [NEW] Load WGC Sidecar with Explicit Path
let wgc = null;
try {
    // 1. Force load from the exact path we know exists
    wgc = require('./build/Release/wgc_capture.node');
    console.log("!!! WGC FAST CAPTURE LOADED SUCCESSFULLY !!!");
} catch (e) {
    console.error("!!! WGC LOAD ERROR (Direct Path) !!!", e);
    try {
        // 2. Fallback to bindings helper
        wgc = require('bindings')('wgc_capture');
        console.log("!!! WGC LOADED VIA BINDINGS !!!");
    } catch (e2) {
        console.error("!!! WGC LOAD ERROR (Bindings) !!!", e2);
    }
}

// ==========================================
// 1. IMPORT DEPENDENCIES FIRST
// ==========================================
const licenseMgr = require('./licenseManager');
let mainWindow;

// ==========================================
// 2. APP CONFIGURATION & LICENSE CHECK
// ==========================================
let IS_PRO_BUILD = false; 


// ==========================================
// 3. SECURE DEVELOPER OVERRIDE STATE
// ==========================================
let DEV_FORCE_PRO = process.env.TEST_PRO_MODE === 'true';


// --- 1. STANDARDIZED STORAGE PATHS ---
// (The rest of your code continues normally from here down...)
if (process.platform === 'win32') {
    app.setAppUserModelId('com.mintlogic.capsize');
}


// --- 1. STANDARDIZED STORAGE PATHS ---
const MINT_LOGIC_PATH = path.join(app.getPath('appData'), 'MintLogic');
const APP_STORAGE_PATH = path.join(MINT_LOGIC_PATH, 'CapSize');
const CONFIG_FILE = path.join(APP_STORAGE_PATH, 'config.json');

const ensureStorage = () => {
    try {
        if (!fs.existsSync(MINT_LOGIC_PATH)) fs.mkdirSync(MINT_LOGIC_PATH);
        if (!fs.existsSync(APP_STORAGE_PATH)) fs.mkdirSync(APP_STORAGE_PATH);
        return true;
    } catch (e) { return false; }
};

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    ensureStorage();
    
    let tray = null;
    let lastToggle = 0;

    const icoPath = path.join(__dirname, 'icon.ico');
    const pngPath = path.join(__dirname, 'icon.png');
    const getIcon = () => fs.existsSync(icoPath) ? icoPath : pngPath;

    // [FIXED] Updated Handshake: Respects the --hidden flag for silent boot
ipcMain.on('renderer-content-ready', () => {
    if(mainWindow) {
        // Only reveal the window if we AREN'T in silent startup mode
        const isStartupLaunch = process.argv.includes('--hidden');
        
        if (!isStartupLaunch) {
            console.log("HANDSHAKE RECEIVED: Revealing Window");
            mainWindow.setOpacity(1);
            mainWindow.show(); // Ensure show is called
            mainWindow.focus();
        } else {
            console.log("HANDSHAKE RECEIVED: Staying hidden in tray (Silent Boot)");
            // Ensure the window is truly hidden but ready in the background
            mainWindow.hide(); 
            mainWindow.setOpacity(0);
        }
    }
});

    // --- FEATURE FLAG HANDLER (SYNC) ---
ipcMain.on('get-is-pro-sync', (event) => { 
    // SECURITY: If the app is compiled, ALWAYS ignore the dev overrides.
    if (app.isPackaged) {
        event.returnValue = IS_PRO_BUILD;
        return;
    }
    // If running locally, allow the developer override to fake the Pro status
    event.returnValue = DEV_FORCE_PRO ? true : IS_PRO_BUILD;
});

// --- DEVELOPER UI CHANNELS ---
ipcMain.on('get-is-dev-sync', (e) => { 
    e.returnValue = !app.isPackaged; 
});

ipcMain.on('toggle-dev-pro', () => {
    // SECURITY: Physically impossible to trigger in the compiled app
    if (!app.isPackaged) {
        DEV_FORCE_PRO = !DEV_FORCE_PRO;
        console.log("🛠️ DEV MODE: Pro Status flipped to " + DEV_FORCE_PRO);
        if (mainWindow) mainWindow.reload(); // Instantly refresh the UI
    }
});

ipcMain.on('nuke-license', () => {
    // SECURITY: Physically impossible to trigger in the compiled app
    if (!app.isPackaged) {
        try {
            // Get the exact path where the encrypted license is saved
            const savePath = licenseMgr.getLicensePath('CapSize');
            
            // Delete the file if it exists
            if (fs.existsSync(savePath)) {
                fs.unlinkSync(savePath);
            }
            
            // Reset the internal app memory
            IS_PRO_BUILD = false;
            DEV_FORCE_PRO = false; 
            
            console.log("💣 DEV MODE: License Nuked. Returned to Core Mode.");
            
            // Instantly refresh the UI
            if (mainWindow) mainWindow.reload();
        } catch (e) {
            console.error("Failed to nuke license:", e);
        }
    }
});

    // --- LICENSE VALIDATION LISTENER ---
ipcMain.on('validate-license', async (event, filePath) => {
    console.log(`[DEBUG-MAIN] Passkey drop received!`);
    try {
        // 1. Read the physical .mint file (or temp file from admin bypass)
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        let rawData = JSON.parse(fileContent);

        // 2. Ensure they aren't dropping a SmartClip key into CapSize
        if (rawData.app !== 'CapSize') {
            return event.reply('license-response', { 
                success: false, 
                reason: `This key is for ${rawData.app || 'another app'}, not CapSize.` 
            });
        }

        // 3. The Corporate Registry Bypass for Hardware ID
        let hwId;
        try {
            hwId = machineIdSync();
        } catch (e) {
            // If corporate IT blocks Registry reads, generate a unique, deterministic hash based on PC Name + Username
            const crypto = require('crypto');
            hwId = crypto.createHash('sha256').update(os.hostname() + os.userInfo().username).digest('hex');
            console.log(`[DEBUG-MAIN] Registry blocked. Using Fallback ID: ${hwId}`);
        }
        
        console.log(`[DEBUG-MAIN] Pinging Upstash for Order: ${rawData.order_id}`);
        
        // 4. Ping Upstash to check the 3-Activation Limit
        const UPSTASH_CHECK_URL = "https://mint-logic-site.vercel.app/api/check-activation";
        const cloudResponse = await fetch(UPSTASH_CHECK_URL, {
            method: 'POST',
            body: JSON.stringify({ order_id: rawData.order_id, hw_id: hwId, app: 'CapSize' }),
            headers: { 'Content-Type': 'application/json' }
        });

        const cloudResult = await cloudResponse.json();

        // 5. Block the Reddit Pirates
        if (!cloudResult.authorized) {
            if (!app.isPackaged) {
                console.log("🛠️ DEV MODE: Bypassing Upstash limit for local testing.");
            } else {
                return event.reply('license-response', { 
                    success: false, 
                    reason: cloudResult.reason || "Activation limit reached (3 max)." 
                });
            }
        }

        // 6. Upstash Approved! Tell Windows to encrypt the local passkey.
        console.log("[DEBUG-MAIN] Upstash approved! Saving local encrypted passkey...");
        
        // 1. We construct the payload, but this time we inject the REAL hwId 
        // that was generated at the top of this function!
       const payloadToSave = { 
            app: 'CapSize', 
            owner: rawData.owner, 
            order_id: rawData.order_id, 
            hw_id: hwId, 
            unlocked: true 
        };
        
        // 2. LicenseManager will automatically detect the real hw_id, 
        // recalculate the signature locally, and encrypt it to the disk.
        const saved = licenseMgr.saveLicense(payloadToSave, 'CapSize');
        
        if (saved) {
            console.log("[DEBUG-MAIN] Success! CapSize is Pro.");
            IS_PRO_BUILD = true;
            event.reply('license-response', { success: true, owner: rawData.owner });
            setTimeout(() => { if (mainWindow) mainWindow.reload(); }, 1500);
        } else {
            event.reply('license-response', { success: false, reason: "Local Windows OS Encryption failed." });
        }

    } catch (err) {
        console.error("[DEBUG-MAIN] Activation Error:", err);
        event.reply('license-response', { success: false, reason: "Invalid file format or connection error." });
    }
});

    // --- CONFIG LOADER (UNIVERSAL) ---
    ipcMain.on('get-app-config-sync', (event) => {
        if (fs.existsSync(CONFIG_FILE)) {
            try {
                const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
                event.returnValue = JSON.parse(data);
            } catch (e) { 
                console.error("Config Read Error:", e); 
                event.returnValue = null;
            }
        } else {
            event.returnValue = null;
        }
    });

    // --- CONFIG SAVER (UNIVERSAL) ---
    ipcMain.on('save-app-config', (event, settings) => {
        ensureStorage();
        try {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(settings, null, 2));
        } catch (e) { 
            console.error("Config Write Error:", e); 
        }
    });

    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
        }
    });

    function createTray() {
        tray = new Tray(getIcon());
        const title = IS_PRO_BUILD ? 'CapSize' : 'CapSize Core';
        const contextMenu = Menu.buildFromTemplate([
            { label: `Open ${title}`, click: () => toggleWindow() },
            { type: 'separator' },
            { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
        ]);
        tray.setToolTip(title);
        tray.setContextMenu(contextMenu);
        tray.on('click', () => toggleWindow());
    }

    // Landmark: Tray Toggle Logic
function toggleWindow() {
    if (!mainWindow) return;
    const now = Date.now();
    if (now - lastToggle < 500) return; 
    lastToggle = now;

    if (mainWindow.isVisible()) {
        // IMPORTANT: If hiding while in FS, turn FS off so it can wake up normally
        if (mainWindow.isFullScreen()) {
            mainWindow.setFullScreen(false);
        }
        mainWindow.hide();
    } else {
        // wake up logic...
        if (currentSessionMode === 'fs') {
            performInstantCapture();
        } else {
            mainWindow.setOpacity(1);
            mainWindow.show();
            mainWindow.focus();
        }
    }
}

let currentSessionMode = null; // Tracks 'window' or 'fs'

// Helper to determine the initial mode based on user settings
function getInitialMode() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(data).startFullscreen ? 'fs' : 'window';
        } catch (e) { return 'window'; }
    }
    return 'window';
}

async function performInstantCapture() {
    if (!mainWindow) return;

    // If the user hits the hotkey, they WANT to see the app.
    // We must clear the 'hidden' state if it exists.
    if (process.argv.includes('--hidden')) {
        // Remove the flag from the session so subsequent actions behave normally
        const index = process.argv.indexOf('--hidden');
        if (index > -1) process.argv.splice(index, 1);
    }

    if (!currentSessionMode) {
        currentSessionMode = getInitialMode();
    }

    if (currentSessionMode === 'fs') {
        const wasVisible = mainWindow.isVisible();

        // 1. CLEAR CAPSIZE (Only if it is physically blocking the screen)
        if (wasVisible) {
            mainWindow.hide();
            await new Promise(r => setTimeout(r, 150)); 
        }

        // 2. THE 16ms MICRO-FLUSH (WGC EXCLUSIVE)
        try {
            let base64 = null;
            if (wgc) {
                const point = screen.getCursorScreenPoint();
                
                // A. Tap the API to wake it up and clear the 5-minute-old stale frame
                wgc.captureScreen(point.x, point.y); 
                
                // B. Wait EXACTLY 16ms (1 monitor frame at 60Hz)
                // This gives Windows the absolute minimum time needed to composite the live pixels
                await new Promise(r => setTimeout(r, 16)); 
                
                // C. Grab the fresh, live frame
                const rawBuffer = wgc.captureScreen(point.x, point.y); 
                
                if (rawBuffer && rawBuffer.length > 0) {
                    base64 = `data:image/png;base64,${rawBuffer.toString('base64')}`;
                }
            } else {
                // ELECTRON NATIVE FALLBACK
                const b = mainWindow.getBounds(); 
                const d = screen.getDisplayMatching(b);
                const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) } });
                const src = sources.find(s => s.display_id === d.id.toString()) || sources[0];
                if (src) base64 = src.thumbnail.toDataURL();
            }

            // 3. SHOW THE CAPTURE
            if (base64) {
                if (mainWindow.isMaximized()) mainWindow.unmaximize();
                mainWindow.setFullScreen(true);
                
                mainWindow.setOpacity(0); // <-- CLOAK BEFORE SHOWING
                mainWindow.show();
                mainWindow.focus();
                // mainWindow.setOpacity(1); // <-- Let renderer.js reveal it
                
                mainWindow.webContents.send('wgc-data-received', base64);
            }
        } catch (e) {
            console.error("Hotkey FS Capture Error:", e);
        }
    } else {
        // --- WINDOWED MODE HOTKEY TOGGLE ---
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
            mainWindow.show();
            mainWindow.focus();
            mainWindow.setOpacity(1);
            mainWindow.webContents.send('window-shown'); 
        }
    }
}

// Ensure the mode is updated when the user manually switches modes in the UI
ipcMain.on('force-maximize', () => { currentSessionMode = 'fs'; });
ipcMain.on('resize-window', () => { currentSessionMode = 'window'; });

    function createWindow() {
        const mousePoint = screen.getCursorScreenPoint();
        const display = screen.getDisplayNearestPoint(mousePoint);
        const STARTUP_W = 1200;
        const STARTUP_H = 700; 
        const x = Math.floor(display.bounds.x + (display.bounds.width / 2) - (STARTUP_W / 2));
        const y = Math.floor(display.bounds.y + (display.bounds.height / 2) - (STARTUP_H / 2));

        mainWindow = new BrowserWindow({
            width: STARTUP_W, height: STARTUP_H, 
            minWidth: 975, // Increased to match new UI floor
            minHeight: 170,
            x: x, y: y,
            frame: false, transparent: true, backgroundColor: '#00000000', alwaysOnTop: true,
            resizable: true, show: false,
            title: IS_PRO_BUILD ? 'CapSize' : 'CapSize Core',
            icon: getIcon(),
            webPreferences: {
                nodeIntegration: false, contextIsolation: true, sandbox: true,
                preload: path.join(__dirname, 'preload.js')
            }
        });
        
        mainWindow.loadFile('index.html');
        mainWindow.on('maximize', () => mainWindow.webContents.send('window-state-change', 'maximized'));
        mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-state-change', 'unmaximize'));
    }

    app.on('web-contents-created', (e, contents) => {
        
        // SECURE: Block drag-and-drop or programmatic navigation to external websites
        contents.on('will-navigate', (event, navigationUrl) => {
            event.preventDefault();
            console.warn('Navigation blocked to:', navigationUrl);
        });

        // SECURE: Block any attempts to open new popup windows
        contents.setWindowOpenHandler(() => {
            return { action: 'deny' };
        });

        // Existing spellcheck context menu logic
        contents.on('context-menu', (event, params) => {
            if (!params.isEditable) return;
            const menuTemplate = [];
            if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
                params.dictionarySuggestions.forEach(suggestion => {
                    menuTemplate.push({ label: suggestion, click: () => contents.replaceMisspelling(suggestion) });
                });
                menuTemplate.push({ type: 'separator' });
            }
            if (params.misspelledWord && params.misspelledWord.length > 0) {
                menuTemplate.push({ label: 'Add to Dictionary', click: () => contents.session.addWordToSpellCheckerDictionary(params.misspelledWord) });
                menuTemplate.push({ type: 'separator' });
            }
            menuTemplate.push({ label: 'Cut', role: 'cut' }, { label: 'Copy', role: 'copy' }, { label: 'Paste', role: 'paste' });
            const menu = Menu.buildFromTemplate(menuTemplate);
            menu.popup();
        });
    });
    
    app.whenReady().then(async () => {
    // 1. AWAIT the license check before building the UI
    const licenseStatus = await licenseMgr.loadLicense('CapSize'); 
    
    if (licenseStatus && licenseStatus.valid) {
        IS_PRO_BUILD = true;
        console.log(`[LICENSE] Valid Pro Passkey found on startup!`);
    } else {
        IS_PRO_BUILD = false;
        console.log(`[LICENSE] Core Mode Active on startup.`);
    }

    // 2. Now that we know the status, build the app
    createWindow(); 
    createTray();
    
    // [NEW] 3. SILENT WGC WARM-UP (Fixes the first-launch capture bug)
    if (wgc) {
        try {
            const point = screen.getCursorScreenPoint();
            wgc.captureScreen(point.x, point.y); 
        } catch(e) {}
    }
    
    // [FIXED] "LIGHTSHOT STYLE" HOTKEY
    globalShortcut.register('PrintScreen', performInstantCapture);
});

    app.on('will-quit', () => globalShortcut.unregisterAll());

    ipcMain.on('renderer-ready-to-show', () => {
        if (!mainWindow) return;
        if (!process.argv.includes('--hidden')) { mainWindow.show(); mainWindow.setOpacity(1); mainWindow.focus(); }
    });

    // --- HANDLERS ---
    ipcMain.handle('select-font', async () => {
        if (!mainWindow) return { canceled: true };
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { title: 'Import Custom Font', properties: ['openFile'], filters: [{ name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2'] }] });
        if (canceled || filePaths.length === 0) return { canceled: true };
        try {
            const fileData = fs.readFileSync(filePaths[0]);
            return { canceled: false, name: path.basename(filePaths[0], path.extname(filePaths[0])), data: `data:font/${path.extname(filePaths[0]).slice(1)};base64,${fileData.toString('base64')}` };
        } catch (e) { return { canceled: true, error: e.message }; }
    });
    
  // Add these simple listeners anywhere in your ipcMain block
ipcMain.on('hide-window', () => { if (mainWindow) mainWindow.hide(); });
ipcMain.on('show-window', () => { if (mainWindow) { mainWindow.show(); mainWindow.setOpacity(1); } });

// Replace your get-wgc-buffer handler
ipcMain.handle('get-wgc-buffer', async () => {
    if (!wgc) return null;
    
    // Crucial: Wait 250ms for the OS to clear the hidden window (Matches your working FS logic)
    await new Promise(r => setTimeout(r, 250)); 

    try {
        const point = screen.getCursorScreenPoint();
        wgc.captureScreen(point.x, point.y); 
        await new Promise(r => setTimeout(r, 32)); // Tiny flush buffer
        const rawBuffer = wgc.captureScreen(point.x, point.y);
        
        if (rawBuffer && rawBuffer.length > 0) {
            return `data:image/png;base64,${rawBuffer.toString('base64')}`;
        }
    } catch (e) { console.error(e); }
    return null;
});

// 1. Safe Scale Factor Retriever (No desktopCapturer required)
ipcMain.handle('get-scale-factor', () => {
    if (!mainWindow) return 1;
    const b = mainWindow.getBounds();
    const d = screen.getDisplayMatching(b);
    return d.scaleFactor || 1;
});

// 2. The Atomic Window Capture Sequence
ipcMain.handle('capture-window-mode-wgc', async () => {
    let debugLog = "START -> ";
    if (!mainWindow) return { error: "Main window is null" };
    
    mainWindow.hide();
    await new Promise(r => setTimeout(r, 250));
    debugLog += "HIDDEN -> ";

    try {
        if (wgc) {
            debugLog += "WGC LOADED -> ";
            const point = screen.getCursorScreenPoint();
            wgc.captureScreen(point.x, point.y);
            await new Promise(r => setTimeout(r, 50)); 
            
            let rawBuffer = wgc.captureScreen(point.x, point.y);
            if (!rawBuffer || rawBuffer.length === 0) {
                debugLog += "BUFFER 1 EMPTY -> ";
                await new Promise(r => setTimeout(r, 50));
                rawBuffer = wgc.captureScreen(point.x, point.y);
            }
            
            mainWindow.show();
            if (rawBuffer && rawBuffer.length > 0) {
                return { success: true, base64: `data:image/png;base64,${rawBuffer.toString('base64')}` };
            } else {
                return { error: debugLog + "BUFFER 2 EMPTY (Blocked by OS)" };
            }
        } else {
            debugLog += "WGC NULL (Fallback Triggered) -> ";
            const b = mainWindow.getBounds(); 
            const d = screen.getDisplayMatching(b);
            const sources = await desktopCapturer.getSources({ 
                types: ['screen'], 
                thumbnailSize: { 
                    width: Math.round(d.size.width * d.scaleFactor), 
                    height: Math.round(d.size.height * d.scaleFactor) 
                } 
            });
            
            if (!sources || sources.length === 0) {
                mainWindow.show();
                return { error: debugLog + "DESKTOPCAPTURER RETURNED 0 SOURCES" };
            }

            const src = sources.find(s => s.display_id === d.id.toString()) || sources[0];
            mainWindow.show();
            
            if (src && src.thumbnail) {
                return { success: true, base64: src.thumbnail.toDataURL() };
            } else {
                return { error: debugLog + "THUMBNAIL GENERATION FAILED" };
            }
        }
    } catch (e) {
        mainWindow.show();
        return { error: debugLog + "CRASH: " + e.message };
    }
});

// ADD THIS to bypass Drag-and-Drop blocks when running as Admin
ipcMain.on('validate-license-string', async (event, rawJson) => {
    try {
        const tempPath = path.join(app.getPath('temp'), 'manual_license.mint');
        fs.writeFileSync(tempPath, rawJson);
        ipcMain.emit('validate-license', event, tempPath);
    } catch (e) { event.reply('license-response', { success: false, reason: "Manual entry failed." }); }
});

ipcMain.on('validate-license-string', async (event, rawJson) => {
    try {
        const tempPath = path.join(app.getPath('temp'), 'manual_license.mint');
        fs.writeFileSync(tempPath, rawJson);
        // Reuse your existing logic
        ipcMain.emit('validate-license', event, tempPath);
    } catch (e) {
        event.reply('license-response', { success: false, reason: "Manual entry failed." });
    }
});

    ipcMain.handle('get-window-pos', () => {
        if (!mainWindow) return { x: 0, y: 0 };
        const b = mainWindow.getBounds(); const d = screen.getDisplayMatching(b);
        return { x: b.x - d.bounds.x, y: b.y - d.bounds.y };
    });

    ipcMain.handle('get-sources', async () => {
    if (!mainWindow) throw new Error("Window missing");
    const b = mainWindow.getBounds(); 
    const d = screen.getDisplayMatching(b);
    
    const sources = await desktopCapturer.getSources({ 
        types: ['screen'], 
        thumbnailSize: { 
            width: Math.round(d.size.width * d.scaleFactor), 
            height: Math.round(d.size.height * d.scaleFactor) 
        } 
    });
    
    const src = sources.find(s => s.display_id === d.id.toString()) || sources[0];
    
    return {
        dataURL: src.thumbnail.toDataURL(),
        scaleFactor: d.scaleFactor // Renderer needs this for the math
    };
});

    ipcMain.handle('select-directory', async () => {
        if (!mainWindow) return { canceled: true };
        return await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
    });

    ipcMain.on('ondragstart', (event, { dataURL, icon, filename }) => {
        const win = BrowserWindow.fromWebContents(event.sender); if (win) win.hide();
        try {
            const buffer = Buffer.from(dataURL.replace(/^data:image\/\w+;base64,/, ""), 'base64');
            const safeFilename = path.basename(filename) || `capsize_share.png`;
            const tempPath = path.join(os.tmpdir(), safeFilename);
            fs.writeFileSync(tempPath, buffer);
            event.sender.startDrag({ file: tempPath, icon: nativeImage.createFromDataURL(icon) });
        } catch (e) { console.error("Drag failed:", e); }
    });

    ipcMain.on('clipboard-write-image', (event, payload) => { 
        try { 
            let img;
            // Check if the payload is our new optimized Binary Buffer
            if (Buffer.isBuffer(payload) || payload instanceof Uint8Array) {
                img = nativeImage.createFromBuffer(Buffer.from(payload));
            } else {
                // Fallback for older string methods
                img = nativeImage.createFromDataURL(payload);
            }
            clipboard.writeImage(img); 
        } catch (e) {
            console.error("Clipboard image write failed", e);
        } 
    });

ipcMain.on('clipboard-write-text', (event, text) => { 
    try {
        clipboard.writeText(text); 
    } catch (e) {
        console.error("Clipboard text write failed", e);
    }
});

    ipcMain.on('open-external', (event, url) => { if (url && (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:'))) { shell.openExternal(url); } });

    ipcMain.handle('save-image', async (event, base64Data, options = {}) => {
        try {
            const data = base64Data.replace(/^data:image\/\w+;base64,/, "");
            const buf = Buffer.from(data, 'base64');
            let ext = 'png'; 
            if (options.format) { 
                if (options.format.includes('jpeg')) ext = 'jpg'; 
                else if (options.format.includes('webp')) ext = 'webp'; 
            }
            
            let targetPath = null;          
            // SECURE: Force path.basename so hackers cannot inject '../' to navigate directories
            const safeFilename = options.filename ? path.basename(options.filename) : `Capture_${Date.now()}.${ext}`;

            if (options.folder && options.filename) { 
                targetPath = path.resolve(options.folder, safeFilename); 
            }
            
            const shouldAutoSave = targetPath && !options.forceDialog;

            if (shouldAutoSave) {
                try {
                    const dir = path.dirname(targetPath); 
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(targetPath, buf); 
                    return true; 
                } catch (e) { 
                    dialog.showMessageBox(mainWindow, { type: 'error', title: 'Auto-Save Failed', message: 'Could not write to folder.', detail: e.message });
                    return false; 
                }
            }

            if(mainWindow) mainWindow.setAlwaysOnTop(false);
            
            // USE THE SECURE FILENAME HERE TOO
            const fallbackPath = targetPath || path.join(app.getPath('documents'), safeFilename);
            
            const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { 
                title: options.forceDialog ? 'Save Capture As...' : 'Save Capture', 
                buttonLabel: 'Save', 
                defaultPath: fallbackPath, 
                filters: [{ name: 'Images', extensions: [ext] }] 
            });
            
            // [FIXED] Read the user's config to see if they ACTUALLY want it back on top
            if(mainWindow) { 
                const configData = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) : {};
                const shouldBeAOT = configData.alwaysOnTop !== false;
                mainWindow.setAlwaysOnTop(shouldBeAOT, 'screen-saver'); 
                mainWindow.focus(); 
            }
            if (!canceled && filePath) { fs.writeFileSync(filePath, buf); return true; }
            return false;
        } catch (err) { return false; }
    });

    ipcMain.on('update-setting', (event, { key, value }) => {
        if (key === 'openAtLogin' && app.isPackaged) {
            app.setLoginItemSettings({ openAtLogin: value, path: process.execPath, args: ['--hidden'] });
        } else if (key === 'globalHotkey') {
            globalShortcut.unregisterAll();
            
            // [FIXED] Use the shared function instead of defining broken logic here
            try { 
                const hotkey = value || 'PrintScreen';
                globalShortcut.register(hotkey, performInstantCapture);
            } 
            catch (e) { console.error("Hotkey Error", e); }
        }
    });

    ipcMain.on('resize-window', (e, { width, height }) => { 
        if (mainWindow) { 
            if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
            if (mainWindow.isMaximized()) mainWindow.unmaximize(); 
            
            // Fallback to safe numbers if the incoming data is NaN/undefined
            const safeW = parseInt(width) || 975; // Updated fallback
            const safeH = parseInt(height) || 170;

            mainWindow.setBounds({ width: Math.max(safeW, 975), height: Math.max(safeH, 170) }); 
        } 
    });
    ipcMain.on('maximize-app', () => { if (mainWindow) mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); });
    ipcMain.on('force-maximize', () => { if (mainWindow && !mainWindow.isMaximized()) mainWindow.maximize(); });
    ipcMain.on('minimize-app', () => { if (mainWindow) mainWindow.minimize(); });
    ipcMain.on('close-app', () => { if (mainWindow) mainWindow.hide(); });
    ipcMain.on('quit-app', () => { app.isQuitting = true; app.quit(); });
    ipcMain.on('set-always-on-top', (e, f) => { if(mainWindow) mainWindow.setAlwaysOnTop(f, 'screen-saver'); });
    ipcMain.on('center-window', () => { if (mainWindow) mainWindow.center(); });
    ipcMain.on('set-window-opacity', (e, o) => { if(mainWindow) mainWindow.setOpacity(o); });
    
ipcMain.on('move-to-next-display', async () => {
    if (!mainWindow) return;
    const displays = screen.getAllDisplays(); 
    if(displays.length < 2) return;
    
    const b = mainWindow.getBounds(); 
    const curIdx = displays.findIndex(d => d.id === screen.getDisplayMatching(b).id);
    const nextIdx = (curIdx + 1 + displays.length) % displays.length;
    const next = displays[nextIdx];
    
    if(mainWindow.isMaximized()) mainWindow.unmaximize();
    if(mainWindow.isFullScreen()) mainWindow.setFullScreen(false);

    // Move to the exact center of the new monitor
    const targetX = Math.floor(next.bounds.x + (next.bounds.width/2));
    const targetY = Math.floor(next.bounds.y + (next.bounds.height/2));
    mainWindow.setPosition(targetX - Math.floor(b.width/2), targetY - Math.floor(b.height/2));
    
    // If in Fullscreen Mode, trigger a fresh capture at the new monitor
    if (currentSessionMode === 'fs') {
        mainWindow.hide();
        await new Promise(r => setTimeout(r, 250));
        try {
            let base64 = null;
            if (wgc) {
                wgc.captureScreen(targetX, targetY); 
                await new Promise(r => setTimeout(r, 50)); 
                const rawBuffer = wgc.captureScreen(targetX, targetY);
                if (rawBuffer && rawBuffer.length > 0) {
                    base64 = `data:image/png;base64,${rawBuffer.toString('base64')}`;
                }
            }
            
            // THE FIX: Fallback to desktopCapturer if WGC returns empty buffer!
            if (!base64) {
                console.log("WGC missed monitor jump frame, falling back to desktopCapturer");
                const sources = await desktopCapturer.getSources({ 
                    types: ['screen'], 
                    thumbnailSize: { 
                        width: Math.round(next.size.width * next.scaleFactor), 
                        height: Math.round(next.size.height * next.scaleFactor) 
                    } 
                });
                const src = sources.find(s => s.display_id === next.id.toString()) || sources[0];
                if (src) base64 = src.thumbnail.toDataURL();
            }

            if (base64) {
                mainWindow.setFullScreen(true);
                mainWindow.setOpacity(0);
                mainWindow.show();
                mainWindow.focus();
                // Send data to renderer to build the UI
                mainWindow.webContents.send('wgc-data-received', base64);
            } else {
                // Total failure: Just show the window so it isn't permanently invisible
                mainWindow.setFullScreen(true);
                mainWindow.show();
                mainWindow.setOpacity(1);
            }
        } catch(e) { 
            console.error(e); 
            mainWindow.show();
            mainWindow.setOpacity(1);
        }
    } else {
        mainWindow.show();
        mainWindow.webContents.send('window-shown'); 
    }
});
}

// [FIXED] EXCLUSIVE WGC HANDLER WITH NATIVE FALLBACK & CACHE FLUSH
ipcMain.handle('start-fullscreen-capture', async () => {
    if (!mainWindow) return null;

    // 1. Physically hide the window (Opacity 0 doesn't always force a Windows DWM repaint)
    mainWindow.hide();
    
    // 2. Wait for the OS to fully render the desktop without our app in the way
    await new Promise(r => setTimeout(r, 250));

    try {
        if (wgc) {
            const point = screen.getCursorScreenPoint();
            
            // --- THE DOUBLE-TAP FIX ---
            // WGC holds a stale frame in its buffer if it hasn't been used recently.
            // We request one frame to flush the buffer, wait a tiny tick, and grab the live one.
            wgc.captureScreen(point.x, point.y); 
            await new Promise(r => setTimeout(r, 50)); 
            
            const rawBuffer = wgc.captureScreen(point.x, point.y); // The REAL frame
            
            if (rawBuffer && rawBuffer.length > 0) {
                if (mainWindow.isMaximized()) mainWindow.unmaximize();
                mainWindow.setFullScreen(true);
                
                mainWindow.setOpacity(0); // <-- CLOAK BEFORE SHOWING
                mainWindow.show();
                mainWindow.focus();
                // mainWindow.setOpacity(1); // <-- Let renderer.js reveal it
                
                return `data:image/png;base64,${rawBuffer.toString('base64')}`;
            }
        } else {
            // --- ELECTRON FALLBACK ---
            console.log("WGC not available, falling back to desktopCapturer");
            const b = mainWindow.getBounds(); 
            const d = screen.getDisplayMatching(b);
            
            const sources = await desktopCapturer.getSources({ 
                types: ['screen'], 
                thumbnailSize: { width: d.size.width * d.scaleFactor, height: d.size.height * d.scaleFactor } 
            });
            
            const src = sources.find(s => s.display_id === d.id.toString()) || sources[0];
            
            if (src) {
                if (mainWindow.isMaximized()) mainWindow.unmaximize();
                mainWindow.setFullScreen(true);
                
                mainWindow.setOpacity(0); // <-- CLOAK BEFORE SHOWING
                mainWindow.show();
                mainWindow.focus();
                // mainWindow.setOpacity(1); // <-- Let renderer.js reveal it
                
                return src.thumbnail.toDataURL();
            }
        }
    } catch (e) { 
        console.error("Capture Error:", e); 
    }
    
    // Restore if failed
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.setOpacity(1);
    return null;
});