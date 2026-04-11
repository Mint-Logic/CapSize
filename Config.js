// Config.js
// Holds pure data, defaults, and the user's active settings.

export const SYSTEM_FONTS = [
    'Arial', 'Arial Black', 'Helvetica', 'Times New Roman', 'Varela Round', 'Rokkitt', 'Permanent Marker', 'Courier New', 'Verdana', 
    'Georgia', 'Palatino', 'Garamond', 'Bookman',  
    'Trebuchet MS', 'Impact', 'Lucida Sans Unicode', 'Lucida Console',
    'Tahoma', 'Courier', 'Comic Sans MS'
];

export const defaultSettings = {
    globalHotkey: 'PrintScreen',
    startupTool: 'cursor',
    startupW: 840,
    startupH: 340,
    alwaysOnTop: true,
    startFullscreen: true, 
    immersiveMode: false, 
    openAtLogin: false,
    showMeasurements: true,
    showTooltips: true,
    cursorStyle: 'dot',
    defaultEraserMode: 'object',
    arrowStyle: 'v',
    defLineWidth: 4,
    cornerStyle: 'round',
    cornerRadius: 10,
    dottedStyle: 'round',
    snapToGrid: false,
    gridSize: 20,
    gridOpacity: 0.2,
    showSmartGuides: true,
    magnetStrength: 'medium',
    angleSnap: 15,
    imageFormat: 'image/png',
    imageQuality: 1.0,
    exportPadding: 0,
    watermarkText: '',
    savePath: '',
    filenameFmt: 'CapSize_{Y}-{M}-{D}_{h}-{m}-{s}',
    autoClipboard: true,
    autoHideOnShare: true,
    customColors: ['#FF0055', '#FF8800', '#FFDD00', '#00FF66', '#00E5FF', '#0088FF', '#AA00FF', '#FF00AA'],
    useCustomSwatches: false,
    highlighterColor: '#FFFF00',
    highlighterOpacity: 0.5,
    shadowBlur: 8,
    shadowDistance: 4,
    stylePresets: [null, null, null, null, null, null, null, null, null],
    introComplete: false,
    onboardingComplete: false,
    stampCount: 1,
    stampMode: 'number', 
    stampLetterCode: 0,
    stampDefaultSize: 40,
    sequenceCounter: 1, 
    defaultFont: 'Arial',
    customFonts: [], 
    pinnedFonts: [], 
    hiddenFonts: []  
};

// Load user settings from localStorage, fallback to defaults
let loadedSettings = { ...defaultSettings };
try {
    const saved = localStorage.getItem('cs_settings');
    if (saved) {
        loadedSettings = { ...defaultSettings, ...JSON.parse(saved) };
    }
} catch (e) {
    console.warn("Failed to load settings:", e);
}

export const userSettings = loadedSettings;

const IS_PRO_BUILD = window.electronAPI.sendSync('get-is-pro-sync');

export const AppFeatures = {
    type: IS_PRO_BUILD ? 'pro' : 'core',
    appName: IS_PRO_BUILD ? 'CapSize' : 'CapSize Core',
    enableHDDPersistence: IS_PRO_BUILD,
    enableToolbox: IS_PRO_BUILD,      
    enableOCR: IS_PRO_BUILD,
    enableMagnifier: IS_PRO_BUILD,
    enableStamps: IS_PRO_BUILD,       
    allowedShapes: IS_PRO_BUILD ? ['square', 'circle', 'star', 'triangle', 'polygon', 'check', 'x-shape'] : ['square', 'circle', 'star'],
    allowedArrowStyles: IS_PRO_BUILD ? ['v', 'hand', 'triangle', 'concave', 'dot'] : ['v'],
    enableShadows: IS_PRO_BUILD,      
    enableDottedLines: IS_PRO_BUILD,
    enableHighlighter: IS_PRO_BUILD,  
    enableBezierCurves: IS_PRO_BUILD, 
    enableSmartSnapping: IS_PRO_BUILD, 
    enableGrid: IS_PRO_BUILD,
    stylePresetsCount: IS_PRO_BUILD ? 9 : 1,
    enableAutoCopy: IS_PRO_BUILD,
    enableWatermark: IS_PRO_BUILD
};