import { userSettings, AppFeatures } from './Config.js';
import { Templates } from './templates.js';

// ==========================================
// 3. DOM ELEMENTS & CACHING
// ==========================================

const fontMgrStyle = document.createElement('style'); fontMgrStyle.innerHTML = Templates.getFontManagerStyle(); document.head.appendChild(fontMgrStyle);
const obStyle = document.createElement('style'); obStyle.innerHTML = Templates.getOnboardingStyle(); document.head.appendChild(obStyle);
const rbStyle = document.createElement('style'); rbStyle.innerHTML = Templates.getRadiusBubbleStyle(); document.head.appendChild(rbStyle);
const noCursorStyle = document.createElement('style'); noCursorStyle.innerHTML = `.force-no-cursor, .force-no-cursor * { cursor: none !important; }`; document.head.appendChild(noCursorStyle);
const headerDragStyle = document.createElement('style'); headerDragStyle.innerHTML = `.logo-area { -webkit-app-region: drag !important; cursor: default; } .logo-area img, .logo-area span { pointer-events: none; }`; document.head.appendChild(headerDragStyle);

// --- 3B. Dynamic DOM Injections ---
const onboardingHtml = Templates.getOnboardingHtml(AppFeatures);
const rbDiv = document.createElement('div'); rbDiv.innerHTML = Templates.getRadiusBubbleHtml(); document.body.appendChild(rbDiv.firstElementChild);
const measureTip = document.createElement('div'); measureTip.className = 'measure-tooltip'; document.body.appendChild(measureTip);

const magLens = document.createElement('canvas'); magLens.id = 'magnifier-lens'; magLens.style.cssText = `position: fixed; pointer-events: none; z-index: 100000; border: none; border-radius: 50%; overflow: hidden; display: none; box-shadow: 0 5px 25px rgba(0,0,0,0.5); background: #1e1e1e;`; document.body.appendChild(magLens);
const microLens = document.createElement('canvas'); microLens.id = 'micro-lens'; microLens.width = 60; microLens.height = 60; microLens.style.cssText = `position: fixed; pointer-events: none; z-index: 100000; width: 60px !important; height: 60px !important; border-radius: 50%; border: 2.5px solid #111; background: #1e1e1e; display: none; box-shadow: 0 0 0 1px rgba(140,250,150,0.4); filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));`; document.body.appendChild(microLens);
const virtualSyringe = document.createElement('img'); virtualSyringe.id = 'virtual-syringe'; virtualSyringe.style.cssText = `position: fixed; pointer-events: none; z-index: 100001; width: 64px; height: 64px; display: none; filter: drop-shadow(2px 3px 2px rgba(0,0,0,0.7));`; document.body.appendChild(virtualSyringe);
const virtualStamp = document.createElement('div'); 
virtualStamp.id = 'virtual-stamp'; 
virtualStamp.style.cssText = `position: fixed; pointer-events: none; z-index: 100000; display: none; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid var(--accent); background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.15) 2px, rgba(255,255,255,0.15) 4px); opacity: 0.85; transition: width 0.05s, height 0.05s; font-family: Arial, sans-serif; font-weight: bold;`; 
document.body.appendChild(virtualStamp);

// --- 3A. Dynamic CSS Injections ---
const style = document.createElement('style');
style.innerHTML = Templates.getMainStyle(userSettings.accentColor || '#8CFA96');
document.head.appendChild(style);

// --- 3D. Virtual Canvases ---
const backgroundCanvas = document.createElement('canvas'); 
const bgCtx = backgroundCanvas.getContext('2d');
const scratchCanvas = document.createElement('canvas'); 
const scratchCtx = scratchCanvas.getContext('2d');
const shapeLayerCanvas = document.createElement('canvas'); 
const shapeLayerCtx = shapeLayerCanvas.getContext('2d');

const tempDiv = document.createElement('div');
tempDiv.innerHTML = Templates.getSettingsHtml(AppFeatures, userSettings) + Templates.getWizardHtml(AppFeatures, userSettings);
document.body.appendChild(tempDiv.firstElementChild); // Settings Modal
document.body.appendChild(tempDiv.lastElementChild);  // Onboarding Wizard

// --- 3C. Cached Element References ---
const canvas = document.getElementById('canvas'); 
const ctx = canvas.getContext('2d'); 
const frame = document.getElementById('frame'); 
const textLayer = document.getElementById('text-layer');
const cursorDot = document.getElementById('cursor-dot'); 

// Header Inputs & Controls
const inpW = document.getElementById('inp-w'); 
const inpH = document.getElementById('inp-h');
const winResizeGrip = document.getElementById('window-resize-grip');
const btnClose = document.getElementById('btn-close'); 
const btnMin = document.getElementById('btn-min');
const btnUndo = document.getElementById('undo'); 
const btnRedo = document.getElementById('redo');
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnCenter = document.getElementById('btn-center');
const floatingBar = document.getElementById('floating-bar'); 

// Tools & Settings UI
const fontFam = document.getElementById('font-family');
const btnBold = document.getElementById('btn-bold'); 
const btnItalic = document.getElementById('btn-italic');
const sizeSl = document.getElementById('size-sl'); 
const opacitySl = document.getElementById('opacity-sl');
const sizeDot = document.getElementById('size-dot');
const btnMultishape = document.getElementById('btn-multishape');
const gridToggle = document.getElementById('grid-toggle'); 
const shapeMenu = document.getElementById('shape-menu');

const fbFontFam = document.getElementById('fb-font-family');
const fbBtnBold = document.getElementById('fb-btn-bold'); 
const fbBtnItalic = document.getElementById('fb-btn-italic');
const fbSizeSl = document.getElementById('fb-size-sl'); 
const fbOpacitySl = document.getElementById('fb-opacity-sl');
const fbSizeDot = document.getElementById('fb-size-dot');
const fbBtnMultishape = document.getElementById('fb-btn-multishape');
const fbGridToggle = document.getElementById('fb-grid-toggle'); 
const fbShapeMenu = document.getElementById('fb-shape-menu');

const settingsPanel = document.querySelector('.settings'); 
const btnSettings = document.getElementById('btn-help'); 
const settingsModal = document.getElementById('settings-modal'); 
const closeSettings = document.getElementById('close-settings');
const colorPopup = document.getElementById('color-popup');

// Utilities
const radiusBubble = document.getElementById('radius-bubble');
const radiusInput = document.getElementById('radius-bubble-input');
const radiusVal = document.getElementById('radius-bubble-val');
const stampBubble = document.getElementById('stamp-bubble');
const stampCurrentValue = document.getElementById('stamp-current-value');
const stampModeToggle = document.getElementById('stamp-mode-toggle');
const stampReset = document.getElementById('stamp-reset');

// Wizard Elements
const onboardingWizard = document.getElementById('onboarding-wizard');
const wizBack = document.getElementById('wiz-back');
const wizNext = document.getElementById('wiz-next');
const wizFinish = document.getElementById('wiz-finish');
const wizHotkeyInput = document.getElementById('wiz-hotkey-input');
const wizHotkeyDisplay = document.getElementById('wiz-hotkey-display');
const wizFinishHotkey = document.getElementById('wiz-finish-hotkey');
const wizPages = [
    document.getElementById('wiz-page-1'), document.getElementById('wiz-page-2'),
    document.getElementById('wiz-page-3'), document.getElementById('wiz-page-4'),
    document.getElementById('wiz-page-save'), document.getElementById('wiz-page-5')
];

export { 
    onboardingHtml, measureTip, magLens, microLens, virtualSyringe, virtualStamp,
    canvas, ctx, frame, textLayer, cursorDot,
    backgroundCanvas, bgCtx, scratchCanvas, scratchCtx, shapeLayerCanvas, shapeLayerCtx, // These are now valid exports
    inpW, inpH, winResizeGrip, btnClose, btnMin, btnUndo, btnRedo, btnFullscreen, btnCenter, floatingBar,
    fontFam, btnBold, btnItalic, sizeSl, opacitySl, sizeDot, btnMultishape, gridToggle, shapeMenu,
    fbFontFam, fbBtnBold, fbBtnItalic, fbSizeSl, fbOpacitySl, fbSizeDot, fbBtnMultishape, fbGridToggle, fbShapeMenu,
    settingsPanel, btnSettings, settingsModal, closeSettings, colorPopup,
    radiusBubble, radiusInput, radiusVal, stampBubble, stampCurrentValue, stampModeToggle, stampReset,
    onboardingWizard, wizBack, wizNext, wizFinish, wizHotkeyInput, wizHotkeyDisplay, wizFinishHotkey, wizPages
};

export const colorTrigger = document.getElementById('color-trigger'); 
export const fbColorTrigger = document.getElementById('fb-color-trigger'); 
export const colorPk = document.getElementById('color-pk');
export const fbColorPk = document.getElementById('fb-color-pk');
export const btnRgb = document.getElementById('btn-rgb');
export const fbBtnRgb = document.getElementById('fb-btn-rgb');
export const cp = document.getElementById('color-popup');
export const fbCp = document.getElementById('fb-color-popup');