const path = require('path');
const { ipcRenderer, clipboard, nativeImage } = require('electron');

// --- 1. SETTINGS & STATE ---
const defaultSettings = {
    // [MODIFIED] Increased default startup size to match new Main.js minimums
    startupW: 930, 
    startupH: 340, 
    alwaysOnTop: true, 
    startFullscreen: true, // [CHANGED] Default is now Fullscreen for mass appeal
    openAtLogin: false, 
    globalHotkey: 'PrintScreen', 
    startupTool: 'cursor', 
    immersiveMode: false,
    cornerStyle: 'round', 
    dottedStyle: 'round',
    cornerRadius: 10,       // Default radius for rounded squares
    
    // [FIXED] Default size changed to 8
    defLineWidth: 8,
    
    magnetStrength: 'medium', 
    angleSnap: 15, 
    defaultColor: '#2e69a3',
    cursorStyle: 'outline', 
    arrowStyle: 'v', 
    shadowBlur: 10,
    shadowDistance: 5,
    accentColor: '#8CFA96', 
    gridSize: 20, 
    gridOpacity: 0.6,
    savePath: '', 
    filenameFmt: 'CapSize_{timestamp}', 
    autoClipboard: false,
    imageFormat: 'image/png', 
    imageQuality: 0.9, 
    watermarkText: '', 
    exportPadding: 0,
    highlighterOpacity: 0.4, 
    showMeasurements: true,
    // --- [NEW FEATURES] ---
    showSmartGuides: true,  // Toggle for Smart Snapping
    snapToGrid: false,
    stylePresets: Array(9).fill(null), // 9 Empty Slots for Presets
    // [FIXED & NEW STAMP SETTINGS]
    stampMode: 'number', // 'number', 'capital', 'small'
    stampCount: 1, // Current counter for number mode
    stampLetterCode: 0, // Current counter for letter modes (0='A' or 'a', 1='B' or 'b', etc.)
    stampDefaultSize: 30, // Persist default size
    // [FIXED] Global state for sequential filename numbering
    sequenceCounter: 1,

    // [NEW] Onboarding State
    onboardingComplete: false,
    introComplete: false,
    // [NEW] User-Editable Swatch Settings
    useCustomSwatches: false, 
    customColors: [
        '#000000', '#FFFFFF', '#FF0000', '#00FF00', 
        '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'
    ]
};

let userSettings = JSON.parse(localStorage.getItem('cs_settings')) || defaultSettings;
// Merge saved settings over defaults, ensuring any missing new fields are added.
userSettings = { ...defaultSettings, ...userSettings };

// [NEW] Logic to update Footer Swatches based on settings
let originalPalette = []; 

function updateSwatches() {
    const swatches = document.querySelectorAll('.swatch');
    
    // 1. Capture defaults if first run
    if (originalPalette.length === 0) {
        swatches.forEach(s => originalPalette.push(s.dataset.c));
    }

    // 2. Determine source: User Custom vs Original Defaults
    const activePalette = userSettings.useCustomSwatches ? userSettings.customColors : originalPalette;

    // 3. Apply to Footer Swatches
    swatches.forEach((s, index) => {
        if (activePalette[index]) {
            s.style.backgroundColor = activePalette[index];
            s.dataset.c = activePalette[index];
        }
    });

    // 4. Update the Settings Menu Inputs (to match current state)
    const settingInputs = document.querySelectorAll('.palette-picker');
    settingInputs.forEach((input, index) => {
        if (userSettings.customColors[index]) {
            input.value = userSettings.customColors[index];
        }
    });
}

// [FIXED] Global state for sequential counter
let sequenceCounter = userSettings.sequenceCounter || 1;

// *** Consolidated and Corrected saveSettings function ***
function saveSettings() {
    // Ensure all critical runtime variables are saved back to the object
    userSettings.sequenceCounter = sequenceCounter;
    // Only save stamp state if they are defined (to avoid ReferenceErrors if called too early)
    if(typeof stampMode !== 'undefined') userSettings.stampMode = stampMode;
    if(typeof stampCounterValue !== 'undefined') userSettings.stampCount = stampMode === 'number' ? stampCounterValue : defaultSettings.stampCount;
    if(typeof stampLetterCode !== 'undefined') userSettings.stampLetterCode = stampMode !== 'number' ? stampLetterCode : defaultSettings.stampLetterCode;
    if(typeof currentStampSize !== 'undefined') userSettings.stampDefaultSize = currentStampSize;

    // Persist all user settings, including onboarding flags
    localStorage.setItem('cs_settings', JSON.stringify(userSettings));
    applySettingsToRuntime();
}

window.resetSection = (sectionCode) => {
    // [NEW] Special Logic for Palette Reset
    if (sectionCode === 'app-palette') {
        userSettings.customColors = [...defaultSettings.customColors]; // Restore defaults
        saveSettings(); // Triggers updateSwatches()
        return;
    }

    let keys = [];
    if(sectionCode==='gen-flow') keys=['globalHotkey','startupTool','immersiveMode', 'openAtLogin', 'showMeasurements'];
    if(sectionCode==='gen-win') keys=['startupW','startupH','startFullscreen','alwaysOnTop'];
    if(sectionCode==='draw-style') keys=['cursorStyle','arrowStyle','shadowBlur', 'shadowDistance'];
    if(sectionCode==='draw-shape') keys=['cornerStyle','dottedStyle','defLineWidth','highlighterOpacity', 'cornerRadius'];
    if(sectionCode==='draw-snap') keys=['magnetStrength','angleSnap','showSmartGuides'];
    if(sectionCode==='app-theme') keys=['accentColor','defaultColor'];
    if(sectionCode==='app-grid') keys=['gridSize','gridOpacity'];
    if(sectionCode==='out-img') keys=['imageFormat','imageQuality','exportPadding','watermarkText'];
    if(sectionCode==='out-save') keys=['savePath','filenameFmt','autoClipboard'];

    keys.forEach(key => { 
        if(defaultSettings[key] !== undefined) userSettings[key] = defaultSettings[key]; 
    });
    
    // Reset sequence counter on reset if it affects output
    if (sectionCode === 'out-save') {
        sequenceCounter = 1;
        userSettings.sequenceCounter = 1;
    }
    
    saveSettings();
    
    // Update UI inputs to reflect reset
    keys.forEach(key => {
        const el = document.querySelector(`[data-setting="${key}"]`);
        if(el) { 
            if(el.type==='checkbox') el.checked=userSettings[key]; 
            else { el.value=userSettings[key]; el.dispatchEvent(new Event('input')); } 
        }
    });

    if(keys.includes('globalHotkey')) ipcRenderer.send('update-setting', { key: 'globalHotkey', value: userSettings.globalHotkey });
    if(keys.includes('openAtLogin')) ipcRenderer.send('update-setting', { key: 'openAtLogin', value: userSettings.openAtLogin });
    
    // Force a redraw to show changes (like corner radius)
    if(typeof renderMain === 'function') renderMain();
};

let snapRadius = 20; let angleSnapRad = Math.PI / 12;

function applySettingsToRuntime() {
    document.documentElement.style.setProperty('--accent', userSettings.accentColor);
    snapRadius = userSettings.magnetStrength === 'low' ? 10 : userSettings.magnetStrength === 'high' ? 40 : 20;
    angleSnapRad = (userSettings.angleSnap * Math.PI) / 180;
    
    // [FIXED] Disable CSS Grid Background
    // We strictly remove the background image but KEEP the element in the DOM
    // so that the classList toggling (On/Off) works correctly.
    const gridEl = document.getElementById('grid');
    if (gridEl) { 
        gridEl.style.backgroundImage = 'none'; 
        // REMOVED: gridEl.style.display = 'none'; <--- This was causing the visibility bug
    }
    
    ipcRenderer.send('set-always-on-top', userSettings.alwaysOnTop);
    updateSwatches();

    if(typeof tool !== 'undefined' && tool !== 'cursor') {
        const cDot = document.getElementById('cursor-dot');
        if(cDot) {
            if(userSettings.cursorStyle === 'crosshair') { document.getElementById('frame').style.cursor = 'crosshair'; cDot.style.display = 'none'; }
            else if (userSettings.cursorStyle === 'outline') { document.getElementById('frame').style.cursor = 'none'; cDot.style.border = '1px solid #000'; cDot.style.background = 'transparent'; }
            else { document.getElementById('frame').style.cursor = 'none'; cDot.style.border = 'none'; cDot.style.backgroundColor = (typeof colorPk !== 'undefined' ? colorPk.value : userSettings.defaultColor); }
        }
    }
    if(typeof renderMain === 'function') renderMain();
    
    if(typeof updateStampBubble === 'function') updateStampBubble(false); 
    
    if(typeof stampCounterValue !== 'undefined') stampCounterValue = userSettings.stampCount;
    if(typeof stampMode !== 'undefined') stampMode = userSettings.stampMode;
    if(typeof stampLetterCode !== 'undefined') stampLetterCode = userSettings.stampLetterCode;
    if(typeof currentStampSize !== 'undefined') currentStampSize = userSettings.stampDefaultSize;
    sequenceCounter = userSettings.sequenceCounter;

    if(typeof updateArrowButtonIcon === 'function') updateArrowButtonIcon();
}

// [NEW] Helper to update Arrow Button Icon based on selected style
function updateArrowButtonIcon() {
    const style = userSettings.arrowStyle || 'v';
    let iconHtml = '';

    // Match icons to the dropdown menu items
    if (style === 'v') iconHtml = '<i class="fa-solid fa-angle-right"></i>';
    else if (style === 'hand') iconHtml = '<i class="fa-solid fa-signature"></i>';
    else if (style === 'triangle') iconHtml = '<i class="fa-solid fa-play" style="transform: rotate(0deg);"></i>';
    else if (style === 'concave') iconHtml = '<i class="fa-solid fa-location-arrow" style="transform: rotate(-45deg);"></i>';
    else if (style === 'dot') iconHtml = '<i class="fa-solid fa-circle-dot"></i>';
    else iconHtml = '<i class="fa-solid fa-arrow-right-long"></i>'; // Fallback

    const mainBtn = document.getElementById('btn-arrow-multi');
    const fbBtn = document.getElementById('fb-btn-arrow-multi');

    if (mainBtn) mainBtn.innerHTML = iconHtml;
    if (fbBtn) fbBtn.innerHTML = iconHtml;
}

// --- CSS INJECTION ---
const style = document.createElement('style');
style.innerHTML = `
    :root { --accent: ${userSettings.accentColor}; }

    /* [FIX] Expand Double-Click Hit Area */
    /* This forces all clicks on the icon to register on the button instead */
    .tool-btn i, .btn-icon i, .dropdown-item i { pointer-events: none !important; }

    button:focus, .tool-btn:focus, .btn-snap:focus {
        outline: none !important;
        box-shadow: none !important;
    }
.tool-btn:focus, .btn-icon:focus { outline: none !important; box-shadow: none !important; }

    body { margin: 0; padding: 0; width: 100vw; ... }
    body { margin: 0; padding: 0; width: 100vw; height: 100vh; display: flex !important; flex-direction: column !important; background: transparent !important; overflow: hidden !important; position: fixed; top: 0; left: 0; font-family: 'Segoe UI', sans-serif; }
    
    /* [UPDATED] Remove ALL Gray Borders from Settings Color Pickers */
    .sleek-color {
        -webkit-appearance: none;
        border: none !important;
        padding: 0 !important;
        background-color: transparent !important;
        cursor: pointer;
        height: 15px !important;
        width: 50px !important; /* Keep this at 50px */
        outline: none !important;
    }
    .sleek-color::-webkit-color-swatch-wrapper {
        padding: 0 !important;
    }
    .sleek-color::-webkit-color-swatch {
        border: none !important;
        border-radius: 4px;
        box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2); 
    }

    .header, .footer, #floating-bar { flex: 0 0 50px !important; z-index: 9999 !important; -webkit-app-region: drag !important; transition: opacity 0.3s; }
    .viewport { flex: 1 1 auto !important; position: relative !important; display: flex !important; justify-content: center !important; align-items: center !important; overflow: hidden !important; width: 100% !important; }
    
    /* --- FRAME & FULLSCREEN LOGIC --- */

/* [FIX] Triangle & Outline Logic */
    .fa-rotate-neg-90 {
        transform: rotate(-90deg);
        display: inline-block !important; /* Critical for rotation */
        width: 1em;
        text-align: center;
    }

    /* [FIX] Outlined Icons for Shapes */
    .outlined-icon { color: transparent !important; -webkit-text-stroke: 2px #ccc; }
    .tool-btn.active .outlined-icon { -webkit-text-stroke: 2px #1e1e1e; }
    
    /* When Solid Mode is ON, fill it in */
    .tool-btn.solid-mode i, .dropdown-item.solid-mode i {
        color: inherit !important;
        -webkit-text-stroke: 0 !important;
    }

/* [FIX] Active State for Dropdown Items */
    .dropdown-item.active-tool {
        background-color: var(--accent) !important;
        color: #1e1e1e !important;
        font-weight: bold;
    }
    .dropdown-item.active-tool i { color: #1e1e1e !important; }

    .frame { -webkit-app-region: no-drag !important; pointer-events: auto !important; position: relative; box-sizing: border-box !important; transform-origin: top left; z-index: 20; border: 2px dashed var(--accent) !important; transition: border-color 0.3s; }
    
    /* [FIXED] Immersive Mode CSS */
    /* 1. Hide the dashed border */
    body.immersive-active .frame { border-color: transparent !important; }
    
    /* 2. Hide all resize handles */
    body.immersive-active .resize-handle { display: none !important; }
    
    /* 3. Hide the window resize grip (bottom right icon) */
    body.immersive-active #window-resize-grip { display: none !important; }

    /* 4. KEEP Corner Brackets visible (Removed opacity:0 rule) */
    
    /* Fullscreen Dimming (0.2 Opacity) */
    body.fullscreen .frame { box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.2) !important; border: 2px dashed var(--accent) !important; }
    
    /* [FIX] Clean Slate: Hides the "Crosshair" (Border) and all Handles/Corners */
    body.fullscreen .frame.clean-slate { border: none !important; }
    body.fullscreen .frame.clean-slate * { display: none !important; }
    body.fullscreen .frame.clean-slate::before, 
    body.fullscreen .frame.clean-slate::after { display: none !important; }

    /* Handles */
    .rh-se { position: absolute !important; bottom: -5px !important; right: -5px !important; cursor: se-resize !important; width: 10px !important; height: 10px !important; z-index: 20005 !important; }
    body.fullscreen .frame.immersive-active { border-color: rgba(255,255,255,0.05) !important; }
    
    /* General UI */
    canvas { pointer-events: auto !important; display: block; position: absolute; top: 0; left: 0; touch-action: none !important; }
    .green-text, .dims input, .dims span { color: var(--accent) !important; }
    .btn-snap { background: var(--accent) !important; color: #1e1e1e !important; filter: brightness(0.9); }
    .btn-snap:hover { filter: brightness(1.1); }
    .tool-btn.active { background-color: var(--accent) !important; color: #1e1e1e !important; box-shadow: 0 0 8px rgba(140, 250, 150, 0.4) !important; border: 1px solid #6bbd72 !important; transform: translateY(-1px); }
    .style-btn.active, .tool-btn.style-active { background-color: #444 !important; color: var(--accent) !important; border: 1px solid var(--accent) !important; }
    .btn-icon.active { color: var(--accent) !important; background: rgba(255, 255, 255, 0.1); box-shadow: 0 0 5px rgba(140, 250, 150, 0.2); }
/* [NEW] Specific Drag Handle Styling */
    .drag-grip {
        width: 24px; 
        height: 32px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        
        /* 50% Transparent Mint */
        color: var(--accent); 
        opacity: 0.5;
        
        /* CRITICAL: This ensures it acts as a window drag handle */
        -webkit-app-region: drag !important; 
        cursor: grab; 
        margin-left: 10px;
        transition: opacity 0.2s;
    }
    .drag-grip:hover { opacity: 1; }
    .drag-grip:active { cursor: grabbing; color: #fff; opacity: 1; }
    input[type="range"] { accent-color: var(--accent) !important; }
    .header input, .header button, .footer button, .footer input, .style-btn, .tool-btn, .utility-buttons button, .window-controls button, .dims input, .dims button, .control-group-center button, #color-trigger, #fb-color-trigger, #size-sl, #fb-size-sl, #opacity-sl, #fb-opacity-sl, #btn-close, #btn-min, #btn-max, #btn-help, #floating-bar button, #floating-bar div, .dropdown-item, select { -webkit-app-region: no-drag !important; position: relative !important; z-index: 20000 !important; cursor: pointer !important; }
    .resize-handle { z-index: 20001 !important; }
    .resize-handle:hover { background: var(--accent) !important; opacity: 0.5; }
    .color-popup { position: absolute; background: #252525; border: 1px solid #444; padding: 8px; border-radius: 6px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 50000; }
    #floating-bar .dropdown-content { position: absolute !important; cursor: default !important; }
    .header input, .footer input { cursor: text !important; pointer-events: auto !important; user-select: text !important; }
    #window-resize-grip { z-index: 20000 !important; -webkit-app-region: no-drag !important; pointer-events: auto !important; cursor: nwse-resize !important; position: absolute !important; bottom: 0 !important; right: 0 !important; width: 20px !important; height: 20px !important; }
    #window-resize-grip:hover { color: var(--accent) !important; }
    #font-family, #fb-font-family { width: 90px !important; } 
    #size-sl, #fb-size-sl, #opacity-sl, #fb-opacity-sl { width: 40px !important; } 
    .settings { gap: 4px !important; margin-left: auto !important; margin-right: 15px !important; display: flex; align-items: center; } 
    .divider { margin: 0 6px !important; }
    .tool-btn { width: 32px !important; height: 32px !important; font-size: 14px !important; }
    .tool-btn.solid-mode::after { content: ''; position: absolute; bottom: 2px; right: 2px; width: 5px; height: 5px; background-color: #fff; border: 1px solid #000; border-radius: 50%; z-index: 20002; }
    .tool-btn.active.solid-mode::after { background-color: #1e1e1e; border-color: #1e1e1e; }
    .outlined-icon { color: transparent !important; -webkit-text-stroke: 1.5px #aaa; }
    .tool-btn.active .outlined-icon { -webkit-text-stroke: 1.5px #1e1e1e; }
    .text-wrapper { position: absolute; display: flex; align-items: center; z-index: 2000; pointer-events: auto; }
    .text-handle { width: 12px; height: 24px; background: var(--accent); cursor: move; margin-right: 6px; border-radius: 2px; border: 1px solid #1e1e1e; box-shadow: 0 1px 3px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 8px; color: #000; font-weight: bold; }
    .text-handle::after { content: '::'; }
    .input-container { position: relative; }
    .float-input { background: transparent; border: none; color: #0000FF; font-size: 20px; outline: none; padding: 0; width: 100%; min-width: 20px; text-shadow: 0 0 2px rgba(255,255,255,0.5); }
    .text-sizer { visibility: hidden; white-space: nowrap; position: absolute; top: 0; left: 0; font-size: 20px; padding: 0; }
    
    /* [FIXED] Recalibrated Long-Needle Syringe (Mint Outline) */
    .cursor-eyedropper { 
        cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32' fill='none' stroke='%238CFA96' stroke-width='1' stroke-linecap='round' stroke-linejoin='round' style='filter: drop-shadow(1px 1.5px 1.2px rgba(0,0,0,0.7));'>\
            <rect x='0' y='31' width='1' height='1' fill='%2322262a' stroke='none' />\
            \
            <path d='M21 11 L27 5' stroke-width='1' />\
            <path d='M25 3 L29 7' stroke-width='2' />\
            \
            <path d='M1 31 L13 19' stroke-width='1' />\
            \
            <rect x='13' y='7' width='6' height='16' rx='0.5' transform='rotate(45 16 16)' fill='rgba(255,255,255,0.15)' stroke='%238CFA96' />\
            \
            <rect x='14.2' y='8.2' width='3.6' height='13.6' rx='0.2' transform='rotate(45 16 16)' fill='rgba(255,255,255,0)' />\
        </svg>") 0 32, crosshair !important; 
    }

    /* OCR Scanner Effect */
    .ocr-scan-overlay { position: absolute; border: 2px solid var(--accent); box-shadow: 0 0 15px var(--accent), inset 0 0 20px rgba(140, 250, 150, 0.1); pointer-events: none; z-index: 9999; overflow: hidden; background: rgba(0, 20, 0, 0.05); border-radius: 4px; }
    .ocr-scan-overlay::after { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: #fff; box-shadow: 0 0 4px #fff, 0 0 10px var(--accent), 0 0 20px var(--accent); animation: scan-line 2s linear forwards; }
    @keyframes scan-line { 0% { top: -10%; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { top: 110%; opacity: 0; } }

    /* Flash Overlay */
    #flash-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: white; z-index: 200000; pointer-events: none; opacity: 0; transition: opacity 0.15s ease-out; mix-blend-mode: hard-light; }

    /* Modal & Settings Styles */
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 60000; justify-content: center; align-items: center; backdrop-filter: blur(5px); }
    .modal.show { display: flex; }
    .guide-content { background: #2c3239; border: 1px solid var(--accent); color: #eee; border-radius: 8px; width: 950px; height: 650px; max-width: 95vw; max-height: 95vh; display: flex; flex-direction: column; box-shadow: 0 0 40px rgba(0,0,0,0.9); overflow: hidden; }
    .guide-header { padding: 15px 20px; background: #394047; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
    .settings-body { display: flex; flex: 1; overflow: hidden; }
    .settings-sidebar { width: 180px; background: #394047; border-right: 1px solid #333; display: flex; flex-direction: column; padding: 15px 0 50px 0; overflow-y: auto; }
    .settings-main { flex: 1; background: #2c3239; padding: 0; overflow-y: auto; }
    .sidebar-section { margin-top: 15px; padding: 0 20px; font-size: 11px; font-weight: 800; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; border-bottom: 1px solid #333; padding-bottom: 5px; }
    .sidebar-section:first-child { margin-top: 0; }
    .tab-btn { background: transparent; border: none; color: #888; font-size: 14px; font-weight: 500; padding: 10px 20px; cursor: pointer; text-align: left; border-left: 3px solid transparent; transition: 0.2s; display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .tab-btn:hover { color: #ccc; background: rgba(255,255,255,0.02); }
    .tab-btn.active { color: var(--accent); border-left: 3px solid var(--accent); background: rgba(255,255,255,0.05); font-weight: bold; }
    .tab-btn i { width: 20px; text-align: center; font-size: 14px; }
    .tab-pane { display: none; padding: 25px 30px; animation: fadeIn 0.3s; }
    .tab-pane.active { display: block; }
    .setting-group { margin-bottom: 25px; border-bottom: 1px solid #333; padding-bottom: 25px; }
    .setting-group:last-child { border-bottom: none; }
    .st-title { color: var(--accent) !important; font-size: 15px; font-weight: bold; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; letter-spacing: 0.5px; }
    .setting-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .setting-label { color: #ddd; font-size: 13px; font-weight: 600; }
    .setting-desc { color: #777; font-size: 11px; margin-top: 3px; max-width: 400px; }
    .st-input, .st-select { background: #2a2a2a; border: 1px solid #444; color: #fff; padding: 6px 10px; border-radius: 4px; outline: none; font-size: 12px; }
    .st-input:focus, .st-select:focus { border-color: var(--accent); }
    .toggle { position: relative; display: inline-block; width: 40px; height: 22px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #444; transition: .4s; border-radius: 34px; }
    .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
    input:checked + .slider { background-color: var(--accent); }
    input:checked + .slider:before { transform: translateX(18px); background-color: #1e1e1e; }
    .browse-group { display: flex; gap: 5px; }
    .btn-browse { background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; padding: 5px 10px; cursor: pointer; font-size: 12px; }
    .btn-browse:hover { background: #444; }
    .guide-close { font-size: 18px; color: #666; transition: 0.2s; cursor: pointer; padding: 5px; }
    .guide-close:hover { color: #c04040; transform: rotate(90deg); }
    .btn-reset { font-size: 10px; background: transparent; color: #666; border: 1px solid #444; padding: 2px 8px; cursor: pointer; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
    .btn-reset:hover { color: #aaa; border-color: #888; background: #333; }
    .g-section { margin-bottom: 25px; }
    .g-title { color: var(--accent) !important; font-size: 14px; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .g-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .g-item { font-size: 13px; color: #ccc; line-height: 1.6; background: #252525; padding: 12px; border-radius: 6px; border: 1px solid #333; transition: transform 0.2s; }
    .g-item:hover { border-color: #555; transform: translateY(-2px); }
    .g-item strong { color: var(--accent) !important; display: block; margin-bottom: 6px; font-size: 13px; border-bottom: 1px solid #333; padding-bottom: 4px; }
    .g-icon { display: inline-flex; width: 20px; height: 20px; background: #444; border-radius: 3px; align-items: center; justify-content: center; font-size: 10px; margin-right: 5px; color: #fff; }
    .k-badge { background: #333; border: 1px solid #555; border-bottom: 2px solid #555; color: #fff; border-radius: 4px; padding: 1px 6px; font-family: 'Consolas', monospace; font-size: 11px; font-weight: bold; }
    .tool-btn.highlighter-mode::after { content: ''; position: absolute; bottom: 2px; right: 2px; width: 6px; height: 6px; background-color: #ffeb3b; border: 1px solid #000; border-radius: 50%; z-index: 20002; }
    .tool-btn.active.highlighter-mode::after { background-color: #ffeb3b; border-color: #1e1e1e; }
    
    .toast { position: fixed; top: 60px; left: 50%; transform: translateX(-50%); background: #1e1e1e; color: var(--accent); border: 1px solid var(--accent); padding: 8px 16px; border-radius: 4px; z-index: 100000; font-size: 13px; font-weight: bold; letter-spacing: 0.5px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); pointer-events: none; opacity: 0; transition: opacity 0.3s ease-in-out; }
    .toast.show { opacity: 1; transform: translateX(-50%) translateY(5px); }
    .confirm-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); z-index: 100001; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(2px); }
    .confirm-box { background: #1e1e1e; border: 1px solid var(--accent); padding: 20px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.8); text-align: center; min-width: 250px; }
    .confirm-msg { color: #eee; margin-bottom: 20px; font-size: 14px; font-weight: 500; }
    .confirm-actions { display: flex; gap: 10px; justify-content: center; }
    .confirm-btn { padding: 6px 18px; border: 1px solid #444; background: #252525; color: #aaa; cursor: pointer; border-radius: 4px; font-size: 12px; transition: 0.2s; }
    .confirm-btn:hover { background: #333; color: #fff; }
    .confirm-btn.yes { background: var(--accent); color: #1e1e1e; border-color: var(--accent); font-weight: bold; }
    .confirm-btn.yes:hover { filter: brightness(1.1); }
    .measure-tooltip { position: fixed; z-index: 100000; pointer-events: none; background: rgba(20, 20, 20, 0.9); border: 1px solid var(--accent); color: #fff; padding: 4px 8px; border-radius: 4px; font-family: 'Consolas', monospace; font-size: 11px; box-shadow: 0 2px 10px rgba(0,0,0,0.5); display: none; white-space: nowrap; transform: translate(15px, 15px); }
    .measure-tooltip span { color: var(--accent); font-weight: bold; }
    
    #onboarding-wizard { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.95); z-index: 100002; justify-content: center; align-items: center; backdrop-filter: blur(8px); flex-direction: column; }
    #onboarding-wizard.show { display: flex; }
    .wizard-content { background: #1e1e1e; border: 2px solid var(--accent); color: #eee; border-radius: 12px; width: 650px; max-width: 90vw; box-shadow: 0 0 50px rgba(140, 250, 150, 0.3); overflow: hidden; display: flex; flex-direction: column; min-height: 400px; }
    .wizard-header { padding: 15px 20px; background: #252525; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
    .wizard-header h2 { margin: 0; color: var(--accent); font-size: 22px; letter-spacing: 1px; }
    .wizard-body { padding: 30px; flex-grow: 1; }
    .wizard-footer { padding: 15px 30px; background: #252525; border-top: 1px solid #333; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
    .wizard-footer button { padding: 8px 18px; font-weight: bold; border: none; border-radius: 6px; cursor: pointer; transition: 0.2s; min-width: 100px; }
    #wiz-next, #wiz-finish { background: var(--accent); color: #1e1e1e; }
    #wiz-next:hover, #wiz-finish:hover { filter: brightness(1.1); }
    #wiz-back { background: #333; color: #ddd; }
    #wiz-back:hover { background: #444; }
    .wizard-page { display: none; animation: fadeIn 0.3s; }
    .wizard-page.active { display: block; }
    .wiz-page-title { color: #fff; font-size: 18px; margin-bottom: 20px; border-bottom: 1px solid #444; padding-bottom: 10px; }
    .wiz-page-content { font-size: 14px; color: #ccc; line-height: 1.6; }
    .wiz-page-content strong { color: var(--accent); }
    .wiz-page-content ul { padding-left: 20px; }
    .wiz-key { display: inline-block; background: #333; border: 1px solid #555; border-bottom: 2px solid #555; color: #fff; border-radius: 4px; padding: 1px 5px; font-family: 'Consolas', monospace; font-size: 11px; font-weight: bold; margin: 0 2px; }
/* --- NEW UI IMPROVEMENTS (REVISED) --- */
    
    /* 1. Tactile Buttons (Bouncy Click) - KEPT */
    .tool-btn, .btn-icon, .style-btn, .stamp-control-btn { transition: all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important; }
    .tool-btn:active, .btn-icon:active, .style-btn:active, .stamp-control-btn:active { transform: scale(0.92) !important; }

    /* 2. Floating Bar (REVERTED to Solid Industrial Dark) */
    #floating-bar {
        background-color: #1f2429 !important; /* Solid dark grey */
        backdrop-filter: none !important;      /* Removed blur */
        box-shadow: 0 5px 15px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
        border: 1px solid #444 !important;
    }

    /* 3. Input Glow Effect - KEPT */
    input[type="number"]:focus, input[type="text"]:focus, .st-input:focus {
        outline: none;
        border-color: var(--accent) !important;
        box-shadow: 0 0 8px rgba(140, 250, 150, 0.4), inset 0 0 4px rgba(140, 250, 150, 0.1);
        transition: box-shadow 0.2s ease-in-out;
    }

    /* 4. Custom Tooltip Styling */
    .custom-tooltip {
        position: fixed; background: #1e1e1e; color: var(--accent); border: 1px solid var(--accent);
        padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;
        font-family: 'Segoe UI', sans-serif; pointer-events: none; z-index: 100000;
        box-shadow: 0 4px 10px rgba(0,0,0,0.5); opacity: 0; transform: translateY(5px);
        transition: opacity 0.15s, transform 0.15s; white-space: nowrap;
    }
    .custom-tooltip.visible { opacity: 1; transform: translateY(0); }

    /* 5. Outlined Icons (Polygon/Triangle Fix) */
    .outlined-icon { color: transparent !important; -webkit-text-stroke: 1.5px #ccc; }
    .tool-btn.active .outlined-icon { -webkit-text-stroke: 1.5px #1e1e1e; }

/* --- CHEAT SHEET REPAIR --- */
    #hotkey-cheat-sheet {
        /* Force Centering and Size */
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        
        /* Dimensions */
        width: 850px !important;
        max-width: 95vw !important;
        max-height: 90vh !important;
        overflow-y: auto !important;
        
        /* Layout */
        display: none; 
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 20px 40px !important;
        padding: 30px !important;
        align-items: start !important;

        /* Aesthetics */
        background: #1e1e1e !important;
        border: 2px solid var(--accent) !important;
        border-radius: 12px !important;
        box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 0 100vw rgba(0,0,0,0.5) !important;
        backdrop-filter: blur(5px) !important;
        z-index: 200000 !important;
        font-family: 'Segoe UI', sans-serif !important;
    }

    /* Column Headers */
    .hk-title {
        grid-column: span 1 !important;
        font-size: 14px !important;
        font-weight: 800 !important;
        text-transform: uppercase !important;
        letter-spacing: 1.5px !important;
        color: var(--accent) !important;
        border-bottom: 2px solid #333 !important;
        margin-bottom: 15px !important;
        padding-bottom: 8px !important;
        text-align: left !important;
    }

    /* Individual Rows */
    .hk-row {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding: 6px 0 !important;
        border-bottom: 1px solid #2a2a2a !important;
        color: #ccc !important;
    }

    /* Keycaps */
    .hk-key {
        background: #252525 !important;
        color: #fff !important;
        border: 1px solid #444 !important;
        border-bottom: 3px solid #444 !important; 
        border-radius: 4px !important;
        padding: 2px 8px !important;
        font-family: 'Consolas', monospace !important;
        font-weight: bold !important;
        font-size: 12px !important;
        min-width: 24px !important;
        text-align: center !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
    }
    
    /* Description Text */
    .hk-desc {
        font-size: 13px !important;
        color: #aaa !important;
    }

    /* Bottom Info Bar */
    #hotkey-cheat-sheet > div:last-child {
        grid-column: 1 / -1 !important;
        margin-top: 15px !important;
        padding-top: 15px !important;
        border-top: 1px solid #333 !important;
        text-align: center !important;
        color: #666 !important;
        font-size: 11px !important;
        text-transform: uppercase !important;
        letter-spacing: 1px !important;
  }
`;
document.head.appendChild(style);

// [NEW] Compact Intro Styles (Paste BEFORE const onboardingHtml)
const obStyle = document.createElement('style');
obStyle.innerHTML = `
    .onboarding-content { 
        background: #1e1e1e; border: 1px solid #444; border-radius: 12px; 
        width: 950px; 
        height: 600px; /* [UPDATED] Height increased for new content */
        display: flex; flex-direction: column; 
        box-shadow: 0 15px 45px rgba(0,0,0,0.8); overflow: hidden; position: relative; 
    }
    .modal { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 60000; padding: 20px; justify-content: center; align-items: center; backdrop-filter: blur(5px); }
    .ob-header { height: 40px; background: #252525; border-bottom: 1px solid #333; display: flex; align-items: center; justify-content: space-between; padding: 0 15px; flex-shrink: 0; }
    .ob-win-controls { display: flex; gap: 6px; }
    .dot-fake { width: 10px; height: 10px; border-radius: 50%; opacity: 0.5; }
    .dot-fake.red { background: #ff5f56; } .dot-fake.yellow { background: #ffbd2e; } .dot-fake.green { background: #27c93f; }
    .ob-title { color: var(--accent); font-size: 14px; font-weight: bold; letter-spacing: 1px; }
    .ob-viewport { flex: 1; background: #181818; position: relative; overflow: hidden; }
    .ob-slides-container { width: 100%; height: 100%; position: relative; }
    .ob-slide { position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 25px 50px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; text-align: center; opacity: 0; transform: translateX(50px); transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55); pointer-events: none; }
    .ob-slide.active { opacity: 1; transform: translateX(0); pointer-events: auto; }
    .ob-icon { font-size: 50px; color: var(--accent); margin-bottom: 5px; text-shadow: 0 0 15px rgba(140, 250, 150, 0.4); }
    .ob-slide h2 { margin: 0 0 6px 0; color: #fff; font-size: 24px; letter-spacing: 1px; font-weight: 700; }
    .ob-slide p { color: #ccc; line-height: 1.5; font-size: 14px; margin-bottom: 5px; max-width: 850px; } 
    .ob-slide .ob-sub { margin-top: 5px !important; color: #888; font-style: italic; font-size: 13px; max-width: 850px; } 
    .ob-tip-box { background: #222222; border: 1px solid #333; border-left: 3px solid var(--accent); padding: 8px 15px; text-align: left; font-size: 13px; color: #ddd; border-radius: 4px; margin-top: 10px; line-height: 1.4; max-width: 850px; box-shadow: 0 3px 10px rgba(0,0,0,0.3); } 
    .ob-tip-box ul { margin: 5px 0 0 0; } .ob-tip-box li { padding: 2px 0; border-bottom: none; } 
    .ob-list { text-align: left; list-style: none; padding: 0; width: 100%; margin-top: 8px; max-width: 850px; } 
    .ob-list li { padding: 4px 0; border-bottom: 1px solid #282828; color: #ddd; font-size: 14px; display: flex; align-items: center; gap: 12px; transition: background 0.2s; }
    
    .ob-list li:hover { background: transparent; }
    
    .ob-list li i { color: var(--accent); width: 20px; text-align: center; } .ob-list li:last-child { border-bottom: none; }
    .ob-big-btn { margin-top: 15px; font-size: 16px !important; padding: 10px 30px !important; background: var(--accent); color: #1e1e1e; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
    .ob-big-btn:hover { background: #fff; transform: translateY(-2px); }
    .ob-footer { height: 50px; border-top: 1px solid #333; background: #252525; display: flex; justify-content: space-between; align-items: center; padding: 0 25px; flex-shrink: 0; }
    .ob-left-controls { display: flex; align-items: center; gap: 20px; }
    .ob-dots { display: flex; gap: 10px; }
    .dot { width: 8px; height: 8px; background: #555; border-radius: 50%; transition: 0.3s; cursor: pointer; border: 1px solid transparent; } 
    .dot.active { background: var(--accent); border: 1px solid var(--accent); } 
    .ob-actions { display: flex; gap: 15px; }
    .ob-btn-pri { background: var(--accent); color: #1e1e1e; border: none; padding: 8px 25px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px; box-shadow: 0 4px 10px rgba(0,0,0,0.4); }
    .ob-btn-sec { background: #333; color: #ccc; border: 1px solid #555; padding: 7px 18px; cursor: pointer; font-size: 13px; border-radius: 6px; }
    .ob-btn-sec:hover { color: #fff; background: #444; }
    .about-hero { text-align: center; padding: 20px; background: #252525; border-radius: 8px; border: 1px solid #333; margin-bottom: 20px; }
    .about-logo { width: 64px; height: 64px; margin-bottom: 10px; }
    .about-ver { color: #777; font-size: 12px; margin-bottom: 15px; }
    .ob-skip-label { color: #aaa; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 5px; }
    
    #ob-dont-show-container { display: flex; align-items: center; gap: 8px; color: #aaa; font-size: 12px; cursor: pointer; }
    #ob-dont-show-check { accent-color: var(--accent); cursor: pointer; }
`;

document.head.appendChild(obStyle);

const onboardingHtml = `
<div id="onboarding-modal" class="modal" style="z-index: 200000; display: none;">
    <div class="onboarding-content">
        <div class="ob-header">
            <div class="ob-win-controls">
                <span class="dot-fake red"></span><span class="dot-fake yellow"></span><span class="dot-fake green"></span>
            </div>
            <span class="ob-title">Welcome to CapSize</span>
            <div style="width: 50px;"></div> 
        </div>
        <div class="ob-viewport">
            <div class="ob-slides-container">
                <div class="ob-slide active" data-step="0">
                    <div class="ob-icon pulse"><i class="fa-solid fa-ruler-combined"></i></div>
                    <h2>Precision Capture Made Simple</h2>
                    
                    <p style="max-width: 600px; margin: 0 auto 10px auto;">Experience the perfect blend of speed and precision. Whether capturing a quick meme or measuring exact UI elements, CapSize adapts to your workflow instantly.</p>
                    
                    <div class="ob-tip-box" style="margin-top: 15px; max-width: 600px; text-align: center;">
                        <i class="fa-solid fa-bolt"></i> <strong style="color:var(--accent); font-weight: bold;">The Core Concept:</strong> 
                        Start in <strong style="color:#fff">Region Mode</strong> for speed—simply drag to snap. Switch to <strong style="color:#fff">Window Mode</strong> anytime for fixed-size precision.
                    </div>

                     <ul class="ob-list ob-tight-list" style="max-width: 600px; width: 100%;">
                        <li style="display: flex; padding-bottom: 5px; margin-bottom: 10px; border-bottom: none; font-size: 13px;"> 
                            <strong style="color:var(--accent); font-weight: bold; min-width: 125px;">Region Mode:</strong> 
                            <span>(Default) The fastest way to work. Drag to highlight a specific area, annotate, and snap.</span>
                        </li>
                        <li style="display: flex; padding-bottom: 5px; margin-bottom: 10px; border-bottom: none; font-size: 13px;">
                            <strong style="color:var(--accent); font-weight: bold; min-width: 125px;">Window Mode:</strong> 
                            <span>Need exact pixels (e.g. 1920x1080)? Switch to Window Mode <i class="fa-regular fa-window-maximize" style="color:var(--accent)"></i> to use the precision viewfinder.</span>
                        </li>
                        <li style="display: flex; padding-bottom: 5px; margin-bottom: 10px; border-bottom: none; font-size: 13px;">
                            <strong style="color:var(--accent); font-weight: bold; min-width: 125px;">Import Images:</strong> 
                            <span>Paste <strong>(Ctrl+V)</strong> or <strong>Drag & Drop</strong> any image file onto the window to instantly load it for editing.</span>
                        </li>
                        <li style="display: flex; font-size: 13px;">
                            <strong style="color:var(--accent); font-weight: bold; min-width: 125px;">Input Freedom:</strong> 
                            <span>Optimized for Mouse, Touchscreen, and Stylus interaction.</span>
                        </li>
                    </ul>
                </div>

                <div class="ob-slide" data-step="1">
                    <div class="ob-icon"><i class="fa-solid fa-highlighter"></i></div>
                    <h2>Professional Markup Tools</h2>
                    <p>Annotate your images with a suite of vector tools designed for speed. Access everything via the toolbar or keyboard hotkeys.</p>
                    
                    <div class="ob-tip-box" style="text-align: left; max-width: 700px; width: 100%; margin-top: 15px;">
                        <i class="fa-solid fa-bolt"></i> <strong style="color:var(--accent); font-weight: bold;">Workflow Secrets:</strong>
                        <ul style="padding-left: 15px; margin: 5px 0 0 0; list-style-type: disc;">
        <li><strong style="color:#fff">Right-Click Menus:</strong> Right-Click <strong>Arrow</strong>, <strong>Polygon</strong>, or <strong>Line</strong> to access styles/modes (e.g., Highlighter).</li>
        <li><strong style="color:#fff">Double-Click Toggles:</strong> Double-click Shape tools (Square, Circle) to toggle Solid vs. Outline.</li>
                            <li><strong style="color:#fff">Curved Lines:</strong> Double-click the center handle of any selected Line or Arrow to toggle curve mode.</li>
                            <li><strong style="color:#fff">Scroll to Resize:</strong> Hover over the canvas and use your <strong>Mouse Wheel</strong> to instantly resize your brush or text.</li>
                        </ul>
                    </div>
                    
                    <div class="ob-tip-box" style="text-align: left; max-width: 700px; width: 100%; margin-top: 15px;">
                        <i class="fa-solid fa-keyboard"></i> <strong style="color:var(--accent); font-weight: bold;">Essential Hotkeys:</strong>
                        <ul style="padding-left: 15px; margin: 5px 0 0 0; list-style-type: disc;">
                            <li><span class="wiz-key">Ctrl</span> + <span class="wiz-key">S</span> Save &nbsp; <span class="wiz-key">Ctrl</span> + <span class="wiz-key">C</span> / <span class="wiz-key">V</span> Copy/Paste &nbsp; <span class="wiz-key">Esc</span> Cancel</li>
                            <li><span class="wiz-key">A</span> Arrow &nbsp; <span class="wiz-key">P</span> Pen &nbsp; <span class="wiz-key">L</span> Line &nbsp; <span class="wiz-key">T</span> Text &nbsp; <span class="wiz-key">S</span> Square</li>
                            <li><span class="wiz-key">Ctrl</span> + <span class="wiz-key">Z</span> Undo &nbsp;&nbsp; <span class="wiz-key">Del</span> Delete Shape</li>
                            <li><strong style="color:var(--accent)">Need a reminder?</strong> Hold <span class="wiz-key">Alt</span> at any time to see the Cheat Sheet overlay.</li>
                        </ul>
                    </div>
                </div>

                <div class="ob-slide" data-step="2">
                    <div class="ob-icon"><i class="fa-solid fa-vector-square"></i></div>
                    <h2>Smart Design Assists</h2>
                    <p>You don't need to be a designer to make things look neat. CapSize includes helper tools to keep your work aligned and tidy.</p>
                    <div class="ob-tip-box" style="margin-top: 10px; max-width: 550px;">

<i class="fa-solid fa-border-all"></i> <strong style="color:var(--accent); font-weight: bold;">Background Grid:</strong> Toggle the grid <i class="fa-solid fa-border-all"></i> in the footer to help you space out elements evenly.
                    </div>
                    <div class="ob-tip-box" style="margin-top: 10px; max-width: 550px;">
                        <i class="fa-solid fa-magnet"></i> <strong style="color:var(--accent); font-weight: bold;">Smart Guides:</strong> Magenta lines will appear automatically in the grid to help you align text and shapes to the center or edges of your image.
                    </div>

<div class="ob-tip-box" style="margin-top: 10px; max-width: 550px;">
                        <i class="fa-solid fa-border-all"></i> <strong style="color:var(--accent); font-weight: bold;">Snap-to-Grid:</strong> 
                        Enable this in Settings to force all drawing and movement to lock perfectly to the background grid lines.
                    </div>

                    <div class="ob-tip-box" style="margin-top: 10px; max-width: 550px;">                        
                        <i class="fa-solid fa-arrows-up-down-left-right"></i> <strong style="color:var(--accent); font-weight: bold;">Precision Nudge:</strong> Click any shape to select it, then use your <strong>Arrow Keys</strong> to move it 1 pixel at a time.
                    </div>
                </div>

                <div class="ob-slide" data-step="3">
                    <div class="ob-icon"><i class="fa-solid fa-toolbox"></i></div>
                    <h2>The Power Toolkit</h2>
                    <p>Found in the <i class="fa-solid fa-toolbox"></i> menu, these tools handle specialized tasks for documentation and privacy.</p>
                    
                    <div class="ob-tip-box" style="text-align: left; max-width: 650px; width: 100%;">
                        <ul class="ob-list ob-tight-list" style="max-width: 600px; width: 100%; margin: 5px 0 0 0; padding-left: 10px; list-style-type: disc;">
                            <li style="font-size: 13px;">
                                <i class="fa-solid fa-eye-dropper" style="color:#fff; min-width: 32px;"></i> 
                                <strong style="color:var(--accent); font-weight: bold; min-width: 135px;">Eyedropper:</strong> 
                                <span>Sample exact hex colors directly from your screen captures. The syringe cursor fills with the selected color.</span>
                            </li>
                            <li style="font-size: 13px;">
                                <i class="fa-solid fa-list-ol" style="color:#fff; min-width: 32px;"></i> 
                                <strong style="color:var(--accent); font-weight: bold; min-width: 135px;">Counter Stamps:</strong> 
                                <span>Place sequential numbers (1, 2, 3) or letters (A, B, C). Use the <strong>Floating Bubble</strong> to toggle modes and reset.</span>
                            </li>
                            <li style="font-size: 13px;">
                                <i class="fa-solid fa-file-lines" style="color:#fff; min-width: 32px;"></i> 
                                <strong style="color:var(--accent); font-weight: bold; min-width: 135px;">OCR Scanner:</strong> 
                                <span>Select this, then drag a box around any text on screen to copy it directly to your clipboard.</span>
                            </li>
                            <li style="font-size: 13px;">
                                <i class="fa-solid fa-eye-slash" style="color:#fff; min-width: 32px;"></i> 
                                <strong style="color:var(--accent); font-weight: bold; min-width: 135px;">Privacy Blur:</strong> 
                                <span>Draw a box over faces, emails, or passwords to permanently blur them out.</span>
                            </li>

<li style="font-size: 13px;">
                                <i class="fa-solid fa-magnifying-glass-plus" style="color:#fff; min-width: 32px;"></i> 
                                <strong style="color:var(--accent); font-weight: bold; min-width: 135px;">Magnifier:</strong> 
                                <span>Zoom in for pixel-perfect detail. <span class="wiz-key">Scroll</span> to resize the lens, and use <span class="wiz-key">Ctrl</span> + <span class="wiz-key">Scroll</span> to change the zoom power.</span>
                            </li>

                            <li style="font-size: 13px;">
                                <i class="fa-solid fa-hand-holding-hand" style="color:#00bcd4; min-width: 32px;"></i> 
                                <strong style="color:var(--accent); font-weight: bold; min-width: 135px;">Drag to Share:</strong> 
                                <span>Click and hold the <strong>blue hands</strong> button to drag your finished image directly into other applications or your desktop.</span>
                            </li>
                        </ul>
                    </div>

                </div>

                <div class="ob-slide" data-step="4">
                    <div class="ob-icon"><i class="fa-solid fa-check-circle" style="color:var(--accent)"></i></div>
                    <h2>You're Ready!</h2>
                    <p>CapSize is highly customizable. You can change your default canvas size, colors, and hotkeys at any time in the <strong>Settings</strong> <i class="fa-solid fa-gear"></i> menu.</p>
                    <div style="display: flex; gap: 15px; margin-top: 15px;">
                        <button id="ob-start-btn" class="ob-big-btn">Start Capturing</button>
                        <button id="ob-setup-btn" class="ob-big-btn" style="background: #333; color: #ccc; border: 1px solid #555;">Run Quick Setup</button>
                    </div>
                    
                    <div id="ob-dont-show-container" style="margin-top: 25px;">
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; color:#888; font-size:12px;">
                            <input type="checkbox" id="ob-dont-show-check"> Do not show this tour again
                        </label>
                    </div>
                </div>
            </div>
        </div>

        <div class="ob-footer">
            <div class="ob-left-controls">
                <div class="ob-dots">
                    <span class="dot active"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span>
                </div>
                <button id="ob-back" class="ob-btn-sec" disabled style="padding: 7px 18px;">Back</button> 
            </div>
            <div class="ob-actions">
                <button id="ob-skip" class="ob-btn-sec">Skip</button>
                <button id="ob-next" class="ob-btn-pri">Next</button>
            </div>
        </div>
    </div>
</div>
`;

// [UPDATED] 3. Init Function (Logic Simplified and fixed)
function initOnboarding(force = false) {
    let existingEl = document.getElementById('onboarding-modal');
    if(existingEl) existingEl.remove();

    if (!force && localStorage.getItem('cs_has_seen_intro')) return;

    // Resize Logic for Tour
    if (!isFullscreen) {
        if (preWizardW === 0 && preWizardH === 0) {
            preWizardW = w; preWizardH = h;
        }
        const tourMinW = 1000; const tourMinH = 700; 
        if (w < tourMinW || h < tourMinH) {
            w = Math.max(w, tourMinW); h = Math.max(h, tourMinH);
            if(inpW) inpW.value = w; 
            if(inpH) inpH.value = h;
            ipcRenderer.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
            updateCanvasSize(w, h);
            ipcRenderer.send('center-window');
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

    // Logic to Close Intro and Optionally Open Wizard
    const finish = (runWizard = false) => {
        const dontShowCheck = document.getElementById('ob-dont-show-check');
        const shouldHideIntroForever = dontShowCheck ? dontShowCheck.checked : false;

        if (shouldHideIntroForever || runWizard) {
            localStorage.setItem('cs_has_seen_intro', 'true');
            userSettings.introComplete = true; 
        }

        if (!runWizard) {
            userSettings.onboardingComplete = true; 
        }
        
        saveSettings(); 

        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none'; 
            modal.remove();
            
            if (runWizard) {
                // Open Wizard after Intro is gone
                setTimeout(() => {
                    if (typeof showOnboardingWizard === 'function') {
                        showOnboardingWizard();
                    }
                }, 100);
            } else {
                // Restore window size if not running wizard
                if (!isFullscreen && preWizardW > 0 && preWizardH > 0) {
                    isSuppressingResize = true;
                    w = preWizardW; h = preWizardH;
                    if(inpW) inpW.value = w; 
                    if(inpH) inpH.value = h;
                    ipcRenderer.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
                    ipcRenderer.send('center-window');
                    updateCanvasSize(w, h);
                    setTimeout(() => {
                        updateCanvasSize(w, h);
                        isSuppressingResize = false;
                        preWizardW = 0; preWizardH = 0;
                    }, 100);
                }
            }
        }, 300);
    };

    if(btnNext) btnNext.onclick = (e) => { e.stopPropagation(); if (currentStep < slides.length - 1) { currentStep++; updateSlide(); } };
    if(btnBack) btnBack.onclick = (e) => { e.stopPropagation(); if (currentStep > 0) { currentStep--; updateSlide(); } };

    if(btnSkip) btnSkip.onclick = (e) => { e.stopPropagation(); finish(false); };
    if(btnStart) btnStart.onclick = (e) => { e.stopPropagation(); finish(false); };
    
    // [FIX] Correctly wired the Quick Setup Button
    if(btnSetup) btnSetup.onclick = (e) => { 
        e.preventDefault();
        e.stopPropagation(); 
        finish(true); 
    };

    dots.forEach((dot, index) => {
        dot.onclick = (e) => { e.stopPropagation(); currentStep = index; updateSlide(); };
    });
}

const oldHelp = document.getElementById('help-modal'); if (oldHelp) oldHelp.remove();

const settingsHtml = `
<div id="settings-modal" class="modal">
    <div class="guide-content">
        <div class="guide-header">
            <h2><i class="fa-solid fa-sliders"></i> Settings & Guide</h2>
            <div id="close-settings" class="guide-close"><i class="fa-solid fa-xmark"></i></div>
        </div>

        <div class="settings-body">
            <div class="settings-sidebar">
                <div class="sidebar-section">Information</div>
                <button class="tab-btn active" data-tab="tab-about"><i class="fa-solid fa-circle-info"></i> About</button>
                
                <div class="sidebar-section">App Settings</div>
                <button class="tab-btn" data-tab="tab-gen"><i class="fa-solid fa-gear"></i> General</button>
                <button class="tab-btn" data-tab="tab-draw"><i class="fa-solid fa-pencil"></i> Drawing</button>
                <button class="tab-btn" data-tab="tab-app"><i class="fa-solid fa-palette"></i> Appearance</button>
                <button class="tab-btn" data-tab="tab-out"><i class="fa-solid fa-image"></i> Output</button>
                
                <div class="sidebar-section">User Guide</div>
                <button class="tab-btn" data-tab="guide-basic"><i class="fa-solid fa-book"></i> Workflow</button>
                <button class="tab-btn" data-tab="guide-draw"><i class="fa-solid fa-pen-ruler"></i> Drawing Tools</button>
                <button class="tab-btn" data-tab="guide-power"><i class="fa-solid fa-toolbox"></i> Toolbox</button>
                <button class="tab-btn" data-tab="guide-hotkeys"><i class="fa-solid fa-keyboard"></i> Hotkeys & Tips</button>
            </div>

            <div class="settings-main">
                <div id="tab-about" class="tab-pane active">
                    <div class="about-hero">
                        <img src="icon.png" class="about-logo" alt="Logo">
                        <div style="font-size: 24px; font-weight: bold; color: #fff;">Cap<span style="color:var(--accent)">Size</span></div>
                        <div class="about-ver">Version 1.0.0</div>
                        

<p style="color:#ccc; font-size:13px; max-width:500px; margin: 10px auto;">
                             CapSize combines the accuracy professionals need with the simplicity home users want.
                        </p>

                        <div style="display:flex; gap:20px; justify-content:center; margin: 15px 0 10px 0; font-size: 13px; color: #ccc;">
                            <span title="No internet required"><i class="fa-solid fa-wifi" style="color:var(--accent); margin-right:6px;"></i> 100% Offline</span>
                            <span title="Pen & Touch support"><i class="fa-solid fa-pen-nib" style="color:var(--accent); margin-right:6px;"></i> Stylus Ready</span>
                        </div>

                        
                        
                        <div style="display:flex; gap:10px; justify-content:center; margin-top:20px;">
                            <button id="btn-replay-intro" class="ob-btn-pri" style="font-size:13px;"><i class="fa-solid fa-play"></i> Replay Tour</button>
                            <button id="btn-run-setup" class="ob-btn-sec" style="font-size:13px;"><i class="fa-solid fa-wand-magic-sparkles"></i> Run Setup Wizard</button>
                        </div>
                    </div>

                    <div class="setting-group">
                        <div class="st-title">Credits & Info</div>
                        <div class="g-grid">
                            <div class="g-item">
                                <strong><i class="fa-solid fa-shield-halved"></i> Privacy Promise</strong>
                                CapSize operates entirely locally on your device. We do not collect, store, or transmit any data to the cloud. Your work stays yours.
                            </div>
                            
                            <div class="g-item">
                                <strong><i class="fa-brands fa-github"></i> Open Source</strong>
                                Built with Electron, FontAwesome, and Tesseract.js.
                            </div>
                        </div>
                    </div>
                </div>

                <div id="tab-gen" class="tab-pane">
                    <div class="setting-group">
                        <div class="st-title">
                            Application Behavior 
                            <div style="display:flex; gap:5px;">
                                <button class="btn-reset" id="btn-export-settings" title="Export Config"><i class="fa-solid fa-download"></i> Backup</button>
                                <button class="btn-reset" id="btn-import-settings" title="Import Config"><i class="fa-solid fa-upload"></i> Load</button>
                                <button class="btn-reset" onclick="resetSection('gen-flow')">Reset</button>
                            </div>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Open at Login <div class="setting-desc">Launch CapSize automatically when Windows starts</div></div>
                            <label class="toggle"><input type="checkbox" data-setting="openAtLogin" ${userSettings.openAtLogin ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Always On Top <div class="setting-desc">Keep window floating above other applications</div></div>
                            <label class="toggle"><input type="checkbox" data-setting="alwaysOnTop" ${userSettings.alwaysOnTop ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Global Hotkey <div class="setting-desc">Key to toggle app visibility (e.g. PrintScreen, F12)</div></div>
                            <input type="text" data-setting="globalHotkey" class="st-input" value="${userSettings.globalHotkey}" placeholder="PrintScreen">
                        </div>
                  
                         <div class="setting-row">
                            <div class="setting-label">Live Measurements <div class="setting-desc">Show dimensions (px) and angles next to cursor while drawing</div></div>
                            <label class="toggle"><input type="checkbox" data-setting="showMeasurements" ${userSettings.showMeasurements ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                    </div>
                    <div class="setting-group">
                        <div class="st-title">Startup Preferences <button class="btn-reset" onclick="resetSection('gen-win')">Reset</button></div>
                        <div class="setting-row">
                            <div class="setting-label">Default Tool</div>
                            <select data-setting="startupTool" class="st-select">
                                <option value="cursor" ${userSettings.startupTool === 'cursor' ? 'selected' : ''}>Cursor (Select)</option>
                                <option value="pen" ${userSettings.startupTool === 'pen' ? 'selected' : ''}>Pen</option>
                                <option value="arrow" ${userSettings.startupTool === 'arrow' ? 'selected' : ''}>Arrow</option>
                            </select>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Initial Window Size <div class="setting-desc">Width x Height in pixels (For Windowed Mode)</div></div>
                            <div style="display:flex; gap:5px;">
                                <input type="number" data-setting="startupW" class="st-input" value="${userSettings.startupW}" style="width: 60px;">
                                <span style="color:#888; align-self:center;">x</span>
                                <input type="number" data-setting="startupH" class="st-input" value="${userSettings.startupH}" style="width: 60px;">
                            </div>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Start in Fullscreen <div class="setting-desc">Enabled by default. Uncheck to start in Windowed Mode.</div></div>
                            <label class="toggle"><input type="checkbox" data-setting="startFullscreen" ${userSettings.startFullscreen ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Immersive Mode <div class="setting-desc">Hide the resize handles and dashed border while drawing</div></div>
                            <label class="toggle"><input type="checkbox" data-setting="immersiveMode" ${userSettings.immersiveMode ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                    </div>
                </div>

                <div id="tab-draw" class="tab-pane">
                    <div class="setting-group">
                        <div class="st-title">Styles & Cursor <button class="btn-reset" onclick="resetSection('draw-style')">Reset</button></div>
                        <div class="setting-row">
                            <div class="setting-label">Cursor Style</div>
                            <select data-setting="cursorStyle" class="st-select">
                                <option value="dot" ${userSettings.cursorStyle === 'dot' ? 'selected' : ''}>Dot (Color Match)</option>
                                <option value="crosshair" ${userSettings.cursorStyle === 'crosshair' ? 'selected' : ''}>Crosshair (Precision)</option>
                                <option value="outline" ${userSettings.cursorStyle === 'outline' ? 'selected' : ''}>Brush Outline</option>
                            </select>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Arrowhead Style</div>
                            <select data-setting="arrowStyle" class="st-select">
                                <option value="v" ${userSettings.arrowStyle === 'v' ? 'selected' : ''}>Open V-Shape</option>
                                <option value="hand" ${userSettings.arrowStyle === 'hand' ? 'selected' : ''}>Hand Drawn</option>
                                <option value="triangle" ${userSettings.arrowStyle === 'triangle' ? 'selected' : ''}>Standard Triangle</option>
                                <option value="concave" ${userSettings.arrowStyle === 'concave' ? 'selected' : ''}>Curved Back</option>
                                <option value="dot" ${userSettings.arrowStyle === 'dot' ? 'selected' : ''}>Dot Endpoint</option>
                            </select>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Shadow Blur (Intensity)</div>
                             <input type="range" data-setting="shadowBlur" min="0" max="30" value="${userSettings.shadowBlur}" title="Shadow Blur">
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Shadow Distance</div>
                             <input type="range" data-setting="shadowDistance" min="0" max="20" value="${userSettings.shadowDistance}" title="Shadow Distance">
                        </div>
                    </div>
                    <div class="setting-group">
                        <div class="st-title">Stroke Properties <button class="btn-reset" onclick="resetSection('draw-shape')">Reset</button></div>
                        <div class="setting-row">
                            <div class="setting-label">Corner Style <div class="setting-desc">For lines, squares and polygons</div></div>
                            <select data-setting="cornerStyle" class="st-select">
                                <option value="miter" ${userSettings.cornerStyle === 'miter' ? 'selected' : ''}>Miter (Sharp)</option>
                                <option value="round" ${userSettings.cornerStyle === 'round' ? 'selected' : ''}>Round</option>
                            </select>
                        </div>

                        <div class="setting-row">
                            <div class="setting-label">Square Corner Radius <div class="setting-desc">Radius in pixels when Corner Style is 'Round'</div></div>
                            <input type="range" data-setting="cornerRadius" min="0" max="50" step="1" value="${userSettings.cornerRadius || 10}" title="Corner Radius">
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Dotted Line Style</div>
                            <select data-setting="dottedStyle" class="st-select">
                                <option value="butt" ${userSettings.dottedStyle === 'butt' ? 'selected' : ''}>Flat Edges</option>
                                <option value="round" ${userSettings.dottedStyle === 'round' ? 'selected' : ''}>Rounded Edges</option>
                            </select>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Default Line Width</div>
                            <input type="number" data-setting="defLineWidth" class="st-input" min="1" max="20" value="${userSettings.defLineWidth}">
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Highlighter Opacity <div class="setting-desc">Opacity used when Line tool is in Highlighter mode</div></div>
                            <input type="range" data-setting="highlighterOpacity" min="0.1" max="0.9" step="0.1" value="${userSettings.highlighterOpacity}">
                        </div>
                    </div>
                    <div class="setting-group">
                        <div class="st-title">Snapping & Precision <button class="btn-reset" onclick="resetSection('draw-snap')">Reset</button></div>
                        
                       <div class="setting-row">
    <div class="setting-label">Snap to Grid <div class="setting-desc">Align shapes to grid (Disables Smart Guides)</div></div>
    <label class="toggle"><input type="checkbox" data-setting="snapToGrid" ${userSettings.snapToGrid ? 'checked' : ''}><span class="slider"></span></label>
</div>
                        <div class="setting-row">
                            <div class="setting-label">Smart Alignment Guides <div class="setting-desc">Show magenta lines when shapes align (Center/Edges)</div></div>
                            <label class="toggle"><input type="checkbox" data-setting="showSmartGuides" ${userSettings.showSmartGuides ? 'checked' : ''}><span class="slider"></span></label>
                        </div>

                        <div class="setting-row">
                            <div class="setting-label">Point Snapping <div class="setting-desc">Magnetic pull when closing Polygons</div></div>
                            <select data-setting="magnetStrength" class="st-select">
                                <option value="low" ${userSettings.magnetStrength === 'low' ? 'selected' : ''}>Low (10px)</option>
                                <option value="medium" ${userSettings.magnetStrength === 'medium' ? 'selected' : ''}>Medium (20px)</option>
                                <option value="high" ${userSettings.magnetStrength === 'high' ? 'selected' : ''}>High (40px)</option>
                            </select>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Angle Snap (Shift) <div class="setting-desc">Rotation increments when holding Shift</div></div>
                            <select data-setting="angleSnap" class="st-select">
                                <option value="15" ${userSettings.angleSnap == 15 ? 'selected' : ''}>15 Degrees</option>
                                <option value="45" ${userSettings.angleSnap == 45 ? 'selected' : ''}>45 Degrees</option>
                                <option value="90" ${userSettings.angleSnap == 90 ? 'selected' : ''}>90 Degrees</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div id="tab-app" class="tab-pane">
                    <div class="setting-group">
                        <div class="st-title">Theme & Colors <button class="btn-reset" onclick="resetSection('app-theme')">Reset</button></div>
                        <div class="setting-row">
                            <div class="setting-label">UI Accent Color</div>
                            <div class="browse-group" style="align-items: center; gap: 8px;">
                                <div style="width: 50px; height: 15px;">
                                    <input type="color" id="inp-accent-picker" class="sleek-color" data-setting="accentColor" value="${userSettings.accentColor}">
                                </div>
                                <input type="text" id="inp-accent-text" class="st-input" value="${userSettings.accentColor}" readonly style="width:80px; text-transform:uppercase;">
                            </div>
                        </div>

                        <div class="setting-row">
                            <div class="setting-label">Default Draw Color</div>
                            <div class="browse-group" style="align-items: center; gap: 8px;">
                                <div style="width: 50px; height: 15px;">
                                    <input type="color" id="inp-def-color-picker" class="sleek-color" data-setting="defaultColor" value="${userSettings.defaultColor}">
                                </div>
                                <input type="text" id="inp-def-color-text" class="st-input" value="${userSettings.defaultColor}" readonly style="width:80px; text-transform:uppercase;">
                            </div>
                        </div>
                        
                        <div class="setting-row" style="align-items: flex-start;">
                            <div class="setting-label">
                                Custom Palette <button class="btn-reset" onclick="resetSection('app-palette')" style="margin-left:8px;">Reset</button>
                                <div class="setting-desc">Toggle to use your own colors. Click bars below to edit.</div>
                                <div id="custom-palette-grid" style="display: grid; grid-template-columns: repeat(4, 50px); grid-auto-rows: 15px; gap: 10px 8px; margin-top: 10px; width: max-content;">
                                    <input type="color" class="palette-picker sleek-color" data-index="0" value="${userSettings.customColors[0]}">
                                    <input type="color" class="palette-picker sleek-color" data-index="1" value="${userSettings.customColors[1]}">
                                    <input type="color" class="palette-picker sleek-color" data-index="2" value="${userSettings.customColors[2]}">
                                    <input type="color" class="palette-picker sleek-color" data-index="3" value="${userSettings.customColors[3]}">
                                    <input type="color" class="palette-picker sleek-color" data-index="4" value="${userSettings.customColors[4]}">
                                    <input type="color" class="palette-picker sleek-color" data-index="5" value="${userSettings.customColors[5]}">
                                    <input type="color" class="palette-picker sleek-color" data-index="6" value="${userSettings.customColors[6]}">
                                    <input type="color" class="palette-picker sleek-color" data-index="7" value="${userSettings.customColors[7]}">
                                </div>
                            </div>
                            <label class="toggle"><input type="checkbox" data-setting="useCustomSwatches" ${userSettings.useCustomSwatches ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                    </div>
                    <div class="setting-group">
                        <div class="st-title">Background Grid <button class="btn-reset" onclick="resetSection('app-grid')">Reset</button></div>
                        <div class="setting-row">
                            <div class="setting-label">Grid Size (px)</div>
                            <input type="number" data-setting="gridSize" class="st-input" value="${userSettings.gridSize}">
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Grid Visibility</div>
                            <input type="range" data-setting="gridOpacity" min="0.1" max="1" step="0.1" value="${userSettings.gridOpacity}">
                        </div>
                    </div>
                </div>

                <div id="tab-out" class="tab-pane">
                    <div class="setting-group">
                        <div class="st-title">Image Export <button class="btn-reset" onclick="resetSection('out-img')">Reset</button></div>
                        <div class="setting-row">
                            <div class="setting-label">File Format</div>
                            <select data-setting="imageFormat" class="st-select">
                                <option value="image/png" ${userSettings.imageFormat === 'image/png' ? 'selected' : ''}>PNG (Lossless)</option>
                                <option value="image/jpeg" ${userSettings.imageFormat === 'image/jpeg' ? 'selected' : ''}>JPG (Compressed)</option>
                                <option value="image/webp" ${userSettings.imageFormat === 'image/webp' ? 'selected' : ''}>WebP (Web)</option>
                            </select>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Quality (JPG/WebP)</div>
                            <input type="range" data-setting="imageQuality" min="0.1" max="1" step="0.1" value="${userSettings.imageQuality}">
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Export Padding (px) <div class="setting-desc">Add whitespace around the capture</div></div>
                            <input type="number" data-setting="exportPadding" class="st-input" value="${userSettings.exportPadding}" style="width: 80px;">
                        </div>
                         <div class="setting-row">
                            <div class="setting-label">Auto-Watermark <div class="setting-desc">Text applied to bottom-right corner</div></div>
                            <input type="text" data-setting="watermarkText" class="st-input" value="${userSettings.watermarkText}" placeholder="e.g. Confidential">
                        </div>
                    </div>
                    <div class="setting-group">
                        <div class="st-title">Saving Rules <button class="btn-reset" onclick="resetSection('out-save')">Reset</button></div>
                        <div class="setting-row">
                            <div class="setting-label">Save Directory</div>
                        </div>
                        <div class="browse-group" style="margin-bottom:15px;">
                            <input type="text" id="inp-save-path" class="st-input" style="flex:1;" value="${userSettings.savePath}" readonly placeholder="Default: Ask every time">
                            <button id="btn-browse-dir" class="btn-browse">Browse...</button>
                            <button id="btn-clear-dir" class="btn-browse" title="Clear"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Filename Template</div>
                            <select data-setting="filenameFmt" class="st-select">
                                <option value="CapSize_{timestamp}" ${userSettings.filenameFmt.includes('timestamp') ? 'selected' : ''}>CapSize_Date_Time.png</option>
                                <option value="Measurement_{seq}" ${userSettings.filenameFmt.includes('seq') ? 'selected' : ''}>Measurement_001.png</option>
                            </select>
                        </div>
                         <div class="setting-row">
                            <div class="setting-label">Auto-Copy on Snap</div>
                            <label class="toggle"><input type="checkbox" data-setting="autoClipboard" ${userSettings.autoClipboard ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                    </div>
                </div>

                <div id="guide-basic" class="tab-pane">
                    <div class="setting-group">
                        <div class="st-title">1. Capture Modes</div>
                        <div class="g-grid">

<div class="g-item">
                                <strong><i class="fa-solid fa-expand"></i> Fullscreen Mode (Region)</strong>
                                Switches to a full canvas. Click and drag anywhere on screen to create a snap box instantly.
                                <br><span style="color:#888;">Best for: Quick snips, capturing fleeting moments.</span>
                                  </div>
                            <div class="g-item">
                                <strong><i class="fa-regular fa-window-maximize"></i> Window Mode (Precision)</strong>
                                Use the floating frame as a viewfinder. Resize it over the content you want to capture, or type exact pixels (e.g., 800x600) in the header.
                                <br><span style="color:#888;">Best for: Specific dimensions, website headers, UI design.</span>
                                                   
                            </div>
                        </div>
                    </div>
                    <div class="setting-group">
                        <div class="st-title">2. Import & Export</div>
                        <div class="g-grid">
                            <div class="g-item">
                                <strong><i class="fa-solid fa-file-import"></i> Importing Images</strong>
                                Drag & Drop an image file anywhere onto the app window, or press <span style="color:var(--accent);">Ctrl+V</span> to paste an image from your clipboard.
                            </div>
                            <div class="g-item">
                                <strong><i class="fa-solid fa-hand-holding-hand" style="color:#00bcd4"></i> Drag-to-Share</strong>
                                Click and <span style="color:var(--accent);">Hold</span> the blue hands button in the header. Drag your finished image directly into other applications, emails, documents, or your Desktop.
                            </div>
                        </div>
                    </div>
                </div>

                <div id="guide-draw" class="tab-pane">
                    <div class="setting-group">
                        <div class="st-title">Primary Tools</div>
                        <div class="g-grid">
                            <div class="g-item">
                                <strong><i class="fa-solid fa-arrow-pointer"></i> Selection</strong>
                                Click any shape to select it. Drag handles to resize or rotate.
                                <br><span style="color:var(--accent);">Shift + Drag:</span> Constrains the shape (perfect circle or square).

<br><span style="color:var(--accent);">Shift + Rotate:</span> Snaps rotation to 15° steps.
                            </div>
                            <div class="g-item">
                                <strong><i class="fa-solid fa-pen"></i> Pen</strong>
                                Smooth, freehand drawing. Scroll your mouse wheel to adjust thickness on the fly.
                            </div>
                            <div class="g-item">
                                <strong><i class="fa-solid fa-slash"></i> Line / Highlighter</strong>
                                <span style="color:var(--accent);">Right-Click</span> the icon to toggle Highlighter mode (transparent yellow).
                                <br><span style="color:var(--accent);">Curve:</span> Double-click the middle handle of a selected line to bend it.
                            </div>
                            <div class="g-item">
    <strong><i class="fa-solid fa-arrow-right-long"></i> Smart Arrow</strong>
    <span style="color:var(--accent);">Right-Click</span> the icon to choose styles (Dot, V, Hand-drawn).
    <br><span style="color:var(--accent);">Curve:</span> Double-click center handle to bend arrow.
                                <br><span style="color:var(--accent);">Hotkeys:</span> Press <span style="color:var(--accent);">A</span> repeatedly to cycle styles.
                            </div>
                        </div>
                    </div>

                    <div class="setting-group">
                        <div class="st-title">Shapes & Text</div>
                        <div class="g-grid">
                            <div class="g-item">
    <strong><i class="fa-regular fa-square"></i> Shapes</strong>
    <span style="color:var(--accent);">Right-Click</span> the Star/Polygon tool to change shape types.
    <br><span style="color:var(--accent);">Double-Click</span> any shape tool to toggle Solid Fill.
    <br><span style="color:var(--accent);">Radius:</span> When drawing a square, use the floating bubble slider to adjust corner roundness.
</div>
                            <div class="g-item">
    <strong><i class="fa-solid fa-font"></i> Text</strong>
    Click to type. Supports standard <span style="color:var(--accent);">Spell Check</span>.
    <br><span style="color:var(--accent);">Fix:</span> Right-click red underlined text to correct spelling.
    <br><span style="color:var(--accent);">Edit:</span> Double-click existing text on canvas to modify it.
</div>
                            <div class="g-item">
                                <strong><i class="fa-solid fa-eraser"></i> Eraser Modes</strong>
                                <span style="color:var(--accent);">Double-Click</span> the eraser to switch between "Brush Eraser" (pixels) and "Object Eraser" (deletes entire shapes).
                            </div>
                        </div>
                    </div>
                   
                    <div class="setting-group">
                        <div class="st-title">Precision & Snapping</div>
                        <div class="g-grid">
                            <div class="g-item">
                                <strong><i class="fa-solid fa-magnet"></i> Grid-Aware Guides</strong>
                                When the grid is visible, magenta Smart Guides will help you align objects to the center, edges, and other shapes simultaneously with the background grid.
                            </div>
                            <div class="g-item">
                                <strong><i class="fa-solid fa-border-all"></i> Snap to Grid</strong>
                                Forces all drawing and resizing to lock to the background grid.
                                <br><span style="color:#aaa; font-style:italic;">Note: Enabling this automatically disables Smart Guides to prevent conflicts.</span>
                          </div>
                            <div class="g-item">
                                <strong><i class="fa-solid fa-arrows-up-down-left-right"></i> Pixel Nudge</strong>
                                Select any shape and use your <span style="color:var(--accent);">Arrow Keys</span> to move it 1px.
                                <br>Hold <span style="color:var(--accent);">Shift</span> + Arrow to jump 10px at a time.
                            </div>
                        </div>
                    </div>

                </div>

                <div id="guide-power" class="tab-pane">
                    <div class="setting-group">
                        <div class="st-title">Toolbox</div>
                        <div class="g-grid">
                            <div class="g-item">
                                <strong><i class="fa-solid fa-file-lines"></i> OCR Text Scanner</strong>
                                1. Snap your screen.<br>
                                2. Select OCR tool.<br>
                                3. Drag a box around text to copy it to your clipboard.
                            </div>
                            <div class="g-item">
                                <strong><i class="fa-solid fa-eye-slash"></i> Privacy Blur</strong>
                                1. Snap your screen.<br>
                                2. Drag a box over sensitive info (emails, passwords, faces).<br>
                                <span>The area will be permanently blurred using a secure pixel-scramble filter.</span>
                            </div>

                            <div class="g-item">
                                <strong><i class="fa-solid fa-magnifying-glass-plus"></i> Precision Magnifier</strong>
                                 
                                1. Snap your screen.<br>
2. Activate from the toolbox to inspect pixels.<br>
</span> 3. Click to place a magnified lens onto your canvas.
<span style="color:var(--accent);">Scroll:</span> Resize the lens.<br> 
<span style="color:var(--accent);">Ctrl + Scroll:</span> Change the zoom power.</span>
                            </div>
                            <div class="g-item">
                                <strong><i class="fa-solid fa-eye-dropper"></i> Smart Eyedropper</strong>
                                1. Snap your screen.<br>
2. Sample colors directly from your snap.<br>
The syringe cursor fills with the selected color and animates when you sample.
                            </div>
                            <div class="g-item">
                                <strong><i class="fa-solid fa-list-ol"></i> Counter Stamps</strong>
                                Click to place auto-incrementing numbers (1, 2, 3) or letters (A, B, C / a, b, c).
                                <br><span style="color:var(--accent);">Controls:</span> Use the floating bubble to reset the counter or switch modes.
                            </div>                          
                        </div>
                    </div>
                    <div class="setting-group">
                        <div class="st-title">Style Presets</div>
                        <div class="g-grid">
                            <div class="g-item">
                                <strong>Saving a Style</strong>
                                Setup your perfect tool (Color + Size + Opacity). Open the Color Picker. 
                                <span style="color:var(--accent);">Right-Click</span> any of the small numbered slots to save.
                            </div>
                            <div class="g-item">
                                <strong>Loading a Style</strong>
                                Press <span class="k-badge">Ctrl</span> + <span class="k-badge">1</span> through <span class="k-badge">9</span> while drawing to instantly switch to that preset.
                            </div>
                        </div>
                    </div>
                </div>
                
                <div id="guide-hotkeys" class="tab-pane">
                    <div class="g-title" style="margin-top: 0;">Essential Shortcuts</div>
                    <div class="g-grid" style="margin-bottom: 25px; grid-template-columns: repeat(3, 1fr);">
         <div class="g-item"><strong><span class="k-badge">ALT</span></strong>Hold to see Cheat Sheet</div>
         <div class="g-item"><strong><span class="k-badge">Ctrl</span>+<span class="k-badge">Z</span></strong>Undo</div>
         <div class="g-item"><strong><span class="k-badge">Ctrl</span>+<span class="k-badge">Y</span></strong>Redo</div>
         <div class="g-item"><strong><span class="k-badge">Ctrl</span>+<span class="k-badge">S</span></strong>Save to File</div>
         
         <div class="g-item"><strong><span class="k-badge">Ctrl</span>+<span class="k-badge">C</span></strong>Copy Shape</div>
         <div class="g-item"><strong><span class="k-badge">Ctrl</span>+<span class="k-badge">V</span></strong>Paste Shape</div>
         <div class="g-item"><strong><span class="k-badge">Del</span></strong>Delete Shape</div>

         <div class="g-item"><strong><span class="k-badge">P</span></strong>Pen Tool</div>
         <div class="g-item"><strong><span class="k-badge">L</span></strong>Line / Highlighter</div>
         <div class="g-item"><strong><span class="k-badge">A</span></strong>Arrows (Cycle)</div>
         
         <div class="g-item"><strong><span class="k-badge">S</span></strong>Square</div>
         <div class="g-item"><strong><span class="k-badge">G</span></strong>Polygon Shapes (Cycle)</div>
         <div class="g-item"><strong><span class="k-badge">T</span></strong>Text</div>
         
         <div class="g-item"><strong><span class="k-badge">E</span></strong>Eraser</div>
         <div class="g-item"><strong><span class="k-badge">U</span></strong>Tools (Cycle)</div>
         <div class="g-item"><strong><span class="k-badge">M</span></strong>Stamp Tool</div>

         <div class="g-item"><strong><span class="k-badge">O</span></strong>OCR Scanner</div>
         <div class="g-item"><strong><span class="k-badge">I</span></strong>Eyedropper</div>
         <div class="g-item"><strong><span class="k-badge">B</span></strong>Blur Tool</div>
         
         <div class="g-item"><strong><span class="k-badge">Ctrl</span>+<span class="k-badge">R</span></strong> Reset Stamp</div>
         <div class="g-item"><strong><span class="k-badge">Z</span></strong> Magnifier Tool</div>
    </div>

                    <div class="setting-group">
                        <div class="st-title">Pro Manipulation</div>
                        <div class="setting-row" style="justify-content: flex-start; gap: 15px;">
                            <div style="font-size: 14px; color: var(--accent); width: 100px; text-align: center;"><span class="k-badge">Scroll</span></div>
                            <div class="setting-label">Resize Tool <div class="setting-desc">Hover canvas and scroll to change line width or text size.</div></div>
                        </div>
                        <div class="setting-row" style="justify-content: flex-start; gap: 15px;">
                            <div style="font-size: 14px; color: var(--accent); width: 100px; text-align: center;"><span class="k-badge">Shift</span>+<span class="k-badge">Scroll</span></div>
                            <div class="setting-label">Opacity <div class="setting-desc">Hold Shift while scrolling to change transparency.</div></div>
                        </div>
                        <div class="setting-row" style="justify-content: flex-start; gap: 15px;">
                            <div style="font-size: 14px; color: var(--accent); width: 100px; text-align: center;"><span class="k-badge">Arrows</span></div>
                            <div class="setting-label">Precision Nudge <div class="setting-desc">Move selected shape 1px. Hold Shift for 10px.</div></div>
                        </div>
                         <div class="setting-row" style="justify-content: flex-start; gap: 15px;">
                            <div style="font-size: 14px; color: var(--accent); width: 100px; text-align: center;"><span class="k-badge">[</span> / <span class="k-badge">]</span></div>
                            <div class="setting-label">Layer Order <div class="setting-desc">Send shape backward or bring forward.</div></div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
</div>
`;

const wizardHtml = `
<div id="onboarding-wizard">
    <div class="wizard-content">
        <div class="wizard-header">
            <h2><i class="fa-solid fa-lightbulb"></i> Quick Setup</h2>
            <span id="wiz-step-info" style="color: #ccc; font-size: 14px;">Step 1 of 6</span>
        </div>
        <div class="wizard-body">
            <div id="wiz-page-1" class="wizard-page active">
                <div class="wiz-page-title">Hello!</div>
                <div class="wiz-page-content">
                    <p>Let's take 30 seconds to configure CapSize to match your workflow.</p>
                    <p>We will set your preferred hotkey, startup behavior, and visual preferences. You can change these later in the <i class="fa-solid fa-gear"></i> Settings menu.</p>
                </div>
            </div>

            <div id="wiz-page-2" class="wizard-page">
                <div class="wiz-page-title">1. On/Off Switch</div>
                <div class="wiz-page-content">
                    <p>Choose a global hotkey to instantly toggle CapSize on and off. When the app is hidden, pressing this key will freeze your screen and bring up the capture tools.</p>
                    <div class="setting-row" style="margin-top: 20px;">
                        <div class="setting-label">Global Hotkey <div class="setting-desc">e.g., F12, PrintScreen, or Ctrl+Space</div></div>
                        <input type="text" data-setting="globalHotkey" class="st-input" value="${userSettings.globalHotkey}" placeholder="PrintScreen" id="wiz-hotkey-input">
                    </div>
                    <p style="margin-top: 15px;">Current Key: <strong id="wiz-hotkey-display" style="color:var(--accent)">${userSettings.globalHotkey}</strong></p>
                </div>
            </div>

            <div id="wiz-page-3" class="wizard-page">
                <div class="wiz-page-title">2. Startup Style</div>
                <div class="wiz-page-content">
                    <p>How should the app look when you first launch it?</p>
                    
                    <ul style="list-style: none; padding-left: 0; margin-bottom: 20px;">
                        <li style="margin-bottom: 15px;">
                            <strong style="color:var(--accent); display:block; margin-bottom: 5px;">Fullscreen Region (Default):</strong>
                            Lets you click and drag to highlight a region on the fly. Best for quick, free-form snaps.
                        </li>
                        <li style="margin-bottom: 15px;">
                            <strong style="color:var(--accent); display:block; margin-bottom: 5px;">Standard Window:</strong>
                            Opens a floating frame. Best for capturing specific dimensions (e.g., 800x600) or editing existing images.
                        </li>
                    </ul>

                    <div class="setting-row" style="margin-top: 20px;">
                        <div class="setting-label">Start in Fullscreen</div>
                        <label class="toggle"><input type="checkbox" data-setting="startFullscreen" ${userSettings.startFullscreen ? 'checked' : ''}><span class="slider"></span></label>
                    </div>
                </div>
            </div>
            
            <div id="wiz-page-4" class="wizard-page">
                <div class="wiz-page-title">3. Visibility & Focus</div>
                <div class="wiz-page-content">
                    <p>Customize how the window behaves while you are working.</p>
                    
                    <div class="setting-row" style="margin-top: 15px;">
                        <div class="setting-label">Always On Top <div class="setting-desc">Keep the toolbar floating above all other windows.</div></div>
                        <label class="toggle"><input type="checkbox" data-setting="alwaysOnTop" ${userSettings.alwaysOnTop ? 'checked' : ''}><span class="slider"></span></label>
                    </div>
                    <div class="setting-row">
                        <div class="setting-label">Live Measurements <div class="setting-desc">Show pixel dimensions (W/H) next to your cursor.</div></div>
                        <label class="toggle"><input type="checkbox" data-setting="showMeasurements" ${userSettings.showMeasurements ? 'checked' : ''}><span class="slider"></span></label>
                    </div>
                    <div class="setting-row">
                        <div class="setting-label">Immersive Mode <div class="setting-desc">Hide the resize handles and dashed border while drawing.</div></div>
                        <label class="toggle"><input type="checkbox" data-setting="immersiveMode" ${userSettings.immersiveMode ? 'checked' : ''}><span class="slider"></span></label>
                    </div>
                </div>
            </div>

            <div id="wiz-page-save" class="wizard-page">
                <div class="wiz-page-title">4. Output & Saving</div>
                <div class="wiz-page-content">
                    <p>Where should your captures go? Leave blank to decide every time.</p>
                    
                    <div class="setting-row" style="margin-top: 20px; display:block;">
                        <div class="setting-label" style="margin-bottom:8px;">Default Folder</div>
                        <div class="browse-group" style="display:flex; gap:5px;">
                            <input type="text" id="wiz-save-path" class="st-input" style="flex:1;" value="${userSettings.savePath}" readonly placeholder="Ask every time">
                            <button id="wiz-btn-browse" class="btn-browse">Browse...</button>
                        </div>
                    </div>
                    
                    <div class="setting-row" style="margin-top: 15px;">
                        <div class="setting-label">Auto-Copy to Clipboard <div class="setting-desc">Copy image immediately after snapping.</div></div>
                        <label class="toggle"><input type="checkbox" data-setting="autoClipboard" ${userSettings.autoClipboard ? 'checked' : ''}><span class="slider"></span></label>
                    </div>
                </div>
            </div>

            <div id="wiz-page-5" class="wizard-page">
                <div class="wiz-page-title">All Set!</div>
                <div class="wiz-page-content">
                    <p>You are ready to go. Here is one final <strong>Pro Tip</strong> to speed up your work:</p>
                    
                    <ul style="margin-bottom: 15px; list-style: none; padding-left: 0;">
                        <li style="margin-bottom: 15px;">
                            <strong style="color:var(--accent); display:block; margin-bottom: 5px;">Style Presets:</strong> 
                            Right-Click any color swatch in the Settings menu to <strong>Save</strong> your current style (Color + Size + Opacity).
                            <br>Load them instantly using <span class="wiz-key">Ctrl</span> + <span class="wiz-key">1</span> through <span class="wiz-key">9</span>.
                        </li>
                    </ul>
                    
                    <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #333;">
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; color:#ccc; font-size:13px;">
                            <input type="checkbox" id="wiz-dont-show-check" style="accent-color: var(--accent);"> Do not show this wizard next time
                        </label>
                    </div>
                </div>
            </div>
        </div>
        <div class="wizard-footer">
            <div class="wiz-left">
                <button id="wiz-back" class="ob-btn-sec" disabled>Back</button>
            </div>
            <div class="wiz-right" style="display:flex; gap:10px;">
                <button id="wiz-next" class="ob-btn-pri">Next</button>
                <button id="wiz-finish" class="ob-btn-pri hidden">Finish</button>
            </div>
        </div>
    </div>
</div>
`;
const tempDiv = document.createElement('div');
tempDiv.innerHTML = settingsHtml + wizardHtml;
document.body.appendChild(tempDiv.firstElementChild); // Settings Modal
document.body.appendChild(tempDiv.lastElementChild);  // Onboarding Wizard

// [NEW] Wire up the About Tab Buttons to their functions
setTimeout(() => {
    const btnReplay = document.getElementById('btn-replay-intro');
    if(btnReplay) {
        btnReplay.onclick = () => {
            // Force replay by passing true
            initOnboarding(true); 
            // Close settings so the intro isn't covered
            settingsModal.style.display = 'none';
        };
    }
    
    const btnRunSetup = document.getElementById('btn-run-setup');
    if(btnRunSetup) {
        btnRunSetup.onclick = () => {
            showOnboardingWizard();
            settingsModal.style.display = 'none';
        };
    }
}, 500);

// --- 4. DOM ELEMENTS ---

// --- [NEW] RADIUS BUBBLE (Floating Slider) ---
// [UPDATED] Flattened HTML for horizontal layout
const radiusBubbleHtml = `
<div id="radius-bubble" class="hidden">
    <i class="fa-regular fa-square" style="color:var(--accent); font-size:14px;"></i>
    <span style="font-size:11px; color:#aaa; font-weight:bold; text-transform:uppercase; margin-right:5px;">Radius</span>
    <input type="range" id="radius-bubble-input" min="0" max="50" step="1" style="width:100px;">
    <span id="radius-bubble-val" style="color:var(--accent); font-weight:bold; font-family:'Consolas', monospace; font-size:12px; min-width:30px; text-align:right;">10px</span>
</div>
`;
const rbDiv = document.createElement('div');
rbDiv.innerHTML = radiusBubbleHtml;
document.body.appendChild(rbDiv.firstElementChild);

// Add CSS for the bubble
const rbStyle = document.createElement('style');
// [UPDATED] CSS for horizontal layout, lifted higher to clear FS Toolbar
rbStyle.innerHTML = `
    #radius-bubble {
        position: fixed; 
        bottom: 80px;       /* [FIX 4] Lowered by 20px */
        left: 50%; 
        transform: translateX(-50%); 
        background: #1e1e1e; 
        border: 1px solid var(--accent); 
        border-radius: 20px; 
        padding: 6px 15px;   
        display: flex; 
        flex-direction: row; 
        align-items: center; 
        gap: 10px;           
        box-shadow: 0 5px 20px rgba(0,0,0,0.6); 
        z-index: 50000;      /* [FIX 3] Lower than Settings Modal (60000) */
        transition: opacity 0.2s, transform 0.2s;
    }
    #radius-bubble.hidden { display: none !important; }
    #radius-bubble:hover { transform: translateX(-50%) translateY(-2px); }
`;
document.head.appendChild(rbStyle);

// Get References
const radiusBubble = document.getElementById('radius-bubble');
const radiusInput = document.getElementById('radius-bubble-input');
const radiusVal = document.getElementById('radius-bubble-val');

// Logic to Update Bubble UI
function updateRadiusBubbleUI() {
    if (!radiusBubble) return;
    
    // Only show if Tool is SQUARE and Style is ROUND
    if (tool === 'square' && userSettings.cornerStyle === 'round') {
        radiusBubble.classList.remove('hidden');
        radiusInput.value = userSettings.cornerRadius || 10;
        radiusVal.innerText = (userSettings.cornerRadius || 10) + 'px';
    } else {
        radiusBubble.classList.add('hidden');
    }
}

// Logic to Handle Slider Change
if (radiusInput) {
    radiusInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        userSettings.cornerRadius = val;
        radiusVal.innerText = val + 'px';
        
        // Sync with Settings Menu Slider (if it exists)
        const settingsSlider = document.querySelector('input[data-setting="cornerRadius"]');
        if(settingsSlider) {
             settingsSlider.value = val;
             // Update the settings label text too if possible
             const lbl = document.getElementById('lbl-radius'); // If you gave it an ID in previous steps
             if(lbl) lbl.innerText = val; 
        }

        saveSettings();
        renderMain(); // Live update canvas
    });
}

const measureTip = document.createElement('div');
measureTip.className = 'measure-tooltip';
document.body.appendChild(measureTip);

function updateMeasureTooltip(x, y, text) {
    if (!userSettings.showMeasurements) {
        measureTip.style.display = 'none';
        return;
    }
    measureTip.style.display = 'block';
    measureTip.style.left = x + 'px';
    measureTip.style.top = y + 'px';
    measureTip.innerHTML = text;
}

function hideMeasureTooltip() {
    measureTip.style.display = 'none';
}

const canvas = document.getElementById('canvas'); const ctx = canvas.getContext('2d'); 
const frame = document.getElementById('frame'); const textLayer = document.getElementById('text-layer');
const cursorDot = document.getElementById('cursor-dot'); 

const fontFam = document.getElementById('font-family');
const btnBold = document.getElementById('btn-bold'); const btnItalic = document.getElementById('btn-italic');
const sizeSl = document.getElementById('size-sl'); const opacitySl = document.getElementById('opacity-sl');
const btnMultishape = document.getElementById('btn-multishape');
const gridToggle = document.getElementById('grid-toggle'); const shapeMenu = document.getElementById('shape-menu');
const sizeDot = document.getElementById('size-dot');

const fbFontFam = document.getElementById('fb-font-family');
const fbBtnBold = document.getElementById('fb-btn-bold'); const fbBtnItalic = document.getElementById('fb-btn-italic');
const fbSizeSl = document.getElementById('fb-size-sl'); const fbOpacitySl = document.getElementById('fb-opacity-sl');
const fbBtnMultishape = document.getElementById('fb-btn-multishape');
const fbGridToggle = document.getElementById('fb-grid-toggle'); const fbShapeMenu = document.getElementById('fb-shape-menu');
const fbSizeDot = document.getElementById('fb-size-dot');

const settingsPanel = document.querySelector('.settings'); 
const winResizeGrip = document.getElementById('window-resize-grip');
const btnClose = document.getElementById('btn-close'); const btnMin = document.getElementById('btn-min'); const btnMax = document.getElementById('btn-max');
// [REVERTED] Standard Inputs Logic
const inpW = document.getElementById('inp-w'); 
const inpH = document.getElementById('inp-h');

// Function to update inputs safely
function setInputValues(width, height) {
    if(inpW) inpW.value = width;
    if(inpH) inpH.value = height;
}

// Sync Listeners with Safety Checks
const syncVal = (src, dst) => { if(src && dst) dst.value = src.value; };

// [FIX] Removed floating bar sync logic to prevent ReferenceError 
const btnUndo = document.getElementById('undo'); const btnRedo = document.getElementById('redo');
const btnFullscreen = document.getElementById('btn-fullscreen');
const floatingBar = document.getElementById('floating-bar'); const btnCenter = document.getElementById('btn-center');

// Help/Settings Button logic
const btnSettings = document.getElementById('btn-help'); 
const settingsModal = document.getElementById('settings-modal'); 
const closeSettings = document.getElementById('close-settings');

const colorPopup = document.getElementById('color-popup');
if(colorPopup) {
    document.body.appendChild(colorPopup);
    colorPopup.classList.add('hidden');
}

// [NEW STAMP BUBBLE ELEMENTS]
const stampBubble = document.getElementById('stamp-bubble');
const stampCurrentValue = document.getElementById('stamp-current-value');
const stampModeToggle = document.getElementById('stamp-mode-toggle');
const stampReset = document.getElementById('stamp-reset');

// [NEW WIZARD ELEMENTS]
const onboardingWizard = document.getElementById('onboarding-wizard');
const wizBack = document.getElementById('wiz-back');
const wizNext = document.getElementById('wiz-next');
const wizFinish = document.getElementById('wiz-finish');
const wizPages = [
    document.getElementById('wiz-page-1'),
    document.getElementById('wiz-page-2'),
    document.getElementById('wiz-page-3'),
    document.getElementById('wiz-page-4'),
    document.getElementById('wiz-page-save'), // <--- ADD THIS LINE
    document.getElementById('wiz-page-5')
];
let currentWizardStep = 0;

// Wizard specific settings inputs
const wizHotkeyInput = document.getElementById('wiz-hotkey-input');
const wizHotkeyDisplay = document.getElementById('wiz-hotkey-display');
const wizFinishHotkey = document.getElementById('wiz-finish-hotkey');

// [NEW] MAGNIFIER LENS ELEMENT
const magLens = document.createElement('canvas');
magLens.id = 'magnifier-lens';
// Style injected via JS to keep it self-contained
magLens.style.cssText = `
    position: fixed; pointer-events: none; z-index: 100000;
    border: 3px solid var(--accent); border-radius: 50%;
    overflow: hidden; display: none; 
    /* [FIX] Reverted to normal shadow intensity */
    box-shadow: 0 5px 25px rgba(0,0,0,0.5);
    background: #1e1e1e;
`;
document.body.appendChild(magLens);

let magSize = 200;  // Default Diameter
let magZoom = 2;    // Default Zoom Level (2x)

// --- 5. INJECT EXTRA BUTTONS ---
   function injectTools(container) {
    if (!container) return;
    
    // 1. Create Dotted Button
    const btnDotted = document.createElement('button'); 
    btnDotted.className = 'tool-btn'; 
    btnDotted.title = 'Dotted Line'; 
    btnDotted.innerHTML = '<i class="fa-solid fa-ellipsis"></i>'; 
    btnDotted.dataset.injected = "dotted";
    btnDotted.id = container.id === 'floating-bar' ? 'fb-btn-dotted' : 'btn-dotted';

    // 2. Create Shadow Button
    const btnShadow = document.createElement('button'); 
    btnShadow.className = 'tool-btn'; 
    btnShadow.title = 'Drop Shadow'; 
    btnShadow.innerHTML = '<i class="fa-solid fa-layer-group"></i>'; 
    btnShadow.dataset.injected = "shadow";
    btnShadow.id = container.id === 'floating-bar' ? 'fb-btn-shadow' : 'btn-shadow';

    // 3. Define the Grid Button (The Anchor)
    const gridBtn = container.querySelector('#grid-toggle') || container.querySelector('#fb-grid-toggle');

    // 4. PLACEMENT: Shadow -> Dotted -> Grid
    if (gridBtn) {
        // Inserting before Grid pushes Grid to the right
        gridBtn.before(btnDotted); 
        btnDotted.before(btnShadow); 
    }

    // 5. Handle "Extra Tools" Position (Before Eraser)
    const eraserBtn = container.querySelector('[data-t="eraser"]');
    
    // Check if the dropdown already exists (Floating Bar has it in HTML)
    const existingDropdown = container.querySelector('#fb-tools-dropdown');

    if (container.id === 'floating-bar' && existingDropdown && eraserBtn) {
        // Move the existing dropdown to be before the eraser
        eraserBtn.before(existingDropdown);
    } 
    else if (container.id !== 'floating-bar' && eraserBtn) {
        // Create new dropdown for Footer and insert before eraser
        const dropdownDiv = document.createElement('div');
        dropdownDiv.className = 'dropdown';
        dropdownDiv.id = 'footer-extra-tools';
        dropdownDiv.style.marginRight = '2px'; // Add spacing

        const btnExt = document.createElement('button');
        btnExt.className = 'tool-btn';
        btnExt.id = 'btn-footer-extras';
        btnExt.title = 'Extra Tools';
        btnExt.innerHTML = '<i class="fa-solid fa-toolbox"></i>';

        const menuDiv = document.createElement('div');
        menuDiv.className = 'dropdown-content';
        menuDiv.id = 'footer-extras-menu';
        menuDiv.style.bottom = '40px'; 
        menuDiv.style.left = '-10px';

        const tools = [
            {id: 'btn-ocr', iconClass: 'fa-solid fa-file-lines', title: 'Extract Text (OCR)', t: 'ocr'},
            {id: 'btn-eyedropper', iconClass: 'fa-solid fa-eye-dropper', title: 'Color Picker', t: 'eyedropper'}, 
            {id: 'btn-stamp', iconClass: 'fa-solid fa-list-ol', title: 'Stamp (Right-Click to Reset)', t: 'stamp'},
            // [FIX] Magnifier moved to be right above Blur
            {id: 'btn-magnifier', iconClass: 'fa-solid fa-magnifying-glass-plus', title: 'Magnifier (Scroll to resize, Shift+Scroll to zoom)', t: 'magnifier'},
            {id: 'btn-blur', iconClass: 'fa-solid fa-eye-slash', title: 'Blur Tool', t: 'blur'}
        ];

        tools.forEach(t => {
            const b = document.createElement('button');
            b.className = 'dropdown-item';
            b.id = t.id; 
            b.title = t.title;
            b.innerHTML = `<i class="${t.iconClass}"></i>`;
            b.dataset.t = t.t; 
            menuDiv.appendChild(b);
        });

        dropdownDiv.appendChild(btnExt);
        dropdownDiv.appendChild(menuDiv);

        // Insert before Eraser
        eraserBtn.before(dropdownDiv);
    }
    
    return { btnDotted, btnShadow };
}
const footerTools = injectTools(document.querySelector('.footer'));
const fbTools = injectTools(document.getElementById('floating-bar'));
if (settingsPanel) { settingsPanel.style.marginLeft = '5px'; settingsPanel.style.marginRight = '15px'; }
const divLine = document.querySelector('.divider'); if(divLine) divLine.remove();

// --- START: Floating Toolbar Brand, Drag & Reset ---
const floatBar = document.getElementById('floating-bar');
if (floatBar && !floatBar.querySelector('.fb-brand-container')) {
    // 1. Create Container
    const brandDiv = document.createElement('div');
    brandDiv.className = 'fb-brand-container';
    brandDiv.style.cssText = `
        display: flex; align-items: center; gap: 6px; margin-right: 8px;
        cursor: grab; -webkit-app-region: no-drag; user-select: none;
    `;
    
// [FIX] Inject Magnifier into Floating Toolbar Menu (Ordered above Blur)
const fbToolsMenu = document.getElementById('fb-tools-menu');
if (fbToolsMenu && !fbToolsMenu.querySelector('[data-t="magnifier"]')) {
    const btn = document.createElement('button');
    btn.className = 'dropdown-item';
    btn.title = 'Magnifier (Scroll to resize, Shift+Scroll to zoom)';
    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass-plus"></i>';
    btn.dataset.t = 'magnifier'; 
    
    // [FIX] Insert specifically before the Blur tool
    const blurBtn = fbToolsMenu.querySelector('[data-t="blur"]');
    if (blurBtn) {
        fbToolsMenu.insertBefore(btn, blurBtn);
    } else {
        fbToolsMenu.appendChild(btn);
    }
}
    // 2. Add Content: Logo + Text + Divider + Reset Button
    brandDiv.innerHTML = `
        <img src="icon.png" style="height:34px; width:auto; pointer-events:none;">
        <span style="font-weight:bold; color:white; font-size:20px; pointer-events:none;">
            Cap<span style="color:var(--accent);">Size</span>
        </span>
        <div class="fb-divider" style="height:16px; margin:0 4px; opacity:0.5;"></div>
        <button id="fb-pos-reset" class="btn-icon" title="Reset Toolbar Position" style="width:24px; height:24px; font-size:12px; color:#888;">
            <i class="fa-solid fa-anchor"></i>
        </button>
    `;
    
    // 3. Insert at the start of the toolbar
    floatBar.prepend(brandDiv);

    // 4. Reset Position Logic
    const resetBtn = brandDiv.querySelector('#fb-pos-reset');
    resetBtn.onmousedown = (e) => e.stopPropagation(); // Prevent drag start when clicking button
    resetBtn.onclick = (e) => {
        e.stopPropagation();
        // Restore default CSS centering
        floatBar.style.transform = 'translateX(-50%)';
        floatBar.style.left = '50%';
        floatBar.style.bottom = '30px';
        floatBar.style.top = 'auto'; // Clear any top offset
        showToast("Toolbar docked to bottom");
    };

    // 5. Custom Drag Logic (Moves Toolbar Only)
    let isDraggingFB = false;
    let fbOffsetX, fbOffsetY;

    brandDiv.onpointerdown = (e) => {
        if(e.target.closest('button')) return; // Ignore clicks on the reset button
        e.preventDefault(); e.stopPropagation();
        
        isDraggingFB = true;
        brandDiv.style.cursor = 'grabbing';
        brandDiv.setPointerCapture(e.pointerId);

        const rect = floatBar.getBoundingClientRect();
        fbOffsetX = e.clientX - rect.left;
        fbOffsetY = e.clientY - rect.top;
        
        // Switch to Absolute Positioning for free movement
        floatBar.style.transform = 'none';
        floatBar.style.bottom = 'auto';
        floatBar.style.left = rect.left + 'px';
        floatBar.style.top = rect.top + 'px';
    };

    brandDiv.onpointermove = (e) => {
        if (!isDraggingFB) return;
        floatBar.style.left = (e.clientX - fbOffsetX) + 'px';
        floatBar.style.top = (e.clientY - fbOffsetY) + 'px';
    };

    brandDiv.onpointerup = (e) => {
        isDraggingFB = false;
        brandDiv.style.cursor = 'grab';
        brandDiv.releasePointerCapture(e.pointerId);
    };
}

// [FIX] Enable Dragging on Main Header Logo (Kept from previous step)
const headerDragStyle = document.createElement('style');
headerDragStyle.innerHTML = `
    .logo-area { -webkit-app-region: drag !important; cursor: default; }
    .logo-area img, .logo-area span { pointer-events: none; }
`;
document.head.appendChild(headerDragStyle);

// --- 6. STATE MANAGEMENT ---

let stampCounterValue = userSettings.stampCount; // Current counter value
let stampMode = userSettings.stampMode; // 'number', 'capital', 'small'
let stampLetterCode = userSettings.stampLetterCode; // Current letter index (0=A/a)

// [FIXED] Initialize default size from settings
let currentStampSize = userSettings.stampDefaultSize; 

// [MODIFIED] Helper to get the next stamp value (Fixes Rotation Bug)
function getNextStampValue() {
    if (stampMode === 'number') {
        return (stampCounterValue++).toString();
    } else if (stampMode === 'capital') {
        // [FIX] Reset count BEFORE calculating if we exceeded bounds
        if (stampLetterCode >= 26) stampLetterCode = 0; 
        const char = String.fromCharCode('A'.charCodeAt(0) + stampLetterCode);
        stampLetterCode++; 
        return char;
    } else if (stampMode === 'small') {
        // [FIX] Reset count BEFORE calculating if we exceeded bounds
        if (stampLetterCode >= 26) stampLetterCode = 0;
        const char = String.fromCharCode('a'.charCodeAt(0) + stampLetterCode);
        stampLetterCode++;
        return char;
    }
    return '1'; 
}

// [NEW] Helper to get the CURRENT stamp value (for display/resetting)
function getCurrentStampValue() {
    if (stampMode === 'number') {
        return stampCounterValue.toString();
    } else if (stampMode === 'capital') {
        return String.fromCharCode('A'.charCodeAt(0) + stampLetterCode);
    } else if (stampMode === 'small') {
        return String.fromCharCode('a'.charCodeAt(0) + stampLetterCode);
    }
    return '1';
}

// [MODIFIED] Function to update the bubble UI (Supports Input Field)
function updateStampBubble(shouldSave = true) {
    if (tool === 'stamp') {
        stampBubble.classList.remove('hidden');
        
        // [FIX] Fetch element dynamically since we replaced the span with an input
        const valEl = document.getElementById('stamp-current-value');
        if (valEl) {
            if (valEl.tagName === 'INPUT') valEl.value = getCurrentStampValue();
            else valEl.innerHTML = getCurrentStampValue(); // Fallback
        }
        
        // Update the mode icon with centered styling
        if (stampMode === 'number') {
            stampModeToggle.innerHTML = '<i class="fa-solid fa-list-ol"></i>';
        } else if (stampMode === 'capital') {
            stampModeToggle.innerHTML = '<span style="font-family:Arial, sans-serif; font-weight:bold; line-height:1;">A</span>';
        } else { 
            stampModeToggle.innerHTML = '<span style="font-family:Arial, sans-serif; font-weight:bold; line-height:1;">a</span>';
        }

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

// [NEW] Function to cycle the stamp mode
function toggleStampMode() {
    if (stampMode === 'number') {
        stampMode = 'capital';
    } else if (stampMode === 'capital') {
        stampMode = 'small';
    } else {
        stampMode = 'number';
    }
    resetStampCounter(false); // Reset the counter for the new mode, do not show toast
    updateStampBubble();
}

// [NEW] Function to reset the counter for the current mode
function resetStampCounter(showMsg = true) {
    if (stampMode === 'number') {
        stampCounterValue = 1;
    } else {
        stampLetterCode = 0;
    }
    updateStampBubble(); // Calls saveSettings internally
    if(showMsg) showToast(`Counter reset to ${getCurrentStampValue()}`);
}

// Attach event listeners to the bubble controls
if (stampModeToggle) stampModeToggle.onclick = toggleStampMode;
if (stampReset) stampReset.onclick = () => resetStampCounter();

let snapLines = [];
let shapes = []; let historyStack = []; let historyIndex = -1; let clipboardShape = null;
let selectedShape = null; activeShape = null; let polygonPoints = [];
let backgroundCanvas = document.createElement('canvas'); let bgCtx = backgroundCanvas.getContext('2d');
let scratchCanvas = document.createElement('canvas'); let scratchCtx = scratchCanvas.getContext('2d');

let shapeLayerCanvas = document.createElement('canvas'); 
let shapeLayerCtx = shapeLayerCanvas.getContext('2d');
let eraserMode = 'brush'; 

let tool = userSettings.startupTool || 'cursor'; 

let isDown = false; let startX, startY; 
let lastClientX = 0; let lastClientY = 0; 

let isDraggingShape = false; let dragOffsetX, dragOffsetY; let dragExOffset, dragEyOffset; 
// [NEW] Curve Control Point Drag Offsets
let dragCpOffsetX, dragCpOffsetY;
let activeTextWrapper = null; let isDraggingText = false; let isDraggingFrame = false;
let isSuppressingResize = false; // [NEW] Flag to suppress unwanted window resize logic
let isHighlighter = false; // [FIXED] Declare flag for Line/Highlighter toggle
let previousColor = userSettings.defaultColor; // [NEW] Remember color before highlighting

// Flag for Region Selection
let isCreatingFrame = false; 

let frameStartX, frameStartY; let draggingHandle = 0; 
let isDotted = false; let isShadow = false;
let isFullscreen = false; let hasSnappedInFullscreen = false;
let fillStates = { square: false, circle: false, star: false, triangle: false, 'x-shape': false, polygon: false, check: false };
let dragStartW, dragStartH; 

// UI CONSTANTS
const MIN_WIN_W = 900; 
const UI_W_OFFSET = 120; 
const UI_H_OFFSET = 110; 
const BORDER_OFFSET = 4;
const HANDLE_RADIUS = 6; 
const MOVE_HANDLE_SIZE = 8; 
const ROTATION_HANDLE_OFFSET = 25;

let preWizardW = 0;
let preWizardH = 0;

let w = userSettings.startupW;
let h = userSettings.startupH;
let dpr = window.devicePixelRatio || 1; 

// [MODIFIED] Use constants derived from new 1000px minimum width in main.js
const requiredW = Math.max(userSettings.startupW + UI_W_OFFSET, 1000);
ipcRenderer.send('resize-window', { width: requiredW, height: h + UI_H_OFFSET });

applySettingsToRuntime();
sizeSl.value = userSettings.defLineWidth;
fbSizeSl.value = userSettings.defLineWidth;


// STARTUP VISIBILITY LOGIC
if (userSettings.startFullscreen) {
    isFullscreen = true;
    document.body.classList.add('fullscreen');
    floatingBar.classList.remove('hidden');
    ipcRenderer.send('force-maximize');
    
    // [FIXED] GHOST FRAME TIMING FIX
    // We wrap the calculation in a timeout to ensure the window has 
    // finished maximizing before we calculate the center coordinates.
    setTimeout(() => {
        const winW = window.innerWidth; 
        const winH = window.innerHeight;
        
        // 1. Determine Ghost Size (Default to saved size or 800x600)
        const ghostW = userSettings.startupW || 800;
        const ghostH = userSettings.startupH || 600;
        
        // 2. Center Calculation
        const cX = (winW - ghostW) / 2;
        const cY = (winH - ghostH) / 2;

        // 3. Force Visibility & Green Dashes
        frame.style.display = 'block'; 
        frame.classList.remove('clean-slate'); 
        frame.classList.remove('immersive-active'); 
        frame.style.border = `2px dashed ${userSettings.accentColor}`; 

        // 4. Apply Position & Size
        frame.style.position = 'absolute';
        frame.style.left = cX + 'px';
        frame.style.top = cY + 'px';
        frame.style.width = ghostW + 'px';
        frame.style.height = ghostH + 'px';
        frame.style.margin = '0'; 

        // 5. Update State
        w = ghostW; h = ghostH; 
        if(inpW) inpW.value = w; 
        if(inpH) inpH.value = h;
        
        updateDPR();
        const innerW = winW * dpr; 
        const innerH = winH * dpr;
        
        // Initialize canvases
        [canvas, backgroundCanvas, scratchCanvas, shapeLayerCanvas].forEach(c => { c.width = innerW; c.height = innerH; });
        [ctx, bgCtx, scratchCtx, shapeLayerCtx].forEach(c => { c.scale(dpr, dpr); c.lineCap = userSettings.cornerStyle; c.lineJoin = userSettings.cornerStyle; });

        // 6. Force Tool to Cursor
        tool = 'cursor';
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        const cursorBtn = document.querySelector('.tool-btn[data-t="cursor"]');
        if(cursorBtn) cursorBtn.classList.add('active');
            
    }, 100); 
}

setTimeout(() => {
    ipcRenderer.send('renderer-ready-to-show');
    
    // Check 1: Has the full Intro Tour been shown? (introComplete)
    if (!userSettings.introComplete) {
        initOnboarding(); // Show the multi-page Introduction Tour
    } 
    // Check 2: If the Intro is done, has the Quick Setup Wizard been dismissed? (onboardingComplete)
    else if (!userSettings.onboardingComplete) {
        // [FIXED] Force save settings now to ensure all defaults are persisted 
        // before the showOnboardingWizard attempts to modify and save
        saveSettings(); 
        showOnboardingWizard(); // Show the Quick Setup Wizard
    }
}, 50);

setTimeout(() => {
    document.querySelectorAll('.tool-btn').forEach(b => { 
        if(b.dataset.t === tool) b.classList.add('active');
        else if(b.dataset.t) b.classList.remove('active');
    });
    // [NEW] Initial Stamp Bubble Update
    updateStampBubble();
}, 100);

// --- 7. INITIALIZATION & RESIZE ---

// [NEW] FIRST RUN LOGIC
// If intro is NOT complete, override any saved settings to ensure the Wizard fits.
// renderer.js (Replacement for FIRST RUN LOGIC block)

// Ensure w and h always start with the user's last saved startup setting.
// The wizard size overrides will now be handled ONLY within initOnboarding/showOnboardingWizard.
w = userSettings.startupW; 
h = userSettings.startupH;

// Initialization now handled inside the startup visibility setTimeout/logic block.
// We must ensure the inputs are updated to reflect the true setting value immediately
// before the window is resized.
if(inpW) inpW.value = w;
if(inpH) inpH.value = h;

// Calculate total requested window size including UI chrome
// renderer.js (Replacement for Startup Logic)

// Calculate total requested window size including UI chrome
const totalWidth = w + UI_W_OFFSET;
const totalHeight = h + UI_H_OFFSET;

if (!userSettings.startFullscreen) {
    // CRITICAL FIX: Temporarily suppress resizing during startup to ensure initCanvas 
    // forces the user's size (w, h) and is not overwritten by the window size (890).
    isSuppressingResize = true; 
    
    // Request the resize. main.js will clamp this.
    ipcRenderer.send('resize-window', { width: totalWidth, height: totalHeight });

    // Center immediately
    ipcRenderer.send('center-window');
    
    // Schedule canvas initialization and unblock resizing
    setTimeout(() => {
        initCanvas();
        isSuppressingResize = false;
    }, 100); 
} else {
    // If starting fullscreen, still need a tiny delay for initCanvas
    setTimeout(initCanvas, 100);
}

function initCanvas() {
    inpW.value = w; inpH.value = h;
    updateDPR();
    
    // [FIXED] Force canvas to be sized based on the user setting (w, h)
    const innerW = (w - BORDER_OFFSET) * dpr; 
    const innerH = (h - BORDER_OFFSET) * dpr;
    
    [canvas, backgroundCanvas, scratchCanvas, shapeLayerCanvas].forEach(c => { c.width = innerW; c.height = innerH; });
    [ctx, bgCtx, scratchCtx, shapeLayerCtx].forEach(c => { c.scale(dpr, dpr); c.lineCap = userSettings.cornerStyle; c.lineJoin = userSettings.cornerStyle; });
    
    // Set frame dimensions based on user setting (w, h)
    frame.style.width = w + 'px'; 
    frame.style.height = h + 'px';
    
    // CRITICAL: Ensure the frame is centered if the window is wider than the frame.
    // This is the core fix for the "770px wide canvas" issue.
    // The margin is calculated relative to the full window width (100% of parent).
    frame.style.margin = '0 auto'; 

    saveState(); 
}
function updateDPR() { dpr = window.devicePixelRatio || 1; }
// renderer.js (Replacement)
// Initialization now handled inside the startup visibility setTimeout/logic block.

function resetFramePosition() { 
    frame.style.position = ''; 
    frame.style.left = ''; 
    frame.style.top = ''; 
    frame.style.transform = ''; 
    // [FIXED] Ensure margin is explicitly cleared when position is reset
    frame.style.margin = '0'; 
    frame.parentElement.style.justifyContent = 'center'; 
    frame.parentElement.style.alignItems = 'center'; 
}

function updateCanvasSize(newW, newH, keepPosition = false) {
    // [FIXED] Reverted to standard integer rounding.
    // We strictly match the requested size to ensure 1:1 pixel mapping.
    w = Math.round(newW);
    h = Math.round(newH);

    updateDPR();

    const savedBg = document.createElement('canvas'); 
    savedBg.width = canvas.width; savedBg.height = canvas.height; 
    
    if (backgroundCanvas.width > 0 && backgroundCanvas.height > 0) {
        savedBg.getContext('2d').drawImage(backgroundCanvas, 0, 0);
    }
    
    setInputValues(w, h); 
    
    const offset = isFullscreen ? 0 : BORDER_OFFSET; 
    const innerW = (w - offset) * dpr; const innerH = (h - offset) * dpr;
    
    [canvas, backgroundCanvas, scratchCanvas, shapeLayerCanvas].forEach(c => { c.width = innerW; c.height = innerH; });
    [ctx, bgCtx, scratchCtx, shapeLayerCtx].forEach(c => { c.scale(dpr, dpr); c.lineCap = userSettings.cornerStyle; c.lineJoin = userSettings.cornerStyle; });
    
    frame.style.width = w + 'px'; 
    frame.style.height = h + 'px'; 
    frame.style.margin = '0 auto'; 

    if (!keepPosition && !frame.style.left) { resetFramePosition(); }
    
    bgCtx.save(); bgCtx.setTransform(1, 0, 0, 1, 0, 0); 
    if (savedBg.width > 0 && savedBg.height > 0) {
        bgCtx.drawImage(savedBg, 0, 0);
    }
    bgCtx.restore();

    // [FIXED] Sync Grid Visuals (Green Crosshair to Centered, Gray Grid to 0,0)
    const gridEl = document.getElementById('grid');
    if (gridEl) {
        const s = parseInt(userSettings.gridSize) || 20; 
        
        // 1. Calculate raw center
        const rawCX = w / 2;
        const rawCY = h / 2;

        // 2. Snap center to nearest grid line
        const cX = Math.round(rawCX / s) * s;
        const cY = Math.round(rawCY / s) * s;
        
        // Green lines follow snapped center. Gray lines stay at 0 0.
        gridEl.style.backgroundPosition = `${cX}px 0, 0 ${cY}px, 0 0, 0 0`;
    }
    
    updateStyle(); renderMain();
}

// [POLISHED] Optimized Resize Listener (Standard Behavior)
let resizeTimer;
window.addEventListener('resize', () => { 
    // 1. Calculate live dimensions immediately
    let newW = window.innerWidth - 120; // UI_W_OFFSET
    let newH = window.innerHeight - 110; // UI_H_OFFSET
    
    // Force dimensions to be Even Numbers to prevent sub-pixel drift
    newW = Math.floor(newW / 2) * 2;
    newH = Math.floor(newH / 2) * 2;

    if (newW < 50) newW = 50; 
    if (newH < 50) newH = 50;

    // [FIX] Restore Tooltip Logic, but GUARD it with the drag flag.
    // This ensures it only shows when you are physically resizing, not on app launch.
    if (typeof measureTip !== 'undefined' && userSettings.showMeasurements && winResizeGrip.isDragging) {
        const tipX = (window.innerWidth / 2) - 60; 
        const tipY = (window.innerHeight / 2) + 40;
        
        measureTip.style.display = 'block';
        measureTip.style.left = tipX + 'px';
        measureTip.style.top = tipY + 'px';
        measureTip.innerHTML = `<span>W:</span> ${Math.round(newW)}px  <span>H:</span> ${Math.round(newH)}px`;
    }

    if (isFullscreen || isSuppressingResize) return; 

    // 2. Update Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height); 

    if (resizeTimer) clearTimeout(resizeTimer);
    
    resizeTimer = setTimeout(() => {
        const WINDOW_FLOOR_W = 820; 
        if (newW <= WINDOW_FLOOR_W && w < newW) {
             newW = w; 
        }
        
        if (w !== newW || h !== newH) {
            updateCanvasSize(newW, newH, true);
        } else {
            renderMain();
        }
        
        // Hide tooltip after a delay when resizing stops
        setTimeout(() => {
            if(measureTip) measureTip.style.display = 'none';
        }, 1500); 
    }, 50); 
});

winResizeGrip.onpointerdown = (e) => { 
    if (isFullscreen) return; 
    e.stopPropagation(); 
    e.preventDefault(); 
    winResizeGrip.setPointerCapture(e.pointerId); 
    
    // [FIX] Set the flag so the resize listener knows we are active
    winResizeGrip.isDragging = true;

    const startX = e.screenX; 
    const startY = e.screenY; 
    const startW = window.outerWidth; 
    const startH = window.outerHeight; 
    
    winResizeGrip.onpointermove = (ev) => { 
        let newWidth = startW + (ev.screenX - startX);
        let newHeight = startH + (ev.screenY - startY);
        
        // Request the resize. The visual tooltip is handled by the 
        // window 'resize' event listener we fixed above.
        ipcRenderer.send('resize-window', { width: newWidth, height: newHeight }); 
    }; 
    
    winResizeGrip.onpointerup = (ev) => { 
        winResizeGrip.releasePointerCapture(ev.pointerId); 
        winResizeGrip.onpointermove = null; 
        winResizeGrip.onpointerup = null; 
        
        // [FIX] Turn off the flag so startup resizes don't trigger the tool
        winResizeGrip.isDragging = false;
        hideMeasureTooltip(); 
    }; 
};

const applyDimensions = () => { 
    if (isFullscreen) return; 
    let reqW = parseInt(inpW.value); let reqH = parseInt(inpH.value); 
    if(isNaN(reqW) || reqW < 50) reqW = 50; if(isNaN(reqH) || reqH < 50) reqH = 50; 
    
    let winW = reqW + UI_W_OFFSET; 
    let winH = reqH + UI_H_OFFSET; 
    
    // [FIX] Suppress the resize listener logic temporarily
    // This ensures the window clamp doesn't immediately overwrite your smaller canvas setting
    isSuppressingResize = true;

    // Update Canvas to exact requested size (even if small)
    updateCanvasSize(reqW, reqH);
    
    // Request window resize. main.js will clamp this to 890px minimum.
    ipcRenderer.send('resize-window', { width: winW, height: winH }); 
    
    // Unblock after window settles
    setTimeout(() => {
        isSuppressingResize = false;
    }, 100);
};
// Wire up Apply button and Enter key
if(document.getElementById('btn-apply')) document.getElementById('btn-apply').onclick = applyDimensions; 

const handleEnter = (e) => { if (e.key === 'Enter') applyDimensions(); };
if(inpW) inpW.addEventListener('keydown', handleEnter); 
if(inpH) inpH.addEventListener('keydown', handleEnter);

// --- 8. CORE RENDER LOOP ---
function renderMain() {
    // 1. Reset Transforms (Critical for Retina/HighDPI)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    shapeLayerCtx.setTransform(1, 0, 0, 1, 0, 0);

    // 2. Clear Screen & Draw Background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (backgroundCanvas.width > 0) {
        ctx.drawImage(backgroundCanvas, 0, 0); 
    }

    // [INTEGRATED] Draw Grid (Only if opacity > 0 AND grid is not hidden)
    const gridEl = document.getElementById('grid');
    const isGridOn = gridEl && !gridEl.classList.contains('hidden');
    if (typeof drawGrid === 'function' && userSettings.gridOpacity > 0.05 && isGridOn) {
        drawGrid(ctx); 
    }

    const shapesToDraw = [...shapes];
    if (activeShape) shapesToDraw.push(activeShape);

    // --- PASS 1: HIGHLIGHTERS (Darken Mode) ---
    // This makes the live ink look just like the saved file
    shapeLayerCtx.clearRect(0, 0, shapeLayerCanvas.width, shapeLayerCanvas.height);
    shapeLayerCtx.save();
    shapeLayerCtx.scale(dpr, dpr); 

    shapesToDraw.forEach(s => {
        if (s.opacity < 1 && s.type !== 'eraser-stroke') {
            shapeLayerCtx.globalCompositeOperation = 'source-over';
            drawShape(shapeLayerCtx, s);
        } else if (s.type === 'eraser-stroke') {
            shapeLayerCtx.globalCompositeOperation = 'destination-out';
            drawShape(shapeLayerCtx, s);
        }
    });
    shapeLayerCtx.restore();

    // Composite with Darken (Keeps black text black)
    ctx.globalCompositeOperation = 'darken';
    ctx.drawImage(shapeLayerCanvas, 0, 0);

    // --- PASS 2: PENS & SHAPES (Normal Mode) ---
    shapeLayerCtx.clearRect(0, 0, shapeLayerCanvas.width, shapeLayerCanvas.height);
    shapeLayerCtx.save();
    shapeLayerCtx.scale(dpr, dpr);

    shapesToDraw.forEach(s => {
        if (s.opacity < 1 && s.type !== 'eraser-stroke') return; 
        
        shapeLayerCtx.globalCompositeOperation = (s.type === 'eraser-stroke') ? 'destination-out' : 'source-over';
        drawShape(shapeLayerCtx, s);
    });
    shapeLayerCtx.restore();

    // Composite normally
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(shapeLayerCanvas, 0, 0);

    // --- PASS 3: UI ELEMENTS ---
    ctx.save();
    ctx.scale(dpr, dpr); // Scale UI to match screen density
    
    // Ghost Polygon
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

    // [INTEGRATED] Smart Guides
    if (typeof snapLines !== 'undefined' && snapLines.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = '#FF00FF';
        ctx.lineWidth = 1;
        ctx.setLineDash([]); 
        snapLines.forEach(l => {
            ctx.moveTo(l.x1, l.y1);
            ctx.lineTo(l.x2, l.y2);
        });
        ctx.stroke();
    }

    if (selectedShape) drawSelectionHandles(ctx, selectedShape);
    ctx.restore();
}

function drawShape(c, s) {
    if (s.type === 'polygon_drag') return; 

    c.save(); 
    c.lineWidth = s.width; 
    c.strokeStyle = s.color; 
    c.fillStyle = s.color; 
    c.globalAlpha = s.opacity || 1;

    // [FIXED] Draw the OCR box if it is the active shape
    if (s.type === 'ocr-selection') {
        c.strokeStyle = '#00ff00'; 
        c.lineWidth = 2; 
        c.setLineDash([5, 5]);
        c.strokeRect(s.x, s.y, s.w, s.h);
        c.fillStyle = 'rgba(0, 255, 0, 0.1)'; 
        c.fillRect(s.x, s.y, s.w, s.h);
        c.restore();
        return; 
    }

    const dashed = s.isDotted; 
    const dashArray = dashed ? [s.width * 2, s.width * 1.5] : [];
    c.setLineDash(dashArray); 
    
    if (dashed) {
        c.lineCap = userSettings.dottedStyle || 'round'; 
        c.lineJoin = userSettings.dottedStyle || 'round';
    } else if (['square', 'triangle', 'polygon', 'check', 'x-shape', 'line', 'star'].includes(s.type)) {
        c.lineJoin = userSettings.cornerStyle; 
        c.lineCap = userSettings.cornerStyle === 'miter' ? 'square' : 'round'; 
        c.miterLimit = 10;
    } else {
        c.lineJoin = 'round'; c.lineCap = 'round';
    }

    // [FIXED] Exclude 'line' from standard shadow. We use composite drawing for lines now to make shadows soft.
    if(s.type !== 'arrow' && s.type !== 'line' && s.type !== 'eraser-stroke') applyShadow(c, s.hasShadow);
    
    if (s.type === 'pen' || s.type === 'polygon' || s.type === 'eraser-stroke') {
        if (s.points && s.points.length > 0) {
            if (s.x !== undefined) c.translate(s.x, s.y);
            c.beginPath();
            if (s.points.length === 1 && s.type !== 'polygon') { c.arc(s.points[0].x, s.points[0].y, s.width / 2, 0, Math.PI * 2); c.fill(); } 
            else {
                c.moveTo(s.points[0].x, s.points[0].y);
                for (let i = 1; i < s.points.length; i++) c.lineTo(s.points[i].x, s.points[i].y);
                if (s.type === 'polygon' && s.isClosed) { c.closePath(); if (s.isSolid) c.fill(); else c.stroke(); } else c.stroke();
            }
        }
    } 
    // [FIXED] Pass control point (s.cp) to drawArrowComposite
    else if (s.type === 'line') {
        drawArrowComposite(c, s.x, s.y, s.ex, s.ey, s.width, s.color, s.hasShadow, s.opacity, (s.isDotted ? [s.width * 2, s.width * 1.5] : []), false, s.cp);
    }
    // [FIXED] Pass control point (s.cp) to drawArrowComposite
    else if (s.type === 'arrow') { 
        drawArrowComposite(c, s.x, s.y, s.ex, s.ey, s.width, s.color, s.hasShadow, s.opacity, (s.isDotted ? [s.width * 2, s.width * 1.5] : []), true, s.cp); 
    } 
    else if (s.type === 'text') { 
        c.font = s.font; 
        c.textBaseline = 'top'; 
        
       // [UPDATED] Text Background Logic
        if (s.isSolid) {
            const m = c.measureText(s.text);
            const h = parseInt(s.font) || 20;
            const pad = 4;
            
            // 1. Get Opacity
            const alpha = userSettings.textOpacity !== undefined ? userSettings.textOpacity : 0.9;
            
            let r, g, b;

            // 2. Determine Color (Auto vs Custom)
            if (userSettings.useAutoTextBg) {
                // AUTO: Calculate high-contrast Black/White
                const hex = s.color.replace('#', '');
                r = parseInt(hex.substring(0,2), 16);
                g = parseInt(hex.substring(2,4), 16);
                b = parseInt(hex.substring(4,6), 16);
                const yiq = ((r*299)+(g*587)+(b*114))/1000;
                
                if (yiq >= 128) { r=0; g=0; b=0; } // Black
                else { r=255; g=255; b=255; }      // White
            } else {
                // CUSTOM: Use user preference
                const customHex = (userSettings.textBgColor || '#000000').replace('#', '');
                r = parseInt(customHex.substring(0,2), 16);
                g = parseInt(customHex.substring(2,4), 16);
                b = parseInt(customHex.substring(4,6), 16);
            }

            // 3. Apply Alpha and Draw
            c.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            
            const rx = s.x - pad;
            const ry = s.y - pad;
            const rw = m.width + (pad*2);
            const rh = h + (pad*2);
            
            c.beginPath();
            if (c.roundRect) c.roundRect(rx, ry, rw, rh, 4);
            else c.rect(rx, ry, rw, rh);
            c.fill();
        }

        c.fillStyle = s.color;
        c.fillText(s.text, s.x, s.y); 
    }
    else if (s.type === 'stamp') {
        const radius = s.w / 2;
        const cx = s.x + radius; const cy = s.y + radius;
        const scale = s.w / 30; 
        
        if (s.ex !== undefined) {
            c.beginPath(); c.moveTo(cx, cy); c.lineTo(s.ex, s.ey);
            c.lineWidth = 2 * scale; c.strokeStyle = s.color; c.stroke();

            const angle = Math.atan2(s.ey - cy, s.ex - cx);
            const headLen = 10 * scale; 
            
            c.beginPath(); c.moveTo(s.ex, s.ey);
            c.lineTo(s.ex - headLen * Math.cos(angle - Math.PI / 6), s.ey - headLen * Math.sin(angle - Math.PI / 6));
            c.lineTo(s.ex - headLen * Math.cos(angle + Math.PI / 6), s.ey - headLen * Math.sin(angle + Math.PI / 6));
            c.fillStyle = s.color; c.fill();
        }
        c.beginPath(); c.arc(cx, cy, radius, 0, Math.PI * 2);
        c.fillStyle = s.color; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2 * scale; c.stroke();
        c.fillStyle = '#fff'; c.font = 'bold ' + (s.w * 0.6) + 'px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s.text, cx, cy + (2 * scale));
    }
    else if (s.type === 'blur') {
        c.save(); c.beginPath(); c.rect(s.x, s.y, s.w, s.h); c.clip();
        c.filter = 'blur(8px)';
        c.drawImage(backgroundCanvas, s.x * dpr, s.y * dpr, s.w * dpr, s.h * dpr, s.x, s.y, s.w, s.h);
        c.filter = 'none'; 
        c.restore();
    }
    // [INTEGRATED] Magnifier Snap Render
    else if (s.type === 'magnifier-snap') {
        c.save();
        c.beginPath();
        c.arc(s.x + s.w/2, s.y + s.h/2, s.w/2, 0, Math.PI * 2);
        c.fillStyle = '#000000'; 
        c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 25; c.shadowOffsetX = 0; c.shadowOffsetY = 5;
        c.fill(); 
        c.restore();

        c.save(); 
        c.beginPath(); c.arc(s.x + s.w/2, s.y + s.h/2, s.w/2, 0, Math.PI * 2); c.clip(); 
        const img = new Image(); img.src = s.imgData;
        if (img.complete) { c.drawImage(img, s.x, s.y, s.w, s.h); } else { img.onload = () => renderMain(); }
        c.restore(); 

        c.save(); c.beginPath(); c.arc(s.x + s.w/2, s.y + s.h/2, s.w/2, 0, Math.PI * 2);
        c.lineWidth = 3; c.strokeStyle = s.color || userSettings.accentColor; c.stroke(); 
        c.restore();
    }
    else {
        if (s.rotation) { 
            const center = getShapeCenter(s); 
            c.translate(center.x, center.y); 
            c.rotate(s.rotation); 
            c.translate(-center.x, -center.y); 
        }
        c.beginPath();
        if (s.type === 'square') { 
            // [UPDATED] Rounded Rectangle Logic
            if (userSettings.cornerStyle === 'round') {
                const radius = userSettings.cornerRadius !== undefined ? userSettings.cornerRadius : 10;
                c.beginPath();
                if (c.roundRect) c.roundRect(s.x, s.y, s.w, s.h, radius);
                else c.rect(s.x, s.y, s.w, s.h); 
                if(s.isSolid) c.fill(); else c.stroke();
            } else {
                if(s.isSolid) c.fillRect(s.x, s.y, s.w, s.h); else c.strokeRect(s.x, s.y, s.w, s.h); 
            }
        } 
        else if (s.type === 'circle') { c.ellipse(s.x + s.w/2, s.y + s.h/2, Math.abs(s.w/2), Math.abs(s.h/2), 0, 0, 2*Math.PI); if(s.isSolid) c.fill(); else c.stroke(); } 
        else if (s.type === 'triangle') { c.moveTo(s.x + s.w/2, s.y); c.lineTo(s.x, s.y + s.h); c.lineTo(s.x + s.w, s.y + s.h); c.closePath(); if(s.isSolid) c.fill(); else c.stroke(); } 
        else if (s.type === 'star') { const cx = s.x + s.w/2; const cy = s.y + s.h/2; const outer = Math.abs(s.w/2); const inner = outer * 0.4; for(let i=0; i<5; i++){ c.lineTo(cx + Math.cos((18 + i*72)/180*Math.PI)*outer, cy - Math.sin((18 + i*72)/180*Math.PI)*outer); c.lineTo(cx + Math.cos((54 + i*72)/180*Math.PI)*inner, cy - Math.sin((54 + i*72)/180*Math.PI)*inner); } c.closePath(); if(s.isSolid) c.fill(); else c.stroke(); } 
        else if (s.type === 'check') { 
            const rx = s.w < 0 ? s.x + s.w : s.x;
            const ry = s.h < 0 ? s.y + s.h : s.y;
            const rw = Math.abs(s.w);
            const rh = Math.abs(s.h);
            c.moveTo(rx + rw * 0.15, ry + rh * 0.55); 
            c.lineTo(rx + rw * 0.40, ry + rh * 0.90); 
            c.lineTo(rx + rw * 0.90, ry + rh * 0.10); 
            c.stroke(); 
        } 
        else if (s.type === 'x-shape') { c.moveTo(s.x, s.y); c.lineTo(s.x+s.w, s.y+s.h); c.moveTo(s.x+s.w, s.y); c.lineTo(s.x, s.y+s.h); c.stroke(); }
    }

    c.restore(); 
}

// [FIXED] Re-enabled shortening for curves using projected docking point to fix poke-through AND separation
function drawArrowComposite(destCtx, x1, y1, x2, y2, width, color, shadow, opacity, dashArray, drawHead = true, cp = null) {
    const sc = scratchCtx; const cv = scratchCanvas; 
    sc.clearRect(0,0,cv.width, cv.height); 
    sc.save(); 
    sc.setTransform(1,0,0,1,0,0); sc.scale(dpr,dpr);
    
    const isDotted = dashArray && dashArray.length > 0;
    const isRoundMode = (isDotted && userSettings.dottedStyle === 'round') || (!isDotted && userSettings.cornerStyle !== 'miter');
    
    let capStyle = isDotted ? (userSettings.dottedStyle === 'butt' ? 'butt' : 'round') : (userSettings.cornerStyle === 'miter' ? 'butt' : 'round');
    let joinStyle = isRoundMode ? 'round' : 'miter';
    
    sc.lineCap = capStyle; 
    sc.lineJoin = joinStyle; 
    sc.lineWidth = width; sc.strokeStyle = color; sc.fillStyle = color; 
    sc.setLineDash(dashArray);
    
    const style = userSettings.arrowStyle || 'triangle';

    // 1. Calculate Tip Angle (Tangent)
    // We need this early to calculate the docking point for the shaft
    let angle;
    if (cp) angle = Math.atan2(y2 - cp.y, x2 - cp.x);
    else angle = Math.atan2(y2-y1, x2-x1); 

    // 2. Calculate Shaft Stop Point (Docking Point)
    let stopX = x2, stopY = y2;
    
    if (drawHead) {
        let headLength;
        if (style === 'v') headLength = width * 4.5;
        else if (style === 'concave' || style === 'curved') headLength = isRoundMode ? width * 5.5 : width * 6.8;
        else if (style === 'hand') headLength = width * 5;
        else headLength = width * 5.5; 

        let shortenBy;
        if (style === 'dot') shortenBy = width / 1.5;
        else if (style === 'v' || style === 'hand') shortenBy = width / 2; 
        else if (style === 'concave' || style === 'curved') shortenBy = headLength * 0.75; 
        else shortenBy = headLength * 0.75; 

        // [FIX] We project the stop point backwards from the tip along the angle.
        // This ensures the shaft ends exactly where the head begins, regardless of curve or straight line.
        stopX = x2 - shortenBy * Math.cos(angle);
        stopY = y2 - shortenBy * Math.sin(angle);
    }
    
    // 3. Draw Shaft
    sc.beginPath(); 
    sc.moveTo(x1, y1); 

    if (cp) {
        // [FIX] Draw curve to the calculated docking point (stopX, stopY)
        sc.quadraticCurveTo(cp.x, cp.y, stopX, stopY);
    } else {
        sc.lineTo(stopX, stopY);
    }
    sc.stroke(); 
    
    // 4. Draw Head
    if (drawHead) {
        sc.beginPath(); sc.setLineDash([]); 
        sc.lineCap = capStyle;
        sc.lineJoin = joinStyle;

        if (style === 'v') {
            const head = width * 4.5;
            sc.moveTo(x2 - head * Math.cos(angle - Math.PI/6), y2 - head * Math.sin(angle - Math.PI/6)); 
            sc.lineTo(x2, y2); 
            sc.lineTo(x2 - head * Math.cos(angle + Math.PI/6), y2 - head * Math.sin(angle + Math.PI/6)); 
            sc.stroke(); 
        } 
        else if (style === 'hand') {
            // [FINAL] "Inward Curve" Marker Style
            const headLen = width * 6.0; 
            sc.lineCap = 'round';
            sc.lineJoin = 'round';
            sc.lineWidth = width * 1.1; // Slight bleed thickness

            const lAngle = angle - Math.PI/5;
            const rAngle = angle + Math.PI/5.5;
            const lx = x2 - headLen * Math.cos(lAngle);
            const ly = y2 - headLen * Math.sin(lAngle);
            const rx = x2 - (headLen * 0.9) * Math.cos(rAngle);
            const ry = y2 - (headLen * 0.9) * Math.sin(rAngle);

            const lCpDist = headLen * 0.6; const lCpAngle = angle - (Math.PI/12); 
            const lCpX = x2 - lCpDist * Math.cos(lCpAngle); const lCpY = y2 - lCpDist * Math.sin(lCpAngle);
            const rCpDist = headLen * 0.6; const rCpAngle = angle + (Math.PI/12); 
            const rCpX = x2 - rCpDist * Math.cos(rCpAngle); const rCpY = y2 - rCpDist * Math.sin(rCpAngle);

            sc.beginPath();
            sc.moveTo(lx, ly); sc.quadraticCurveTo(lCpX, lCpY, x2, y2);
            sc.quadraticCurveTo(rCpX, rCpY, rx, ry);
            sc.stroke();
            sc.lineWidth = width;
        }
        else if (style === 'dot') {
            const rad = Math.max(width * 1.5, 5);
            sc.arc(x2, y2, rad, 0, Math.PI * 2);
            sc.fill();
        } 
        else if (style === 'concave') {
            // [UPDATED] "Double Fletched" - Round Mode Sizing Fix
            let tailAngle;
            if (cp) { tailAngle = Math.atan2(cp.y - y1, cp.x - x1); } else { tailAngle = angle; }

            const head = isRoundMode ? width * 5.5 : width * 7; 
            const spreadAngle = Math.PI / 7.5; 
            const notchFactor = 0.8; 

            // Front Wings
            const rwX = x2 - head * Math.cos(angle - spreadAngle); const rwY = y2 - head * Math.sin(angle - spreadAngle);
            const lwX = x2 - head * Math.cos(angle + spreadAngle); const lwY = y2 - head * Math.sin(angle + spreadAngle);
            const notchX = x2 - (head * notchFactor) * Math.cos(angle); const notchY = y2 - (head * notchFactor) * Math.sin(angle);

            // Front Control Points
            const cpDist = head * 0.6; const cpAngle = spreadAngle * 0.3; 
            const rCpX = x2 - cpDist * Math.cos(angle - cpAngle); const rCpY = y2 - cpDist * Math.sin(angle - cpAngle);
            const lCpX = x2 - cpDist * Math.cos(angle + cpAngle); const lCpY = y2 - cpDist * Math.sin(angle + cpAngle);

            // Tail Arrowhead (Back)
            const tHead = isRoundMode ? width * 5.5 : width * 7; 
            const tSpread = Math.PI / 9; 
            const tNotchDist = (tHead * notchFactor);
            const shiftX = tNotchDist * Math.cos(tailAngle); const shiftY = tNotchDist * Math.sin(tailAngle);
            const tTipX = x1 + shiftX; const tTipY = y1 + shiftY;

            const trwX = tTipX - tHead * Math.cos(tailAngle - tSpread); const trwY = tTipY - tHead * Math.sin(tailAngle - tSpread);
            const tlwX = tTipX - tHead * Math.cos(tailAngle + tSpread); const tlwY = tTipY - tHead * Math.sin(tailAngle + tSpread);
            const tNotchX = tTipX - (tHead * notchFactor) * Math.cos(tailAngle); const tNotchY = tTipY - (tHead * notchFactor) * Math.sin(tailAngle);

            const tCpDist = tHead * 0.6; const tCpAngle = tSpread * 0.3;
            const trCpX = tTipX - tCpDist * Math.cos(tailAngle - tCpAngle); const trCpY = tTipY - tCpDist * Math.sin(tailAngle - tCpAngle);
            const tlCpX = tTipX - tCpDist * Math.cos(tailAngle + tCpAngle); const tlCpY = tTipY - tCpDist * Math.sin(tailAngle + tCpAngle);

            // Draw Main Head
            sc.moveTo(x2, y2); sc.quadraticCurveTo(rCpX, rCpY, rwX, rwY); sc.lineTo(notchX, notchY); 
            sc.lineTo(lwX, lwY); sc.quadraticCurveTo(lCpX, lCpY, x2, y2); 

            // Draw Tail Head
            sc.moveTo(tTipX, tTipY); sc.quadraticCurveTo(trCpX, trCpY, trwX, trwY); 
            sc.lineTo(tNotchX, tNotchY); sc.lineTo(tlwX, tlwY); sc.quadraticCurveTo(tlCpX, tlCpY, tTipX, tTipY); 

            sc.fill();
            if (isRoundMode) sc.stroke();
        }
        else {
            // Standard Triangle
            const head = width * 5.5; 
            const narrowAngle = Math.PI / 7;
            sc.moveTo(x2, y2); 
            sc.lineTo(x2 - head * Math.cos(angle - narrowAngle), y2 - head * Math.sin(angle - narrowAngle)); 
            sc.lineTo(x2 - head * Math.cos(angle + narrowAngle), y2 - head * Math.sin(angle + narrowAngle)); 
            sc.closePath(); 
            sc.fill();
            if (isRoundMode) sc.stroke();
        }
    }
    
    sc.restore();
    destCtx.save(); 
    applyShadow(destCtx, shadow); 
    destCtx.scale(1/dpr, 1/dpr); 
    destCtx.drawImage(cv, 0, 0); 
    destCtx.restore();
}

function drawSelectionHandles(c, s) {
    // [FIX] Immediately exit if Immersive Mode is active (Hides all handles)
    if (userSettings.immersiveMode) return;

    if (s.type === 'polygon_drag' || s.type === 'eraser-stroke' || s.type === 'ocr-selection') return;

    // 1. Text Handles (Specific Dashed Box)
    if (s.type === 'text') {
        c.save(); 
        c.font = s.font; 
        c.textBaseline = 'top';
        const m = c.measureText(s.text); 
        const h = parseInt(s.font) || 20;
        
        c.strokeStyle = userSettings.accentColor; 
        c.setLineDash([4, 4]); 
        c.lineWidth = 1;
        c.strokeRect(s.x - 4, s.y - 4, m.width + 8, h + 8);
        
        drawHandleSquare(c, s.x + m.width + 4, s.y - 4);
        drawHandleSquare(c, s.x - 4, s.y + h / 2);
        c.restore();
        return;
    }

   // 2. Line / Arrow Handles
   if (['line', 'arrow'].includes(s.type)) {
        drawHandleCircle(c, s.x, s.y, userSettings.accentColor);
        
        let h2x = s.ex, h2y = s.ey;
        if (s.type === 'arrow') {
             let angle;
             if (s.cp) {
                 angle = Math.atan2(s.ey - s.cp.y, s.ex - s.cp.x);
             } else {
                 angle = Math.atan2(s.ey - s.y, s.ex - s.x);
             }
             const offset = 15; 
             h2x = s.ex + offset * Math.cos(angle); 
             h2y = s.ey + offset * Math.sin(angle); 
        }
        
        drawHandleCircle(c, h2x, h2y, userSettings.accentColor);
        
        // [FIXED] Middle Handle Logic: Toggle between Move (Circle) and Bend (Square)
        let cx, cy;
        if (s.cp) {
            cx = s.cp.x; cy = s.cp.y;
        } else {
            cx = (s.x + s.ex) / 2; cy = (s.y + s.ey) / 2;
        }
        
        if (s.curveMode) {
            // ORANGE SQUARE (Bend Mode)
            c.beginPath();
            c.rect(cx - 5, cy - 5, 10, 10);
            c.fillStyle = '#ffcc00'; c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke();
        } else {
            // WHITE CIRCLE (Move Mode - Standard)
            drawHandleCircle(c, cx, cy, userSettings.accentColor);
        }
        
        return;
    }

    // 3. Pen / Polygon Handles
    if (['pen', 'polygon'].includes(s.type)) {
        const b = getBoundingBox(s);
        drawHandleSquare(c, b.x + b.w / 2, b.y + b.h / 2);
        if (s.type === 'polygon') {
            s.points.forEach((pt) => {
                drawHandleCircle(c, s.x + pt.x, s.y + pt.y, userSettings.accentColor);
            });
        }
        return;
    }

    // 4. Standard Shapes (Rotatable) - The Fallback
    c.save();
    const center = getShapeCenter(s);
    c.translate(center.x, center.y);
    c.rotate(s.rotation || 0);

    const halfW = s.w / 2;
    const halfH = s.h / 2;
    const handleY = (s.h > 0 ? -halfH : halfH) - ROTATION_HANDLE_OFFSET;

    // Rotation Handle
    c.beginPath(); 
    c.moveTo(0, (s.h > 0 ? -halfH : halfH)); 
    c.lineTo(0, handleY);
    c.strokeStyle = userSettings.accentColor; 
    c.lineWidth = 1; 
    c.setLineDash([]); 
    c.stroke();
    drawHandleCircle(c, 0, handleY, userSettings.accentColor);

    // Corner Handles (Local Coordinates)
    drawHandleCircle(c, -halfW, -halfH, userSettings.accentColor);
    drawHandleCircle(c, halfW, -halfH, userSettings.accentColor);
    drawHandleCircle(c, halfW, halfH, userSettings.accentColor);
    drawHandleCircle(c, -halfW, halfH, userSettings.accentColor);

    // Center Handle (unless stamp)
    if (s.type !== 'stamp') {
            drawHandleSquare(c, 0, 0);
    }

    c.restore();

    // Stamp Tip (World Coordinates)
    if (s.type === 'stamp' && s.ex !== undefined) {
            drawHandleCircle(c, s.ex, s.ey, userSettings.accentColor);
    }
}

function drawHandleCircle(c, x, y, color) { 
    c.beginPath(); c.setLineDash([]); 
    c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 3; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
    // [MODIFIED] Larger visual handle for clarity
    c.arc(x, y, 5, 0, Math.PI * 2); 
    c.fillStyle = '#ffffff'; c.fill(); 
    c.strokeStyle = color; c.lineWidth = 1.5; c.stroke(); 
}

function drawHandleSquare(c, x, y) { 
    c.beginPath(); c.setLineDash([]); 
    c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 3; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
    const s = 10; c.rect(x - s/2, y - s/2, s, s); 
    c.fillStyle = '#ffffff'; c.fill(); 
    c.strokeStyle = userSettings.accentColor; c.lineWidth = 1.5; c.stroke(); 
}

// --- 9. HELPERS ---

// --- SYRINGE LIQUID HELPER WITH ANIMATION ---
function updateSyringeLiquid(hexColor, isClicking = false) {
    const encodedColor = hexColor.replace('#', '%23');
    const styleId = 'dynamic-syringe-style';
    let styleEl = document.getElementById(styleId);

    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
    }

    // Shift plunger 3 pixels for the "click" animation
    const shift = isClicking ? 3 : 0;

    // Inject dynamic CSS to update the actual mouse cursor
    // [FIXED] Outline is now Mint (#8CFA96 encoded as %238CFA96)
    styleEl.innerHTML = `
        .cursor-eyedropper { 
            cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32' fill='none' stroke='%238CFA96' stroke-width='0.6' stroke-linecap='round' stroke-linejoin='round' style='filter: drop-shadow(1px 1.5px 1.2px rgba(0,0,0,0.7));'>\
                <rect x='0' y='31' width='1' height='1' fill='%2322262a' stroke='none' />\
                <path d='M${21-shift} ${11+shift} L${27-shift} ${5+shift}' stroke-width='0.6' />\
                <path d='M${25-shift} ${3+shift} L${29-shift} ${7+shift}' stroke-width='1.5' />\
                <path d='M1 31 L13 19' stroke-width='0.6' />\
                <rect x='13' y='7' width='6' height='16' rx='0.5' transform='rotate(45 16 16)' fill='rgba(255,255,255,0.15)' stroke='%238CFA96' stroke-width='0.6' />\
                <rect x='14.2' y='8.2' width='3.6' height='13.6' rx='0.2' transform='rotate(45 16 16)' fill='${encodedColor}' stroke='none' />\
            </svg>") 0 32, crosshair !important; 
        }
    `;
}

// [NEW] Helper for Centered Grid Snapping (Matches drawGrid)
function applyGridSnap(val, axis) {
    if (!userSettings.snapToGrid) return val;
    
    const size = parseInt(userSettings.gridSize) || 20;
    
    // 1. Get Center (Must match drawGrid exactly)
    const center = Math.floor((axis === 'x') ? (w / 2) : (h / 2));
    
    // 2. Calculate distance from Center
    const dist = val - center;
    
    // 3. Snap distance to nearest grid unit
    const snappedDist = Math.round(dist / size) * size;
    
    // 4. Return absolute position
    return center + snappedDist;
}

function getShapeCenter(s) { if (['line', 'arrow'].includes(s.type)) return { x: (s.x + s.ex) / 2, y: (s.y + s.ey) / 2 }; return { x: s.x + s.w / 2, y: s.y + s.h / 2 }; }
function getBoundingBox(s) { if (s.points) { let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity; s.points.forEach(p => { minX=Math.min(minX, p.x); maxX=Math.max(maxX, p.x); minY=Math.min(minY, p.y); maxY=Math.max(maxY, p.y); }); return { x: minX + (s.x||0), y: minY + (s.y||0), w: s.w||(maxX-minX), h: s.h||(maxY-minY) }; } return { x: s.x, y: s.y, w: s.w, h: s.h }; }
function applyShadow(ctx, on) { 
    if (on) { 
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; 
        ctx.shadowBlur = parseInt(userSettings.shadowBlur) || 10; 
        
        // [NEW] Use configurable distance
        const dist = parseInt(userSettings.shadowDistance) || 5;
        ctx.shadowOffsetX = dist; 
        ctx.shadowOffsetY = dist; 
    } else { 
        ctx.shadowColor = 'transparent'; 
        ctx.shadowBlur = 0; 
        ctx.shadowOffsetX = 0; 
        ctx.shadowOffsetY = 0; 
    } 
}
const getXY = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

// --- [NEW] NOTIFICATION HELPER ---
let toastTimeout;
function showToast(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    
    toast.innerHTML = `<i class="fa-solid fa-info-circle"></i> ${message}`;
    toast.classList.add('show');
    
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2000); // Disappears after 2 seconds
}
function showConfirm(message, onYes) {
    // Remove existing if any
    const old = document.getElementById('app-confirm');
    if(old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'app-confirm';
    overlay.className = 'confirm-overlay';
    
    overlay.innerHTML = `
        <div class="confirm-box">
            <div class="confirm-msg">${message}</div>
            <div class="confirm-actions">
                <button class="confirm-btn yes" id="conf-yes">Yes</button>
                <button class="confirm-btn" id="conf-no">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('conf-yes').onclick = () => {
        onYes();
        overlay.remove();
    };
    
    document.getElementById('conf-no').onclick = () => {
        overlay.remove();
    };
    
    overlay.onclick = (e) => {
        if(e.target === overlay) overlay.remove();
    };
    
    document.getElementById('conf-yes').focus();
}

// --- 10. UI ACTIONS ---
if(btnClose) btnClose.onclick = (e) => { e.stopPropagation(); ipcRenderer.send('close-app'); };
if(btnMin) btnMin.onclick = (e) => { e.stopPropagation(); ipcRenderer.send('minimize-app'); };
if(btnMax) btnMax.onclick = (e) => { e.stopPropagation(); ipcRenderer.send('maximize-app'); };
ipcRenderer.on('window-state-change', (e, s) => { const i = btnMax.querySelector('i'); if (s === 'maximized') { i.classList.remove('fa-square'); i.classList.add('fa-clone'); } else { i.classList.remove('fa-clone'); i.classList.add('fa-square'); } });

// FULLSCREEN TOGGLE
btnFullscreen.onclick = () => { 
    isFullscreen = true; hasSnappedInFullscreen = false; 
    document.body.classList.add('fullscreen'); 
    floatingBar.classList.remove('hidden'); 
    
    // [FIXED] Ghost Frame Logic
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const ghostW = w || 800; 
    const ghostH = h || 600; 
    
    const cX = (winW - ghostW) / 2;
    const cY = (winH - ghostH) / 2;

    // Force Appearance
    frame.style.display = 'block'; 
    frame.classList.remove('clean-slate');
    frame.style.border = `2px dashed ${userSettings.accentColor}`;
    
    // Position
    frame.style.position = 'absolute';
    frame.style.left = cX + 'px';
    frame.style.top = cY + 'px';
    frame.style.width = ghostW + 'px';
    frame.style.height = ghostH + 'px';
    frame.style.margin = '0';

    inpW.value = ghostW; inpH.value = ghostH;
    
    // Reset State
    shapes = []; selectedShape = null; isCreatingFrame = false;
    
    // Force Tool to Cursor (for Moveability)
    tool = 'cursor';
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const cursorBtn = document.querySelector('.tool-btn[data-t="cursor"]');
    if(cursorBtn) cursorBtn.classList.add('active');

    ipcRenderer.send('force-maximize'); 
    
    // Resize Canvases
    updateDPR();
    const innerW = winW * dpr; 
    const innerH = winH * dpr;
    [canvas, backgroundCanvas, scratchCanvas, shapeLayerCanvas].forEach(c => { c.width = innerW; c.height = innerH; });
    [ctx, bgCtx, scratchCtx, shapeLayerCtx].forEach(c => { c.scale(dpr, dpr); c.lineCap = userSettings.cornerStyle; c.lineJoin = userSettings.cornerStyle; });
    
};

// [FIXED] Enforce User Default Canvas Size (No Hard Stop on Canvas)
btnCenter.onclick = () => { 
    isSuppressingResize = true; 
    exitFullscreen(); 
    hasSnappedInFullscreen = false; 
    
    // [FIX] Use exact user settings. If startupW is 500, canvas becomes 500.
    w = userSettings.startupW; 
    h = userSettings.startupH; 
    
    inpW.value = w; 
    inpH.value = h; 
    resetFramePosition(); 
    
    // Request window resize. main.js will clamp this to 890x160 minimum.
    // If w is small, window stays at 890, frame draws at small w in the center.
    ipcRenderer.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET }); 
    ipcRenderer.send('center-window');
    
    setTimeout(() => { 
        updateCanvasSize(w, h); 
        isSuppressingResize = false; 
    }, 50); 
};

// MAXIMIZE FRAME BUTTON
document.getElementById('fb-max').onclick = () => {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    w = winW; h = winH;
    frame.style.left = '0px'; frame.style.top = '0px';
    frame.style.width = w + 'px'; frame.style.height = h + 'px';
    inpW.value = w; inpH.value = h;
    updateCanvasSize(w, h, true);
};

// RESET SELECTION BUTTON
document.getElementById('fb-reset').onclick = () => {
    doDelete(); 
    if(isFullscreen) {
        frame.style.display = 'none';
        inpW.value = 0; inpH.value = 0;
    }
};

// [FIXED] Enforce User Default Canvas Size on Exit
document.getElementById('fb-exit').onclick = () => {
    isSuppressingResize = true;
    
    // [FIX] Use exact user settings
    w = userSettings.startupW; 
    h = userSettings.startupH; 
    
    inpW.value = w; inpH.value = h;
    
    exitFullscreen(); 
    
    // Main.js handles the window hard stop
    ipcRenderer.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET }); 
    ipcRenderer.send('center-window');
    
    shapes = []; selectedShape = null; polygonPoints = []; activeShape = null;
    bgCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
    historyStack = []; historyIndex = -1; updateHistoryButtons(); saveState(); 
    
    setTimeout(() => { 
        updateCanvasSize(w, h); 
        isSuppressingResize = false;
    }, 50);
};
const btnQuit = document.getElementById('fb-quit');
if(btnQuit) { btnQuit.onclick = () => { ipcRenderer.send('close-app'); }; }

function exitFullscreen() { 
    isFullscreen = false; 
    isCreatingFrame = false; 
    
    document.body.classList.remove('fullscreen'); 
    floatingBar.classList.add('hidden'); 
    
    frame.style.display = 'block'; 
    frame.style.border = `2px dashed ${userSettings.accentColor}`; 
    winResizeGrip.style.display = 'flex'; 
    
    resetFramePosition();
}

// --- SETTINGS MODAL LOGIC ---
const toggleSettings = (e) => { 
    if(e) e.stopPropagation(); 
    
    // Check if we are currently hidden (meaning we are about to OPEN)
    const isOpening = settingsModal.style.display === 'none' || settingsModal.style.display === ''; 
    
    if (isOpening) {
        // --- OPENING SETTINGS ---
        settingsModal.style.display = 'flex';
        
        if (!isFullscreen) {
            // 1. Save the user's current "canvas" size
            // Only save if we haven't already (e.g. if chaining from another modal)
            if (preWizardW === 0 && preWizardH === 0) {
                preWizardW = w;
                preWizardH = h;
            }
            
            // 2. Define minimum size needed for the Settings Menu (960x660 window area)
            const settMinW = 960; 
            const settMinH = 660;

            // 3. Expand if too small
            if (w < settMinW || h < settMinH) {
                // We update 'w' temporarily so the UI expands
                w = Math.max(w, settMinW);
                h = Math.max(h, settMinH);
                
                inpW.value = w; 
                inpH.value = h;
                
                // Request resize (main.js enforces the 890x160 hard stops, but allows expansion)
                ipcRenderer.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
                updateCanvasSize(w, h);
                ipcRenderer.send('center-window');
            }
        }
    } else {
        // --- CLOSING SETTINGS ---
        settingsModal.style.display = 'none';
        
        // 4. Restore the user's previous size
        if (!isFullscreen && preWizardW > 0 && preWizardH > 0) {
            // [FIX] Block the resize listener so it doesn't snap canvas to the window's hard stop
            isSuppressingResize = true; 
            
            w = preWizardW;
            h = preWizardH;
            
            inpW.value = w; 
            inpH.value = h;
            
            // Request physical window resize
            ipcRenderer.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
            ipcRenderer.send('center-window');
            
            // Force the canvas size immediately to match user preference
            updateCanvasSize(w, h);
            
            // Unblock after animation allows the window to settle
            setTimeout(() => {
                updateCanvasSize(w, h); // Ensure it stuck
                isSuppressingResize = false;
                
                // Reset memory
                preWizardW = 0; 
                preWizardH = 0;
            }, 100);
        }
    }
};

btnSettings.onclick = toggleSettings; 
closeSettings.onclick = toggleSettings; 
settingsModal.addEventListener('mousedown', (e) => { if (e.target === settingsModal) toggleSettings(); });

document.querySelectorAll('[data-setting]').forEach(input => {
    input.addEventListener('change', (e) => {
        const key = input.dataset.setting;
        let val;
        if(input.type === 'checkbox') val = input.checked;
        else if(input.type === 'number' || input.type === 'range') val = parseFloat(input.value);
        else val = input.value;
        
        userSettings[key] = val;
        saveSettings();
        
        if (key === 'globalHotkey') ipcRenderer.send('update-setting', { key: 'globalHotkey', value: val });
        if (key === 'openAtLogin') ipcRenderer.send('update-setting', { key: 'openAtLogin', value: val });

        // [NEW] Trigger Bubble Update if Corner Style changes
        if (key === 'cornerStyle' && typeof updateRadiusBubbleUI === 'function') updateRadiusBubbleUI();
        
        // [NEW] Trigger Canvas Redraw to show changes immediately
        if (key === 'cornerRadius' || key === 'cornerStyle') renderMain();
    });
});

const accPick = document.getElementById('inp-accent-picker');
const accText = document.getElementById('inp-accent-text');

// [FIXED] Live update for Accent Color (Does not force save/window layer reset)
const previewAccent = (val) => {
    // Update local setting variable but don't persist to disk yet
    userSettings.accentColor = val;
    accPick.value = val;
    accText.value = val;
    // Manually update the CSS variable for immediate visual feedback
    document.documentElement.style.setProperty('--accent', val);
};

// [FIXED] Commit Accent Color (Saves and restores window state)
const commitAccent = (val) => {
    previewAccent(val);
    saveSettings(); // This restores Always On Top via applySettingsToRuntime
};

// Suspend Always-On-Top immediately on click so the picker stays visible
accPick.addEventListener('mousedown', () => {
    ipcRenderer.send('set-always-on-top', false);
});

// Live Preview: Update UI only (prevents window jumping to front)
accPick.addEventListener('input', e => previewAccent(e.target.value));

// Commit: Save and Restore State when picker closes
accPick.addEventListener('change', e => {
    commitAccent(e.target.value);
    // Redundant safety restore
    setTimeout(() => {
        ipcRenderer.send('set-always-on-top', userSettings.alwaysOnTop);
    }, 50);
});

accText.addEventListener('change', e => commitAccent(e.target.value));

const defColorPick = document.getElementById('inp-def-color-picker');
const defColorText = document.getElementById('inp-def-color-text');

// [FIXED] Live update for Default Color
const previewDefColor = (val) => {
    userSettings.defaultColor = val;
    defColorPick.value = val;
    defColorText.value = val;
    
    // Update main tool color picker too
    colorPk.value = val;
    updateStyle();
    applyPropertyChange('color', val);
};

// [FIXED] Commit Default Color
const commitDefColor = (val) => {
    previewDefColor(val);
    saveSettings(); // This restores Always On Top via applySettingsToRuntime
};

// Suspend Always-On-Top immediately on click
defColorPick.addEventListener('mousedown', () => {
    ipcRenderer.send('set-always-on-top', false);
});

// Live Preview (Update UI only)
defColorPick.addEventListener('input', e => previewDefColor(e.target.value));

// Commit (Save and Restore)
defColorPick.addEventListener('change', e => {
    commitDefColor(e.target.value);
    setTimeout(() => {
        ipcRenderer.send('set-always-on-top', userSettings.alwaysOnTop);
    }, 50);
});

defColorText.addEventListener('change', e => commitDefColor(e.target.value));

const btnBrowse = document.getElementById('btn-browse-dir');
const btnClearDir = document.getElementById('btn-clear-dir');
const inpSavePath = document.getElementById('inp-save-path');
btnBrowse.onclick = async () => {
    try {
       const result = await ipcRenderer.invoke('select-directory');
       if(result && !result.canceled) {
           userSettings.savePath = result.filePaths[0];
           inpSavePath.value = userSettings.savePath;
           saveSettings();
       }
    } catch(e) { alert("Directory selection failed."); }
};
btnClearDir.onclick = () => { userSettings.savePath = ''; inpSavePath.value = ''; saveSettings(); };

// [FIX] Layering logic helper
function changeLayerOrder(direction) {
    if (!selectedShape || selectedShape.isGroup) return;

    const index = shapes.indexOf(selectedShape);
    if (index === -1) return;

    let newIndex = index + direction;
    // Clamp the index within the array bounds
    newIndex = Math.max(0, Math.min(shapes.length - 1, newIndex));

    if (newIndex !== index) {
        // Remove shape from current index
        shapes.splice(index, 1);
        // Insert shape at new index
        shapes.splice(newIndex, 0, selectedShape);
        saveState();
        renderMain();
    }
}


// --- HISTORY STATE MANAGEMENT ---
// --- HISTORY STATE MANAGEMENT ---
function saveState() {
    // 1. Abort if in temporary modes
    const settingsModal = document.getElementById('settings-modal');
    const wizardModal = document.getElementById('onboarding-wizard');
    if ((settingsModal && settingsModal.style.display === 'flex') || 
        (wizardModal && wizardModal.classList.contains('show')) || 
        preWizardW > 0) return;

    // 2. Capture Current State
    const isCentered = (frame.style.position === '' || frame.style.position === 'relative');
    const currentState = {
        shapes: JSON.parse(JSON.stringify(shapes)), // Deep copy
        w: w,
        h: h,
        x: frame.offsetLeft,
        y: frame.offsetTop,
        isCentered: isCentered 
    };

    // 3. SMART DUPLICATE CHECK
    if (historyIndex >= 0 && historyStack[historyIndex]) {
        const lastState = historyStack[historyIndex];
        
        // A. Check Window Metrics
        const isSameMeta = lastState.w === w && lastState.h === h && 
                           lastState.x === frame.offsetLeft && lastState.y === frame.offsetTop;
        
        // B. Check Shape Count (CRITICAL: If counts differ, ALWAYS SAVE)
        const countChanged = currentState.shapes.length !== lastState.shapes.length;

        if (isSameMeta && !countChanged) {
            // Only perform deep check if count is same and window hasn't moved
            const currentStr = JSON.stringify(currentState.shapes);
            const lastStr = JSON.stringify(lastState.shapes);
            
            if (currentStr === lastStr) return; // Identical state, do not save
        }
    }

    // 4. Commit to History
    historyIndex++;
    historyStack = historyStack.slice(0, historyIndex); // Remove 'Redo' history
    historyStack.push(currentState);

    // 5. Limit History Size
    if (historyStack.length > 50) {
        historyStack.shift();
        historyIndex--;
    }

    updateHistoryButtons();
}
function updateHistoryButtons() { 
    const ac = 'active-history-btn'; 
    const uBtn = document.getElementById('fb-undo');
    const rBtn = document.getElementById('fb-redo');
    
    if (historyIndex > 0) { 
        btnUndo.classList.add(ac); 
        if(uBtn) uBtn.classList.add(ac); 
    } else { 
        btnUndo.classList.remove(ac); 
        if(uBtn) uBtn.classList.remove(ac); 
    } 
    
    if (historyIndex < historyStack.length - 1) { 
        btnRedo.classList.add(ac); 
        if(rBtn) rBtn.classList.add(ac); 
    } else { 
        btnRedo.classList.remove(ac); 
        if(rBtn) rBtn.classList.remove(ac); 
    } 
}

function restoreState(state) {
    // Support backward compatibility
    let targetShapes = Array.isArray(state) ? state : state.shapes;
    shapes = JSON.parse(JSON.stringify(targetShapes));
    
    // Check for advanced state properties
    if (!Array.isArray(state)) {
        const currentX = frame.offsetLeft;
        const currentY = frame.offsetTop;
        const targetX = state.x !== undefined ? state.x : currentX;
        const targetY = state.y !== undefined ? state.y : currentY;

        // Restore Layout Mode & Position
        if (state.isCentered) {
            // Restore to Responsive Centering
            frame.style.position = '';
            frame.style.left = '';
            frame.style.top = '';
            frame.style.margin = '0 auto';
            frame.style.transform = ''; 
            if(frame.parentElement) {
                frame.parentElement.style.justifyContent = 'center'; 
                frame.parentElement.style.alignItems = 'center';
            }
        } else {
            // Restore to Absolute Position (User moved it)
            frame.style.position = 'absolute';
            frame.style.margin = '0'; 
            frame.style.left = targetX + 'px';
            frame.style.top = targetY + 'px';
        }

        // Restore Size if changed
        if (state.w !== w || state.h !== h) {
            isSuppressingResize = true;
            updateCanvasSize(state.w, state.h, true); 
            if(inpW) inpW.value = state.w;
            if(inpH) inpH.value = state.h;
            
            // Sync physical window if not fullscreen
            if (!isFullscreen) {
                const totalW = state.w + (typeof UI_W_OFFSET !== 'undefined' ? UI_W_OFFSET : 120);
                const totalH = state.h + (typeof UI_H_OFFSET !== 'undefined' ? UI_H_OFFSET : 110);
                ipcRenderer.send('resize-window', { width: totalW, height: totalH });
            }
            setTimeout(() => { isSuppressingResize = false; }, 200);
        }
    }
    
    selectedShape = null; 
    updateHistoryButtons(); 
    renderMain();
}

// --- UNDO / REDO (Timestamp Locked) ---
let lastHistoryTime = 0; 

function undo() { 
    const now = Date.now();
    if (now - lastHistoryTime < 250) return; // Debounce 250ms
    lastHistoryTime = now;

    if(historyIndex > 0) { 
        historyIndex--; 
        restoreState(historyStack[historyIndex]);
    } 
}

function redo() { 
    const now = Date.now();
    if (now - lastHistoryTime < 250) return; // Debounce 250ms
    lastHistoryTime = now;

    if(historyIndex < historyStack.length - 1) { 
        historyIndex++; 
        restoreState(historyStack[historyIndex]);
    } 
}

window.addEventListener('keydown', (e) => {
    // 0. SHOW CHEAT SHEET (ALT KEY)
    if (e.key === 'Alt') {
        const sheet = document.getElementById('hotkey-cheat-sheet');
        if(sheet) sheet.style.display = 'grid';
        return;
    }

    // 1. Prevent Nudge/Hotkeys if typing in a text box
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

    // 2. TOOL SHORTCUTS (Single Key)
    if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        const k = e.key.toLowerCase();
        
        // A: Arrow (Cycle)
        if (k === 'a') {
            const styles = ['v', 'hand', 'triangle', 'concave', 'dot'];
            let currentIdx = styles.indexOf(userSettings.arrowStyle);
            
            // If we are already on arrow tool, cycle style
            if (tool === 'arrow') {
                let nextIdx = currentIdx + 1;
                if (nextIdx >= styles.length) nextIdx = 0;
                
                const nextStyle = styles[nextIdx];
                userSettings.arrowStyle = nextStyle;
                saveSettings();
                
                // [FIX] Update Icon immediately
                updateArrowButtonIcon();

                // Visual feedback (Toast)
                showToast(`Arrow Style: ${nextStyle.charAt(0).toUpperCase() + nextStyle.slice(1)}`);
                
                // If a shape is selected and it is an arrow, update it immediately
                if (selectedShape && selectedShape.type === 'arrow') {
                    saveState();
                    renderMain();
                }
            } else {
                // Just switch to arrow tool
                tool = 'arrow';
            }
            // Trigger UI update
            const arrowBtn = document.getElementById('btn-arrow-multi');
            if(arrowBtn) handleToolClick(arrowBtn);
            return;
        }

// G: Cycle Polygon Shapes
        if (k === 'g') {
            const shapes = ['star', 'triangle', 'polygon', 'check', 'x-shape'];
            let idx = shapes.indexOf(tool);
            // If current tool isn't a polygon shape, start loop from the beginning
            if (idx === -1) idx = -1; 
            
            let nextIdx = idx + 1;
            if (nextIdx >= shapes.length) nextIdx = 0;
            
            const nextShape = shapes[nextIdx];
            
            // Trigger the dropdown item directly to handle all UI syncing
            const btn = document.querySelector(`.dropdown-item[data-sub="${nextShape}"]`);
            if(btn) btn.click();
            
            // Visual Feedback
            showToast(`Shape: ${nextShape.charAt(0).toUpperCase() + nextShape.slice(1)}`);
            return;
        }

        // U: Cycle Utilities (Toolkit)
        if (k === 'u') {
            const utils = ['ocr', 'eyedropper', 'stamp', 'blur'];
            let idx = utils.indexOf(tool);
            if (idx === -1) idx = -1;
            
            let nextIdx = idx + 1;
            if (nextIdx >= utils.length) nextIdx = 0;
            
            const nextUtil = utils[nextIdx];
            
            // Find the button (Works for both Footer and Floating bar due to shared IDs/Classes logic)
            // We look for the footer ID specifically as the primary trigger
            const btn = document.getElementById(`btn-${nextUtil}`);
            if(btn) btn.click();
            
            // Visual Feedback
            const names = { ocr: 'OCR Scanner', eyedropper: 'Eyedropper', stamp: 'Stamp', blur: 'Blur Tool' };
            showToast(`Tool: ${names[nextUtil]}`);
            return;
        }

// I: Eyedropper
        if (k === 'i') {
            const btn = document.getElementById('btn-eyedropper');
            if(btn) { 
                tool = 'eyedropper'; 
                // Close extra menu if open
                const menu = document.getElementById('footer-extras-menu');
                if(menu) menu.classList.remove('show');
                setToolActive(btn);
            }
            return;
        }

        // P: Pen
        if (k === 'p') {
            const btn = document.querySelector('.tool-btn[data-t="pen"]');
            if(btn) handleToolClick(btn);
            return;
        }

        // L: Line
        if (k === 'l') {
            const btn = document.querySelector('.tool-btn[data-t="line"]');
            if(btn) handleToolClick(btn);
            return;
        }

        // S: Square
        if (k === 's') {
            const btn = document.querySelector('.tool-btn[data-t="square"]');
            if(btn) handleToolClick(btn);
            return;
        }

        // C: Circle
        if (k === 'c') {
            const btn = document.querySelector('.tool-btn[data-t="circle"]');
            if(btn) handleToolClick(btn);
            return;
        }

        // T: Text
        if (k === 't') {
            const btn = document.querySelector('.tool-btn[data-t="text"]');
            if(btn) handleToolClick(btn);
            return;
        }

        // E: Eraser
        if (k === 'e') {
            const btn = document.querySelector('.tool-btn[data-t="eraser"]');
            if(btn) handleToolClick(btn);
            return;
        }
        
        // B: Blur
        if (k === 'b') {
            const btn = document.getElementById('btn-blur');
            if(btn) { 
                tool = 'blur'; 
                const menu = document.getElementById('footer-extras-menu');
                if(menu) menu.classList.remove('show');
                setToolActive(btn);
            }
            return;
        }

        // O: OCR
        if (k === 'o') {
            const btn = document.getElementById('btn-ocr');
            if(btn) {
                tool = 'ocr';
                const menu = document.getElementById('footer-extras-menu');
                if(menu) menu.classList.remove('show');
                setToolActive(btn);
            }
            return;
        }

        // M: Stamp
        if (k === 'm') {
            const btn = document.getElementById('btn-stamp');
            if(btn) {
                // Ensure footer menu closes
                const menu = document.getElementById('footer-extras-menu');
                if(menu) menu.classList.remove('show');
                // Use standard handler
                handleToolClick({ dataset: { t: 'stamp' } });
            }
            return;
        }
    }

    // 3. ARROW NUDGE LOGIC
    if (selectedShape && e.key.startsWith('Arrow')) {
        e.preventDefault(); 
        const s = selectedShape;
        let dx = 0; let dy = 0;
        const step = e.shiftKey ? 10 : 1; // Shift = 10px jump

        if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;
        else if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;

        s.x += dx; s.y += dy;
        if (s.ex !== undefined) { s.ex += dx; s.ey += dy; }
        renderMain();
        saveState(); 
        return;
    }

    // 4. LAYER ORDER HOTKEYS ([ and ])
    if (selectedShape) {
        if (e.key === ']') { e.preventDefault(); changeLayerOrder(1); } // Bring Forward
        else if (e.key === '[') { e.preventDefault(); changeLayerOrder(-1); } // Send Backward
    }

    // 5. STANDARD HOTKEYS (Ctrl+Z, Ctrl+C, etc.)
    if (e.ctrlKey) {
        if (e.key === 'z') { e.preventDefault(); undo(); } 
        else if (e.key === 'y') { e.preventDefault(); redo(); }
        else if (e.key === 'c') { e.preventDefault(); if(selectedShape) clipboardShape = JSON.parse(JSON.stringify(selectedShape)); }
        else if (e.key === 'v') { 
            e.preventDefault(); 
            if(clipboardShape) { 
                const newShape = JSON.parse(JSON.stringify(clipboardShape)); 
                newShape.x += 20; newShape.y += 20; 
                if(newShape.ex) { newShape.ex += 20; newShape.ey += 20; } 
                shapes.push(newShape); selectedShape = newShape; saveState(); renderMain(); 
            } 
        }
        else if (e.key === 'x') { 
            e.preventDefault(); 
            if(selectedShape) { 
                clipboardShape = JSON.parse(JSON.stringify(selectedShape)); 
                shapes = shapes.filter(s => s !== selectedShape); 
                selectedShape = null; saveState(); renderMain(); 
            } 
        }
        else if (e.key === 'a') { e.preventDefault(); selectedShape = { isGroup: true }; renderMain(); }
        else if (e.key === 'r') { e.preventDefault(); if(typeof resetStampCounter === 'function') resetStampCounter(true); }
    }
    
    // 6. DELETE
    if (e.key === 'Delete' || e.key === 'Backspace') { 
        if (selectedShape) { 
            shapes = shapes.filter(s => s !== selectedShape); 
            selectedShape = null; 
            saveState(); 
            renderMain(); 
        } 
    }
});

// [NEW] HIDE CHEAT SHEET ON KEY UP
window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt') {
        const sheet = document.getElementById('hotkey-cheat-sheet');
        if(sheet) sheet.style.display = 'none';
    }
});

// --- TOOL LOGIC ---
const colorTrigger = document.getElementById('color-trigger'); const fbColorTrigger = document.getElementById('fb-color-trigger'); const colorPk = document.getElementById('color-pk'); const swatches = document.querySelectorAll('.swatch'); const btnRgb = document.getElementById('btn-rgb');
// [FIX] Initialize colorPk with the persisted default color
colorPk.value = userSettings.defaultColor;

const showColorPopup = (e) => {
    e.stopPropagation(); const rect = e.target.getBoundingClientRect();
    colorPopup.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
    let left = rect.left + (rect.width/2) - (colorPopup.offsetWidth/2);
    left = Math.max(10, Math.min(window.innerWidth - colorPopup.offsetWidth - 10, left));
    colorPopup.style.left = left + 'px'; colorPopup.style.right = 'auto'; colorPopup.classList.toggle('hidden');
};
colorTrigger.onclick = showColorPopup; fbColorTrigger.onclick = showColorPopup;
window.addEventListener('click', (e) => { if (colorPopup && !colorPopup.contains(e.target) && e.target !== colorTrigger && e.target !== fbColorTrigger) colorPopup.classList.add('hidden'); if(!shapeMenu.contains(e.target) && !btnMultishape.contains(e.target)) shapeMenu.classList.remove('show'); if(!fbShapeMenu.contains(e.target) && !fbBtnMultishape.contains(e.target)) fbShapeMenu.classList.remove('show'); });

const applyPropertyChange = (prop, value) => { 
    updateStyle(); 

    // [FIXED] 1. PRIORITY: Check if we are currently editing text (Live Input)
    // We check activeTextWrapper instead of document.activeElement because clicking 
    // a UI button (like Bold or Color) steals focus from the input.
    if (activeTextWrapper) { 
        const currentInput = activeTextWrapper.querySelector('input');
        
        if (currentInput) {
            const wrapper = activeTextWrapper;
            
            // Apply simple properties directly
            if (prop === 'color') {
    currentInput.style.color = value;
    updateSyringeLiquid(value); // <--- ADD THIS LINE
}
            if (prop === 'opacity') currentInput.style.opacity = value;
            if (prop === 'shadow') currentInput.style.textShadow = value ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none';
            
            // Recalculate composite font string based on ALL current UI states
            // We do this regardless of which specific property changed to ensure consistency
            const isBold = btnBold.classList.contains('active'); 
            const isItalic = btnItalic.classList.contains('active');
            
            // Determine size and family (use passed value if relevant, otherwise use current UI value)
            const sizeVal = prop === 'width' ? value : sizeSl.value;
            const fontFamVal = prop === 'fontFamily' ? value : fontFam.value;
            
            const newFont = `${isItalic?'italic':''} ${isBold?'bold':''} ${(sizeVal * 5)}px ${fontFamVal}`;
            
            currentInput.style.font = newFont; 
            currentInput.dataset.font = newFont; // Store for later commit
            
            const sizer = wrapper.querySelector('.text-sizer'); 
            if(sizer) sizer.style.font = newFont;
            
            // Force re-measure of width
            currentInput.dispatchEvent(new Event('input')); 
            
            // [IMPORTANT] Return focus to input so user can keep typing immediately
            setTimeout(() => currentInput.focus(), 10);
        }
    }
    // 2. SECONDARY: Check if a shape is currently selected (Post-Edit modification)
    else if (selectedShape) { 
        if(selectedShape.type === 'text') {
            // Update simple properties
            if(prop === 'color') selectedShape.color = value;
            else if (prop === 'opacity') selectedShape.opacity = value;
            else if (prop === 'shadow') selectedShape.hasShadow = value;
            
            // Reconstruct font string for selected text shape
            if(prop === 'fontFamily' || prop === 'fontStyle' || prop === 'width') {
                 const isBold = btnBold.classList.contains('active');
                 const isItalic = btnItalic.classList.contains('active');
                 
                 // Extract current size from existing font string or use slider
                 const sizeMatch = selectedShape.font.match(/(\d+)px/);
                 let currentShapeSize = sizeMatch ? sizeMatch[1] / 5 : sizeSl.value; 
                 
                 const newSize = prop === 'width' ? value : currentShapeSize;
                 const newFontFam = prop === 'fontFamily' ? value : fontFam.value;

                 selectedShape.font = `${isItalic?'italic':''} ${isBold?'bold':''} ${newSize * 5}px ${newFontFam}`;
            }
        }
        else if(selectedShape.isGroup) { shapes.forEach(s => s[prop] = value); } 
        else { selectedShape[prop] = value; }
        
        saveState(); 
        renderMain(); 
    } 
};

swatches.forEach(s => { s.addEventListener('click', () => { 
    // [FIX] Use the new commit function we created in the settings block
    commitDefColor(s.dataset.c); 
    colorPopup.classList.add('hidden'); 
}); });
btnRgb.onclick = () => colorPk.click(); 

// [FIXED] Color Picker Event: Use 'input' event to apply color change in real-time.
colorPk.addEventListener('input', () => { 
    // If a shape is selected, apply the change to the shape
    if (selectedShape) {
    applyPropertyChange('color', colorPk.value);
} 
updateStyle();
updateSyringeLiquid(colorPk.value); // <--- ADD THIS LINE 
});
// [FIXED] The 'change' event is now less critical since 'input' is handled, but kept for fallback
colorPk.addEventListener('change', () => { 
    // On change/blur, ensure style is updated, particularly if the selection was finished.
    updateStyle(); 
});


sizeSl.addEventListener('input', () => { applyPropertyChange('width', sizeSl.value); });
opacitySl.addEventListener('input', () => { applyPropertyChange('opacity', opacitySl.value); });

function updateStyle() { 
    // 1. Update Color Triggers (These keep the selected color)
    colorTrigger.style.backgroundColor = colorPk.value; 
    fbColorTrigger.style.backgroundColor = colorPk.value; 
    
    // 2. Update Size Dots (Preview)
    [sizeDot, fbSizeDot].forEach(d => { 
        d.style.width = sizeSl.value + 'px'; 
        d.style.height = sizeSl.value + 'px'; 
        d.style.opacity = opacitySl.value; 
        // [FIXED] Force these to use the static Accent/Mint color
        d.style.backgroundColor = userSettings.accentColor; 
        
        // [FIXED] Show size tooltip on hover
        d.title = sizeSl.value + ' px';
    }); 
    
    // 3. Update Slider Hover Titles
    const sizeLabel = `Size: ${sizeSl.value}px`;
    sizeSl.title = sizeLabel;
    fbSizeSl.title = sizeLabel;

    const opacityLabel = `Opacity: ${Math.round(opacitySl.value * 100)}%`;
    opacitySl.title = opacityLabel;
    fbOpacitySl.title = opacityLabel;

    // 4. Update Cursor Dot Style (The actual mouse cursor)
    // We keep this dynamic so you know what color you are painting with
    cursorDot.style.width = sizeSl.value + 'px'; 
    cursorDot.style.height = sizeSl.value + 'px';
    
    if(userSettings.cursorStyle === 'outline') {
        cursorDot.style.backgroundColor = 'transparent';
        cursorDot.style.border = '1px solid #1e1e1e';
    } else {
        cursorDot.style.backgroundColor = colorPk.value;
        cursorDot.style.border = 'none';
    }
updateSyringeLiquid(colorPk.value);
}
updateStyle(); 

const sync = (a, b, fn) => { a.addEventListener('input', () => { b.value = a.value; fn(); }); b.addEventListener('input', () => { a.value = b.value; fn(); }); };
sync(sizeSl, fbSizeSl, () => applyPropertyChange('width', sizeSl.value)); sync(opacitySl, fbOpacitySl, () => applyPropertyChange('opacity', opacitySl.value)); 
sync(fontFam, fbFontFam, () => {
    // [FIXED] Trigger font change when dropdown value changes
    applyPropertyChange('fontFamily', fontFam.value);
});

const toggleFontBtn = (btn, fbBtn, type) => {
    const v = btn.classList.toggle('active'); fbBtn.classList.toggle('active', v);
    // [FIXED] Pass a dummy value to trigger the font reconstruction logic in applyPropertyChange
    applyPropertyChange('fontStyle', v); 
};
// [FIXED] Ensure bold/italic buttons trigger styling change on click
btnBold.onclick = () => toggleFontBtn(btnBold, fbBtnBold, 'bold'); fbBtnBold.onclick = btnBold.onclick;
btnItalic.onclick = () => toggleFontBtn(btnItalic, fbBtnItalic, 'italic'); fbBtnItalic.onclick = btnItalic.onclick;

fontFam.addEventListener('change', () => applyPropertyChange('fontFamily', fontFam.value)); 
fbFontFam.addEventListener('change', () => applyPropertyChange('fontFamily', fbFontFam.value));

window.addEventListener('wheel', (e) => { 
    // 1. Settings Sliders (No changes)
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

    // [FIX] PRIORITY: Check Magnifier Tool FIRST (Live Preview)
    if (tool === 'magnifier') {
        e.preventDefault();
        const dir = e.deltaY < 0 ? 1 : -1;
        
        // Ctrl + Scroll: Adjust Zoom Level (Magnification Power)
        if (e.ctrlKey) {
            magZoom = Math.min(Math.max(magZoom + (dir * 0.5), 1.5), 5);
            showToast(`Zoom Level: ${magZoom.toFixed(1)}x`);
        } else {
            // Standard Scroll: Adjust Lens Size
            magSize = Math.min(Math.max(magSize + (dir * 20), 100), 500);
        }
        
        // Force update the lens immediately
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: lastClientX, clientY: lastClientY }));
        return; 
    }

    // 2. Global Shift + Scroll (Opacity for ANY tool/selection)
    if(e.shiftKey) { 
        e.preventDefault(); 
        const dir = e.deltaY < 0 ? 0.1 : -0.1; 
        let val = parseFloat(opacitySl.value) + dir; 
        val = Math.min(Math.max(val, 0.1), 1); 
        opacitySl.value = val.toFixed(1); 
        fbOpacitySl.value = val.toFixed(1); 
        applyPropertyChange('opacity', val); 
        return;
    } 

    // 3. [FIX] RESIZE SELECTED SHAPE (Stamps & Magnifiers)
    // This allows resizing a snapped lens or stamp even when the tool is 'cursor'
    if ((tool === 'stamp') || (selectedShape && (selectedShape.type === 'stamp' || selectedShape.type === 'magnifier-snap'))) {
        e.preventDefault(); 
        const dir = e.deltaY < 0 ? 5 : -5; 
        
        if (selectedShape) {
            // Resize the active selection
            let newSize = selectedShape.w + dir;
            if (newSize < 20) newSize = 20; // Min size
            if (newSize > 800) newSize = 800; // Max size
            
            selectedShape.w = newSize;
            selectedShape.h = newSize; // Keep 1:1 aspect ratio
            
            // If it's a stamp, update the global default too
            if (selectedShape.type === 'stamp') {
                currentStampSize = newSize;
                userSettings.stampDefaultSize = newSize; 
            }
            
            saveState(); 
            renderMain();
        } else {
            // Resize the 'phantom' stamp before placing it
            if (tool === 'stamp') {
                currentStampSize += dir;
                if (currentStampSize < 15) currentStampSize = 15;
                if (currentStampSize > 300) currentStampSize = 300;
                userSettings.stampDefaultSize = currentStampSize; 
                saveSettings(); 
            }
        }
        return;
    }

    // 4. Default Tool Resize (Pen/Line thickness)
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

// --- INTERACTION ---
function getHandleAt(p, s) {
    if(!s || s.type === 'polygon_drag' || s.isGroup || s.type === 'eraser-stroke') return 0;
    const TOUCH_RAD = 30; 

    // Stamp Handles
    if (s.type === 'stamp') {
         const radius = s.w / 2;
         const cx = s.x + radius; 
         const cy = s.y + radius;

         // Tip Handle (Inner)
         if (s.ex !== undefined) {
             const angle = Math.atan2(s.ey - cy, s.ex - cx);
             const innerX = s.ex - 20 * Math.cos(angle);
             const innerY = s.ey - 20 * Math.sin(angle);
             if (Math.hypot(p.x - innerX, p.y - innerY) < TOUCH_RAD) return 99;
         }
         
         // Standard Box Handles
         // [FIX] Added missing Handle 1 (Top-Left) check
         if (Math.hypot(p.x - s.x, p.y - s.y) < TOUCH_RAD) return 1; 
         if (Math.hypot(p.x - (s.x+s.w), p.y - s.y) < TOUCH_RAD) return 2;
         if (Math.hypot(p.x - (s.x+s.w), p.y - (s.y+s.h)) < TOUCH_RAD) return 3; 
         if (Math.hypot(p.x - s.x, p.y - (s.y+s.h)) < TOUCH_RAD) return 4;
         
         if (Math.hypot(p.x - cx, p.y - cy) < radius) return 6; 
         return 0;
    }

    // Line/Arrow Handles
    if (['line','arrow'].includes(s.type)) {
        if (Math.hypot(p.x - s.x, p.y - s.y) < TOUCH_RAD) return 1; 
        
        let h2x = s.ex, h2y = s.ey;
        let angle;
        if (s.cp) angle = Math.atan2(s.ey - s.cp.y, s.ex - s.cp.x);
        else angle = Math.atan2(s.ey - s.y, s.ex - s.x);

        if (s.type === 'arrow') {
             // [FIX] Move handle INSIDE the line (subtracting offset)
             // This clears the view for the arrow tip
             const offset = 25; 
             h2x = s.ex - offset * Math.cos(angle);
             h2y = s.ey - offset * Math.sin(angle);
        }

        if (Math.hypot(p.x - h2x, p.y - h2y) < TOUCH_RAD) return 2;
        
        // Middle Handle
        let cx, cy;
        if (s.cp) { cx = s.cp.x; cy = s.cp.y; }
        else { cx = (s.x + s.ex)/2; cy = (s.y + s.ey)/2; }
        
        if (Math.hypot(p.x - cx, p.y - cy) < TOUCH_RAD) {
            return s.curveMode ? 7 : 6;
        }
    } 
    // Polygon/Pen Handles
    else if (['pen', 'polygon'].includes(s.type)) {
        const b = getBoundingBox(s); 
        if (Math.hypot(p.x - (b.x + b.w/2), p.y - (b.y + b.h/2)) < TOUCH_RAD) return 6; 
        if (s.type === 'polygon' && s.points) {
            for(let i=0; i<s.points.length; i++) { 
                const gx = s.x + s.points[i].x; const gy = s.y + s.points[i].y; 
                if(Math.hypot(p.x - gx, p.y - gy) < TOUCH_RAD) return 100 + i; 
            }
        }
    } 
    // Text Handles
    else if (s.type === 'text') {
        ctx.save(); ctx.font = s.font; ctx.textBaseline = 'top'; 
        const m = ctx.measureText(s.text); const h = parseInt(s.font) || 20; 
        ctx.restore();
        if (p.x >= s.x - 10 && p.x <= s.x + m.width + 10 && p.y >= s.y - 10 && p.y <= s.y + h + 10) return 6; 
    } 
    // Standard Shape Handles
    else {
        const c = getShapeCenter(s); const rot = s.rotation || 0;
        const dx = p.x - c.x; const dy = p.y - c.y;
        const lx = dx * Math.cos(-rot) - dy * Math.sin(-rot) + c.x; 
        const ly = dx * Math.sin(-rot) + dy * Math.cos(-rot) + c.y;
        
        const localX = lx - c.x;
        const localY = ly - c.y;
        const handleY = (s.h > 0 ? -s.h/2 : s.h/2) - ROTATION_HANDLE_OFFSET;
        
        if (localX*localX + (localY - handleY)*(localY - handleY) < (TOUCH_RAD * TOUCH_RAD)) return 5; 

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
            ctx.save(); ctx.font = s.font; ctx.textBaseline = 'top'; 
            const h = parseInt(s.font) || 20; const m = ctx.measureText(s.text); ctx.restore();
            const tx = s.w < 0 ? s.x + s.w : s.x;
            const tw = Math.abs(s.w > 0 ? s.w : m.width); 
            if (p.x >= tx && p.x <= tx + tw && p.y >= s.y && p.y <= s.y + h) return s;
        } 
        else if (['pen', 'polygon'].includes(s.type)) { 
             const b = getBoundingBox(s); 
             if (p.x >= b.x - HIT_PAD && p.x <= b.x+b.w + HIT_PAD && p.y >= b.y - HIT_PAD && p.y <= b.y+b.h + HIT_PAD) return s;
        } 
        else if (['line', 'arrow'].includes(s.type)) {
             const hitThreshold = Math.max(HIT_PAD, s.width * 1.5);

             if (s.cp) {
                 // [FIX] Curve-Aware Hit Test
                 // If the line has a control point, check distance to the actual curve
                 const dist = pointToCurveDist(p, s.x, s.y, s.cp, s.ex, s.ey);
                 if (dist < hitThreshold) return s;
                 
                 // Also check control point handle itself (if visible or not)
                 if (Math.hypot(p.x - s.cp.x, p.y - s.cp.y) < hitThreshold) return s;
             } else {
                 // Standard Straight Line Check
                 if (pointToLineDist(p, {x:s.x, y:s.y}, {x:s.ex, y:s.ey}) < hitThreshold) return s;
             }
        } 
        else if (s.type === 'stamp') {
             const radius = s.w/2; const cx = s.x + radius; const cy = s.y + radius;
             if (Math.hypot(p.x - cx, p.y - cy) < radius) return s;
             if (s.ex !== undefined && Math.hypot(p.x - s.ex, p.y - s.ey) < HIT_PAD) return s;
        } 
        else {
            const c = getShapeCenter(s); const rot = s.rotation || 0;
            const dx = p.x - c.x; const dy = p.y - c.y;
            const lx = dx * Math.cos(-rot) - dy * Math.sin(-rot) + c.x; 
            const ly = dx * Math.sin(-rot) + dy * Math.cos(-rot) + c.y;
            const rX = s.w < 0 ? s.x + s.w : s.x;
            const rY = s.h < 0 ? s.y + s.h : s.y;
            const rW = Math.abs(s.w);
            const rH = Math.abs(s.h);
            if (lx >= rX && lx <= rX + rW && ly >= rY && ly <= rY + rH) return s;
        }
    }
    return null;
}

function pointToLineDist(p, v, w) { const l2 = (Math.pow(v.x-w.x,2) + Math.pow(v.y-w.y,2)); if(l2==0) return Math.hypot(p.x-v.x, p.y-v.y); let t = ((p.x-v.x)*(w.x-v.x) + (p.y-v.y)*(w.y-v.y)) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - (v.x + t * (w.x-v.x)), p.y - (v.y + t * (w.y-v.y))); }

// [NEW] Helper to check distance to a Quadratic Bezier Curve
function pointToCurveDist(p, x1, y1, cp, x2, y2) {
    // Sample points along the curve to find closest distance
    // (Efficient approximation)
    let minD = Infinity;
    for(let t=0; t<=1; t+=0.05) {
        const lx = (1-t)*(1-t)*x1 + 2*(1-t)*t*cp.x + t*t*x2;
        const ly = (1-t)*(1-t)*y1 + 2*(1-t)*t*cp.y + t*t*y2;
        const d = Math.hypot(p.x - lx, p.y - ly);
        if(d < minD) minD = d;
    }
    return minD;
}

// [FIX] Missing Polygon Completion Function
function finishPolygon() {
    if (polygonPoints.length < 3) return; // Need at least a triangle

    // 1. Create the Shape Object
    const newShape = {
        type: 'polygon',
        points: [...polygonPoints], // Copy the active points
        color: colorPk.value,
        width: parseFloat(sizeSl.value),
        opacity: parseFloat(opacitySl.value),
        // Check fill state (Solid vs Outline)
        isSolid: fillStates['polygon'] || false,
        isDotted: isDotted,
        hasShadow: isShadow,
        isClosed: true,
        rotation: 0
    };

    // 2. Normalize Coordinates (Bounding Box)
    // This calculates the tightest box around the shape so handles appear correctly
    const b = getBoundingBox(newShape);
    
    // Adjust points to be relative to the top-left of the bounding box
    newShape.points = newShape.points.map(p => ({ x: p.x - b.x, y: p.y - b.y }));
    
    // Set final dimensions
    newShape.x = b.x;
    newShape.y = b.y;
    newShape.w = b.w;
    newShape.h = b.h;

    // 3. Save & Reset
    shapes.push(newShape);
    selectedShape = newShape;
    
    polygonPoints = [];
    activeShape = null;
    
    saveState();
    renderMain();
}

// [FIXED] POINTER EVENTS: Direct Click Restored
window.addEventListener('pointerdown', e => {
    // Ignore Right-Clicks
    if (e.button === 2) return;

    // Ignore clicks on UI elements
    const isControlClick = e.target.closest('.header') || 
                           e.target.closest('.footer') || 
                           e.target.closest('#floating-bar') || 
                           e.target.closest('#color-popup') || 
                           e.target.closest('#settings-modal') || 
                           e.target.closest('.ctx-menu') ||
                           e.target.closest('.text-wrapper');

    if (isControlClick && !e.target.classList.contains('text-handle')) return;

    // Capture starting position
    lastClientX = e.clientX; 
    lastClientY = e.clientY;
    const p = getXY(e);

    // Commit any open text boxes
    if (activeTextWrapper && tool !== 'text') commitActiveText();

    // A. PRIORITY: Check Handles on Selected Shape
    // This allows resizing/rotating immediately
    if (selectedShape) {
        const h = getHandleAt(p, selectedShape);
        if (h > 0) {
            isDown = true; 
            draggingHandle = h; 
            dragStartW = selectedShape.w; 
            dragStartH = selectedShape.h;
            
            if (h === 6) { 
                dragOffsetX = p.x - selectedShape.x; 
                dragOffsetY = p.y - selectedShape.y;
                if (selectedShape.ex !== undefined) {
                    dragExOffset = p.x - selectedShape.ex;
                    dragEyOffset = p.y - selectedShape.ey;
                }
                if (selectedShape.cp) {
                    dragCpOffsetX = p.x - selectedShape.cp.x;
                    dragCpOffsetY = p.y - selectedShape.cp.y;
                }
            }
            frame.setPointerCapture(e.pointerId);
            renderMain();
            return;
        }
    }

    // B. HIT TESTING (Selecting shapes)
    const hit = hitTest(p);
    
    // [FIX] "Direct Click" Logic
    // We allow selecting an existing shape even if a tool is active, 
    // UNLESS the tool is Pen, Eraser, Text, or Polygon (which need exclusive control).
    // This allows you to click a square to move it, even if the Square tool is active.
    const toolsBlockingSelection = ['pen', 'eraser', 'text', 'polygon', 'magnifier'];
    
    if (tool === 'cursor' || (hit && !toolsBlockingSelection.includes(tool))) {
        if (hit) {
            selectedShape = hit;
            isDraggingShape = true; 
            isDown = true;
            dragOffsetX = p.x - selectedShape.x; 
            dragOffsetY = p.y - selectedShape.y;
            
            if (selectedShape.ex !== undefined) {
                dragExOffset = p.x - selectedShape.ex;
                dragEyOffset = p.y - selectedShape.ey;
            }
            
            cursorDot.style.display = 'none';
            updateAuxUI(); // Sync the UI buttons to the shape's style
            renderMain();
            return;
        } 
        
        // Background Click with Cursor = Window Drag (or deselect)
        if (tool === 'cursor' && !hit) {
            selectedShape = null; 
            isDraggingFrame = true;
            
            const rect = frame.getBoundingClientRect(); 
            const parentRect = frame.parentElement.getBoundingClientRect(); 
            frameStartX = e.clientX - rect.left; 
            frameStartY = e.clientY - rect.top; 
            
            frame.style.cursor = 'grabbing';
            renderMain();
            return;
        }
    }

    // C. TOOL SPECIFIC ACTIONS
    if (tool === 'text') { createTextInput(p.x, p.y); return; }
    
    if (tool === 'eyedropper') {
        const pickX = p.x * dpr; const pickY = p.y * dpr;
        const data = bgCtx.getImageData(pickX, pickY, 1, 1).data;
        if (backgroundCanvas.width === 0 || data[3] === 0) { showToast("Snap screen first!"); return; }
        const hex = "#" + ((1 << 24) + (data[0] << 16) + (data[1] << 8) + data[2]).toString(16).slice(1);
        colorPk.value = hex; updateStyle(); applyPropertyChange('color', hex);
        if(typeof updateSyringeLiquid === 'function') { updateSyringeLiquid(hex, true); setTimeout(() => updateSyringeLiquid(hex, false), 150); }
        return;
    }
    
    if (tool === 'stamp') {
        const stampShape = { 
            type: 'stamp', x: p.x - (currentStampSize/2), y: p.y - (currentStampSize/2), 
            w: currentStampSize, h: currentStampSize, ex: p.x + currentStampSize, ey: p.y + currentStampSize, 
            color: colorPk.value, text: getNextStampValue(), width: 0, opacity: 1, hasShadow: isShadow 
        };
        shapes.push(stampShape); selectedShape = stampShape; saveState(); renderMain(); updateStampBubble(); return;
    }
    
    if (tool === 'polygon') {
        if(polygonPoints.length > 2) { 
            const start = polygonPoints[0]; 
            if(Math.hypot(p.x - start.x, p.y - start.y) < 20) { finishPolygon(); return; } 
        }
        polygonPoints.push(p); 
        if (polygonPoints.length === 1) { 
            activeShape = { type: 'polygon_drag', x: p.x, y: p.y, ex: p.x, ey: p.y }; 
        } 
        renderMain(); 
        return;
    }

    // D. START NEW DRAWING
    selectedShape = null;
    updateAuxUI(); 
    isDown = true;
    
    if (userSettings.snapToGrid) { 
        startX = applyGridSnap(p.x, 'x'); 
        startY = applyGridSnap(p.y, 'y'); 
    } else { 
        startX = p.x; 
        startY = p.y; 
    }

    const drawColor = colorPk.value;
    const isSolid = (typeof fillStates !== 'undefined' && fillStates[tool]) || false; 
    
    if (tool === 'pen') {
        activeShape = { type: 'pen', color: drawColor, width: sizeSl.value, opacity: opacitySl.value, hasShadow: isShadow, points: [p], x:0, y:0 };
    } 
    else if (tool === 'eraser') {
         if (eraserMode === 'brush') {
             activeShape = { type: 'eraser-stroke', points: [p], width: sizeSl.value, x: 0, y: 0 };
         } else {
             if (hit) { shapes = shapes.filter(s => s !== hit); saveState(); renderMain(); }
             return;
         }
    }
    else if (tool === 'line') {
        activeShape = { type: 'line', x: startX, y: startY, w: 0, h: 0, ex: startX, ey: startY, color: drawColor, width: sizeSl.value, opacity: isHighlighter ? userSettings.highlighterOpacity : opacitySl.value, isSolid: false, isDotted: isDotted, hasShadow: isHighlighter ? false : isShadow };
    } 
    else {
        activeShape = { 
            type: tool, 
            x: startX, y: startY, 
            w: 0, h: 0, 
            ex: startX, ey: startY, 
            color: drawColor, 
            width: sizeSl.value, 
            opacity: opacitySl.value, 
            isSolid: isSolid, 
            isDotted: isDotted, 
            hasShadow: isShadow, 
            rotation: 0 
        };
    }
    
    renderMain();
});

// 2. POINTER MOVE (Update Drawing)
window.addEventListener('pointermove', e => {
    lastClientX = e.clientX; 
    lastClientY = e.clientY;
    const p = getXY(e);

    // Update Polygon Drag Preview
    if (tool === 'polygon' && activeShape) {
        let targetX = p.x; let targetY = p.y;
        if(userSettings.snapToGrid) { targetX = applyGridSnap(targetX, 'x'); targetY = applyGridSnap(targetY, 'y'); }
        activeShape.ex = targetX; activeShape.ey = targetY;
        renderMain(); return;
    }

    // Handle Frame Dragging
    if (isDraggingFrame) {
        const parentRect = frame.parentElement.getBoundingClientRect();
        frame.style.left = (e.clientX - parentRect.left - frameStartX) + 'px';
        frame.style.top = (e.clientY - parentRect.top - frameStartY) + 'px';
        return;
    }

    // If not holding mouse down, just update cursors
    if (!isDown) {
        if (selectedShape) {
            const h = getHandleAt(p, selectedShape);
            if (h > 0) {
                frame.style.cursor = 'default'; 
                cursorDot.style.display = 'none';
                return;
            }
        }
        
        // Show/Hide Custom Cursor
        if (tool !== 'cursor') {
            cursorDot.style.display = 'block';
            cursorDot.style.left = e.clientX + 'px';
            cursorDot.style.top = e.clientY + 'px';
            frame.style.cursor = 'none';
        } else {
            cursorDot.style.display = 'none';
            frame.style.cursor = 'default';
        }
        return;
    }

    // --- DRAGGING LOGIC (Mouse is Down) ---

    // 1. Dragging an existing Shape
    if (isDraggingShape && selectedShape) {
        let newX = p.x - dragOffsetX;
        let newY = p.y - dragOffsetY;
        
        if (userSettings.snapToGrid) {
            const snappedX = applyGridSnap(newX, 'x');
            const snappedY = applyGridSnap(newY, 'y');
            // Calculate delta to keep relative positions (like arrow endpoints)
            const dx = snappedX - selectedShape.x;
            const dy = snappedY - selectedShape.y;
            
            selectedShape.x = snappedX; 
            selectedShape.y = snappedY;
            
            if (selectedShape.ex !== undefined) { selectedShape.ex += dx; selectedShape.ey += dy; }
            if (selectedShape.cp) { selectedShape.cp.x += dx; selectedShape.cp.y += dy; }
        } else {
            selectedShape.x = newX;
            selectedShape.y = newY;
            if (selectedShape.ex !== undefined) {
                 selectedShape.ex = p.x - dragExOffset; 
                 selectedShape.ey = p.y - dragEyOffset;
            }
        }
        renderMain();
        return;
    }

    // 2. Dragging a Handle (Resizing)
    if (draggingHandle > 0 && selectedShape) {
        let targetX = p.x; let targetY = p.y;
        if (userSettings.snapToGrid && draggingHandle !== 5) { // Don't snap rotation handle to grid
            targetX = applyGridSnap(targetX, 'x');
            targetY = applyGridSnap(targetY, 'y');
        }

        const s = selectedShape;

        if (draggingHandle === 6) { // Center Move Handle
             s.x = targetX - dragOffsetX; s.y = targetY - dragOffsetY;
        } 
        else if (draggingHandle === 1) { // Top-Left or Start
             if (s.type === 'line' || s.type === 'arrow') { s.x = targetX; s.y = targetY; }
             else { const right = s.x + s.w; const bottom = s.y + s.h; s.x = targetX; s.y = targetY; s.w = right - s.x; s.h = bottom - s.y; }
        }
        else if (draggingHandle === 2) { // Top-Right or End
             if (s.type === 'line' || s.type === 'arrow') { s.ex = targetX; s.ey = targetY; }
             else { const bottom = s.y + s.h; s.y = targetY; s.w = targetX - s.x; s.h = bottom - s.y; }
        }
        else if (draggingHandle === 3) { // Bottom-Right
             s.w = targetX - s.x; s.h = targetY - s.y;
        }
        else if (draggingHandle === 4) { // Bottom-Left
             const right = s.x + s.w; s.x = targetX; s.w = right - s.x; s.h = targetY - s.y;
        }
        else if (draggingHandle === 5) { // Rotation
             const c = getShapeCenter(s);
             const angle = Math.atan2(targetY - c.y, targetX - c.x) + Math.PI/2;
             // [CHECK] This line enables the snap
             s.rotation = e.shiftKey ? Math.round(angle / angleSnapRad) * angleSnapRad : angle;
        }
        }

    // 3. Creating a New Shape (Active Drawing)
    if (activeShape) {
        if (tool === 'pen' || tool === 'eraser') {
            activeShape.points.push(p);
        } else {
            // Determine Snap Target
            let targetX = p.x; let targetY = p.y;
            if (userSettings.snapToGrid) {
                targetX = applyGridSnap(p.x, 'x'); 
                targetY = applyGridSnap(p.y, 'y');
            }

            // Calculate Dimensions
            let curW = targetX - startX;
            let curH = targetY - startY;

            // Shift Key Constraints
            if (e.shiftKey) {
                if (tool === 'line' || tool === 'arrow') {
                    // Snap line angle
                    const angle = Math.atan2(curH, curW);
                    const snappedAngle = Math.round(angle / angleSnapRad) * angleSnapRad;
                    const dist = Math.hypot(curW, curH);
                    curW = dist * Math.cos(snappedAngle);
                    curH = dist * Math.sin(snappedAngle);
                    targetX = startX + curW;
                    targetY = startY + curH;
                } 
                // [FIX] Equilateral Triangle
                else if (tool === 'triangle') {
                    // Calculate side length based on the largest dimension
                    const side = Math.max(Math.abs(curW), Math.abs(curH));
                    // Height of equilateral triangle = side * sqrt(3) / 2
                    const equiHeight = side * (Math.sqrt(3) / 2);
                    
                    curW = (curW < 0 ? -1 : 1) * side;
                    curH = (curH < 0 ? -1 : 1) * equiHeight;
                    
                    targetX = startX + curW;
                    targetY = startY + curH;
                }
                else {
                    // Standard 1:1 Aspect Ratio (Square/Circle/Star)
                    const size = Math.max(Math.abs(curW), Math.abs(curH));
                    curW = (curW < 0 ? -1 : 1) * size;
                    curH = (curH < 0 ? -1 : 1) * size;
                }
            }

            activeShape.w = curW;
            activeShape.h = curH;
            activeShape.ex = targetX;
            activeShape.ey = targetY;
        }
        renderMain();
    }
});

// 3. POINTER UP (Finish Drawing)
window.addEventListener('pointerup', e => {
    isDraggingFrame = false;
    isDraggingShape = false;
    draggingHandle = 0;
    
    if (tool === 'cursor') frame.style.cursor = 'grab';

    if (isDown) {
        isDown = false;
        if (activeShape) {
            // Normalize Bounds for Pen/Eraser
            if (tool === 'pen' || tool === 'eraser') {
                const b = getBoundingBox(activeShape);
                activeShape.points = activeShape.points.map(pt => ({ x: pt.x - b.x, y: pt.y - b.y }));
                activeShape.x = b.x; activeShape.y = b.y; activeShape.w = b.w; activeShape.h = b.h;
            }
            
            // Validate size (don't save tiny accidental dots)
            const isSmall = Math.abs(activeShape.w) < 3 && Math.abs(activeShape.h) < 3;
            const isPoint = (tool === 'pen' || tool === 'eraser') && activeShape.points.length < 2;

            if (!isSmall && !isPoint) {
                shapes.push(activeShape);
                selectedShape = activeShape;
                saveState(); // Save History
            }
            
            activeShape = null;
            renderMain();
        }
    }
});

// --- TEXT TOOL ---
function createTextInput(frameRelX, frameRelY, initialText = "", forcedColor = null) {
    if(activeTextWrapper) commitActiveText();
    selectedShape = null; renderMain();
    
    // Get frame's absolute position on screen
    const fr = frame.getBoundingClientRect();
    
    // Calculate absolute screen position for the wrapper
    const absX = fr.left + frameRelX;
    const absY = fr.top + frameRelY;

    const wrapper = document.createElement('div'); wrapper.className = 'text-wrapper'; 
    wrapper.style.left = frameRelX + 'px'; // Position relative to the frame
    wrapper.style.top = frameRelY + 'px'; // Position relative to the frame
    
    const handle = document.createElement('div'); handle.className = 'text-handle';
    handle.onmouseenter = () => { cursorDot.style.display = 'none'; }; handle.onmouseleave = () => { if(tool !== 'cursor') cursorDot.style.display = 'block'; };
    
    // Drag offsets should be based on absolute screen coordinates 
    // vs the wrapper's absolute screen coordinates
    handle.onmousedown = (e) => { 
        isDraggingText = true; 
        const wrapperRect = wrapper.getBoundingClientRect();
        dragOffsetX = e.clientX - wrapperRect.left; 
        dragOffsetY = e.clientY - wrapperRect.top; 
        e.stopPropagation(); 
        handle.style.cursor = 'grabbing'; 
    };
    
    const inputContainer = document.createElement('div'); inputContainer.className = 'input-container';
    const inp = document.createElement('input'); inp.className = 'float-input';
    const sizer = document.createElement('span'); sizer.className = 'text-sizer';
    
    const isBold = btnBold.classList.contains('active'); const isItalic = btnItalic.classList.contains('active');
    const constructedFont = `${isItalic?'italic':''} ${isBold?'bold':''} ${(sizeSl.value * 5)}px ${fontFam.value}`;
    
    // [FIXED] Use forcedColor if provided (edit mode), otherwise use picker value
    inp.style.font = constructedFont; sizer.style.font = constructedFont; 
    inp.style.color = forcedColor || colorPk.value; 
    inp.style.opacity = opacitySl.value; inp.dataset.font = constructedFont; inp.value = initialText;
    if (isShadow) inp.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
    const resize = () => { sizer.innerHTML = inp.value.replace(/\s/g, '&nbsp;'); const w = sizer.getBoundingClientRect().width; inp.style.width = (Math.max(45, w+20))+'px'; };
    inp.addEventListener('input', resize); inp.addEventListener('keydown', (e) => { if(e.key==='Enter') commitActiveText(); });
    
    frame.appendChild(wrapper); // Append to frame, not document.body
    
    wrapper.appendChild(handle); inputContainer.appendChild(sizer); inputContainer.appendChild(inp); wrapper.appendChild(inputContainer); 

    activeTextWrapper = wrapper; 
    setTimeout(() => inp.focus(), 10); resize();
}

function commitActiveText() {
    if(!activeTextWrapper) return; 
    const inp = activeTextWrapper.querySelector('input');
    
    if(inp.value.trim() !== "") {
        // [MODIFIED]: Get position relative to the frame
        const wrapperRelX = activeTextWrapper.offsetLeft;
        const wrapperRelY = activeTextWrapper.offsetTop;

        const fontStr = inp.style.font || inp.dataset.font; 
        const textOpacity = inp.style.opacity || 1;
        const textShadow = inp.style.textShadow !== 'none' && inp.style.textShadow !== '';
        
        // Remove 2px padding offset before saving to canvas coordinates
        const textShape = { 
            type: 'text', 
            text: inp.value, 
            x: wrapperRelX - 2, 
            y: wrapperRelY - 2, 
            font: fontStr, 
            color: inp.style.color, 
            width: 0, 
            h: 0, 
            opacity: textOpacity, 
            hasShadow: textShadow 
        };
        shapes.push(textShape); selectedShape = textShape; saveState();
    }
    if(activeTextWrapper.parentNode) activeTextWrapper.parentNode.removeChild(activeTextWrapper);
    activeTextWrapper = null; renderMain();
}

// renderer.js (New Function: Around Line 2060)

// Helper function to draw the composite image onto a correctly sized canvas (no extra white space)
async function getFinalImageData(exportW, exportH) {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportW;
    exportCanvas.height = exportH;
    const exCtx = exportCanvas.getContext('2d');

    // Draw Background
    if (backgroundCanvas.width > 0) {
        exCtx.drawImage(backgroundCanvas, 0, 0);
    }

    // Draw Shapes (2-Pass for Transparency)
    exCtx.save();
    
    // The export canvas is already sized for the final pixels (exportW/exportH), 
    // but the drawShape function expects to operate on coordinates *scaled* by the DPR.
    exCtx.scale(dpr, dpr); 
    
    // Pass 1: Highlighters (Multiply)
    exCtx.globalCompositeOperation = 'multiply'; 
    shapes.forEach(s => { if (s.opacity < 1 && s.type !== 'eraser-stroke') try { drawShape(exCtx, s); } catch(e){} });

    // Pass 2: Normal
    exCtx.globalCompositeOperation = 'source-over';
    shapes.forEach(s => {
        if (s.opacity < 1 && s.type !== 'eraser-stroke') return;
        exCtx.globalCompositeOperation = (s.type === 'eraser-stroke') ? 'destination-out' : 'source-over';
        try { drawShape(exCtx, s); } catch(e){}
    });
    
    // Watermark
    if(userSettings.watermarkText) {
         // Revert scale for accurate pixel drawing of watermark
         exCtx.setTransform(1, 0, 0, 1, 0, 0); 
         exCtx.font = "bold 14px Segoe UI"; exCtx.fillStyle = "rgba(255,255,255,0.7)"; 
         exCtx.textAlign = "right"; exCtx.textBaseline = "bottom";
         exCtx.shadowColor = "rgba(0,0,0,0.8)"; exCtx.shadowBlur = 2;
         exCtx.fillText(userSettings.watermarkText, exportCanvas.width - 10, exportCanvas.height - 10);
    }
    exCtx.restore();

    const format = userSettings.imageFormat || 'image/png';
    const quality = parseFloat(userSettings.imageQuality) || 0.9;
    
    return exportCanvas.toDataURL(format, quality);
}

// --- TOOL LOGIC ---
let clickTimer = null;
const handleToolClick = (btn) => {
    // 1. Cleanup: Close all menus
    ['fb-tools-menu', 'fb-shape-menu', 'fb-arrow-menu', 'footer-extras-menu', 'arrow-menu', 'shape-menu'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('show');
    });

    // 2. Handle Undo/Redo
    if(btn.id === 'undo' || btn.id === 'fb-undo') { undo(); return; }
    if(btn.id === 'redo' || btn.id === 'fb-redo') { redo(); return; }
    
    // 3. Set Tool
    // If the button has no tool data, ignore it
    if (!btn.dataset.t && !btn.dataset.sub) return;
    const newTool = btn.dataset.t || btn.dataset.sub;
    
    if (activeTextWrapper) commitActiveText();
    if (newTool === 'polygon' && tool !== 'polygon') polygonPoints = [];
    tool = newTool;

    // 4. Update Cursor
    frame.classList.remove('cursor-eyedropper', 'cursor-crosshair');
    if (tool === 'cursor') { cursorDot.style.display = 'none'; frame.style.cursor = 'grab'; } 
    else if (tool === 'eyedropper') { frame.classList.add('cursor-eyedropper'); cursorDot.style.display = 'none'; frame.style.cursor = 'none'; }
    else if (tool === 'ocr' || tool === 'stamp') { frame.style.cursor = (tool === 'stamp') ? 'copy' : 'crosshair'; cursorDot.style.display = 'none'; }
    else if (userSettings.cursorStyle === 'crosshair') frame.style.cursor = 'crosshair';
    else if (userSettings.cursorStyle === 'outline') frame.style.cursor = 'none';
    else { frame.style.cursor = 'none'; }

    // 5. Update Active UI State
    document.querySelectorAll('.tool-btn, .dropdown-item').forEach(b => {
        const t = b.dataset.t || b.dataset.sub;
        const isUtility = ['undo','redo','grid-toggle','btn-dotted','btn-shadow','bring-forward','send-backward'].includes(t);
        
        if (!isUtility) {
             // Logic to highlight the main shape button if ANY shape is selected
             const isShapeBtn = (b.id === 'btn-multishape' || b.id === 'fb-btn-multishape');
             const currentIsShape = ['star', 'triangle', 'polygon', 'check', 'x-shape'].includes(tool);
             
             if (isShapeBtn && currentIsShape) {
                 b.classList.add('active');
             } else {
                 b.classList.toggle('active', t === tool);
             }
        }
        if (b.classList.contains('dropdown-item')) b.classList.remove('active-tool');
    });
    
    // Highlight active item in dropdown
    const activeItem = document.querySelector(`.dropdown-item[data-sub="${tool}"]`);
    if(activeItem) activeItem.classList.add('active-tool');

    // 6. Draw Icons: Sync Solid/Outline state to the main button
    const multiShapes = ['star', 'triangle', 'polygon', 'check', 'x-shape'];
    if (multiShapes.includes(tool)) {
        [document.getElementById('btn-multishape'), document.getElementById('fb-btn-multishape')].forEach(mainBtn => {
            if (!mainBtn) return;
            mainBtn.dataset.t = tool; 
            
            const isSolid = fillStates[tool] === true; 
            let iconClass = '';
            
            if (tool === 'star') iconClass = 'fa-solid fa-star';
            else if (tool === 'polygon') iconClass = 'fa-solid fa-draw-polygon';
            else if (tool === 'check') iconClass = 'fa-solid fa-check';
            else if (tool === 'x-shape') iconClass = 'fa-solid fa-xmark';
            else if (tool === 'triangle') iconClass = 'fa-solid fa-play fa-rotate-neg-90'; 

            // Add 'outlined-icon' class if it is NOT solid
            const canOutline = ['star', 'triangle', 'polygon'].includes(tool);
            const extraClass = (canOutline && !isSolid) ? ' outlined-icon' : '';
            
            mainBtn.innerHTML = `<i class="${iconClass}${extraClass}"></i>`;
            mainBtn.classList.toggle('solid-mode', isSolid);
        });
    }

    updateStyle();
    updateStampBubble();
    if(typeof updateRadiusBubbleUI === 'function') updateRadiusBubbleUI();
};

// CRITICAL: Re-attach the listeners so buttons actually work!
document.querySelectorAll('.tool-btn').forEach(btn => btn.addEventListener('click', (e) => handleToolClick(e.currentTarget)));

document.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        const subTool = item.dataset.sub || item.dataset.t; 
        handleToolClick({ dataset: { t: subTool } });
    });
});

// [FIX] Initialize Dropdown Icons correctly
setTimeout(() => {
    // 1. Fix Triangle: Add 'outlined-icon' class
    const triItems = document.querySelectorAll('.dropdown-item[data-sub="triangle"]');
    triItems.forEach(el => {
        el.innerHTML = '<i class="fa-solid fa-play fa-rotate-neg-90 outlined-icon"></i>';
    });

    // 2. Fix Polygon: Add 'outlined-icon' class
    const polyItems = document.querySelectorAll('.dropdown-item[data-sub="polygon"]');
    polyItems.forEach(el => {
        el.innerHTML = '<i class="fa-solid fa-draw-polygon outlined-icon"></i>';
    });
}, 500);

function toggleSolidMode(targetTool) {
    // 1. Toggle State
    fillStates[targetTool] = !fillStates[targetTool];
    
    // 2. Update Icons immediately
    document.querySelectorAll('.tool-btn').forEach(b => { 
        // Update the small dot indicator
        if (b.dataset.t === targetTool || (['star','polygon','check','triangle','x-shape'].includes(targetTool) && (b.id==='btn-multishape'||b.id==='fb-btn-multishape') && tool === targetTool)) { 
            b.classList.toggle('solid-mode', fillStates[targetTool]); 
        } 
        
        // Update Square/Circle icons explicitly
        if (targetTool === 'square' && b.dataset.t === 'square') {
            const iconClass = fillStates['square'] ? 'fa-solid fa-square' : 'fa-regular fa-square';
            b.innerHTML = `<i class="${iconClass}"></i>`;
        }
        if (targetTool === 'circle' && b.dataset.t === 'circle') {
            const iconClass = fillStates['circle'] ? 'fa-solid fa-circle' : 'fa-regular fa-circle';
            b.innerHTML = `<i class="${iconClass}"></i>`;
        }
    });
    
    // 3. Update the currently selected shape on the canvas
    if(selectedShape && selectedShape.type === targetTool) { 
        selectedShape.isSolid = fillStates[targetTool]; 
        renderMain(); 
        saveState(); 
    }
    
    // 4. Force a UI Refresh of the main button 
    // This ensures the Triangle/Polygon icon switches between Solid and Outline visually
    handleToolClick({ dataset: { t: targetTool }, id: 'refresh-trigger' }); 
}

// [NEW] Right-Click to Open Shape Menu
[document.getElementById('btn-multishape'), document.getElementById('fb-btn-multishape')].forEach(btn => {
    if(btn) {
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Close other menus first
            ['fb-tools-menu', 'fb-arrow-menu', 'footer-extras-menu', 'arrow-menu'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('show');
            });

            // Toggle the correct menu based on which button was clicked (Header vs Floating Bar)
            const menu = btn.id === 'btn-multishape' ? document.getElementById('shape-menu') : document.getElementById('fb-shape-menu');
            if(menu) menu.classList.toggle('show');
        };
    }
});

// Attach Double Click Listeners
document.querySelectorAll('.tool-btn[data-t="square"], .tool-btn[data-t="circle"], .tool-btn[data-t="text"]').forEach(b => b.addEventListener('dblclick', () => toggleSolidMode(b.dataset.t)));

[document.getElementById('btn-multishape'), document.getElementById('fb-btn-multishape')].forEach(btn => {
    if(btn) {
        btn.addEventListener('dblclick', (e) => {
            e.preventDefault(); e.stopPropagation();
            if(['star','polygon','check','triangle','x-shape'].includes(tool)) { toggleSolidMode(tool); }
        });
    }
});

// [FIX] Eraser Toggle Logic
const toggleEraserMode = (e) => {
    e.preventDefault(); 
    e.stopPropagation();
    
    // Switch Mode
    eraserMode = (eraserMode === 'brush') ? 'object' : 'brush';
    
    // Visual Feedback
    const btn = e.currentTarget;
    if (eraserMode === 'object') {
        btn.innerHTML = '<i class="fa-solid fa-trash"></i>'; // Trash icon for Object Eraser
        btn.title = "Object Eraser (Deletes entire shape)";
        btn.classList.add('solid-mode');
        showToast("Eraser: Object Mode");
    } else {
        btn.innerHTML = '<i class="fa-solid fa-eraser"></i>'; // Standard Eraser icon
        btn.title = "Brush Eraser (Standard)";
        btn.classList.remove('solid-mode');
        showToast("Eraser: Brush Mode");
    }
};
document.querySelectorAll('.tool-btn[data-t="eraser"]').forEach(b => { b.addEventListener('dblclick', toggleEraserMode); });

const toggleHighlighterMode = (e) => {
    // [FIX] Prevent the standard context menu from appearing
    if(e) { e.preventDefault(); e.stopPropagation(); }

    if (!isHighlighter) {
        // ACTIVATING: Save current color, then switch to Yellow
        previousColor = colorPk.value;
        isHighlighter = true;
        colorPk.value = '#FFFF00'; 
    } else {
        // DEACTIVATING: Restore previous color
        isHighlighter = false;
        if (previousColor) colorPk.value = previousColor;
    }

    const iconLine = '<i class="fa-solid fa-slash"></i>'; 
    const iconHighlighter = '<i class="fa-solid fa-highlighter"></i>';
    
    const buttons = document.querySelectorAll('.tool-btn[data-t="line"]');
    buttons.forEach(btn => {
        btn.innerHTML = isHighlighter ? iconHighlighter : iconLine;
        btn.classList.toggle('highlighter-mode', isHighlighter);
        btn.title = isHighlighter ? "Highlighter (Right-Click for Line Tool)" : "Line Tool (Right-Click for Highlighter)";
    });
    
    updateStyle();
    // [NEW] Update the syringe liquid to match the new color state
    updateSyringeLiquid(colorPk.value); 
    renderMain();
};
// [UPDATED] Use 'contextmenu' (Right-Click) listener instead of 'dblclick'
document.querySelectorAll('.tool-btn[data-t="line"]').forEach(b => { b.oncontextmenu = toggleHighlighterMode; });

// --- FOOTER EXTRA TOOLS LOGIC ---
const btnFooterExtras = document.getElementById('btn-footer-extras');
const footerExtrasMenu = document.getElementById('footer-extras-menu');

if(btnFooterExtras) { 
    btnFooterExtras.onclick = (e) => { 
        e.stopPropagation(); 
        // Close other menus if open
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
if(btnEye) btnEye.onclick = () => { 
    tool = 'eyedropper'; 
    if(footerExtrasMenu) footerExtrasMenu.classList.remove('show'); 
    setToolActive(btnEye); 
};

// --- STAMP TOOL ---
const btnStamp = document.getElementById('btn-stamp');
if(btnStamp) {
    btnStamp.onclick = () => { 
        // [FIXED] Simplified: now uses the unified tool handler
        if(footerExtrasMenu) footerExtrasMenu.classList.remove('show'); 
        handleToolClick({ dataset: { t: 'stamp' } });
    };
    
// [CHANGED] Right Click now asks for confirmation
    btnStamp.oncontextmenu = (e) => { 
        e.preventDefault(); 
        showConfirm(`Reset stamp counter (${stampMode})?`, () => { // [MODIFIED] Use stamp mode in prompt
            resetStampCounter();
        });
    };
}

const btnBlur = document.getElementById('btn-blur');
if(btnBlur) btnBlur.onclick = () => { 
    tool = 'blur'; 
    if(footerExtrasMenu) footerExtrasMenu.classList.remove('show'); 
    setToolActive(btnBlur); 
};

const btnMag = document.getElementById('btn-magnifier');
if(btnMag) btnMag.onclick = () => { 
    tool = 'magnifier'; 
    if(footerExtrasMenu) footerExtrasMenu.classList.remove('show'); 
    setToolActive(btnMag); 
};

// [NEW] Hook up Floating Bar Settings
const fbSettings = document.getElementById('fb-settings');
if(fbSettings) fbSettings.onclick = toggleSettings;

function setToolActive(activeBtn) {
    // 1. Deactivate all drawing tools (data-t)
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    
    // 2. Deactivate all custom extra tools (active-tool)
    const extraTools = [document.getElementById('btn-ocr'), document.getElementById('btn-eyedropper'), document.getElementById('btn-stamp'), document.getElementById('btn-blur')];
    extraTools.forEach(b => { if(b) b.classList.remove('active-tool'); });

    // 3. Set the new tool
    if(activeBtn) {
        tool = activeBtn.dataset.tool || activeBtn.dataset.t;
        
        // Find the matching buttons in both toolbars/dropdowns to ensure all visual states are active
        document.querySelectorAll(`[data-t="${tool}"]`).forEach(b => {
             if (b.tagName !== 'BUTTON') return; // Skip non-buttons like selects
            
             // Regular tool buttons get 'active' class (e.g., pen, line, square)
             if (!b.classList.contains('dropdown-item')) { 
                 b.classList.add('active'); 
             }
             
             // Dropdown items get 'active-tool' class
             if (extraTools.some(et => et && et.id === b.id)) {
                 b.classList.add('active-tool');
             }
        });
    }
    
    // 4. Update cursor and bubble visibility
    cursorDot.style.display = 'none';
    frame.classList.remove('cursor-eyedropper');
    
    if(tool === 'eyedropper') { frame.classList.add('cursor-eyedropper'); frame.style.cursor = 'none'; }
    else if(tool === 'ocr') { frame.style.cursor = 'crosshair'; }
    else if(tool === 'stamp') { frame.style.cursor = 'copy'; }
    else if (tool === 'cursor') { frame.style.cursor = 'grab'; }
    else frame.style.cursor = 'crosshair';
    
    updateStampBubble(); 
}

const btnOCR = document.getElementById('btn-ocr');
if(btnOCR) {
    btnOCR.onclick = () => {
        if(footerExtrasMenu) footerExtrasMenu.classList.remove('show');
        tool = 'ocr';
        setToolActive(btnOCR);
    };
}

// --- OCR EXECUTION: SYNCED SCANNER EFFECT ---
const performOCR = async (x, y, w, h) => {
    // [SAFETY CHECK]
    if (typeof Tesseract === 'undefined') {
        showToast("Error: OCR requires internet connection.");
        return;
    }
    const originalIcon = btnOCR.innerHTML;
    
    // 1. Show Loading State
    btnOCR.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    btnOCR.style.color = '#e6e600'; 

    // 2. Create Sci-Fi Scanner Overlay
    const scanner = document.createElement('div');
    scanner.className = 'ocr-scan-overlay';
    scanner.style.left = x + 'px';
    scanner.style.top = y + 'px';
    scanner.style.width = w + 'px';
    scanner.style.height = h + 'px';
    frame.appendChild(scanner);

    // [FIX] Wait 50ms to ensure the element renders before animation starts
    await new Promise(resolve => setTimeout(resolve, 50));

    // [FIX] TIMING SYNC: Wait exactly 2000ms to match the CSS '2s' animation.
    // This ensures the laser hits the bottom right as we finish.
    const minTimePromise = new Promise(resolve => setTimeout(resolve, 2000));

    try {
        const ocrCanvas = document.createElement('canvas');
        ocrCanvas.width = w; ocrCanvas.height = h;
        const ocrCtx = ocrCanvas.getContext('2d');

        // Draw Background (Cropped)
        if (backgroundCanvas.width > 0) {
            ocrCtx.drawImage(backgroundCanvas, x*dpr, y*dpr, w*dpr, h*dpr, 0, 0, w, h);
        }

        // Draw Shapes (Cropped & Filtered)
        const shapesToRender = [...shapes];
        ocrCtx.save();
        ocrCtx.translate(-x, -y); 
        
        // Pass 1: Highlighters
        ocrCtx.globalCompositeOperation = 'multiply';
        shapesToRender.forEach(s => { if (s.opacity < 1 && s.type !== 'eraser-stroke') try { drawShape(ocrCtx, s); } catch(e){} });

        // Pass 2: Normal Ink
        ocrCtx.globalCompositeOperation = 'source-over';
        shapesToRender.forEach(s => { if (s.opacity < 1 && s.type !== 'eraser-stroke') return;
            ocrCtx.globalCompositeOperation = (s.type === 'eraser-stroke') ? 'destination-out' : 'source-over';
            try { drawShape(ocrCtx, s); } catch(e){}
        });
        ocrCtx.restore();

        // Process with Tesseract
        const dataUrl = ocrCanvas.toDataURL('image/png');
        
       // [FIXED] OCR OFFLINE PATHS
        // We use __dirname to create a full "file://" path. 
        // This prevents the Worker thread from getting lost when looking for files.
        const assetBase = 'file://' + __dirname.replace(/\\/g, '/') + '/assets/js/';

        const [result] = await Promise.all([
            Tesseract.recognize(dataUrl, 'eng', {
                // Point explicitly to the full path of the files
                workerPath: assetBase + 'worker.min.js',
                corePath: assetBase + 'tesseract-core.wasm.js',
                langPath: assetBase, // Folder path for eng.traineddata
                gzip: false 
            }),
            minTimePromise
        ]);
        
        const text = result.data.text.trim();

        if (text) {
            clipboard.writeText(text);
            btnOCR.innerHTML = '<i class="fa-solid fa-check"></i>'; 
            btnOCR.style.color = '#00ff00';
            showToast("Text copied to clipboard!");
        } else {
            btnOCR.style.color = '#ff5555';
            showToast("No text detected.");
        }
    } catch (err) {
        console.error("OCR Failed:", err);
        btnOCR.style.color = '#ff5555';
        showToast("OCR Error.");
    } finally {
        // 3. Cleanup
        scanner.remove();
        setTimeout(() => { 
            btnOCR.innerHTML = originalIcon; 
            btnOCR.style.color = ''; 
        }, 2000);
    }
};


// --- SNAP, SAVE, DELETE & RESIZE LOGIC ---

// [NEW] Helper to generate filename based on user settings
function getSaveFilename() {
    const format = userSettings.filenameFmt || 'CapSize_{timestamp}';
    let filename = format;
    
    // Replace {timestamp}
    if (filename.includes('{timestamp}')) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        filename = filename.replace('{timestamp}', timestamp);
    }
    
    // Replace {seq}
    if (filename.includes('{seq}')) {
        const seq = sequenceCounter.toString().padStart(3, '0');
        filename = filename.replace('{seq}', seq);
    }
    
    // Determine extension
    let ext = 'png';
    if(userSettings.imageFormat.includes('jpeg') || userSettings.imageFormat.includes('jpg')) ext = 'jpg';
    else if(userSettings.imageFormat.includes('webp')) ext = 'webp';

    return `${filename}.${ext}`;
}

// [NEW] Helper to explicitly reset the background content
function clearBackground() {
    // 1. Clear Drawing Data (Critical for removing residual shapes/active drawing)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    shapeLayerCtx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    shapeLayerCtx.clearRect(0, 0, shapeLayerCanvas.width, shapeLayerCanvas.height); 

    // 2. Clear Background Image Data (The definitive fix)
    const w = backgroundCanvas.width;
    backgroundCanvas.width = w; // Hard reset pixels and context state
    
    // Re-apply DPI scaling and styles
    bgCtx.scale(dpr, dpr);
    bgCtx.lineCap = userSettings.cornerStyle || 'round';
    bgCtx.lineJoin = userSettings.cornerStyle || 'round';
    
    // [CRITICAL] Clear the main rendering canvas one last time in case of residual state
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
}


const doDelete = () => { 
    // 1. Clear Drawing Data from memory
    shapes = []; 
    selectedShape = null; 
    polygonPoints = []; 
    activeShape = null;

    // 2. Clear All Canvases (Drawing, Shape Layer, and Background)
    clearBackground();

    // 3. Remove Text Inputs from the DOM
    const handles = document.querySelectorAll('#frame > .text-wrapper'); 
    handles.forEach(h => h.remove()); 
    activeTextWrapper = null;

    // 4. Save Empty State & Render
    saveState(); 
    // Re-wire tool to cursor for cleanup convenience
    document.querySelector('.tool-btn[data-t="cursor"]').click();
    renderMain();
};


// [FIXED] Snap Calibration (Strict Integer Rounding)
const doSnap = async () => {
    if (activeTextWrapper) commitActiveText();
    ipcRenderer.send('set-window-opacity', 0);

    try {
        const dataURL = await ipcRenderer.invoke('get-sources'); 
        const img = new Image();

        img.onload = () => {
            // 1. Calculate Exact Coordinates
            const frameRect = frame.getBoundingClientRect();
            
            ipcRenderer.invoke('get-window-pos').then(winPos => {
                const BORDER = 2; // The visual thickness of the green dashed line

                // Frame Position on Screen
                const rootX = winPos.x;
                const rootY = winPos.y;
                const rectL = frameRect.left;
                const rectT = frameRect.top;

                // Source Coordinates (Inner Image only, exclude green border)
                const srcX = Math.round((rootX + rectL + BORDER) * dpr); 
                const srcY = Math.round((rootY + rectT + BORDER) * dpr);
                
                // Capture Dimensions (The Image Size)
                const logicW = frameRect.width - (BORDER * 2);
                const logicH = frameRect.height - (BORDER * 2);
                
                // Physical Pixels to Copy
                const srcW = Math.round(logicW * dpr);
                const srcH = Math.round(logicH * dpr);

                // 2. Update Canvas State
                // [FIX] PREVENT SHRINKING:
                // We keep 'w' and 'h' as the OUTER frame size so the green border doesn't move.
                // The updateCanvasSize() function automatically calculates the inner canvas size based on this.
                w = Math.round(frameRect.width);
                h = Math.round(frameRect.height);
                
                const wasFullscreen = isFullscreen;
                if (isFullscreen) isFullscreen = false; 

                // Resize internal buffers
                updateCanvasSize(w, h, true);
                
                isFullscreen = wasFullscreen;

                // 3. RAW PIXEL COPY
                bgCtx.setTransform(1, 0, 0, 1, 0, 0);
                bgCtx.imageSmoothingEnabled = false; 
                
                bgCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);

                // Draw exact source pixels to destination
                bgCtx.drawImage(
                    img,
                    srcX, srcY, srcW, srcH,   // Source (Screen Physical Pixels)
                    0, 0, srcW, srcH          // Destination (Canvas Physical Pixels)
                );

                // Restore coordinate system
                bgCtx.scale(dpr, dpr);
                bgCtx.lineCap = userSettings.cornerStyle || 'round';
                bgCtx.lineJoin = userSettings.cornerStyle || 'round';

                // 4. Save & Finish
                historyStack = []; historyIndex = -1; updateHistoryButtons(); 
                saveState(); renderMain(); 
                showToast("Screen snapped!");
                
                if (isFullscreen || userSettings.autoClipboard) {
                    if (isFullscreen) hasSnappedInFullscreen = true;
                    if(userSettings.autoClipboard) doClipboard();
                }
            }).catch(err => {
                 console.error("Error getting window position:", err);
                 showToast("Snap failed: Position error.");
            });
        };

        img.src = dataURL; 
    } catch (e) {
        console.error("Snap failed:", e);
        showToast("Snap failed: Cannot capture screen.");
    } finally {
        ipcRenderer.send('set-window-opacity', 1);
    }
};

// [NEW] Helper function for doSnap
const doClipboard = async () => {
    if(activeTextWrapper) commitActiveText();

    // The dimensions of the content, without the frame border
    const contentW = backgroundCanvas.width;
    const contentH = backgroundCanvas.height;

    // Create an image containing only the final image and drawings
    const dataURL = await getFinalImageData(contentW, contentH);
    
    // Copy to clipboard
    const image = nativeImage.createFromDataURL(dataURL);
    clipboard.writeImage(image);

    showToast("Copied to clipboard.");
    return true;
};

// [CRITICAL FIX] Ensure you also re-wire the main SNAP button if it was removed.
if(document.getElementById('btn-snap')) document.getElementById('btn-snap').onclick = doSnap;
// The floating bar button is already wired further down in the file:
// if(document.getElementById('fb-snap')) document.getElementById('fb-snap').onclick = doSnap;
// Connect Save Buttons


// renderer.js (Replacement for doSave, starting around Line 2191)

const doSave = async () => {
    // 1. Commit text if open
    if(activeTextWrapper) commitActiveText();

    // The dimensions of the content, without the frame border
    const contentW = backgroundCanvas.width;
    const contentH = backgroundCanvas.height;

    // 2. Prepare export data using the new helper function
    const dataURL = await getFinalImageData(contentW, contentH);
    
    const format = userSettings.imageFormat || 'image/png';
    // Quality is set inside getFinalImageData now
    
    // [FIXED] Call the new helper function
    let defaultPath = getSaveFilename();
    if(userSettings.savePath && userSettings.savePath.trim() !== '') {
        defaultPath = path.join(userSettings.savePath, defaultPath);
    }

    try {
        const saveResult = await ipcRenderer.invoke('save-image', dataURL, {
            format: format,
            defaultPath: defaultPath
        });
        
        // ... (rest of success/failure logic remains the same)
        if (saveResult === true) {
            // Increment sequence only on success
            if (userSettings.filenameFmt && userSettings.filenameFmt.includes('{seq}')) {
                sequenceCounter++;
                saveSettings();
            }
            
            showToast("Capture saved.");
            
            // CLEAR EVERYTHING
            doDelete(); 

            // If in Fullscreen, hide the frame and reset inputs
            if (isFullscreen) {
                frame.style.display = 'none';
                inpW.value = 0;
                inpH.value = 0;
                isCreatingFrame = false;
                hasSnappedInFullscreen = false;
            }
        }
    } catch (e) {
        console.error("Save failed in renderer:", e);
        showToast("Error saving image.");
    }
};

// Connect Save/Snap/Delete Buttons
if(document.getElementById('btn-save')) document.getElementById('btn-save').onclick = doSave;
if(document.getElementById('fb-save')) document.getElementById('fb-save').onclick = doSave;
if(document.getElementById('btn-snap')) document.getElementById('btn-snap').onclick = doSnap;
if(document.getElementById('fb-snap')) document.getElementById('fb-snap').onclick = doSnap;

// [CRITICAL FIX] Ensure Delete buttons are wired to doDelete
if(document.getElementById('btn-del')) document.getElementById('btn-del').onclick = doDelete;
if(document.getElementById('fb-del')) document.getElementById('fb-del').onclick = doDelete;

// Grid & Styles
const toggleGrid = () => { 
    const g = document.getElementById('grid'); 
    g.classList.toggle('hidden'); 
    const isVisible = !g.classList.contains('hidden'); 
    
    // Update Button States
    document.getElementById('grid-toggle').classList.toggle('active', isVisible); 
    if(document.getElementById('fb-grid-toggle')) document.getElementById('fb-grid-toggle').classList.toggle('active', isVisible);
    
    // Clear guides if hiding
    if (!isVisible) {
        snapLines = [];
    }
    
    // [FIXED] Always render. This ensures the grid appears immediately when toggled ON.
    renderMain();
};

document.getElementById('grid-toggle').onclick = toggleGrid; 
if(document.getElementById('fb-grid-toggle')) document.getElementById('fb-grid-toggle').onclick = toggleGrid;

// [NEW] Centralized Helper to Sync Dotted/Shadow/Solid Buttons AND Active Tool
function updateAuxUI() {
    // 1. Determine Source of Truth (Selected Shape OR Global Defaults)
    let targetDotted = isDotted;
    let targetShadow = isShadow;

    if (selectedShape) {
        targetDotted = selectedShape.isDotted;
        targetShadow = selectedShape.hasShadow;

        // [FIX] Force Dotted OFF for Text shapes explicitly
        if (selectedShape.type === 'text') {
            targetDotted = false;
        }

        // --- SYNC ACTIVE TOOL BUTTON ---
        const shapeType = selectedShape.type;
        
        // Only switch if the type is different and it's a valid drawing tool
        if (tool !== shapeType && shapeType !== 'polygon_drag' && shapeType !== 'eraser-stroke') {
             tool = shapeType;
             
             // Visual Update: Deactivate ALL drawing tools first
             document.querySelectorAll('.tool-btn').forEach(b => {
                const isUtility = ['undo','redo','grid-toggle','btn-dotted','btn-shadow','fb-undo','fb-redo','fb-grid-toggle','fb-btn-dotted','fb-btn-shadow', 'bring-forward', 'send-backward'].includes(b.dataset.t);
                if (!isUtility) b.classList.remove('active');
             });

             // Activate the specific button for this shape
             document.querySelectorAll(`.tool-btn[data-t="${shapeType}"]`).forEach(b => b.classList.add('active'));

             // Handle Multishape Button Activation (Star, Triangle, etc.)
             if (['star', 'triangle', 'polygon', 'check', 'x-shape'].includes(shapeType)) {
                 [document.getElementById('btn-multishape'), document.getElementById('fb-btn-multishape')].forEach(b => {
                     if(b) {
                         b.classList.add('active');
                         b.dataset.t = shapeType; // Sync data-t so it matches selection
                     }
                 });
             }
        }
        // --- END SYNC SECTION ---

        // [NEW] Sync Solid Mode for Shapes (Square, Circle, Star, etc.)
        const solidTypes = ['square', 'circle', 'triangle', 'star', 'polygon', 'check', 'x-shape'];
        if (solidTypes.includes(selectedShape.type)) {
            const isSolid = selectedShape.isSolid || false;
            
            // A. Update Global State
            if(typeof fillStates !== 'undefined') fillStates[selectedShape.type] = isSolid;

            // B. Update Tool Buttons (Visual Icon Swap)
            document.querySelectorAll(`.tool-btn[data-t="${selectedShape.type}"]`).forEach(btn => {
                btn.classList.toggle('solid-mode', isSolid);
                
                // [FIX] Force Icon Update for ALL solid-capable shapes
                if (selectedShape.type === 'square') {
                    btn.innerHTML = isSolid ? '<i class="fa-solid fa-square"></i>' : '<i class="fa-regular fa-square"></i>';
                } else if (selectedShape.type === 'circle') {
                    btn.innerHTML = isSolid ? '<i class="fa-solid fa-circle"></i>' : '<i class="fa-regular fa-circle"></i>';
                } else {
                    // Logic for Star, Triangle, Polygon, etc.
                    const iconClass = selectedShape.type === 'star' ? (isSolid ? 'fa-solid fa-star' : 'fa-regular fa-star') : 
                                      selectedShape.type === 'polygon' ? 'fa-solid fa-draw-polygon' : 
                                      selectedShape.type === 'check' ? 'fa-solid fa-check' : 
                                      selectedShape.type === 'x-shape' ? 'fa-solid fa-xmark' : 'fa-solid fa-play';
                    
                    const outlineClass = (!isSolid && ['triangle','star','polygon'].includes(selectedShape.type)) ? ' outlined-icon' : '';
                    btn.innerHTML = `<i class="${iconClass}${outlineClass}" style="${selectedShape.type === 'triangle' ? 'transform:rotate(-90deg)' : ''}"></i>`;
                }
            });

            // C. Update Multishape Button explicitly (redundancy for safety)
            if (['star', 'triangle', 'polygon', 'check', 'x-shape'].includes(selectedShape.type)) {
                const multiBtns = [document.getElementById('btn-multishape'), document.getElementById('fb-btn-multishape')];
                multiBtns.forEach(btn => {
                    if(btn) {
                        btn.classList.toggle('solid-mode', isSolid);
                        // Apply the same icon update logic to the main menu button
                        const iconClass = selectedShape.type === 'star' ? (isSolid ? 'fa-solid fa-star' : 'fa-regular fa-star') : 
                                          selectedShape.type === 'polygon' ? 'fa-solid fa-draw-polygon' : 
                                          selectedShape.type === 'check' ? 'fa-solid fa-check' : 
                                          selectedShape.type === 'x-shape' ? 'fa-solid fa-xmark' : 'fa-solid fa-play';
                        
                        const outlineClass = (!isSolid && ['triangle','star','polygon'].includes(selectedShape.type)) ? ' outlined-icon' : '';
                        btn.innerHTML = `<i class="${iconClass}${outlineClass}" style="${selectedShape.type === 'triangle' ? 'transform:rotate(-90deg)' : ''}"></i>`;
                    }
                });
            }
        }
    } 
    // [FIX] If no shape is selected, but we are in Text Tool mode, force visuals off
    else if (tool === 'text') {
        targetDotted = false;
    }

    // 2. Update Footer Buttons
    if (footerTools && footerTools.btnDotted) footerTools.btnDotted.classList.toggle('active', !!targetDotted);
    if (footerTools && footerTools.btnShadow) footerTools.btnShadow.classList.toggle('active', !!targetShadow);

    // 3. Update Floating Bar Buttons
    if (fbTools && fbTools.btnDotted) fbTools.btnDotted.classList.toggle('active', !!targetDotted);
    if (fbTools && fbTools.btnShadow) fbTools.btnShadow.classList.toggle('active', !!targetShadow);
}

// [FIXED] Updated Toggle Style Logic (Syncs Globals on Edit)
const toggleStyle = (btn, fbBtn, prop) => {
    // 1. Determine new value based on context
    let newValue;
    
    if (selectedShape) {
        // Toggle the property on the specific shape
        if (prop === 'dotted') {
            selectedShape.isDotted = !selectedShape.isDotted;
            newValue = selectedShape.isDotted;
            isDotted = newValue; // [FIX] Sync Global Default so next shape matches this choice
        } else if (prop === 'shadow') {
            selectedShape.hasShadow = !selectedShape.hasShadow;
            newValue = selectedShape.hasShadow;
            isShadow = newValue; // [FIX] Sync Global Default so next shape matches this choice
        }
        renderMain();
        saveState();
    } else {
        // Toggle the Global Defaults directly (No shape selected)
        if (prop === 'dotted') {
            isDotted = !isDotted;
            newValue = isDotted;
        } else if (prop === 'shadow') {
            isShadow = !isShadow;
            newValue = isShadow;
        }
    }

    // 2. Update visuals to match the new state
    updateAuxUI();

    // 3. Apply changes to active inputs if necessary (like Text Shadow)
    applyPropertyChange(prop, newValue);
};

// Hook up the buttons
if(footerTools && footerTools.btnDotted) { footerTools.btnDotted.onclick = () => toggleStyle(footerTools.btnDotted, fbTools.btnDotted, 'dotted'); fbTools.btnDotted.onclick = footerTools.btnDotted.onclick; }
if(footerTools && footerTools.btnShadow) { footerTools.btnShadow.onclick = () => toggleStyle(footerTools.btnShadow, fbTools.btnShadow, 'shadow'); fbTools.btnShadow.onclick = footerTools.btnShadow.onclick; }

// Window Resize Logic
const handles = document.querySelectorAll('.resize-handle');
let isResizing = false; let resizeDir = '';
let startResizeX, startResizeY, startResizeW, startResizeH, startResizeLeft, startResizeTop;

handles.forEach(h => {
    h.addEventListener('mousedown', (e) => {
        isResizing = true; resizeDir = h.dataset.dir; startResizeX = e.clientX; startResizeY = e.clientY;
        const rect = frame.getBoundingClientRect(); const parentRect = frame.parentElement.getBoundingClientRect();
        startResizeW = rect.width; startResizeH = rect.height; startResizeLeft = rect.left - parentRect.left; startResizeTop = rect.top - parentRect.top;
        frame.style.position = 'absolute'; frame.style.left = startResizeLeft + 'px'; frame.style.top = startResizeTop + 'px'; frame.style.width = startResizeW + 'px'; frame.style.height = startResizeH + 'px';
        frame.style.margin = '0'; frame.style.transform = 'none'; e.stopPropagation(); e.preventDefault();
    });
});

window.addEventListener('mousemove', (e) => {
    if (!isResizing) return; 

    // [NEW] Enforce Crosshair Cursor if Shift is held
    if (e.shiftKey) {
        frame.style.cursor = 'crosshair';
    } else {
        frame.style.cursor = resizeDir + '-resize';
    }
    
    // We are resizing the frame, not drawing a shape.
    const dx = e.clientX - startResizeX; 
    const dy = e.clientY - startResizeY;
    
    let newX = startResizeLeft;
    let newY = startResizeTop;
    let newW = startResizeW;
    let newH = startResizeH;

    // --- Calculate New Dimensions and Position ---
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
    
    // --- Clamp and Normalize ---
    const MIN_SIZE = 50;

    // Width Clamping
    if (newW < MIN_SIZE) {
        if (resizeDir.includes('w')) {
            newX = startResizeLeft + (startResizeW - MIN_SIZE); 
        }
        newW = MIN_SIZE;
    }
    
    // Height Clamping
    if (newH < MIN_SIZE) {
        if (resizeDir.includes('n')) {
            newY = startResizeTop + (startResizeH - MIN_SIZE);
        }
        newH = MIN_SIZE;
    }

    // --- Apply to Frame and Inputs ---
    frame.style.width = newW + 'px'; 
    frame.style.height = newH + 'px'; 
    frame.style.left = newX + 'px'; 
    frame.style.top = newY + 'px';
    inpW.value = Math.round(newW); 
    inpH.value = Math.round(newH);

   // [NEW] Visual Snap: Pure Math Alignment
    // We ignore the DOM element and calculate exactly where the corner coordinate is
    // based on the constrained variables we just calculated.
    if (isResizing) {
        const vpRect = frame.parentElement.getBoundingClientRect();
        
        // Start at the Frame's Top-Left (Screen Coordinate)
        let dotX = vpRect.left + newX;
        let dotY = vpRect.top + newY;
        
        // Adjust X based on handle direction
        if (resizeDir.includes('e')) {
            dotX += newW;       // Right Edge
        } else if (!resizeDir.includes('w')) {
            dotX += newW / 2;   // Horizontal Center
        }
        
        // Adjust Y based on handle direction
        if (resizeDir.includes('s')) {
            dotY += newH;       // Bottom Edge
        } else if (!resizeDir.includes('n')) {
            dotY += newH / 2;   // Vertical Center
        }

        // Apply coordinates
        cursorDot.style.left = dotX + 'px';
        cursorDot.style.top = dotY + 'px';
        cursorDot.style.display = 'block';
    }
    
    // Ensure dot is visible during this operation so the user sees the snap
    cursorDot.style.display = 'block';

    // CRITICAL FIX: Add tooltip update here
    updateMeasureTooltip(e.clientX, e.clientY, `<span>W:</span> ${Math.round(newW)}px  <span>H:</span> ${Math.round(newH)}px`);
    
    // We are returning immediately after this block executes since 'isResizing'
    // is mutually exclusive with 'isDown' drawing logic.
});
window.addEventListener('mouseup', () => { if (isResizing) { isResizing = false; updateCanvasSize(parseInt(frame.style.width), parseInt(frame.style.height), true); } });

// --- [NEW] SETTINGS TAB LOGIC ---

// Define the function used to update slider tooltips
function updateAllSliderTooltips() {
    document.querySelectorAll('input[type="range"]').forEach(input => {
        const val = parseFloat(input.value);
        let text = val;
        
        if (input.id.includes('opacity') || (input.dataset.setting && input.dataset.setting.includes('Opacity'))) {
            text = Math.round(val * 100) + '%';
        } else if (input.id.includes('size')) {
            text = val + 'px';
        } else if (input.dataset.setting === 'imageQuality') {
            text = Math.round(val * 100) + '%';
        } else if (input.dataset.setting === 'shadowBlur') {
            text = val + 'px';
        } 
        // [NEW] Add label for Shadow Distance
        else if (input.dataset.setting === 'shadowDistance') {
            text = val + 'px';
        }
        else if (input.dataset.setting === 'highlighterOpacity') {
            text = Math.round(val * 100) + '%';
        }
        input.title = text;
    });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = btn.dataset.tab;
        
        // --- 1. DEACTIVATE AND RESET SCROLL POSITION OF CURRENT TAB ---
        let currentPane = null;
        document.querySelectorAll('.tab-btn').forEach(b => {
            if (b.classList.contains('active')) {
                const currentId = b.dataset.tab;
                currentPane = document.getElementById(currentId);
            }
            b.classList.remove('active');
        });
        
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

        if (currentPane) {
            // [FIX] Reset the scroll position of the pane we are leaving
            currentPane.scrollTop = 0; 
        }

        // --- 2. ACTIVATE NEW TAB ---
        btn.classList.add('active');
        const targetPane = document.getElementById(tabId);
        if (targetPane) {
            targetPane.classList.add('active');
            // Reset scroll position for the new tab just in case it was open before
            targetPane.scrollTop = 0; 
        }
        
        // Ensure all sliders update their tooltips when the tab is opened
        updateAllSliderTooltips();
    });
});

// Init slider tooltips on startup
updateAllSliderTooltips();
// Update on any input (Ensure this is listening globally, outside of the loop)
document.addEventListener('input', (e) => {
    if(e.target.tagName === 'INPUT' && e.target.type === 'range') updateAllSliderTooltips();
});

ipcRenderer.on('window-shown', () => {
    if (isFullscreen) {
        // [FIXED] Force Ghost Frame Visibility & Interactivity
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        
        // 1. Determine Ghost Size
        const ghostW = userSettings.startupW || 800;
        const ghostH = userSettings.startupH || 600;
        
        // 2. Center Calculation
        // [FIX] We re-calculate this inside the timeout below to ensure window.innerWidth is final
        let cX = (winW - ghostW) / 2;
        let cY = (winH - ghostH) / 2;

        // 3. Force Visibility
        frame.style.display = 'block'; 
        frame.classList.remove('clean-slate'); 
        frame.classList.remove('immersive-active'); 
        frame.style.border = `2px dashed ${userSettings.accentColor}`; 
        
        // 4. Apply Position
        frame.style.position = 'absolute';
        frame.style.left = cX + 'px';
        frame.style.top = cY + 'px';
        frame.style.width = ghostW + 'px';
        frame.style.height = ghostH + 'px';
        frame.style.margin = '0'; 
        
        w = ghostW; h = ghostH;
        if(inpW) inpW.value = w; 
        if(inpH) inpH.value = h;
        
        tool = 'cursor';
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        const cursorBtn = document.querySelector('.tool-btn[data-t="cursor"]');
        if(cursorBtn) cursorBtn.classList.add('active');

        shapes = []; selectedShape = null; activeShape = null;
        isCreatingFrame = false; 
        if(activeTextWrapper) commitActiveText(); 
        ctx.clearRect(0, 0, canvas.width, canvas.height); 
        bgCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
        
        // [FIXED] Recalculate Position (Tooltip removed to prevent visual clutter)
        setTimeout(() => {
            const finalWinW = window.innerWidth;
            const finalWinH = window.innerHeight;
            const finalCX = (finalWinW - ghostW) / 2;
            const finalCY = (finalWinH - ghostH) / 2;
            
            // Re-center frame visually in case window metrics changed
            frame.style.left = finalCX + 'px';
            frame.style.top = finalCY + 'px';
            
            // REMOVED: updateMeasureTooltip(...) call
        }, 150);
    } 
    
    else if (userSettings.startFullscreen && !isFullscreen) {
        if(document.getElementById('btn-fullscreen')) document.getElementById('btn-fullscreen').click();
    }
    else {
        // Standard Windowed Mode Startup
        if (!w || !h || w < 50 || h < 50) {
            w = userSettings.startupW;
            h = userSettings.startupH;
        }
        isSuppressingResize = true; 
        inpW.value = w; 
        inpH.value = h;
        ipcRenderer.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
        updateCanvasSize(w, h);
        ipcRenderer.send('center-window');
        setTimeout(() => {
            updateCanvasSize(w, h);
            isSuppressingResize = false;
        }, 100);
    }
});

// --- ONBOARDING WIZARD LOGIC ---

function updateWizardControls() {
    // Safety check: ensure wizard exists
    if (!document.getElementById('wiz-step-info')) return;

    document.getElementById('wiz-step-info').textContent = `Step ${currentWizardStep + 1} of ${wizPages.length}`;
    
    wizPages.forEach((page, index) => {
        if(page) page.classList.toggle('active', index === currentWizardStep);
    });

    // Back button visibility
    if(wizBack) wizBack.disabled = currentWizardStep === 0;

    // Next/Finish button visibility
    if (currentWizardStep === wizPages.length - 1) {
        if(wizNext) wizNext.classList.add('hidden');
        if(wizFinish) wizFinish.classList.remove('hidden');
        
        // Update hotkey display if element exists
        const hotkeyDisplay = document.getElementById('wiz-finish-hotkey');
        if(hotkeyDisplay) hotkeyDisplay.textContent = userSettings.globalHotkey;
    } else {
        if(wizNext) wizNext.classList.remove('hidden');
        if(wizFinish) wizFinish.classList.add('hidden');
    }
    
    // Update hotkey display in page 2
    if (currentWizardStep === 1) {
        if(wizHotkeyInput) wizHotkeyInput.value = userSettings.globalHotkey;
        if(wizHotkeyDisplay) wizHotkeyDisplay.textContent = userSettings.globalHotkey;
    }
}

function nextWizardStep() {
    if (currentWizardStep < wizPages.length - 1) {
        // Step 2 validation/save: Hotkey
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

function showOnboardingWizard() {
    // 1. Maintain your existing size logic...
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
            ipcRenderer.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
            updateCanvasSize(w, h);
            ipcRenderer.send('center-window');
        }
    }

    // 2. Reset the step and show the modal
    currentWizardStep = 0;
    updateWizardControls();
    
    if(onboardingWizard) {
        onboardingWizard.classList.add('show');
        
        // --- ADD THESE LINES TO FIX THE FINISH BUTTON ---
        const wizFinishBtn = document.getElementById('wiz-finish');
        if (wizFinishBtn) {
            // Force the onclick to the global finish function
            wizFinishBtn.onclick = (e) => {
                e.preventDefault();
                finishOnboarding();
            };
        }
    }
}

function finishOnboarding() {
    const wizDontShowCheck = document.getElementById('wiz-dont-show-check');
    
    // 1. Save "Complete" status based on checkbox
    userSettings.onboardingComplete = wizDontShowCheck ? wizDontShowCheck.checked : false;
    saveSettings(); 
    
    // 2. Hide Wizard
    if(onboardingWizard) onboardingWizard.classList.remove('show');

    // 3. Restore Window Size ONLY if we were in Windowed Mode before
    if (!isFullscreen && preWizardW > 0 && preWizardH > 0) {
        isSuppressingResize = true; 
        
        w = preWizardW;
        h = preWizardH;
        if(inpW) inpW.value = w;
        if(inpH) inpH.value = h;

        ipcRenderer.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
        ipcRenderer.send('center-window'); 
        
        updateCanvasSize(w, h);
        
        setTimeout(() => {
            updateCanvasSize(w, h);
            isSuppressingResize = false;
            preWizardW = 0; preWizardH = 0;
        }, 100);
    }
}

// Re-Attach Listeners (CRITICAL FIX)
if(wizBack) wizBack.onclick = prevWizardStep;
if(wizNext) wizNext.onclick = nextWizardStep;
if(wizFinish) wizFinish.onclick = finishOnboarding;

// [NEW] Wire up Wizard Browse Button
const wizBrowseBtn = document.getElementById('wiz-btn-browse');
if (wizBrowseBtn) {
    wizBrowseBtn.onclick = async () => {
        try {
            const result = await ipcRenderer.invoke('select-directory');
            if (result && !result.canceled) {
                const path = result.filePaths[0];
                
                // 1. Update Settings
                userSettings.savePath = path;
                saveSettings();

                // 2. Update Wizard Input
                document.getElementById('wiz-save-path').value = path;

                // 3. Sync Main Settings Menu Input (so they match)
                if(inpSavePath) inpSavePath.value = path;
            }
        } catch (e) {
            console.error("Wizard Browse Error:", e);
        }
    };
}

// Sync Page 2 hotkey display on input
if(wizHotkeyInput) {
    wizHotkeyInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        wizHotkeyDisplay.textContent = value || "Press key to set";
    });
    // Ensure actual setting change happens when input blurs or 'Next' is pressed
    wizHotkeyInput.addEventListener('change', (e) => {
        const inputEl = document.querySelector('[data-setting="globalHotkey"]');
        if (inputEl) {
            inputEl.value = e.target.value;
            inputEl.dispatchEvent(new Event('change'));
        }
    });
}

// [UPDATED] INJECT DRAG-TO-SHARE "blue hands" BUTTON (Next to Save)
(function() {
    const utilityBtns = document.querySelector('.utility-buttons');
    if (!utilityBtns) return;

    // 1. Create the Button
    const btnDrag = document.createElement('button');
    btnDrag.id = 'btn-drag';
    btnDrag.className = 'btn-icon';
    btnDrag.style.color = '#00bcd4';
    btnDrag.style.marginLeft = '5px'; // Spacing from Save button
    btnDrag.innerHTML = '<i class="fa-solid fa-hand-holding-hand"></i>';
    btnDrag.title = "Drag to Share (Click & Hold)";
    btnDrag.draggable = true; 

    // 2. Insert it AFTER the Save button
    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
        btnSave.after(btnDrag);
    } else {
        utilityBtns.appendChild(btnDrag);
    }

    // renderer.js (Original Lines 2707-2748)

    // renderer.js (Replacement for dragstart handler, around Line 2707)
    // 3. Handle Drag Event
    btnDrag.addEventListener('dragstart', async (e) => {
        e.preventDefault();

        // 1. Get correctly sized image data using the helper
        const contentW = backgroundCanvas.width;
        const contentH = backgroundCanvas.height;
        const dataURL = await getFinalImageData(contentW, contentH);
        
        // 2. Save to Temporary File
        const fs = require('fs');
        const os = require('os');
        const path = require('path');
        
        const buffer = Buffer.from(dataURL.replace(/^data:image\/\w+;base64,/, ""), 'base64');
        const tempPath = path.join(os.tmpdir(), `CapSize_Share_${Date.now()}.png`);
        
        // Ensure directory exists (though tmpdir should exist)
        try {
             fs.writeFileSync(tempPath, buffer);
        } catch (error) {
            console.error("Failed to write temporary file for drag:", error);
            showToast("Drag failed: Cannot write temporary file.");
            return;
        }

        // 3. CREATE CUSTOM DRAG ICON
        const iconCanvas = document.createElement('canvas');
        const iconSize = 48;
        iconCanvas.width = iconSize;
        iconCanvas.height = iconSize;
        const iconCtx = iconCanvas.getContext('2d');

        iconCtx.clearRect(0, 0, iconSize, iconSize);
        
        iconCtx.fillStyle = '#00bcd4'; 
        iconCtx.shadowColor = 'rgba(0,0,0,0.8)';
        iconCtx.shadowBlur = 5;

        // [REQUIRED] Font weight 900 is needed for Solid icons to render
        iconCtx.font = "900 30px 'Font Awesome 6 Free'"; 
        
        iconCtx.textBaseline = 'middle'; 
        iconCtx.textAlign = 'center';

        // [CORRECTED] Unicode for hand-holding-hand
        iconCtx.fillText('\ue4f7', iconSize / 2, iconSize / 2 + 3); 

        const iconDataURL = iconCanvas.toDataURL('image/png');

        // 4. Trigger Native OS Drag via Main Process
        ipcRenderer.send('ondragstart', {
            filePath: tempPath,
            icon: iconDataURL 
        });
    });
})();

// [NEW] Listeners for Palette Customization Inputs
// We attach this to the document because the settings modal is dynamically injected
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('palette-picker')) {
        const index = parseInt(e.target.dataset.index);
        const newColor = e.target.value;
        
        // 1. Update State
        userSettings.customColors[index] = newColor;
        
        // 2. Persist (only if we want instant save, or wait for blur)
        // For smoothness, we update live if the toggle is ON
        if (userSettings.useCustomSwatches) {
            updateSwatches(); // Repaint footer immediately
        }
    }
});

document.addEventListener('change', (e) => {
    if (e.target.classList.contains('palette-picker')) {
        // Commit to localStorage on final selection
        saveSettings();
    }
});

// --- FIX: New Selection Button Logic ---
const fixFbReset = document.getElementById('fb-reset');
if (fixFbReset) {
    fixFbReset.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 1. Clear Shapes and State
        shapes = []; 
        selectedShape = null; 
        activeShape = null; 
        polygonPoints = [];
        historyStack = []; 
        historyIndex = -1;

        // 2. Clear Canvases
        if (typeof ctx !== 'undefined') ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (typeof bgCtx !== 'undefined') {
            bgCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
            const w = backgroundCanvas.width;
            backgroundCanvas.width = w; 
            bgCtx.scale(dpr, dpr);
            bgCtx.lineCap = userSettings.cornerStyle || 'round';
            bgCtx.lineJoin = userSettings.cornerStyle || 'round';
        }
        if (typeof shapeLayerCtx !== 'undefined') shapeLayerCtx.clearRect(0, 0, shapeLayerCanvas.width, shapeLayerCanvas.height);

        // 3. Remove text inputs
        const handles = document.querySelectorAll('#frame > .text-wrapper'); 
        handles.forEach(h => h.remove()); 
        activeTextWrapper = null;

        // 4. Reset Tool
        if (typeof renderMain === 'function') renderMain();
        const cursorBtn = document.querySelector('.tool-btn[data-t="cursor"]');
        if (cursorBtn) cursorBtn.click();

        // 5. Hide Frame (The core "New Selection" behavior)
        if (isFullscreen) {
            // [FIX] Re-apply clean-slate to hide border/crosshair but keep dimming
            frame.classList.add('clean-slate');
            
            frame.style.display = 'block';
            frame.style.width = '0px'; 
            frame.style.height = '0px';
            frame.style.top = '-100px'; 
            frame.style.left = '-100px';
            
            if (inpW) inpW.value = 0; 
            if (inpH) inpH.value = 0;
            isCreatingFrame = false; 
        }
    };
}
// --- FIX: Maximize Frame Button Logic ---
const fixFbMax = document.getElementById('fb-max');
if (fixFbMax) {
    fixFbMax.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 1. Force Frame Visibility and Appearance
        frame.style.display = 'block';
        frame.style.border = `2px dashed ${userSettings.accentColor}`; // Ensure border is visible
        // [CRITICAL FIX] Ensure the 'clean-slate' class is removed if present
        frame.classList.remove('clean-slate'); 
        // Also remove immersive-active just in case it was hiding the border
        frame.classList.remove('immersive-active');
        
        // 2. Calculate Full Dimensions
        // We use window.innerWidth because in fullscreen mode, the body is 100vw/100vh
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        
        w = winW; 
        h = winH;

        // 3. Apply Geometry
        frame.style.left = '0px'; 
        frame.style.top = '0px';
        frame.style.width = w + 'px'; 
        frame.style.height = h + 'px';
        frame.style.margin = '0'; // Remove centering margins if any
        
        // 4. Update Inputs
        if(inpW) inpW.value = w; 
        if(inpH) inpH.value = h;

        // 5. Reset Interaction Flags
        isCreatingFrame = false; 
        
        // 6. Render
        // Re-calculate canvas dimensions based on new w/h (which is fullscreen size)
        updateCanvasSize(w, h, true);
        if (typeof renderMain === 'function') renderMain();
    };
}

// --- CUSTOM TOOLTIP LOGIC (FIXED) ---
const tooltipEl = document.createElement('div');
tooltipEl.className = 'custom-tooltip';
document.body.appendChild(tooltipEl);

// 1. SHOW TOOLTIP
document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[title]');
    if (!target) return;

    // Swap title to data attribute to stop browser tooltip
    const text = target.getAttribute('title');
    target.setAttribute('data-original-title', text);
    target.removeAttribute('title');

    // Set text and show
    tooltipEl.textContent = text;
    tooltipEl.classList.add('visible');

    // Position logic (Below element)
    const rect = target.getBoundingClientRect();
    const tipRect = tooltipEl.getBoundingClientRect();
    
    let top = rect.bottom + 8;
    let left = rect.left + (rect.width / 2) - (tipRect.width / 2);

    // Flip to top if near bottom of screen
    if (top + tipRect.height > window.innerHeight - 5) {
        top = rect.top - tipRect.height - 8;
    }
    
    // Clamp horizontal position
    if (left < 5) left = 5;
    if (left + tipRect.width > window.innerWidth) left = window.innerWidth - tipRect.width - 5;

    tooltipEl.style.top = top + 'px';
    tooltipEl.style.left = left + 'px';
});

// 2. HIDE TOOLTIP (With Safety Check)
document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-original-title]');
    if (target) {
        // [CRITICAL FIX] If we moved into a child element (like the icon), do NOTHING.
        // This prevents the tooltip from flickering or getting stuck.
        if (e.relatedTarget && target.contains(e.relatedTarget)) {
            return;
        }

        // Otherwise, restore title and hide
        target.setAttribute('title', target.getAttribute('data-original-title'));
        target.removeAttribute('data-original-title');
        tooltipEl.classList.remove('visible');
    }
});

// 3. SAFETY: Hide on any click
document.addEventListener('mousedown', () => {
    tooltipEl.classList.remove('visible');
});

document.addEventListener('mouseout', (e) => {
    // When leaving an element, restore the title and hide tooltip
    const target = e.target.closest('[data-original-title]');
    if (target) {
        target.setAttribute('title', target.getAttribute('data-original-title'));
        target.removeAttribute('data-original-title');
        tooltipEl.classList.remove('visible');
    }
});

// --- [NEW] ARROW STYLE DROPDOWN LOGIC ---
const arrowBtn = document.getElementById('btn-arrow-multi');
const fbArrowBtn = document.getElementById('fb-btn-arrow-multi');
const arrowMenu = document.getElementById('arrow-menu');
const fbArrowMenu = document.getElementById('fb-arrow-menu');

const shapeBtn = document.getElementById('btn-multishape');
const fbShapeBtn = document.getElementById('fb-btn-multishape');
// shapeMenu and fbShapeMenu are already defined globally

// Helper to wire up Right-Click (Context Menu)
const setupRightClickMenu = (btn, menu, otherMenus = []) => {
    if (!btn) return;
    
    // 1. Disable default context menu (prevent standard right-click list)
    btn.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 2. Close all other potential open menus
        otherMenus.forEach(m => { if(m) m.classList.remove('show'); });
        if(document.getElementById('footer-extras-menu')) document.getElementById('footer-extras-menu').classList.remove('show');
        if(document.getElementById('fb-tools-menu')) document.getElementById('fb-tools-menu').classList.remove('show');

        // 3. Toggle the target menu
        if(menu) menu.classList.toggle('show');
    };
};

// Wire up Arrow Buttons (Main & Floating)
setupRightClickMenu(arrowBtn, arrowMenu, [fbArrowMenu, shapeMenu, fbShapeMenu]);
setupRightClickMenu(fbArrowBtn, fbArrowMenu, [arrowMenu, shapeMenu, fbShapeMenu]);

// Wire up Shape Buttons (Main & Floating)
setupRightClickMenu(shapeBtn, shapeMenu, [arrowMenu, fbArrowMenu, fbShapeMenu]);
setupRightClickMenu(fbShapeBtn, fbShapeMenu, [arrowMenu, fbArrowMenu, shapeMenu]);

// 2. Handle Style Selection
const handleArrowStyleSelect = (e) => {
    e.stopPropagation();
    const target = e.currentTarget;
    const style = target.dataset.arrow;
    
    // Save Setting
    userSettings.arrowStyle = style;
    saveSettings();
    

    
    // Set Tool to Arrow
    const mainBtn = document.getElementById('btn-arrow-multi');
    if(mainBtn) handleToolClick(mainBtn); 
    
    // Hide Menus
    if(arrowMenu) arrowMenu.classList.remove('show');
    if(fbArrowMenu) fbArrowMenu.classList.remove('show');
    
    if(selectedShape && selectedShape.type === 'arrow') {
        saveState(); 
        renderMain();
    }
};
// 3. Attach Listeners to Items
document.querySelectorAll('.dropdown-item[data-arrow]').forEach(item => {
    item.addEventListener('click', handleArrowStyleSelect);
});

// 4. Close menus on outside click
window.addEventListener('click', (e) => {
    if (arrowMenu && arrowMenu.classList.contains('show') && !arrowMenu.contains(e.target) && !arrowBtn.contains(e.target)) {
        arrowMenu.classList.remove('show');
    }
    if (fbArrowMenu && fbArrowMenu.classList.contains('show') && !fbArrowMenu.contains(e.target) && !fbArrowBtn.contains(e.target)) {
        fbArrowMenu.classList.remove('show');
    }
})

// --- DOUBLE CLICK INTERACTIONS ---
window.addEventListener('dblclick', (e) => {
    const p = getXY(e);
    
    // [FIX] Perform a fresh Hit Test to ensure we grab the shape under the mouse
    // even if the selection state was cleared during the click sequence.
    const hit = hitTest(p);

    // 1. EDIT EXISTING TEXT
    if (hit && hit.type === 'text') {
        const s = hit;
        
        // A. Parse Font String to Sync UI
        const isItalic = s.font.includes('italic');
        const isBold = s.font.includes('bold');
        const sizeMatch = s.font.match(/(\d+)px/);
        const fontSize = sizeMatch ? parseInt(sizeMatch[1]) : 20;
        const fontFamily = s.font.replace(/italic|bold|\d+px|\s/g, ''); 

        // B. Update UI Controls
        if(isItalic !== btnItalic.classList.contains('active')) btnItalic.click();
        if(isBold !== btnBold.classList.contains('active')) btnBold.click();
        
        sizeSl.value = fontSize / 5; 
        fbSizeSl.value = fontSize / 5;
        fontFam.value = fontFamily;
        fbFontFam.value = fontFamily;
        opacitySl.value = s.opacity;
        
        // [FIX] Convert RGB to Hex so Color Picker doesn't turn Black
        let hexColor = s.color;
        if (s.color.startsWith('rgb')) {
            const rgb = s.color.match(/\d+/g);
            if (rgb) {
                hexColor = "#" + ((1 << 24) + (parseInt(rgb[0]) << 16) + (parseInt(rgb[1]) << 8) + parseInt(rgb[2])).toString(16).slice(1);
            }
        }
        colorPk.value = hexColor;
        
        // [FIX] Force Dotted/Shadow OFF for Text Editing to prevent UI glitches
        isDotted = false;
        isShadow = false;
        updateAuxUI(); // Updates the buttons visually
        updateStyle(); 

        // C. Remove the static shape so it doesn't duplicate
        shapes = shapes.filter(sh => sh !== s);
        selectedShape = null;
        
        // Switch tool state to Text
        tool = 'text';
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.t === 'text'));

        // D. Open Input with corrected Hex Color
        createTextInput(s.x, s.y, s.text, hexColor);
        return;
    }

    // 2. TOGGLE CURVE MODE (Lines/Arrows)
    // We also use 'hit' here to make it more reliable
    if (hit && ['line', 'arrow'].includes(hit.type)) {
        const s = hit;
        
        // Calculate center handle position
        let cx, cy;
        if (s.cp) { cx = s.cp.x; cy = s.cp.y; }
        else { cx = (s.x + s.ex)/2; cy = (s.y + s.ey)/2; }

        // Only toggle if clicking near the center handle
        if (Math.hypot(p.x - cx, p.y - cy) < 30) {
            s.curveMode = !s.curveMode;
            
            // If turning ON curve mode, create a control point if missing
            if (s.curveMode) {
                if(!s.cp) s.cp = { x: cx, y: cy };
            } 
            // [FIXED] If turning OFF curve mode, delete the control point
            // This ensures the line snaps back to being perfectly straight
            else {            
            }
            
            saveState();
            renderMain();
        }
    }
});

// --- SETTINGS EXPORT / IMPORT LOGIC ---
setTimeout(() => {
    const btnExport = document.getElementById('btn-export-settings');
    const btnImport = document.getElementById('btn-import-settings');

    // 1. Export Logic
    if (btnExport) {
        btnExport.onclick = async () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userSettings, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "CapSize_Config.json");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            showToast("Settings exported!");
        };
    }

    // 2. Import Logic
    if (btnImport) {
        btnImport.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = e => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = event => {
                    try {
                        const importedObj = JSON.parse(event.target.result);
                        // Validate basic structure by checking for a known key
                        if (importedObj.startupW || importedObj.accentColor) {
                            // Merge and Save
                            userSettings = { ...defaultSettings, ...importedObj };
                            saveSettings();
                            
                            // Force Reload to apply everything cleanly
                            showToast("Config loaded! Reloading...");
                            setTimeout(() => location.reload(), 1000);
                        } else {
                            showToast("Invalid config file.");
                        }
                    } catch (err) {
                        showToast("Error parsing JSON.");
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        };
    }
}, 1000); // Wait 1s to ensure Settings Modal DOM is injected

// Helper: Load an image Blob/File, resize window, and paint background
function loadExternalImage(blob) {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.onload = () => {
        // [FIX] Adjust for High-DPI Screens
        // Screenshots from high-res screens have more pixels than CSS points.
        // We divide by the Device Pixel Ratio to restore the "visual" size.
        const dpr = window.devicePixelRatio || 1;
        
        let newW = Math.round(img.width / dpr);
        let newH = Math.round(img.height / dpr);

        // 1. Calculate Max Dimensions (Clamp to Screen Size - 100px padding)
        const maxW = window.screen.availWidth - 100;
        const maxH = window.screen.availHeight - 100;
        
        // Scale down if image is still massive after DPR adjustment
        if (newW > maxW || newH > maxH) {
            const ratio = Math.min(maxW / newW, maxH / newH);
            newW = Math.round(newW * ratio);
            newH = Math.round(newH * ratio);
            showToast(`Image scaled to ${newW}x${newH}`);
        }
        
        // 2. Resize Window to Fit Image
        w = newW; 
        h = newH;
        
        // Update Inputs
        if(inpW) inpW.value = w;
        if(inpH) inpH.value = h;
        
        // Suppress resize logic while we force the window size
        isSuppressingResize = true;
        
        // Send resize command to Main Process
        ipcRenderer.send('resize-window', { width: w + UI_W_OFFSET, height: h + UI_H_OFFSET });
        ipcRenderer.send('center-window');
        
        // 3. Clear Current State
        doDelete(); // Clears shapes and old background
        
        // 4. Draw New Image to Background Canvas
        updateCanvasSize(w, h); // Resizes internal canvases
        
        // Draw the image scaled to fit the window
        bgCtx.drawImage(img, 0, 0, w, h);
        renderMain(); // Force screen refresh
        
        setTimeout(() => {
            isSuppressingResize = false;
            showToast("Image loaded!");
        }, 200);
        
        URL.revokeObjectURL(url);
    };
    
    img.src = url;
}

// 1. Handle File Drag & Drop
document.body.addEventListener('dragover', (e) => {
    e.preventDefault(); 
    e.stopPropagation();
    // Visual cue
    frame.style.borderColor = '#00ff00';
});

document.body.addEventListener('dragleave', (e) => {
    e.preventDefault(); 
    e.stopPropagation();
    // Restore border
    frame.style.borderColor = userSettings.accentColor;
});

document.body.addEventListener('drop', (e) => {
    e.preventDefault(); 
    e.stopPropagation();
    frame.style.borderColor = userSettings.accentColor;
    
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/')) {
            loadExternalImage(file);
        } else {
            showToast("Not an image file.");
        }
    }
});

// 2. Handle Paste (Ctrl+V) for Images
window.addEventListener('paste', (e) => {
    // If user is pasting text into a text box, ignore this
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.clipboardData && e.clipboardData.items) {
        const items = e.clipboardData.items;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                loadExternalImage(blob);
                e.preventDefault(); // Prevent double-paste issues
                return;
            }
        }
    }
});

// --- FIX: CHEAT SHEET RESET ---
setTimeout(() => {
    const cs = document.getElementById('hotkey-cheat-sheet');
    if (cs) {
        // 1. Reset Container Styles (Fluid & Responsive)
        cs.style.cssText = `
            display: none; 
            position: fixed; 
            top: 50%; left: 50%; 
            transform: translate(-50%, -50%); 
            z-index: 200000;
            background: rgba(30, 30, 30, 0.96);
            border: 1px solid var(--accent);
            border-radius: 12px;
            box-shadow: 0 0 50px rgba(0,0,0,0.8), 0 0 0 100vw rgba(0,0,0,0.4);
            
            /* [UPDATED] Fluid Width */
            width: 85%;           /* Takes up 85% of window width */
            max-width: 1200px;    /* But stops getting huge on massive screens */
            min-width: auto;      /* Remove rigid pixel limits */
            max-height: 95vh;
            overflow: hidden;
            box-sizing: border-box;

            padding: 20px;
            grid-template-columns: repeat(3, 1fr); /* 3 Equal Columns */
            gap: 15px 30px;
            align-items: start;
            justify-content: center;
            backdrop-filter: blur(5px);
        `;
        
        // 2. Inject Clean HTML with Local Style Overrides
        cs.innerHTML = `
            <style>
                /* Force smaller fonts and tighter spacing locally */
                #hotkey-cheat-sheet .hk-desc { font-size: 11px !important; color: #bbb !important; }
                #hotkey-cheat-sheet .hk-key { font-size: 10px !important; padding: 1px 5px !important; min-width: 20px !important; height: 18px !important; line-height: 14px !important; }
                #hotkey-cheat-sheet .hk-row { padding: 3px 0 !important; border-bottom: 1px solid #2a2a2a !important; }
                #hotkey-cheat-sheet .hk-title { font-size: 12px !important; margin-bottom: 8px !important; padding-bottom: 4px !important; }
            </style>

            <div style="display:flex; flex-direction:column; gap:2px;">
                <div class="hk-title">Create</div>
                <div class="hk-row"><span class="hk-desc">Arrows (Cycle)</span><span class="hk-key">A</span></div>
                <div class="hk-row"><span class="hk-desc">Polygon Shapes (Cycle)</span><span class="hk-key">G</span></div>
                <div class="hk-row"><span class="hk-desc">Pen Tool</span><span class="hk-key">P</span></div>
                <div class="hk-row"><span class="hk-desc">Line / Highlt.</span><span class="hk-key">L</span></div>
                <div class="hk-row"><span class="hk-desc">Square</span><span class="hk-key">S</span></div>
                <div class="hk-row"><span class="hk-desc">Circle</span><span class="hk-key">C</span></div>
                <div class="hk-row"><span class="hk-desc">Text Tool</span><span class="hk-key">T</span></div>
            </div>

            <div style="display:flex; flex-direction:column; gap:2px;">
                <div class="hk-title">Utility</div>
                <div class="hk-row"><span class="hk-desc">Extra Tools (Cycle)</span><span class="hk-key">U</span></div>
                <div class="hk-row"><span class="hk-desc">Eraser</span><span class="hk-key">E</span></div>
                <div class="hk-row"><span class="hk-desc">Blur Tool</span><span class="hk-key">B</span></div>
                <div class="hk-row"><span class="hk-desc">OCR Scanner</span><span class="hk-key">O</span></div>
                <div class="hk-row"><span class="hk-desc">Eyedropper</span><span class="hk-key">I</span></div>
                <div class="hk-row"><span class="hk-desc">Magnifier Tool</span><span class="hk-key">Z</span></div>
                <div class="hk-row"><span class="hk-desc">Stamp (Cycle)</span><span class="hk-key">M</span></div>
                <div class="hk-row"><span class="hk-desc">Reset Stamp</span><span class="hk-key">Ctrl+R</span></div>
            </div>

            <div style="display:flex; flex-direction:column; gap:2px;">
                <div class="hk-title">Edit</div>
                <div class="hk-row"><span class="hk-desc">Undo / Redo</span><span class="hk-key">Ctrl+Z / Y</span></div>
                <div class="hk-row"><span class="hk-desc">Nudge Shape</span><span class="hk-key">Arrows</span></div>
                <div class="hk-row"><span class="hk-desc">Layer Order</span><span class="hk-key">[ &nbsp; / &nbsp; ]</span></div>
                <div class="hk-row"><span class="hk-desc">Adjust Size</span><span class="hk-key">Scroll</span></div>
                <div class="hk-row"><span class="hk-desc">Adjust Opacity</span><span class="hk-key">Shift+Scroll</span></div>
                <div class="hk-row"><span class="hk-desc">Delete</span><span class="hk-key">Del</span></div>
            </div>

            <div style="grid-column: 1 / -1; text-align:center; margin-top:10px; padding-top:8px; border-top:1px solid #333; font-size: 10px; color: #666; text-transform:uppercase; letter-spacing:1px;">
                Hold <strong>SHIFT</strong> to Snap Angles &nbsp;&bull;&nbsp; Release <strong>ALT</strong> to close
            </div>
        `;
    }
}, 500);

// ==========================================================
// --- NEW FEATURES: SMART GUIDES, PRESETS, NEEDLE TIP ---
// ==========================================================

// 1. SMART ALIGNMENT LOGIC

// [NEW] Specialized Snapper for Drawing (Snaps Mouse Cursor Only)
function calculateDrawingSnap(p) {
    // Reset lines if starting fresh, or append if we want multiple
    // But usually we clear them at the start of the frame. 
    // Since pointermove runs frequently, we can clear snapLines here if we assume this is the only snap happening.
    // However, to be safe, let's just push to the global array.
    
    // [MODIFIED] Only snap if Smart Guides are enabled AND Grid is visible
    const gridEl = document.getElementById('grid');
    const isGridVisible = gridEl && !gridEl.classList.contains('hidden');

    if (!userSettings.showSmartGuides || !isGridVisible) return p;

    const SNAP_THRESH = 15;
    const INF = 100000;
    
    let newX = p.x;
    let newY = p.y;
    let snappedX = false;
    let snappedY = false;

    // Helper to get bounds
    const getBox = (s) => {
        let bx = s.x || 0, by = s.y || 0, bw = s.w || 0, bh = s.h || 0;
        if (s.points && s.points.length > 0) {
            let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity; 
            s.points.forEach(pt => { minX=Math.min(minX, pt.x); maxX=Math.max(maxX, pt.x); minY=Math.min(minY, pt.y); maxY=Math.max(maxY, pt.y); });
            bx += minX; by += minY; bw = maxX-minX; bh = maxY-minY;
        }
        if (bw < 0) { bx += bw; bw = Math.abs(bw); }
        if (bh < 0) { by += bh; bh = Math.abs(bh); }
        return { l: bx, c: bx + bw/2, r: bx + bw, t: by, m: by + bh/2, b: by + bh };
    };

    shapes.forEach(s => {
        // Don't snap to the shape currently being drawn (it's not in the array yet, but just in case)
        if (s === activeShape) return; 

        const b = getBox(s);
        const vTargets = [b.l, b.c, b.r];
        const hTargets = [b.t, b.m, b.b];

        // Vertical Snaps (X alignment)
        if (!snappedX) {
            vTargets.forEach(target => {
                if (Math.abs(newX - target) < SNAP_THRESH) {
                    newX = target;
                    snappedX = true;
                    snapLines.push({ x1: target, y1: -INF, x2: target, y2: INF });
                }
            });
        }

        // Horizontal Snaps (Y alignment)
        if (!snappedY) {
            hTargets.forEach(target => {
                if (Math.abs(newY - target) < SNAP_THRESH) {
                    newY = target;
                    snappedY = true;
                    snapLines.push({ x1: -INF, y1: target, x2: INF, y2: target });
                }
            });
        }
    });

    return { x: newX, y: newY };
}

function calculateSmartSnaps(active) {
    snapLines = []; 
    if (!active) return;
    // Don't snap freehand lines to things (too messy)
    if (active.type === 'pen' || active.type === 'eraser-stroke') return; 

    // [MODIFIED] Only snap if Grid is visible
    const gridEl = document.getElementById('grid');
    const isGridVisible = gridEl && !gridEl.classList.contains('hidden');

    if (!isGridVisible) return;

    const SNAP_DIST = 25; // Generous snap distance
    
    // 1. Robust Bounding Box Helper
    const getSafeBox = (s) => {
        let bx = s.x || 0, by = s.y || 0, bw = s.w || 0, bh = s.h || 0;
        
        // Handle Pen/Polygon points if present
        if (s.points && s.points.length > 0) {
            let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity; 
            s.points.forEach(p => { 
                minX=Math.min(minX, p.x); maxX=Math.max(maxX, p.x); 
                minY=Math.min(minY, p.y); maxY=Math.max(maxY, p.y); 
            });
            bx += minX; by += minY; bw = maxX-minX; bh = maxY-minY;
        }
        
        // Normalize negatives (if drawn backwards)
        if (bw < 0) { bx += bw; bw = Math.abs(bw); }
        if (bh < 0) { by += bh; bh = Math.abs(bh); }
        
        return { 
            l: Math.round(bx), 
            c: Math.round(bx + bw/2), 
            r: Math.round(bx + bw), 
            t: Math.round(by), 
            m: Math.round(by + bh/2), 
            b: Math.round(by + bh) 
        };
    };

    const a = getSafeBox(active);

    // 2. Define Alignment Targets
    const targets = [
        { val: a.l, type: 'v' }, { val: a.c, type: 'v' }, { val: a.r, type: 'v' },
        { val: a.t, type: 'h' }, { val: a.m, type: 'h' }, { val: a.b, type: 'h' }
    ];

    let snappedX = false;
    let snappedY = false;

    // 3. Iterate All Shapes
    shapes.forEach(s => {
        if (s === active) return; // Skip self
        
        const b = getSafeBox(s);
        const matchPoints = [
            { val: b.l, type: 'v' }, { val: b.c, type: 'v' }, { val: b.r, type: 'v' },
            { val: b.t, type: 'h' }, { val: b.m, type: 'h' }, { val: b.b, type: 'h' }
        ];

        matchPoints.forEach(mp => {
            targets.forEach(t => {
                // If within distance
                if (t.type === mp.type && Math.abs(t.val - mp.val) < SNAP_DIST) {
                    
                    if (t.type === 'v') {
                        if (!snappedX) { 
                            const diff = mp.val - t.val;
                            // Apply Snap
                            active.x += diff; 
                            if(active.ex !== undefined) active.ex += diff;
                            if(active.cp) active.cp.x += diff;
                            snappedX = true;
                        }
                        // Add Vertical Guide (Full Height)
                        snapLines.push({ x1: mp.val, y1: -50000, x2: mp.val, y2: 50000 });
                    } else {
                        if (!snappedY) { 
                            const diff = mp.val - t.val;
                            // Apply Snap
                            active.y += diff;
                            if(active.ey !== undefined) active.ey += diff;
                            if(active.cp) active.cp.y += diff;
                            snappedY = true;
                        }
                        // Add Horizontal Guide (Full Width)
                        snapLines.push({ x1: -50000, y1: mp.val, x2: 50000, y2: mp.val });
                    }
                }
            });
        });
    });
}
// --- STYLE PRESETS LOGIC (FIXED VISUALS) ---
function renderPresets() {
    const containers = [
        document.getElementById('color-popup'),
        document.getElementById('fb-color-popup')
    ];

    containers.forEach(parent => {
        if (!parent) return;

        // Clean up old grid
        const existing = parent.querySelectorAll('.preset-container-wrapper');
        existing.forEach(el => el.remove());

        // Create Wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'preset-container-wrapper';
        // [FIX] Span the entire width of the swatches grid (4 columns)
        wrapper.style.cssText = "grid-column: 1 / -1; border-top: 1px solid #444; margin-top: 8px; padding-top: 8px; width: 100%;";

        // Create Preset Grid (9 items)
        const grid = document.createElement('div');
        grid.style.cssText = "display: grid; grid-template-columns: repeat(9, 1fr); gap: 2px;";

        for (let i = 0; i < 9; i++) {
            const preset = userSettings.stylePresets[i];
            const slot = document.createElement('div');
            
            // [FIX] Better visual styling for small slots
            slot.style.cssText = `
                height: 18px; 
                border-radius: 3px; 
                cursor: pointer;
                /* Remove border, use background color for definition */
                background-color: ${preset ? preset.color : '#333'};
                border: ${preset ? '1px solid rgba(255,255,255,0.3)' : '1px solid #444'};
                display: flex; 
                align-items: center; 
                justify-content: center;
                font-size: 10px; 
                font-weight: bold;
                color: ${preset ? 'rgba(255,255,255,0.8)' : '#666'}; 
                text-shadow: ${preset ? '0 1px 2px rgba(0,0,0,0.8)' : 'none'};
                position: relative;
                transition: transform 0.1s;
            `;

            // Always show the number for clarity
            slot.innerText = i + 1;

            // Hover effect
            slot.onmouseenter = () => { slot.style.transform = 'scale(1.1)'; slot.style.zIndex = '10'; };
            slot.onmouseleave = () => { slot.style.transform = 'scale(1)'; slot.style.zIndex = '1'; };

            // CLICK: LOAD
            slot.onclick = (e) => {
                e.stopPropagation(); 
                e.preventDefault();
                if (preset) {
                    colorPk.value = preset.color;
                    sizeSl.value = preset.width;
                    opacitySl.value = preset.opacity;
                    
                    const fbColor = document.getElementById('fb-color-pk');
                    if(fbColor) fbColor.value = preset.color;
                    if(fbSizeSl) fbSizeSl.value = preset.width;
                    if(fbOpacitySl) fbOpacitySl.value = preset.opacity;

                    applyPropertyChange('color', preset.color);
                    applyPropertyChange('width', preset.width);
                    applyPropertyChange('opacity', preset.opacity);
                    
                    updateStyle();
                    showToast(`Loaded Style ${i + 1}`);
                } else {
                    showToast(`Slot ${i + 1} is empty`);
                }
            };

            // RIGHT CLICK: SAVE
            slot.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                userSettings.stylePresets[i] = {
                    color: colorPk.value,
                    width: parseFloat(sizeSl.value),
                    opacity: parseFloat(opacitySl.value)
                };
                saveSettings();
                renderPresets(); 
                showToast(`Saved to Slot ${i + 1}`);
            };

            grid.appendChild(slot);
        }

        wrapper.appendChild(grid);
        parent.appendChild(wrapper);
    });
}

// Initialize logic once DOM is ready
setTimeout(renderPresets, 500);

// --- HOTKEYS (Ctrl + 1-9) ---
window.addEventListener('keydown', (e) => {
    // [FIXED] Use Ctrl + Number for Presets (Avoids Alt/Shift conflicts)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && !document.activeElement.matches('input, textarea')) {
        const key = parseInt(e.key);

        if (!isNaN(key) && key >= 1 && key <= 9) {
            e.preventDefault();
            const index = key - 1;
            const preset = userSettings.stylePresets[index];

            if (preset) {
                // Apply Settings
                colorPk.value = preset.color;
                sizeSl.value = preset.width;
                opacitySl.value = preset.opacity;
                
                // Sync Floating Bar
                const fbColor = document.getElementById('fb-color-pk');
                if(fbColor) fbColor.value = preset.color;
                if(fbSizeSl) fbSizeSl.value = preset.width;
                if(fbOpacitySl) fbOpacitySl.value = preset.opacity;

                // Update Runtime & Active Shape
                applyPropertyChange('color', preset.color);
                applyPropertyChange('width', preset.width);
                applyPropertyChange('opacity', preset.opacity);
                
                updateStyle();
                showToast(`Preset ${key} Applied`);
            } else {
                showToast(`Preset ${key} is Empty`);
            }
        }
    }
});

// ==========================================================
// --- NEW FEATURE: RIGHT-CLICK CONTEXT MENU ---
// ==========================================================

(function() {
    // 1. Inject Menu Styles
    const ctxStyle = document.createElement('style');
    ctxStyle.innerHTML = `
        .ctx-menu {
            position: fixed; z-index: 200000;
            background: #252525; border: 1px solid #444;
            box-shadow: 0 5px 15px rgba(0,0,0,0.6);
            border-radius: 6px; padding: 4px;
            display: none; flex-direction: column;
            min-width: 180px; font-family: 'Segoe UI', sans-serif;
            backdrop-filter: blur(5px);
        }
        .ctx-menu.show { display: flex; animation: fadeIn 0.1s ease-out; }
        .ctx-item {
            background: transparent; border: none;
            color: #ddd; text-align: left;
            padding: 6px 12px; font-size: 13px;
            cursor: pointer; display: flex; align-items: center; gap: 10px;
            border-radius: 4px; transition: 0.1s;
        }
        .ctx-item:hover { background: var(--accent); color: #1e1e1e; font-weight: 600; }
        .ctx-item i { width: 16px; text-align: center; }
        .ctx-divider { height: 1px; background: #3d3d3d; margin: 4px 0; }
        .ctx-danger:hover { background: #c04040 !important; color: white !important; }
        .ctx-shortcut { margin-left: auto; font-size: 10px; opacity: 0.5; font-family: monospace; }
    `;
    document.head.appendChild(ctxStyle);

    // 2. Inject Menu HTML
    const ctxMenu = document.createElement('div');
    ctxMenu.id = 'shape-ctx-menu';
    ctxMenu.className = 'ctx-menu';
    ctxMenu.innerHTML = `
        <button class="ctx-item" id="cm-top"><i class="fa-solid fa-angles-up"></i> Bring to Front</button>
        <button class="ctx-item" id="cm-up"><i class="fa-solid fa-angle-up"></i> Bring Forward <span class="ctx-shortcut">]</span></button>
        <button class="ctx-item" id="cm-down"><i class="fa-solid fa-angle-down"></i> Send Backward <span class="ctx-shortcut">[</span></button>
        <button class="ctx-item" id="cm-bottom"><i class="fa-solid fa-angles-down"></i> Send to Back</button>
        <div class="ctx-divider"></div>
        <button class="ctx-item" id="cm-dupe"><i class="fa-solid fa-clone"></i> Duplicate <span class="ctx-shortcut">Ctrl+C</span></button>
        <div class="ctx-divider"></div>
        <button class="ctx-item ctx-danger" id="cm-del"><i class="fa-solid fa-trash"></i> Delete <span class="ctx-shortcut">Del</span></button>
    `;
    document.body.appendChild(ctxMenu);

    // 3. Logic: Open Menu (With Smart Positioning)
    window.addEventListener('contextmenu', (e) => {
        const isCanvas = e.target.id === 'canvas' || e.target.closest('.frame');
        const isUI = e.target.closest('.header') || e.target.closest('.footer') || e.target.closest('#floating-bar');
        
        if (selectedShape && isCanvas && !isUI) {
            e.preventDefault();
            isDown = false; isDraggingShape = false; draggingHandle = 0;

            // Dimensions (approximate height of menu with 7 items + dividers)
            const menuW = 190; 
            const menuH = 240; 
            
            let x = e.clientX; 
            let y = e.clientY;
            
            const winW = window.innerWidth;
            const winH = window.innerHeight;

            // Horizontal: Flip left if too far right
            if (x + menuW > winW) {
                x -= menuW;
            }

            // Vertical: Flip up if too far down
            if (y + menuH > winH) {
                y -= menuH;
            }

            // [FIX] Safety Clamp: Ensure it never goes off-screen Top or Left
            // This catches cases where flipping UP pushes it off the top of a small window
            if (x < 0) x = 0;
            if (y < 0) y = 0;

            ctxMenu.style.left = x + 'px';
            ctxMenu.style.top = y + 'px';
            ctxMenu.classList.add('show');
        }
    });

    // 4. Logic: Close Menu
    window.addEventListener('click', (e) => { if (!ctxMenu.contains(e.target)) ctxMenu.classList.remove('show'); });
    window.addEventListener('scroll', () => ctxMenu.classList.remove('show'), {capture: true});

    // 5. Logic: Actions
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

// ==========================================================
// --- FINAL FIX: UNIFIED FLOATING MENU MANAGER ---
// ==========================================================
(function() {
    // 1. Define all floating menus and their trigger buttons
    const menus = [
        { btnId: 'fb-btn-tools',       menuId: 'fb-tools-menu',       trigger: 'click' },      // Left-Click
        { btnId: 'fb-btn-multishape',  menuId: 'fb-shape-menu',       trigger: 'contextmenu' }, // Right-Click
        { btnId: 'fb-btn-arrow-multi', menuId: 'fb-arrow-menu',       trigger: 'contextmenu' }, // Right-Click
        { btnId: 'btn-footer-extras',  menuId: 'footer-extras-menu',  trigger: 'click' }       // Footer Left-Click
    ];

    // 2. Helper to close ALL menus except one (optional)
    function closeAllMenus(exceptMenuId = null) {
        menus.forEach(m => {
            const menuEl = document.getElementById(m.menuId);
            if (menuEl && menuEl.id !== exceptMenuId) {
                menuEl.classList.remove('show');
            }
        });
        
        // Also force close standard footer menus just in case
        const extras = ['shape-menu', 'arrow-menu'];
        extras.forEach(id => {
            const el = document.getElementById(id);
            if(el && el.id !== exceptMenuId) el.classList.remove('show');
        });
    }

    // 3. Re-Attach Listeners with the "Close Others" logic
    menus.forEach(item => {
        const btn = document.getElementById(item.btnId);
        const menu = document.getElementById(item.menuId);

        if (btn && menu) {
            // Remove old listeners to prevent double-firing (cloning checks)
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            // Re-assign generic tool click handler if it was a left-click tool button
            if (item.trigger === 'contextmenu') {
                // Restore the standard left-click "Select Tool" behavior
                newBtn.onclick = (e) => {
                    // Assuming handleToolClick is global
                    if (typeof handleToolClick === 'function') handleToolClick(newBtn);
                };
            }

            // Add the Menu Toggle Listener
            newBtn.addEventListener(item.trigger, (e) => {
                e.preventDefault();
                e.stopPropagation();

                // A. Is the menu currently open?
                const isOpen = menu.classList.contains('show');

                // B. Close EVERY OTHER menu first
                closeAllMenus(item.menuId);

                // C. Toggle this menu (If it was open, close it. If closed, open it.)
                if (isOpen) {
                    menu.classList.remove('show');
                } else {
                    menu.classList.add('show');
                }
            });
        }
    });

    // 4. Global click to close everything when clicking canvas/background
    window.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown') && !e.target.closest('.tool-btn')) {
            closeAllMenus();
        }
    });
})();

// ==========================================================
// --- FIX: RESTORE FLOATING TOOLS ITEM SELECTION ---
// ==========================================================
(function() {
    const toolsMenu = document.getElementById('fb-tools-menu');
    const toolsBtn = document.getElementById('fb-btn-tools');

    if (toolsMenu) {
        toolsMenu.querySelectorAll('.dropdown-item').forEach(item => {
            // [FIX] Use a clean listener to ensure it doesn't conflict
            item.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                // 1. Close the Menu immediately
                toolsMenu.classList.remove('show');

                // 2. Get the tool ID (OCR, Stamp, etc.)
                const toolId = item.dataset.tool || item.dataset.t;
                if (!toolId) return;

                // 3. Set Global Tool State
                tool = toolId;

                // 4. Update Visuals (Highlight the Tools button)
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                if (toolsBtn) toolsBtn.classList.add('active');

                // 5. Activate Tool Logic (Cursors, Bubbles, etc.)
                if (typeof setToolActive === 'function') {
                    setToolActive(item);
                }
            };
        });
    }
})();

// --- [NEW] UPGRADE STAMP COUNTER TO EDITABLE INPUT ---
(function upgradeStampCounter() {
    const oldSpan = document.getElementById('stamp-current-value');
    if (oldSpan && oldSpan.tagName === 'SPAN') {
        // 1. Create Input Element
        const inp = document.createElement('input');
        inp.id = 'stamp-current-value';
        inp.type = 'text';
        inp.style.cssText = "background: transparent; border: none; color: var(--accent); width: 50px; text-align: center; font-weight: 900; font-size: 24px; outline: none; font-family: 'Segoe UI', sans-serif;";
        inp.setAttribute('autocomplete', 'off');
        
        // 2. Replace Span
        oldSpan.replaceWith(inp);

        // 3. Stop Hotkeys while typing (Critical)
        inp.addEventListener('keydown', (e) => { e.stopPropagation(); });
        
        // 4. Handle Value Change
        inp.addEventListener('change', () => {
            const val = inp.value.trim();
            
            if (stampMode === 'number') {
                const num = parseInt(val);
                if (!isNaN(num) && num > 0) {
                    stampCounterValue = num;
                }
            } else {
                // Convert Letter to Code (A=0, B=1...)
                if (val.length > 0) {
                    const charCode = val.toUpperCase().charCodeAt(0);
                    if (charCode >= 65 && charCode <= 90) {
                        stampLetterCode = charCode - 65;
                    }
                }
            }
            // Refresh Bubble to format correctly
            updateStampBubble(); 
        });
        
        // Select text on click for fast editing
        inp.addEventListener('click', () => inp.select());
    }
})();

// [FIX] Global Shift Key Listener
const handleShiftChange = (e) => { 
    if (e.key === 'Shift') {
        const isShiftDown = e.type === 'keydown';
        
        // 1. Force visual update for Resizing (Resize Handle)
        if (typeof isResizing !== 'undefined' && isResizing) {
            frame.style.cursor = isShiftDown ? 'crosshair' : (resizeDir + '-resize');
        }

        // 2. Force re-calculation of Drawing/Dragging
        if (typeof isDown !== 'undefined' && isDown) { 
            // Manually trigger a pointermove to re-run snap logic
            const event = new PointerEvent('pointermove', { 
                clientX: lastClientX, 
                clientY: lastClientY, 
                shiftKey: isShiftDown,
                bubbles: true
            });
            window.dispatchEvent(event);
        }
    }
};
window.addEventListener('keydown', handleShiftChange); 
window.addEventListener('keyup', handleShiftChange);