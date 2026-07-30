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


// EMERGENCY OS CAPTURE: Bypasses GPU isolation AND Electron's DPI scaling lies
const getEmergencyScreenshot = (monitorIndex = 0) => {
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        
        // C# Injection: Forces DPI Awareness and targets the specific physical monitor array index
        const psCommand = `powershell.exe -WindowStyle Hidden -NoProfile -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class DPI { [DllImport(\\"user32.dll\\")] public static extern bool SetProcessDPIAware(); }'; [DPI]::SetProcessDPIAware(); Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $screens = [System.Windows.Forms.Screen]::AllScreens; if (${monitorIndex} -ge $screens.Length) { $s = $screens[0] } else { $s = $screens[${monitorIndex}] }; $b = New-Object System.Drawing.Bitmap $s.Bounds.Width, $s.Bounds.Height; $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen($s.Bounds.X, $s.Bounds.Y, 0, 0, $b.Size); $m = New-Object System.IO.MemoryStream; $b.Save($m, [System.Drawing.Imaging.ImageFormat]::Png); Write-Output ([Convert]::ToBase64String($m.ToArray()))"`;
        
        // 15MB buffer for high-res uncompressed Base64
        exec(psCommand, { maxBuffer: 1024 * 1024 * 15 }, (err, stdout) => {
            if (err || !stdout) resolve(null);
            else resolve('data:image/png;base64,' + stdout.trim());
        });
    });
};


let wgc = null;
try {
    // Dynamically route the path depending on the environment
    const wgcPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'app.asar.unpacked', 'build', 'Release', 'wgc_capture.node')
        : path.join(__dirname, 'build', 'Release', 'wgc_capture.node');
        
    wgc = require(wgcPath);
    console.log("!!! WGC FAST CAPTURE LOADED SUCCESSFULLY !!!");
} catch (e) {
    console.error("!!! WGC LOAD ERROR (Direct Path) !!!", e);
    try {
        wgc = require('bindings')('wgc_capture');
        console.log("!!! WGC LOADED VIA BINDINGS !!!");
    } catch (e2) {
        console.error("!!! WGC LOAD ERROR (Bindings) !!!", e2);
    }
}

let currentSessionMode = null;

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


// ORIGINAL HELPER: Strictly uses default sizes for Cold Boot
function getStartupWindowBounds() {
    let startW = 840;
    let startH = 340;

    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            startW = configData.startupW || 840;
            startH = configData.startupH || 340;
        } catch (e) { console.error(e); }
    }

    const contentW = Math.max(parseInt(startW, 10) || 840, 50); 
    const contentH = Math.max(parseInt(startH, 10) || 340, 50);

    const windowW = Math.max(contentW + 120, 975); 
    const windowH = Math.max(contentH + 98, 170);

    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) || screen.getPrimaryDisplay();
    const workArea = display.workArea;
    
    // Clamp startup dimensions to the physical screen
    const finalW = Math.min(windowW, workArea.width - 40);
    const finalH = Math.min(windowH, workArea.height - 40);

    const x = Math.round(workArea.x + (workArea.width - finalW) / 2);
    const y = Math.round(workArea.y + (workArea.height - finalH) / 2);

    return { x, y, width: finalW, height: finalH };
}

// NEW HELPER: Calculates bounds using the last active dimensions from the session for Hotkey Wake-ups
function getLastActiveWindowBounds() {
    let startW = 840;
    let startH = 340;

    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            // Prioritize lastW/lastH for hotkey wake-ups, fallback to startup sizes
            startW = configData.lastW || configData.startupW || 840;
            startH = configData.lastH || configData.startupH || 340;
        } catch (e) { console.error(e); }
    }

    const contentW = Math.max(parseInt(startW, 10) || 840, 50); 
    const contentH = Math.max(parseInt(startH, 10) || 340, 50);

    const windowW = Math.max(contentW + 120, 975); 
    const windowH = Math.max(contentH + 98, 170);

    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) || screen.getPrimaryDisplay();
    const workArea = display.workArea;
    
    // Clamp dimensions to the physical screen
    const finalW = Math.min(windowW, workArea.width - 40);
    const finalH = Math.min(windowH, workArea.height - 40);

    const x = Math.round(workArea.x + (workArea.width - finalW) / 2);
    const y = Math.round(workArea.y + (workArea.height - finalH) / 2);

    return { x, y, width: finalW, height: finalH };
}

function applyNormalWindowBounds() {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    try {
        if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        mainWindow.setMaximizable(false);

        const bounds = getStartupWindowBounds();
        mainWindow.setBounds(bounds);
    } catch (e) {
        console.error('Failed to apply normal window bounds:', e);
    }
}

function toggleWindow() {
    if (!mainWindow) return;
    const now = Date.now();
    if (now - lastToggle < 500) return; 
    lastToggle = now;

    if (mainWindow.isVisible()) {
        mainWindow.webContents.send('scrub-workspace'); 
        saveCurrentWindowStateBeforeHide(); // Save state if toggled off via tray icon
        setTimeout(() => mainWindow.hide(), 50); 
    } else {
        // FORCE READ LAST SAVED STATE: Override setup defaults on manual reopen
        let lastUsedMode = 'window';
        if (fs.existsSync(CONFIG_FILE)) {
            try {
                const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
                if (configData.lastActiveMode) {
                    lastUsedMode = configData.lastActiveMode;
                }
            } catch (e) { console.error(e); }
        }
        currentSessionMode = lastUsedMode;

        if (currentSessionMode === 'fs') {
            performInstantCapture();
        } else {
            if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
            if (mainWindow.isMaximized()) mainWindow.unmaximize();
            mainWindow.setMaximizable(false);

            mainWindow.setOpacity(0);
            
            // THE FIX: Use getLastActiveWindowBounds instead of getStartupWindowBounds
            const normalBounds = getLastActiveWindowBounds();
            mainWindow.setBounds(normalBounds);

            mainWindow.show();
            mainWindow.webContents.send('window-shown-tray-restore');
        }
    }
}

async function performInstantCapture() {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) return; 

    if (process.argv.includes('--hidden')) {
        const index = process.argv.indexOf('--hidden');
        if (index > -1) process.argv.splice(index, 1);
    }

    let lastUsedMode = 'window'; 
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            lastUsedMode = configData.lastActiveMode || (configData.startFullscreen ? 'fs' : 'window');
        } catch (e) { 
            console.error(e); 
        }
    }

    currentSessionMode = lastUsedMode;

    if (currentSessionMode === 'fs') {
        try {
            let base64 = null;
            
            // THE FIX: Find exactly which monitor the cursor is on
            const point = screen.getCursorScreenPoint();
            const d = screen.getDisplayNearestPoint(point);

            if (wgc) {
                // Translate the logical center of that monitor to physical pixels
                const logicalX = Math.round(d.bounds.x + (d.bounds.width / 2));
                const logicalY = Math.round(d.bounds.y + (d.bounds.height / 2));
                const physicalPoint = screen.dipToScreenPoint({ x: logicalX, y: logicalY });
                
                wgc.captureScreen(physicalPoint.x, physicalPoint.y); 
                await new Promise(r => setTimeout(r, 16)); 
                const rawBuffer = wgc.captureScreen(physicalPoint.x, physicalPoint.y); 
                if (rawBuffer && rawBuffer.length > 0) {
                    base64 = `data:image/png;base64,${rawBuffer.toString('base64')}`;
                }
            } 

            if (!base64) {
                const sources = await desktopCapturer.getSources({ 
                    types: ['screen'], 
                    thumbnailSize: { 
                        width: Math.round(d.size.width * d.scaleFactor), 
                        height: Math.round(d.size.height * d.scaleFactor) 
                    } 
                });
                
// Hardened fallback that checks both the designated ID and the raw source string
let src = sources.find(s => 
    s.display_id === d.id.toString() || 
    s.id.includes(d.id.toString())
) || sources[0];

                if (src) base64 = src.thumbnail.toDataURL();
            }

            if (base64) {
                if (mainWindow.isMaximized()) mainWindow.unmaximize();
                mainWindow.setOpacity(0); 
                mainWindow.show();
                mainWindow.setBounds(d.bounds); // Snap to the right display!
                mainWindow.setFullScreen(true);
                mainWindow.focus();
                mainWindow.webContents.send('wgc-data-received', base64);
            }
        } catch (e) {
            console.error("Hotkey FS Capture Error:", e);
        }
    } 
    else {
        if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        mainWindow.setMaximizable(false);
        
        mainWindow.setOpacity(0);
        
        // THE FIX: Use getLastActiveWindowBounds instead of getStartupWindowBounds
        const normalBounds = getLastActiveWindowBounds();
        mainWindow.setBounds(normalBounds);

        setTimeout(() => {
            if (!mainWindow) return;
            mainWindow.show();
            mainWindow.focus();
            
            // THE FIX: Do not calculate contentW / contentH from normalBounds.
            // Just send the event bare. The Renderer will fall back to the true userSettings.startupW.
            
            mainWindow.webContents.send('window-shown'); 
        }, 60);
    }
}

// ⭐ THE STATE PERSISTENCE INJECTIONS:
// Make sure when these window actions are triggered, they write their state back to disk!
ipcMain.on('force-maximize', () => { 
    currentSessionMode = 'fs';
    saveStateModeToConfig('fs');
});

ipcMain.on('resize-window', (e, b) => { 
    currentSessionMode = 'window'; 
    saveStateModeToConfig('window');
});

ipcMain.on('resize-anchored', (e, b) => {
    currentSessionMode = 'window';
    saveStateModeToConfig('window');
});

// Helper function to safely update the configuration file on the fly
function saveStateModeToConfig(modeString) {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const currentConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            currentConfig.lastActiveMode = modeString;
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2));
        }
    } catch (e) {
        console.error("Failed to persist active window mode state:", e);
    }
}

    function createWindow() {
        const startupBounds = getStartupWindowBounds();

        mainWindow = new BrowserWindow({
            width: startupBounds.width, height: startupBounds.height,
            minWidth: 975,
            minHeight: 170,
            x: startupBounds.x, y: startupBounds.y,
            frame: false, transparent: true, backgroundColor: '#00000000', alwaysOnTop: true,
            resizable: true, show: false,
            maximizable: false, // <-- THE FIX: Lock out OS Maximize on boot
            title: IS_PRO_BUILD ? 'CapSize' : 'CapSize Core',
            icon: getIcon(),
            webPreferences: {
                nodeIntegration: false, contextIsolation: true, sandbox: true,
                preload: path.join(__dirname, 'preload.js')
            }
        });
        
        mainWindow.loadFile('index.html');
        
        mainWindow.once('ready-to-show', () => {
            if (!process.argv.includes('--hidden')) {
                // Prep the bounds in the background, but do NOT show the window yet!
                applyNormalWindowBounds();
            }
        });
        mainWindow.on('maximize', () => mainWindow.webContents.send('window-state-change', 'maximized'));
        mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-state-change', 'unmaximize'));

        // Safely intercept Ctrl+Shift+I, F12, or Escape when CapSize is actively focused
mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control && input.shift && input.key.toLowerCase() === 'i') || input.key === 'F12') {
        event.preventDefault();
        mainWindow.webContents.openDevTools({mode: 'detach'});
    }
    
    // THE ESCAPE FIX: Intercept 'Escape' on keydown, prevent standard FS exit, and close to tray
    if (input.key === 'Escape' && input.type === 'keyDown') {
    event.preventDefault();
    console.log("Escape key intercepted: Saving state and closing to tray");
    
    mainWindow.webContents.send('scrub-workspace'); 
    saveCurrentWindowStateBeforeHide(); // <--- Save State here
    setTimeout(() => {
        if (mainWindow) mainWindow.hide();
    }, 50);
}
});
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
    
    // [NEW] 3. SILENT WGC WARM-UP (Protected against M1 Hybrid GPU)
    const point = screen.getCursorScreenPoint();
    const d = screen.getDisplayNearestPoint(point);
    const isPrimary = d.id === screen.getPrimaryDisplay().id;
    
    // Only warm up WGC if we are NOT on the laptop screen
    if (wgc && !isPrimary) {
        try {
            wgc.captureScreen(point.x, point.y); 
        } catch(e) {}
    }
    
    // [FIXED] "LIGHTSHOT STYLE" HOTKEY
    globalShortcut.register('PrintScreen', performInstantCapture);
});

    app.on('will-quit', () => globalShortcut.unregisterAll());

    ipcMain.on('renderer-ready-to-show', () => {
        if (!mainWindow) return;
        if (!process.argv.includes('--hidden')) { 
            mainWindow.show(); 
            mainWindow.setOpacity(1); 
            mainWindow.focus(); 
        }
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

    // A helper function to capture the active state right before hiding
function saveCurrentWindowStateBeforeHide() {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    try {
        const currentConfig = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) : {};
        
        if (mainWindow.isFullScreen() || currentSessionMode === 'fs') {
            currentConfig.lastActiveMode = 'fs';
        } else {
            currentConfig.lastActiveMode = 'window';
            
            // THE FIX: Remove the reverse padding math!
            // Do NOT overwrite startupW and startupH here using mainWindow.getBounds()
        }

        fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2));
    } catch (e) {
        console.error("Failed to save state on window hide:", e);
    }
}

ipcMain.on('close-app', () => { 
    if (mainWindow) {
        mainWindow.webContents.send('scrub-workspace'); 
        saveCurrentWindowStateBeforeHide(); // <--- Save State here
        mainWindow.hide(); 
    } 
});

ipcMain.on('hide-window', () => { 
    if (mainWindow) {
        mainWindow.webContents.send('scrub-workspace'); 
        saveCurrentWindowStateBeforeHide(); // <--- Save State here
        mainWindow.hide(); 
    } 
});

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

ipcMain.handle('capture-window-mode-wgc', async () => {
    let debugLog = "START -> ";
    if (!mainWindow) return { error: "Main window is null" };
    
    mainWindow.hide();
    await new Promise(r => setTimeout(r, 50));
    debugLog += "HIDDEN -> ";

    try {
        const b = mainWindow.getBounds(); 
        const d = screen.getDisplayMatching(b);
        
        let base64 = null;

        if (wgc) {
            // Calculate logical center
            const logicalX = Math.round(d.bounds.x + (d.bounds.width / 2));
            const logicalY = Math.round(d.bounds.y + (d.bounds.height / 2));
            
            // THE FIX: Translate to physical pixels
            const physicalPoint = screen.dipToScreenPoint({ x: logicalX, y: logicalY });
            
            wgc.captureScreen(physicalPoint.x, physicalPoint.y);
            await new Promise(r => setTimeout(r, 50)); 
            
            let rawBuffer = wgc.captureScreen(physicalPoint.x, physicalPoint.y);
            if (!rawBuffer || rawBuffer.length === 0) {
                await new Promise(r => setTimeout(r, 50));
                rawBuffer = wgc.captureScreen(physicalPoint.x, physicalPoint.y);
            }
            if (rawBuffer && rawBuffer.length > 0) {
                base64 = `data:image/png;base64,${rawBuffer.toString('base64')}`;
            }
        }

        if (!base64) {
            const sources = await desktopCapturer.getSources({ 
                types: ['screen'], 
                thumbnailSize: { 
                    width: Math.round(d.size.width * d.scaleFactor), 
                    height: Math.round(d.size.height * d.scaleFactor) 
                } 
            });
            
// Hardened fallback that checks both the designated ID and the raw source string
let src = sources.find(s => 
    s.display_id === d.id.toString() || 
    s.id.includes(d.id.toString())
) || sources[0];

            if (src) base64 = src.thumbnail.toDataURL();
        }

        mainWindow.show();
        
        if (base64) {
            return { success: true, base64: base64 };
        } else {
            return { error: debugLog + "ALL CAPTURE METHODS FAILED" };
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
    // 1. Handle Windows Startup Registration (THE SHIELD)
    if (key === 'openAtLogin') {
        if (app.isPackaged) { 
            app.setLoginItemSettings({ 
                openAtLogin: value, 
                path: process.execPath, 
                args: ['--hidden'] 
            });
        }
    }
    
    // 2. Handle Global Hotkey Re-registration
    else if (key === 'globalHotkey') {
        globalShortcut.unregisterAll(); // Clear old registration
        try {
            const success = globalShortcut.register(value, performInstantCapture);
            if (!success) console.error("Hotkey registration failed:", value);
        } catch (e) {
            console.error("Malformed hotkey string:", value);
        }
    }
    
    // 3. Persist Settings to HDD
    const currentConfig = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) : {};
    currentConfig[key] = value;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2));
});

// 1. STANDARD RESIZE
ipcMain.on('resize-window', (e, { width, height }) => { 
        if (mainWindow) { 
            if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
            if (mainWindow.isMaximized()) mainWindow.unmaximize(); 
            
            const safeW = parseInt(width) || 975; 
            const safeH = parseInt(height) || 170;

            mainWindow.setBounds({ width: Math.max(safeW, 975), height: Math.max(safeH, 170) }); 
        } 
    });

// 2. ANCHORED RESIZE
ipcMain.on('resize-anchored', (e, { width, height }) => {
    if (!mainWindow) return;
    currentSessionMode = 'window';
    if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    mainWindow.setMaximizable(false);

    const safeW = Math.max(parseInt(width) || 200, 975); // Enforce 975 min
    const safeH = Math.max(parseInt(height) || 150, 170); // Enforce 170 min
    
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({ x: bounds.x, y: bounds.y, width: safeW, height: safeH });
});

    // 3. WINDOW STATE HANDLERS
    ipcMain.on('maximize-app', () => {
        if (!mainWindow) return;
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    });

    ipcMain.on('minimize-app', () => { if (mainWindow) mainWindow.minimize(); });
    ipcMain.on('close-app', () => { if (mainWindow) { mainWindow.webContents.send('scrub-workspace'); mainWindow.hide(); } });
    ipcMain.on('quit-app', () => { app.isQuitting = true; app.quit(); });
    ipcMain.on('set-always-on-top', (e, f) => { if(mainWindow) mainWindow.setAlwaysOnTop(f, 'screen-saver'); });

   ipcMain.on('center-window', () => {
    currentSessionMode = 'window';
    if (mainWindow) {
        if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        mainWindow.setMaximizable(false);
        mainWindow.center();
    }
});

ipcMain.on('restore-window-size', (e, { width, height }) => {
    if (!mainWindow) return;
    currentSessionMode = 'window';
    
    // THE FIX: Lock the exact monitor you are on BEFORE turning off Fullscreen
    const currentBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(currentBounds) || screen.getPrimaryDisplay();
    
    // Now it's safe to strip the OS fullscreen flags
    if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    mainWindow.setMaximizable(false);

    // Give the Windows Desktop Window Manager (DWM) a split-second to detach the flags
    setTimeout(() => {
        if (!mainWindow) return;
        
        const safeW = Math.max(parseInt(width) || 200, 975); 
        const safeH = Math.max(parseInt(height) || 150, 170); 

        const workArea = display.workArea;
        
        // Strict clamping
        const finalW = Math.min(safeW, workArea.width - 40);
        const finalH = Math.min(safeH, workArea.height - 40);

        const x = Math.round(workArea.x + (workArea.width - finalW) / 2);
        const y = Math.round(workArea.y + (workArea.height - finalH) / 2);

        // THE DOUBLE-TAP HACK: 
        // 1st Tap: Forces the Window into the M2 coordinate space to update the OS DPI context.
        mainWindow.setBounds({ x, y, width: finalW, height: finalH });
        
        // 2nd Tap: Re-applies the exact logical dimensions now that the DPI multiplier is correct.
        setTimeout(() => {
            mainWindow.setBounds({ x, y, width: finalW, height: finalH });
            mainWindow.show();
            mainWindow.focus();
        }, 25);
    }, 50);
});

    ipcMain.on('set-window-opacity', (e, o) => { if(mainWindow) mainWindow.setOpacity(o); });
    
const jumpDisplay = async (direction) => {
    if (!mainWindow) return;
    const displays = screen.getAllDisplays(); 
    if(displays.length < 2) return;
    
    const b = mainWindow.getBounds(); 
    const curIdx = displays.findIndex(d => d.id === screen.getDisplayMatching(b).id);
    const nextIdx = (curIdx + direction + displays.length) % displays.length;
    const next = displays[nextIdx];
    
    if(mainWindow.isMaximized()) mainWindow.unmaximize();
    if(mainWindow.isFullScreen()) mainWindow.setFullScreen(false);

    // 1. Ghost the window, but KEEP it active so the OS processes the DPI change
    mainWindow.setOpacity(0);
    
    if (currentSessionMode === 'fs') {
        // THE DPI DOUBLE-TAP HACK
        
        // Dynamically scale the wait times: 200% monitors get extra time to process the heavy math
        const isHighDPI = next.scaleFactor > 1;
        const dpiWait = isHighDPI ? 150 : 80;
        const clearWait = isHighDPI ? 800 : 600;

        // Tap 1: Throw it to the new monitor
        mainWindow.setBounds(next.bounds);
        
        // 1. Give High-DPI monitors 150ms to update, standard monitors 80ms
        await new Promise(r => setTimeout(r, dpiWait)); 
        
        // Tap 2: Re-apply bounds
        mainWindow.setBounds(next.bounds);
        
        // NOW we safely hide it
        mainWindow.hide();
        
        // 2. Give High-DPI monitors 800ms to clear the buffer, standard monitors 600ms
        await new Promise(r => setTimeout(r, clearWait));
        
        try {
            let base64 = null;

            if (wgc) {
                // Find the exact logical center of the target monitor
                const logicalX = Math.round(next.bounds.x + (next.bounds.width / 2));
                const logicalY = Math.round(next.bounds.y + (next.bounds.height / 2));
                
                // Translate logical DPI pixels into OS physical pixels
                const physicalPoint = screen.dipToScreenPoint({ x: logicalX, y: logicalY });
                
                // FLUSH 1: Wake up the GPU on the new monitor
                wgc.captureScreen(physicalPoint.x, physicalPoint.y);
                await new Promise(r => setTimeout(r, isHighDPI ? 110 : 50));
                
                // FLUSH 2: If we are jumping to a 200% monitor, force a second discard 
                // to clear the intermediate scaling frame from the GPU buffer
                if (isHighDPI) {
                    wgc.captureScreen(physicalPoint.x, physicalPoint.y);
                    await new Promise(r => setTimeout(r, isHighDPI ? 50 : 20));
                }
                
                // FINAL CAPTURE: The buffer is now clean, keep this frame
                const rawBuffer = wgc.captureScreen(physicalPoint.x, physicalPoint.y);
                
                if (rawBuffer && rawBuffer.length > 0) {
                    base64 = `data:image/png;base64,${rawBuffer.toString('base64')}`;
                }
            }

            // Clean, minimal fallback if WGC fails
            if (!base64) {
                const sources = await desktopCapturer.getSources({ 
                    types: ['screen'], 
                    thumbnailSize: { 
                        width: Math.round(next.size.width * next.scaleFactor), 
                        height: Math.round(next.size.height * next.scaleFactor) 
                    } 
                });
                
                let src = sources.find(s => 
                    s.display_id === next.id.toString() || 
                    s.id.includes(next.id.toString())
                ) || sources[0];
                if (src) base64 = src.thumbnail.toDataURL();
            }

            if (base64) {
                mainWindow.show(); 
                mainWindow.setBounds(next.bounds); 
                mainWindow.focus();
                mainWindow.webContents.send('wgc-data-received', base64);
            } else {
                mainWindow.webContents.send('scrub-workspace');
                mainWindow.setBounds(next.bounds); 
                mainWindow.show();
                mainWindow.setOpacity(1);
            }
        } catch(e) { 
            console.error(e); 
            mainWindow.show();
            mainWindow.setOpacity(1);
        }
    } else {
        // WINDOWED MODE JUMP: Keep it centered and apply the Double-Tap
        const currentW = b.width;
        const currentH = b.height;
        const targetX = Math.round(next.bounds.x + (next.bounds.width - currentW) / 2);
        const targetY = Math.round(next.bounds.y + (next.bounds.height - currentH) / 2);
        
        mainWindow.setBounds({ x: targetX, y: targetY, width: currentW, height: currentH });
        await new Promise(r => setTimeout(r, 50));
        mainWindow.setBounds({ x: targetX, y: targetY, width: currentW, height: currentH });
        
        mainWindow.show();
        mainWindow.setOpacity(1);
        mainWindow.webContents.send('window-shown'); 
    }
};

// Wire up both hotkeys (Swapped to match physical layout)
ipcMain.on('move-to-next-display', () => jumpDisplay(-1));
ipcMain.on('move-to-prev-display', () => jumpDisplay(1));

ipcMain.handle('start-fullscreen-capture', async () => {
    if (!mainWindow) return null;

    mainWindow.hide();
    await new Promise(r => setTimeout(r, 50));

    try {
        const b = mainWindow.getBounds(); 
        const d = screen.getDisplayMatching(b);

        let base64 = null;

        if (wgc) {
            // Calculate logical center
            const logicalX = Math.round(d.bounds.x + (d.bounds.width / 2));
            const logicalY = Math.round(d.bounds.y + (d.bounds.height / 2));
            
            // THE FIX: Translate to physical pixels
            const physicalPoint = screen.dipToScreenPoint({ x: logicalX, y: logicalY });
            
            wgc.captureScreen(physicalPoint.x, physicalPoint.y); 
            await new Promise(r => setTimeout(r, 50)); 
            const rawBuffer = wgc.captureScreen(physicalPoint.x, physicalPoint.y); 
            
            if (rawBuffer && rawBuffer.length > 0) {
                base64 = `data:image/png;base64,${rawBuffer.toString('base64')}`;
            }
        }
        
        if (!base64) {
            const sources = await desktopCapturer.getSources({ 
                types: ['screen'], 
                thumbnailSize: { 
                    width: Math.round(d.size.width * d.scaleFactor), 
                    height: Math.round(d.size.height * d.scaleFactor) 
                } 
            });
            
            // Hardened fallback that checks both the designated ID and the raw source string
            let src = sources.find(s => 
                s.display_id === d.id.toString() || 
                s.id.includes(d.id.toString())
            ) || sources[0];
            if (src) base64 = src.thumbnail.toDataURL();
        } 

        if (base64) {
            if (mainWindow.isMaximized()) mainWindow.unmaximize();
            mainWindow.setOpacity(0); 
            mainWindow.show(); 
            mainWindow.setBounds(d.bounds); 
            mainWindow.focus();
            return base64;
        }
    } catch (e) { console.error("Capture Error:", e); }
    
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.setOpacity(1);
    return null;
});

} // <-- THIS SINGLE BRACE CORRECTLY CLOSES THE gotTheLock 'else' BLOCK AT THE VERY END