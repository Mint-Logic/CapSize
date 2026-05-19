// UIBuilder.js
import { Templates } from './templates.js';

export function injectDynamicUI(AppFeatures, userSettings) {
    const fontMgrStyle = document.createElement('style'); fontMgrStyle.innerHTML = Templates.getFontManagerStyle(); document.head.appendChild(fontMgrStyle);
    const obStyle = document.createElement('style'); obStyle.innerHTML = Templates.getOnboardingStyle(); document.head.appendChild(obStyle);
    const rbStyle = document.createElement('style'); rbStyle.innerHTML = Templates.getRadiusBubbleStyle(); document.head.appendChild(rbStyle);
    const noCursorStyle = document.createElement('style'); noCursorStyle.innerHTML = `.force-no-cursor, .force-no-cursor * { cursor: none !important; }`; document.head.appendChild(noCursorStyle);
    const headerDragStyle = document.createElement('style'); headerDragStyle.innerHTML = `.logo-area { -webkit-app-region: drag !important; cursor: default; } .logo-area img, .logo-area span { pointer-events: none; }`; document.head.appendChild(headerDragStyle);

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

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = Templates.getSettingsHtml(AppFeatures, userSettings) + Templates.getWizardHtml(AppFeatures, userSettings);
    document.body.appendChild(tempDiv.firstElementChild); 
    document.body.appendChild(tempDiv.lastElementChild);  

    return { onboardingHtml, measureTip, magLens, microLens, virtualSyringe, virtualStamp };
}

export function injectLateStyles(AppFeatures, userSettings) {
    // --- 1. TACTICAL UI (UNIFIED MASTER STYLES) ---
    setTimeout(() => {
        const oldStyle = document.getElementById('tactical-ui-style');
        if (oldStyle) oldStyle.remove();
        const tacticalUIStyle = document.createElement('style');
        tacticalUIStyle.id = 'tactical-ui-style';
        tacticalUIStyle.innerHTML = `
     
        /* CORE CHASSIS & BACKGROUNDS */
        /* HEADER & FOOTER (Darker, since they sit over the empty window background) */
        .header, .footer { background: repeating-linear-gradient(
            0deg,
            rgba(255, 255, 255, 0.09) 0px,
            rgba(255, 255, 255, 0.09) 1px,
            transparent 1.5px,
            transparent 3px
        ), rgba(12, 14, 16, 0.9) !important; backdrop-filter: blur(20px) saturate(120%) !important; -webkit-backdrop-filter: blur(20px) saturate(120%) !important; border: 1px solid rgba(255, 255, 255, 0.04) !important; border-top: 1px solid rgba(255, 255, 255, 0.15) !important; border-radius: 8px !important; box-sizing: border-box !important; }

        /* BRANDING & LOGO SHADOWS (Object-Fit Bug Fix) */
        .app-logo, .fb-brand-container img, .about-logo { 
    /* Changed to a massive Hot Pink drop-shadow to test visibility */
    filter: drop-shadow(3px 3px 3px #000000) !important; 
}
        
        /* Keep the text shadow for the "CapSize" title and Edition Label */
        .header .title, .fb-brand-container .brand-font { text-shadow: 3px 3px 3px rgba(0, 0, 0, 1), -1px -1px 0px rgba(255, 255, 255, 0.1) !important; }
        .edition-label { box-shadow: 3px 3px 3px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; text-shadow: 2px 2px 2px rgba(0, 0, 0, 1) !important; }

        /* FLOATING BAR (Lighter, so you can actually see the canvas through it) */
        #floating-bar { background: repeating-linear-gradient(
            0deg,
            rgba(255, 255, 255, 0.09) 0px,
            rgba(255, 255, 255, 0.09) 1px,
            transparent 1.5px,
            transparent 3px
        ), rgba(12, 14, 16, 0.5) !important; backdrop-filter: blur(0px) saturate(120%) brightness(0.18) !important; -webkit-backdrop-filter: blur(20px) saturate(120%) brightness(0.4) !important; border: 1px solid rgba(255, 255, 255, 0.04) !important; border-top: 1px solid rgba(255, 255, 255, 0.15) !important; border-radius: 8px !important; box-sizing: border-box !important; }
        .header, .footer { position: fixed !important; left: 2px !important; right: 2px !important; width: auto !important; display: flex !important; align-items: center !important; padding: 0 15px !important; z-index: 99999 !important; }
        .header { top: 2px !important; height: 42px !important; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important; }
        .footer { bottom: 2px !important; height: 42px !important; box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important; }
        .footer .settings { margin-left: auto !important; display: flex !important; gap: 7px !important; align-items: center !important; }
        .header .window-controls { margin-left: auto !important; display: flex !important; gap: 7px !important; }
        .tool-group { display: flex !important; align-items: center !important; gap: 7px !important; }
        
        /* FLOATING BAR SPECIFICS */
        #floating-bar { padding: 4px 14px !important; position: fixed !important; bottom: 60px; z-index: 100000 !important; box-shadow: 0 6px 15px rgba(0, 0, 0, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important; -webkit-app-region: no-drag !important; cursor: grab; transition: opacity 0.2s; }
        
        /* FRAME BOUNDARIES (PREVENTS GIANT SCREEN BUG) */
        #frame { outline-offset: -2px !important; }
        #frame:not([style*="position: absolute"]) { margin-top: 48px !important; margin-bottom: 48px !important; }
        #window-resize-grip, .footer .divider { display: none !important; }

        /* MENUS & POPUPS */
        .dropdown-content, .ctx-menu, .color-popup, #hotkey-cheat-sheet { background: repeating-linear-gradient(

            0deg,

            rgba(255, 255, 255, 0.09) 0px,

            rgba(255, 255, 255, 0.09) 1px,

            transparent 1.5px,

            transparent 3px

        ), rgba(12, 14, 16, 0.9) !important; backdrop-filter: blur(20px) saturate(120%) !important; -webkit-backdrop-filter: blur(20px) saturate(120%) !important; border: 1px solid rgba(255, 255, 255, 0.04) !important; border-top: 1px solid rgba(255, 255, 255, 0.15) !important; border-radius: 8px !important; box-sizing: border-box !important;  box-shadow: 0 10px 30px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1) !important; display: flex !important; padding: 8px !important; opacity: 0 !important; visibility: hidden !important; transform: translateY(12px) scale(0.95) !important; pointer-events: none !important; transition: opacity 0.2s, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), visibility 0.2s !important; }
        .dropdown-content, .ctx-menu { flex-direction: column !important; gap: 6px !important; }
        .color-popup { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 4px !important; width: fit-content !important; }
        .dropdown-content.show, .ctx-menu.show, .color-popup:not(.hidden) { opacity: 1 !important; visibility: visible !important; transform: translateY(0) scale(1) !important; pointer-events: auto !important; }

        /* COLORS & BUTTON ANIMATIONS */
        .btn-snap { background: #252628 !important; box-shadow: 4px 4px 4px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; }
        .btn-snap:hover { background: #252628 !important; box-shadow: 0 0 10px rgba(140, 250, 150, 0.2), 4px 4px 4px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; }
        .btn-snap:active { background: #252628 !important; box-shadow: 1px 1px 1px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; transform: translateY(1px) !important; }
        .swatch, .btn-rgb, #color-trigger, #fb-color-trigger { border: 1px solid rgba(0, 0, 0, 0.8) !important;  border-radius: 4px !important; box-shadow: inset 1.5px 1.5px 2px rgba(255, 255, 255, 0.6), inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.7), 2px 2px 2px rgba(0, 0, 0, 0.8), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; transition: all 0.15s ease !important; min-width: 24px; min-height: 24px; }
        .swatch:hover, .btn-rgb:hover, #color-trigger:hover, #fb-color-trigger:hover { transform: scale(1.02) translateY(-1px) !important; box-shadow: 0 0 8px rgba(140, 250, 150, 0.4), inset 1.5px 1.5px 2px rgba(255, 255, 255, 0.6), inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.6), 2px 2px 2px rgba(0, 0, 0, 0.8), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; z-index: 10; }
        .swatch:active, .btn-rgb:active, #color-trigger:active, #fb-color-trigger:active { transform: scale(0.99) translateY(1px) !important; box-shadow: inset 1.5px 1.5px 2px rgba(255, 255, 255, 0.4), inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.5) !important; }
        .color-popup input[type="text"] { background: rgba(0, 0, 0, 0.4) !important; border: 1px solid rgba(255, 255, 255, 0.1) !important; border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important; border-radius: 4px !important; color: #fff !important; box-shadow: inset 0 2px 5px rgba(0,0,0,0.6) !important; padding: 2px 6px !important; text-align: center !important; }
       #btn-apply { box-shadow: none !important; border: none !important; background: transparent !important; filter: drop-shadow(4px 4px 4px rgba(0, 0, 0, 1)) drop-shadow(-0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1)) !important; transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important; transform-origin: center !important; }
        #btn-apply:hover { transform: scale(1.12) translateY(-1px) !important; color: var(--accent) !important; filter: drop-shadow(0 0 8px rgba(140, 250, 150, 0.6)) drop-shadow(4px 4px 4px rgba(0, 0, 0, 1)) drop-shadow(-0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1)) !important; z-index: 10; }
        #btn-apply:active { transition: all 0.05s ease-in !important; transform: scale(0.92) translateY(1px) !important; filter: drop-shadow(0 0 2px rgba(140, 250, 150, 0.3)) drop-shadow(1px 1px 1px rgba(0, 0, 0, 1)) drop-shadow(-0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1)) !important; }

        /* SLIDER THUMBS & SIZE DOT SHADOWS */
        .size-dot {  width: 21px !important; height: 21px !important; box-shadow: 
        inset 2px 2px 2px rgba(0, 0, 0, 0.6), 
                inset -1px -1px 2px rgba(255, 255, 255, 0.5); !important;}
        input[type="range"]::-webkit-slider-thumb { box-shadow: 0 0 5px var(--accent), 0 0 10px var(--accent), 4px 4px 4px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; }
        input[type="range"]:hover::-webkit-slider-thumb { box-shadow: 0 0 8px var(--accent), 0 0 15px var(--accent), 4px 4px 4px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; }

        /* DRAG GRIP SHADOW */
        .drag-grip::after { box-shadow: 0 0 12px rgba(140, 250, 150, 1.0), 0 0 25px rgba(140, 250, 150, 0.5), 3px 3px 2px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; }

        /* NUMBER INPUT BAR */
        .dims { background: #252628 !important; border: 1px solid rgba(185, 185, 185, 0.8) !important; box-shadow: 
        inset 4px 4px 4px rgba(0, 0, 0, 0.8), 
                inset -0.5px -0.5px 1px rgba(255, 255, 255, 0.05); !important;
         }
        `;
        document.head.appendChild(tacticalUIStyle);
    }, 150);

    // --- 2. BRANDING EDITION LABELS ---
    setTimeout(() => {
        const isPro = AppFeatures.type !== 'core';
        const labelText = isPro ? 'PRO' : 'CORE';
        const labelColor = isPro ? 'var(--accent)' : '#fff'; 
        
        const style = document.createElement('style');
        style.innerHTML = Templates.getBrandingStyle(isPro, labelColor); 
        document.head.appendChild(style);

        const applyLabel = (container) => {
            if (!container) return;
            const oldLabel = container.querySelector('.edition-label');
            if (oldLabel) oldLabel.remove();
            container.innerHTML += `<span class="edition-label">${labelText}</span>`;
        };

        applyLabel(document.querySelector('.header .title'));
        const fbTitle = document.querySelector('.fb-brand-container span');
        if (fbTitle) {
            fbTitle.style.fontSize = '16px'; fbTitle.style.whiteSpace = 'nowrap';  
            fbTitle.style.display = 'flex'; fbTitle.style.alignItems = 'center';  
            applyLabel(fbTitle);
        }
    }, 100);

    // --- 3. ICON SIZING PATCH ---
    const textIconSizeStyle = document.createElement('style');
    textIconSizeStyle.innerHTML = `.tool-btn[data-t="text"] .icon-img { width: 24px !important; height: 24px !important; max-width: none !important; }`;
    document.head.appendChild(textIconSizeStyle);

    setTimeout(() => {
        document.querySelectorAll('.tool-btn[data-t="text"] .icon-img').forEach(img => {
            img.style.transform = ''; img.removeAttribute('style');
        });
    }, 50);

    // --- 4. INDEPENDENT ICON STYLES ---
    const stdIconStyle = document.createElement('style');
    stdIconStyle.innerHTML = `
        .footer .tool-btn, .footer .style-btn, .footer .dropdown-item, #floating-bar .tool-btn, #floating-bar .style-btn, #floating-bar .dropdown-item { width: 26px !important; height: 26px !important; padding: 3px !important; margin: 0 !important; border-radius: 4px !important; background: #252628 !important; border: 1px solid rgba(255, 255, 255, 0.5) !important; box-shadow: 4px 4px 4px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; transition: border-color 0.1s ease, box-shadow 0.1s ease !important; overflow: hidden !important; }
        .footer .dropdown-content, #floating-bar .dropdown-content { min-width: 44px !important; width: 44px !important; align-items: center !important; box-sizing: border-box !important; padding: 4px 0 !important; }
        .dropdown-content .dropdown-item { margin: 4px 0 !important; }
        .footer, .footer .tool-group, .footer .fb-section, .footer .settings, #floating-bar, #floating-bar .tool-group, #floating-bar .fb-section, #floating-bar .settings { gap: 7px !important; }
        .footer .dropdown, #floating-bar .dropdown { display: flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; }
        .footer .tool-btn .icon-img, #floating-bar .tool-btn .icon-img, .footer .dropdown-item .icon-img, #floating-bar .dropdown-item .icon-img { width: 16px !important; height: 16px !important; object-fit: contain !important; transform: none !important;  filter: invert(0.8) !important; }
        .footer .tool-btn:not(.active):hover, #floating-bar .tool-btn:not(.active):hover, .footer .dropdown-item:not(.active-tool):hover, #floating-bar .dropdown-item:not(.active-tool):hover, .footer .style-btn:not(.active):hover, #floating-bar .style-btn:not(.active):hover { background: #252628 !important; border-color: rgba(255, 255, 255, 0.8) !important; box-shadow: 0 0 10px rgba(255, 255, 255, 0.6), 4px 4px 4px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; color: white !important; }
        .footer .tool-btn:not(.active):hover .icon-img, #floating-bar .tool-btn:not(.active):hover .icon-img, .footer .dropdown-item:not(.active-tool):hover .icon-img, #floating-bar .dropdown-item:not(.active-tool):hover .icon-img { filter: invert(1) brightness(2) !important; transform: none !important; }
        .footer .tool-btn.active, #floating-bar .tool-btn.active, .footer .dropdown-item.active-tool, #floating-bar .dropdown-item.active-tool { background: #252628 !important; border-color: var(--accent) !important; box-shadow: 0 0 10px rgba(140, 250, 150, 0.6), 2px 2px 2px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; transform: translateY(1.5px) !important;}
        .footer .tool-btn.active .icon-img, #floating-bar .tool-btn.active .icon-img, .footer .dropdown-item.active-tool .icon-img, #floating-bar .dropdown-item.active-tool .icon-img { transform: translateY(-100px) !important; filter: drop-shadow(0 100px 0 var(--accent)) !important; }
        .footer .custom-font-btn, #floating-bar .custom-font-btn { width: 78px !important; justify-content: space-between !important; padding: 0 4px 0 6px !important; !important; box-shadow: inset 4px 4px 4px rgba(0, 0, 0, 0.9), 
                inset -1px -1px 2px rgba(255, 255, 255, 0.05) !important;
                line-height: 0.9 !important;
                 text-shadow: 2px 2px 2px rgba(0, 0, 0, 1), 
                 -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.12);  }
        .footer .custom-font-btn:hover, #floating-bar .custom-font-btn:hover { 
            background: #252628 !important; 
            border-color: var(--accent) !important; 
           box-shadow: inset 4px 4px 4px rgba(0, 0, 0, 0.9), 
                inset -1px -1px 2px rgba(255, 255, 255, 0.05) !important;} 
            transform: none !important; 
        }
        .custom-font-btn .font-label { 
    display: block !important; 
    white-space: normal !important; 
    font-size: 11px !important;     
    text-align: left !important;
    overflow: hidden !important;
    pointer-events: none; 
    margin-top: 1px !important;
       
        /* THE FIX: An unbreakable width. It literally cannot touch the chevron now. */
    width: 52px !important; 
    min-width: 52px !important;
}
        .custom-font-btn i { font-size: 10px; opacity: 0.5; pointer-events: none; margin-left: 4px; }
        .footer .dropdown-content.font-menu, #floating-bar .dropdown-content.font-menu { width: 180px !important; min-width: 180px !important; max-height: 250px !important; overflow-y: auto !important; padding: 4px !important; align-items: stretch !important; }
        .font-menu::-webkit-scrollbar { width: 6px; } .font-menu::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; } .font-menu::-webkit-scrollbar-thumb:hover { background: var(--accent); }
        .font-optgroup { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 1px; padding: 6px 8px 2px 8px; font-weight: bold; pointer-events: none; }
        .footer .dropdown-content .dropdown-item.font-option, #floating-bar .dropdown-content .dropdown-item.font-option { width: 100% !important; height: auto !important; min-height: 28px !important; padding: 6px 10px !important; justify-content: flex-start !important; border: 1px solid transparent !important; border-radius: 4px !important; font-size: 14px !important; margin: 2px 0 !important; }
        .footer .dropdown-content .dropdown-item.font-option:hover, #floating-bar .dropdown-content .dropdown-item.font-option:hover { background-color: #252628 !important; box-shadow: none !important; border-color: transparent !important; }
    `;
    document.head.appendChild(stdIconStyle);

    const sysIconStyle = document.createElement('style');
    sysIconStyle.innerHTML = `
        .btn-icon, .window-controls .btn-icon { padding: 3px !important; display: flex !important; align-items: center !important; justify-content: center !important; width: 26px !important; height: 26px !important; border-radius: 4px !important; transition: all 0.2s ease !important; background: #252628 !important; border: 1px solid rgba(185, 185, 185, 0.8) !important; margin: 0 !important; box-shadow: 4px 4px 4px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; }
        #floating-bar #fb-max, #floating-bar #fb-reset { border: 1px solid rgba(185, 185, 185, 0.8) !important; }
        .footer .divider, .footer .fb-divider, #floating-bar .fb-divider { height: 32px !important; margin: 0 6px !important; }
        #floating-bar .fb-divider { height: 26px !important; margin: 0 6px !important; }
        #btn-help, #btn-min, #btn-close { padding: 3px !important; width: 26px !important; height: 26px !important; margin: 0 !important; }
        .colored-icon { mask-size: contain !important; -webkit-mask-size: contain !important; mask-repeat: no-repeat !important; -webkit-mask-repeat: no-repeat !important; mask-position: center !important; -webkit-mask-position: center !important; }
        .btn-icon .colored-icon { width: 16px !important; height: 16px !important; background-color: currentColor !important; transform: none !important; }
        #btn-help .colored-icon, #btn-min .colored-icon, #btn-close .colored-icon { transform: none !important; }
        #btn-save, #fb-save, #btn-save-close, #fb-save-close, #btn-drag, #fb-drag, #btn-del, #fb-del, #btn-help, #fb-settings, #btn-quit, #fb-quit, #btn-center, #fb-pos-reset, #fb-monitor-jump, #btn-fullscreen, #fb-exit, #btn-min, #btn-close { color: #B9B9B9 !important; }
        #btn-save:hover, #fb-save:hover, #btn-save-close:hover, #fb-save-close:hover, #btn-drag:hover, #fb-drag:hover, #btn-del:hover, #fb-del:hover, #btn-help:hover, #fb-settings:hover, #btn-center:hover, #fb-pos-reset:hover, #fb-monitor-jump:hover, #btn-fullscreen:hover, #fb-exit:hover, #btn-min:hover, #btn-close:hover, #btn-quit:hover, #fb-quit:hover, #fb-max:hover, #fb-reset:hover { background: #121417 !important; border: 1px solid currentColor !important; transform: scale(1.05) !important; }

       /* PERMANENT GLOW + MACHINED SHADOW FOR SPECIAL BUTTONS */
       #btn-fullscreen, #fb-exit { background: #252628 !important; box-shadow: 0 0 10px rgba(140, 250, 150, 0.5), inset 0 0 5px rgba(140, 250, 150, 0.2), 4px 4px 4px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; }
        #btn-drag, #fb-drag { box-shadow: 0 0 12px rgba(0, 188, 212, 0.6), 3px 3px 3px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; }
        #btn-save:hover, #fb-save:hover, #btn-fullscreen:hover, #fb-exit:hover { color: #00FF66 !important; box-shadow: 0 0 10px rgba(0, 255, 102, 0.6), 3px 3px 3px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; }
        #btn-save-close:hover, #fb-save-close:hover, #btn-min:hover { color: #FFD700 !important; box-shadow: 0 0 10px rgba(255, 215, 0, 0.6), 3px 3px 3px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; }
        #btn-drag:hover, #fb-drag:hover { color: #00E5FF !important; box-shadow: 0 0 10px rgba(0, 229, 255, 0.6), 3px 3px 3px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; }
        #btn-del:hover, #fb-del:hover, #btn-quit:hover, #fb-quit:hover, #btn-close:hover { color: #FF3333 !important; box-shadow: 0 0 10px rgba(255, 51, 51, 0.6), 3px 3px 3px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; }
        #btn-help:hover, #fb-settings:hover, #fb-max:hover, #fb-reset:hover, #btn-center:hover, #fb-pos-reset:hover, #fb-monitor-jump:hover { color: #FFFFFF !important; box-shadow: 0 0 10px rgba(255, 255, 255, 0.6), 3px 3px 3px rgba(0, 0, 0, 1), -0.5px -0.5px 0.5px rgba(255, 255, 255, 0.1) !important; }
    `;
    document.head.appendChild(sysIconStyle);

    // --- 5. UI BEHAVIOR PATCHES ---
    if (AppFeatures.type === 'pro') {
        const hint = "Save (Shift+Click for 'Save As...')";
        [document.getElementById('btn-save'), document.getElementById('fb-save')].forEach(btn => {
            if (btn) { btn.title = hint; btn.setAttribute('data-original-title', hint); }
        });
    }

    setTimeout(() => {
        const fmtInput = document.querySelector('input[data-setting="filenameFmt"]');
        const varContainer = fmtInput ? fmtInput.nextElementSibling : null;
        if (fmtInput && varContainer) {
            varContainer.querySelectorAll('span').forEach(span => {
                span.style.cursor = 'pointer'; span.style.borderBottom = '1px dashed #666'; span.style.padding = '0 2px';
                span.onmouseenter = () => { span.style.color = 'var(--accent)'; span.style.borderBottomColor = 'var(--accent)'; };
                span.onmouseleave = () => { span.style.color = '#666'; span.style.borderBottomColor = '#666'; };
                span.onclick = () => {
                    const start = fmtInput.selectionStart; const end = fmtInput.selectionEnd; const text = fmtInput.value;
                    fmtInput.value = text.substring(0, start) + span.innerText + text.substring(end);
                    fmtInput.dispatchEvent(new Event('change'));
                    fmtInput.focus(); fmtInput.setSelectionRange(start + span.innerText.length, start + span.innerText.length);
                };
            });
        }
    }, 1000);
}