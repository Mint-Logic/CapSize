export const Templates = {
    getSyringeSvg: (colorStr, shift = 0) => {
        // The 'shift' parameter is passed by renderer.js when the mouse is clicked
        const isClicking = shift > 0;
        
        // If clicking, the lightning arcs and the reservoirs flash to full opacity
        const lightningOpacity = isClicking ? 1 : 0;
        const bulbOpacity = isClicking ? 0.9 : 0.4;

        return `
        <svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64' fill='none' stroke='%238CFA96' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' style='filter: drop-shadow(2px 3px 2px rgba(0,0,0,0.7));'>
            <defs>
                <linearGradient id='metal-mint' x1='0' y1='0' x2='1' y2='0'>
                    <stop offset='0' stop-color='%231a2e1c' />
                    <stop offset='0.2' stop-color='%238CFA96' />
                    <stop offset='0.5' stop-color='%23ffffff' />
                    <stop offset='0.8' stop-color='%238CFA96' />
                    <stop offset='1' stop-color='%23111111' />
                </linearGradient>
            </defs>
            <g transform='rotate(45 32 32)'>
                <circle cx='32' cy='18' r='10' fill='${colorStr}' stroke='url(%23metal-mint)' stroke-width='2' style='opacity: ${bulbOpacity};'/>
                <path d='M28 14 Q 32 10 36 14' stroke='rgba(255,255,255,0.7)' stroke-width='1.5'/>
                
                <rect x='20' y='28' width='24' height='4' rx='2' fill='${colorStr}' stroke='url(%23metal-mint)' stroke-width='1.5' style='opacity: ${bulbOpacity};'/>
                
                <path d='M26 32 L26 46 L29 53' stroke='url(%23metal-mint)' stroke-width='3'/>
                <path d='M38 32 L38 46 L35 53' stroke='url(%23metal-mint)' stroke-width='3'/>
                
                <path d='M26 32 L26 46 L29 53' stroke='%23111' stroke-width='1'/>
                <path d='M38 32 L38 46 L35 53' stroke='%23111' stroke-width='1'/>
                
                <path d='M29 53 L31 60' stroke='url(%23metal-mint)' stroke-width='1.5'/>
                <path d='M35 53 L33 60' stroke='url(%23metal-mint)' stroke-width='1.5'/>
                
                <line x1='28' y1='42' x2='36' y2='42' stroke='url(%23metal-mint)' stroke-dasharray='2 2'/>

                <path d='M31 60 L32 58 L33 60' stroke='${colorStr}' stroke-width='2' style='opacity: ${lightningOpacity};'/>
                <path d='M32 58 L30 48 L34 38 L32 32' stroke='${colorStr}' stroke-width='2' style='opacity: ${lightningOpacity};'/>
            </g>
        </svg>
        `;
    },

    // [NEW] FONT MANAGER CSS
    getFontManagerStyle: () => `
        .font-manager-container { margin-top: 10px; background: #222; border: 1px solid #444; border-radius: 4px; overflow: hidden; }
       .font-manager-header { 
    padding: 8px 12px; 
    background: rgba(255, 255, 255, 0.03); /* Ghost background */
    border: 1px solid rgba(255, 255, 255, 0.1); 
    border-radius: 6px;
    cursor: pointer; 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    font-size: 11px; /* Slightly smaller/sleeker */
    font-family: 'Orbitron', sans-serif; /* Thematic font */
    letter-spacing: 1px;
    color: #888; 
    transition: all 0.2s; 
}
        .font-manager-header:hover { 
    background: rgba(140, 250, 150, 0.05); 
    color: var(--accent); 
    border-color: var(--accent);
}
        .font-manager-body { max-height: 0; overflow-y: auto; transition: max-height 0.3s ease-out; background: #1e1e1e; }
        .font-manager-body.open { max-height: 300px; border-top: 1px solid #444; }
        
        .font-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid #2a2a2a; transition: background 0.1s; }
        .font-row:last-child { border-bottom: none; }
        .font-row:hover { background: #252525; }
        .font-row.is-hidden { opacity: 0.5; }
        
        .font-info { display: flex; align-items: center; gap: 10px; flex: 1; overflow: hidden; }
        .font-name { font-size: 13px; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .font-badge { font-size: 9px; padding: 1px 4px; border-radius: 3px; border: 1px solid #555; color: #888; text-transform: uppercase; font-family: 'Segoe UI', sans-serif; font-weight: bold; }
        .font-badge.custom { border-color: var(--accent); color: var(--accent); }
        .font-badge.system { border-color: #444; color: #666; }
        
        .font-actions { display: flex; gap: 5px; align-items: center; }
        .font-btn { background: transparent; border: none; color: #555; cursor: pointer; width: 24px; height: 24px; border-radius: 3px; display: flex; align-items: center; justify-content: center; transition: all 0.1s; }
        
        /* [FIX] Ensure the icon doesn't block the tooltip hover trigger */
        .font-btn i { pointer-events: none; }
        
        .font-btn:hover { background: #333; color: #aaa; }
        .font-btn.active { color: #FFD700; }
        .font-btn.active:hover { color: #ffeb3b; }
        .font-btn.visible-state { color: #888; }
        .font-btn.hidden-state { color: #d9534f; }
        .font-btn.delete:hover { color: #ff5555; background: rgba(255, 85, 85, 0.1); }
    `,

    // 1. CORE ENFORCER STYLE (Hides Pro features)
    getCoreStyle: () => `
    /* GROUP 1: PRESERVE LAYOUT (Invisible but takes space) */
    /* This ensures that dividers and neighboring buttons don't shift */
    #fb-tools-dropdown, 
    #fb-max, 
    #fb-pos-reset, 
    #fb-monitor-jump,
    #footer-extra-tools, 
    #btn-footer-extras,
    #btn-dotted, 
    #btn-shadow, 
    #fb-btn-dotted, 
    #fb-btn-shadow {
        visibility: hidden !important;
        pointer-events: none !important;
        opacity: 0 !important;
    }
    
    /* GROUP 2: COLLAPSE LAYOUT (Only for items inside vertical menus) */
    /* Since these are inside dropdowns, removing them doesn't affect the horizontal bar size */
    .dropdown-item[data-sub="triangle"],
    .dropdown-item[data-sub="polygon"],
    .dropdown-item[data-sub="check"],
    .dropdown-item[data-sub="x-shape"],
    .dropdown-item[data-arrow="hand"],
    .dropdown-item[data-arrow="triangle"],
    .dropdown-item[data-arrow="concave"],
    .dropdown-item[data-arrow="dot"],
    
    /* GENERIC HIDER CLASS */
    .pro-only { display: none !important; }
`,

    // 2. MAIN APPLICATION CSS
    getMainStyle: (accentColor) => `
        /* [FIXED] @import must be the very first rule */
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap');

        /* [NEW] Override System Blue Selection with Theme Accent */
        ::selection { background: ${accentColor}; color: #1e1e1e; }

        /* --- MAIN WINDOW BRANDING --- */
    .header { padding-right: 5px !important; } 
    .window-controls, #btn-help, .utility-buttons { flex-shrink: 0 !important; z-index: 50000 !important; }
    .settings { margin-right: 5px !important; }
    .header .title { font-family: 'Orbitron', sans-serif !important; }

    :root { --accent: ${accentColor}; }

    @keyframes badgePulse {
            0% { box-shadow: 0 0 10px rgba(140, 250, 150, 0.1); }
            50% { box-shadow: 0 0 20px rgba(140, 250, 150, 0.3); }
            100% { box-shadow: 0 0 10px rgba(140, 250, 150, 0.1); }
        }
        .license-active-badge { animation: badgePulse 3s infinite ease-in-out; }
        
        .brand-font { font-family: 'Orbitron', sans-serif !important; letter-spacing: 1px !important; text-transform: none !important; }
        button:focus, .tool-btn:focus, .btn-snap:focus, .btn-icon:focus { outline: none !important; box-shadow: none !important; }
        
        body { margin: 0; padding: 0; width: 100vw; height: 100vh; display: flex !important; flex-direction: column !important; background: transparent !important; overflow: hidden !important; position: fixed; top: 0; left: 0; font-family: 'Segoe UI', sans-serif; }
        
        /* --- TACTICAL NEON SCROLLBAR --- */
        ::-webkit-scrollbar { 
            width: 8px;  /* Ultra-thin and modern */
            height: 8px; 
        }

        ::-webkit-scrollbar-track { 
            background: transparent; /* Lets the dark background show through */
            border-left: 1px solid rgba(255, 255, 255, 0.02); /* Faint structural line */
        }

        ::-webkit-scrollbar-thumb { 
            background: rgba(140, 250, 150, 0.25); /* Dim, dormant mint green */
            border-radius: 4px; 
        }

        ::-webkit-scrollbar-thumb:hover { 
            background: rgba(140, 250, 150, 0.7); /* Toned down to 75% opacity */
            box-shadow: 0 0 8px rgba(140, 250, 150, 0.4); /* Softer, less aggressive glow */
        }

        ::-webkit-scrollbar-corner { 
            background: transparent; 
        }

        /* COLOR PICKERS */
        .sleek-color { -webkit-appearance: none; border: none !important; padding: 0 !important; background-color: transparent !important; cursor: pointer; height: 15px !important; width: 50px !important; outline: none !important; }
        .sleek-color::-webkit-color-swatch-wrapper { padding: 0 !important; }
        .sleek-color::-webkit-color-swatch { border: none !important; border-radius: 4px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2); }

        /* LAYOUT */
        .header, .footer, #floating-bar { flex: 0 0 44px !important; z-index: 9999 !important; -webkit-app-region: drag !important; transition: opacity 0.3s; }
        .viewport { flex: 1 1 auto !important; position: relative !important; display: flex !important; justify-content: center !important; align-items: center !important; overflow: hidden !important; width: 100% !important; }
        .header { min-width: 0 !important; overflow: hidden !important; }

        /* FRAME & CANVAS */
        .frame { -webkit-app-region: no-drag !important; pointer-events: auto !important; position: relative; box-sizing: border-box !important; transform-origin: top left; z-index: 20; border: 2px dashed var(--accent) !important; transition: border-color 0.3s; }
        canvas { pointer-events: auto !important; display: block; position: absolute; top: 0; left: 0; touch-action: none !important; }
        
        /* IMMERSIVE & FULLSCREEN */
        body.immersive-active .frame { border: 2px solid transparent !important; box-shadow: none !important; }
        body.immersive-active .resize-handle { display: none !important; }
        body.immersive-active #window-resize-grip { display: none !important; }
        body.immersive-active .corner-bracket { opacity: 1 !important; } 
        body.fullscreen .frame { box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.2) !important; border: 2px dashed var(--accent) !important; }
        body.fullscreen .frame.clean-slate { border: none !important; }
        body.fullscreen .frame.clean-slate * { display: none !important; }
        body.fullscreen .frame.clean-slate::before, body.fullscreen .frame.clean-slate::after { display: none !important; }
        body.fullscreen .frame.immersive-active { border-color: rgba(255,255,255,0.05) !important; }

        /* HANDLES & CONTROLS */
        .rh-se { position: absolute !important; bottom: -5px !important; right: -5px !important; cursor: se-resize !important; width: 10px !important; height: 10px !important; z-index: 20005 !important; }
        .resize-handle { z-index: 20001 !important; }
        .resize-handle:hover { background: var(--accent) !important; opacity: 0.5; }
        #window-resize-grip { z-index: 20000 !important; -webkit-app-region: no-drag !important; pointer-events: auto !important; cursor: nwse-resize !important; position: absolute !important; bottom: 0 !important; right: 0 !important; width: 20px !important; height: 20px !important; }
        #window-resize-grip:hover { color: var(--accent) !important; }

        /* UI ELEMENTS */
        .green-text, .dims input, .dims span { color: var(--accent) !important; }
        
        #btn-fullscreen, #fb-exit {
            border: 1px solid var(--accent) !important;
            color: var(--accent) !important;
            background: rgba(140, 250, 150, 0.08) !important;
            box-shadow: 0 0 10px rgba(140, 250, 150, 0.5), inset 0 0 5px rgba(140, 250, 150, 0.2) !important;
            transition: all 0.2s ease-in-out !important;
        }

        #btn-fullscreen:hover, #fb-exit:hover {
            background: rgba(140, 250, 150, 0.07) !important;
            color: var(--accent) !important;
            border: 1px solid var(--accent) !important;
            box-shadow: 0 0 8px var(--accent), inset 0 0 10px rgba(140, 250, 150, 0.2) !important; 
            transform: scale(1.05) !important;
        }

        /* [NEW] CYAN GLOW for Drag-to-Share */
        #btn-drag:hover, #fb-drag:hover {
            background: rgba(0, 188, 212, 0.07) !important;
            color: #00bcd4 !important; /* Force Cyan Icon */
            border: 1px solid #00bcd4 !important;
            box-shadow: 0 0 8px #00bcd4, inset 0 0 10px rgba(0, 188, 212, 0.2) !important;
            transform: scale(1.05) !important;
        }

     
       /* --- MINIMAL EDGE-LIT SNAP BUTTON (TEXT GLOW) --- */
        .btn-snap { 
            background: rgba(140, 250, 150, 0.05) !important; 
            color: var(--accent) !important;                  
            border: 1px solid var(--accent) !important;       
            
            font-family: 'Orbitron', sans-serif !important;
            font-weight: 700 !important; 
            font-size: 13px !important;
            letter-spacing: 1.5px !important;
            padding: 0 18px !important; 
            height: 26px !important;
            border-radius: 4px !important;
            
            box-shadow: none !important;  
            text-shadow: none !important; 
            
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
            text-transform: uppercase !important;
            
            transition: all 0.2s ease !important; 
            cursor: pointer !important;
        }

        .btn-snap:hover { 
            box-shadow: none !important; 
            
            /* Dialed back the opacity: 60% for the tight core, 30% for the outer spread */
            text-shadow: 0 0 8px rgba(140, 250, 150, 0.6), 
                         0 0 16px rgba(140, 250, 150, 0.3) !important; 
                         
            transform: translateY(-1px) !important; 
        }

        .btn-snap:active { 
            box-shadow: none !important;
            
            /* Very subtle 40% glow on press */
            text-shadow: 0 0 4px rgba(140, 250, 150, 0.4) !important;
            
            transform: translateY(1px) !important;    
            /* Reduced the background flash opacity from 0.1 to 0.05 so it's barely there */
            background: rgba(140, 250, 150, 0.05) !important; 
        }
        
       /* [UPDATED] ACTIVE STATE: Thin Glowing Frame + Neon Icon */
        .tool-btn.active { 
            /* 1. Thin Mint Border */
            border: 1px solid var(--accent) !important; 
            
            /* 2. Very Subtle Mint Background */
            background-color: rgba(140, 250, 150, 0.05) !important; 
            
            /* 3. The Glow Effect (Outer + Inner) */
            box-shadow: 0 0 10px rgba(140, 250, 150, 0.3), 
                        inset 0 0 5px rgba(140, 250, 150, 0.1) !important;
            
            transform: translateY(-1px); 
        }
        
        /* [NEW] Custom PNG Icon Styles */
        .icon-img {
            width: 20px;
            height: 20px;
            object-fit: contain;
            pointer-events: none;
            filter: invert(0.8); 
            transition: filter 0.1s; 
        }
        
        /* [NEW] MINT GUIDE ICONS (Uses mask to force Mint color) */
        .guide-icon-mint {
            width: 14px; height: 14px;
            display: inline-block; vertical-align: middle;
            background-color: var(--accent); /* Force Mint */
            -webkit-mask-size: contain; -webkit-mask-repeat: no-repeat; -webkit-mask-position: center;
            mask-size: contain; mask-repeat: no-repeat; mask-position: center;
            margin-right: 4px;
        }

        /* [NEW] OUTPUT TAB ICON (Inherits text color: Grey -> Mint) */
        .tab-icon-mask {
            width: 16px; height: 16px;
            display: inline-block; vertical-align: middle;
            background-color: currentColor; /* Inherit Grey or Mint from parent */
            -webkit-mask-size: contain; -webkit-mask-repeat: no-repeat; -webkit-mask-position: center;
            mask-size: contain; mask-repeat: no-repeat; mask-position: center;
            margin-right: 10px;
        }

        .style-btn.active, .tool-btn.style-active { background-color: #444 !important; color: var(--accent) !important; border: 1px solid var(--accent) !important; }
        .btn-icon.active { color: var(--accent) !important; background: rgba(255, 255, 255, 0.1); box-shadow: 0 0 5px rgba(140, 250, 150, 0.2); }
        
        .drag-grip { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; -webkit-app-region: drag !important; cursor: grab; margin-left: 4px; }
        .drag-grip i, .drag-grip svg { display: none !important; }
        .drag-grip::after { 
            content: ''; 
            width: 7px; 
            height: 7px; 
            background-color: #8CFA96; 
            box-shadow: 0 0 12px rgba(140, 250, 150, 1.0), 0 0 25px rgba(140, 250, 150, 0.5); 
            border-radius: 1px; 
        }

        /* INTERACTIONS & INPUTS */
        input[type="range"] { accent-color: var(--accent) !important; }
        .header input, .header button, .footer button, .footer input, .style-btn, .tool-btn, .utility-buttons button, .window-controls button, .dims input, .dims button, .control-group-center button, #color-trigger, #fb-color-trigger, #size-sl, #fb-size-sl, #opacity-sl, #fb-opacity-sl, #btn-close, #btn-min, #btn-max, #btn-help, #floating-bar button, #floating-bar div, .dropdown-item, select { -webkit-app-region: no-drag !important; position: relative !important; z-index: 20000 !important; cursor: pointer !important; }
        .header input, .footer input { cursor: text !important; pointer-events: auto !important; user-select: text !important; }
        input[type="number"]:focus, input[type="text"]:focus, .st-input:focus { outline: none; border-color: var(--accent) !important; box-shadow: 0 0 8px rgba(140, 250, 150, 0.4), inset 0 0 4px rgba(140, 250, 150, 0.1); transition: box-shadow 0.2s ease-in-out; }

        /* POPUPS & MENUS */
        .color-popup { position: absolute; background: #252525; border: 1px solid #444; padding: 8px; border-radius: 6px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 50000; }
        #floating-bar .dropdown-content { position: absolute !important; cursor: default !important; }
        
        /* TEXT TOOL */
        .text-wrapper { position: absolute; display: flex; align-items: center; z-index: 2000; pointer-events: auto; }
        .text-handle { width: 12px; height: 24px; background: var(--accent); cursor: move; margin-right: 6px; border-radius: 2px; border: 1px solid #1e1e1e; box-shadow: 0 1px 3px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 8px; color: #000; font-weight: bold; }
        .text-handle::after { content: '::'; }
        .input-container { position: relative; }
        
        /* [FIXED] Increased padding and line-height to support letters like j, g, p, y */
        .float-input { background: transparent; border: none; color: #0000FF; font-size: 20px; outline: none; padding: 0 0 6px 0; line-height: 1.15; width: 100%; min-width: 20px; text-shadow: 0 0 2px rgba(255,255,255,0.5); }
        .text-sizer { visibility: hidden; white-space: nowrap; position: absolute; top: 0; left: 0; font-size: 20px; padding: 0 0 6px 0; line-height: 1.15; }

        /* CURSORS & OVERLAYS */
        .cursor-eyedropper { cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32' fill='none' stroke='%238CFA96' stroke-width='1' stroke-linecap='round' stroke-linejoin='round' style='filter: drop-shadow(1px 1.5px 1.2px rgba(0,0,0,0.7));'><rect x='0' y='31' width='1' height='1' fill='%2322262a' stroke='none' /><path d='M21 11 L27 5' stroke-width='1' /><path d='M25 3 L29 7' stroke-width='2' /><path d='M1 31 L13 19' stroke-width='1' /><rect x='13' y='7' width='6' height='16' rx='0.5' transform='rotate(45 16 16)' fill='rgba(255,255,255,0.15)' stroke='%238CFA96' /><rect x='14.2' y='8.2' width='3.6' height='13.6' rx='0.2' transform='rotate(45 16 16)' fill='rgba(255,255,255,0)' /></svg>") 0 32, crosshair !important; }
        .ocr-scan-overlay { position: absolute; border: 2px solid var(--accent); box-shadow: 0 0 15px var(--accent), inset 0 0 20px rgba(140, 250, 150, 0.1); pointer-events: none; z-index: 9999; overflow: hidden; background: rgba(0, 20, 0, 0.05); border-radius: 4px; }
        .ocr-scan-overlay::after { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: #fff; box-shadow: 0 0 4px #fff, 0 0 10px var(--accent), 0 0 20px var(--accent); animation: scan-line 2s linear forwards; }
        @keyframes scan-line { 0% { top: -10%; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { top: 110%; opacity: 0; } }
        #flash-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: white; z-index: 200000; pointer-events: none; opacity: 0; transition: opacity 0.15s ease-out; mix-blend-mode: hard-light; }

       /* SETTINGS MODAL */
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 60000; justify-content: center; align-items: center; backdrop-filter: blur(5px); }
        .modal.show { display: flex; }
       .guide-content { background: #0B0C0E; border: .1px solid rgba(140, 250, 150, 0.3); border-radius: 12px; width: 950px; height: 660px; display: flex; flex-direction: column; box-shadow: 0 15px 45px rgba(0,0,0,0.9), 0 0 30px rgba(140, 250, 150, 0.1); overflow: hidden; }
        .guide-header { padding: 15px 25px; background: #0E1012; border-bottom: 1px solid rgba(255, 255, 255, 0.05); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
        .guide-header h2 { font-size: 18px !important; margin: 0 !important; color: #fff !important; font-weight: 700 !important; letter-spacing: 0.5px !important; }
        .settings-body { display: flex; flex: 1; overflow: hidden; }
        .settings-sidebar { width: 180px; background: #0d1014; border-right: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; padding: 15px 0 50px 0; overflow-y: auto; }
        .settings-main { flex: 1; background: #090a0c; padding: 0; overflow-y: auto; }
        .sidebar-section { margin-top: 15px; padding: 0 20px; font-size: 11px; font-weight: 800; color: #777; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 5px; }
        .sidebar-section:first-child { margin-top: 0; }
        .tab-btn { background: transparent; border: none; color: #888; font-size: 14px; font-weight: 500; padding: 10px 20px; cursor: pointer; text-align: left; border-left: 3px solid transparent; transition: 0.2s; display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .tab-btn:hover { color: #ccc; background: rgba(255,255,255,0.02); }
        .tab-btn.active { color: var(--accent); border-left: 3px solid var(--accent); background: rgba(140, 250, 150, 0.05); font-weight: bold; }
        .tab-btn i { width: 20px; text-align: center; font-size: 14px; }
        .tab-pane { display: none; padding: 25px 30px; animation: fadeIn 0.3s; }
        .tab-pane.active { display: block; }
        
        /* SETTINGS FORM ELEMENTS */
        .setting-group { margin-bottom: 25px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 25px; }
        .setting-group:last-child { border-bottom: none; }
        .st-title { color: var(--accent) !important; font-size: 15px; font-weight: bold; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; letter-spacing: 0.5px; }
        .setting-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .setting-label { color: #ddd; font-size: 13px; font-weight: 600; }
        .setting-desc { color: #777; font-size: 11px; margin-top: 3px; max-width: 350px; }
        .st-input, .st-select { background: #12161a; border: 1px solid #333; color: #fff; padding: 6px 10px; border-radius: 4px; outline: none; font-size: 12px; transition: border-color 0.2s; }
        .st-input:focus, .st-select:focus { border-color: var(--accent); }
        .toggle { 
    position: relative; 
    display: inline-block; 
    width: 34px; /* Shrunk from 40px */
    height: 18px; /* Shrunk from 22px */
}
        .toggle input { opacity: 0; width: 0; height: 0; }
        .slider { 
    position: absolute; 
    cursor: pointer; 
    top: 0; left: 0; right: 0; bottom: 0; 
    background-color: #222; 
    border: 1px solid #444; /* Added defined border */
    transition: .3s; 
    border-radius: 20px; 
}

.slider:before { 
    position: absolute; 
    content: ""; 
    height: 12px; /* Shrunk from 16px */
    width: 12px; /* Shrunk from 16px */
    left: 2px; 
    bottom: 2px; 
    background-color: #666; 
    transition: .3s cubic-bezier(0.68, -0.55, 0.265, 1.55); /* Bouncy movement */
    border-radius: 50%; 
}

input:checked + .slider { 
    background-color: rgba(140, 250, 150, 0.1); 
    border-color: var(--accent); 
}

input:checked + .slider:before { 
    transform: translateX(16px); 
    background-color: var(--accent); 
    box-shadow: 0 0 8px var(--accent); /* Miniature glow */
}
        .browse-group { display: flex; gap: 5px; }
        .btn-browse { 
    background: rgba(140, 250, 150, 0.05) !important; 
    color: var(--accent) !important; 
    border: 1px solid rgba(140, 250, 150, 0.3) !important; 
    border-radius: 4px; 
    padding: 5px 12px; 
    cursor: pointer; 
    font-size: 11px; 
    font-family: 'Orbitron', sans-serif;
    font-weight: 700;
    transition: all 0.2s;
}
        .btn-browse:hover { 
    background: rgba(140, 250, 150, 0.15) !important; 
    border-color: var(--accent) !important;
    box-shadow: 0 0 10px rgba(140, 250, 150, 0.2);
}
        .guide-close { font-size: 18px; color: #666; transition: 0.2s; cursor: pointer; padding: 5px; }
        .guide-close:hover { color: #c04040; transform: rotate(90deg); }
        .btn-reset { font-size: 10px; background: transparent; color: #666; border: 1px solid #444; padding: 2px 8px; cursor: pointer; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
        .btn-reset:hover { color: #aaa; border-color: #888; background: #333; }
        /* Custom Hover for the Updates Button */
#btn-check-updates {
    transition: all 0.2s ease !important;
}

#btn-check-updates:hover {
    background: rgba(140, 250, 150, 0.15) !important; /* Soft Mint Glow */
    color: var(--accent) !important;
    border-color: var(--accent) !important;
    box-shadow: 0 0 10px rgba(140, 250, 150, 0.2) !important;
    transform: translateY(-1px); /* Slight lift */
}

#btn-check-updates:active {
    transform: translateY(1px); /* Physical press effect */
    background: rgba(140, 250, 150, 0.05) !important;
}
    
        /* GUIDE GRIDS */
        .g-section { margin-bottom: 25px; }
        .g-title { color: var(--accent) !important; font-size: 14px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
        .g-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .g-item { font-size: 13px; color: #ccc; line-height: 1.6; background: #12161a; padding: 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); transition: transform 0.2s; }
        .g-item:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
        .g-item strong { color: var(--accent) !important; display: block; margin-bottom: 6px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px; }
        .g-icon { display: inline-flex; width: 20px; height: 20px; background: #444; border-radius: 3px; align-items: center; justify-content: center; font-size: 10px; margin-right: 5px; color: #fff; }
        .k-badge { background: #333; border: 1px solid #555; border-bottom: 2px solid #555; color: #fff; border-radius: 4px; padding: 1px 6px; font-family: 'Consolas', monospace; font-size: 11px; font-weight: bold; }
        
        /* TOOL SPECIFICS */
        .tool-btn.highlighter-mode::after { content: ''; position: absolute; bottom: 2px; right: 2px; width: 6px; height: 6px; background-color: #ffeb3b; border: 1px solid #000; border-radius: 50%; z-index: 20002; }
        .tool-btn.active.highlighter-mode::after { background-color: #ffeb3b; border-color: #1e1e1e; }
        .tool-btn.solid-mode::after { content: ''; position: absolute; bottom: 2px; right: 2px; width: 5px; height: 5px; background-color: #fff; border: 1px solid #000; border-radius: 50%; z-index: 20002; }
        .tool-btn.active.solid-mode::after { background-color: #1e1e1e; border-color: #1e1e1e; }
        .outlined-icon { color: transparent !important; -webkit-text-stroke: 1.5px #aaa; }
        .tool-btn.active .outlined-icon { -webkit-text-stroke: 1.5px #1e1e1e; }
        
       /* TOAST & CONFIRM */
        .toast { 
            position: fixed; 
            top: 60px; 
            left: 50%; 
            transform: translateX(-50%) translateY(-10px); /* Start slightly higher */
            background: #1e1e1e; 
            color: var(--accent); 
            border: 1px solid var(--accent); 
            padding: 8px 16px; 
            border-radius: 4px; 
            z-index: 100000; 
            font-size: 13px; 
            font-weight: bold; 
            letter-spacing: 0.5px; 
            box-shadow: 0 5px 15px rgba(0,0,0,0.5); 
            pointer-events: none; 
            opacity: 0; 
            /* [FIX] Transition ALL properties to smooth the movement */
            transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1); 
        }
        
        .toast.show { 
            opacity: 1; 
            /* Drop into place */
            transform: translateX(-50%) translateY(0px); 
        }
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
        
        /* WIZARD STYLES */
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
        
        /* GENERAL UI IMPROVEMENTS */
        .tool-btn, .btn-icon, .style-btn, .stamp-control-btn { transition: all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important; }
        .tool-btn:active, .btn-icon:active, .style-btn:active, .stamp-control-btn:active { transform: scale(0.92) !important; }
        #floating-bar { 
            background: repeating-linear-gradient(45deg, #0B0C0E, #0B0C0E 10px, #0E1012 10px, #0E1012 20px) !important; 
            backdrop-filter: none !important;
            box-shadow: 0 5px 20px rgba(0,0,0,0.8), 0 0 20px rgba(140, 250, 150, 0.15) !important; 
            border: .7px solid rgba(140, 250, 150, 0.6) !important; 
        }
        .custom-tooltip { position: fixed; background: #1e1e1e; color: var(--accent); border: 1px solid var(--accent); padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; font-family: 'Segoe UI', sans-serif; pointer-events: none; z-index: 100000; box-shadow: 0 4px 10px rgba(0,0,0,0.5); opacity: 0; transform: translateY(5px); transition: opacity 0.15s, transform 0.15s; white-space: nowrap; }
        .custom-tooltip.visible { opacity: 1; transform: translateY(0); }
        
        .logo-area { -webkit-app-region: drag !important; cursor: default; }
        .logo-area img, .logo-area span { pointer-events: none; }
    
       /* --- FLOATING BAR COMPACT LAYOUT --- */
        #floating-bar { 
            padding: 4px 12px !important; 
            width: auto !important;         
            min-width: fit-content !important;
            max-width: 1550px !important;
            justify-content: center !important; 
        }

        #floating-bar .tool-group,
        #floating-bar .settings,
        #floating-bar .fb-section {
            flex: 0 0 auto !important; 
            width: auto !important;
            justify-content: flex-start !important;
        }

        /* [REMOVED] #fb-save override so it perfectly obeys the global 6px gap */

        .divider { width: 2px; height: 32px; background: rgba(255, 255, 255, 0.6); margin: 0 !important; }

        #floating-bar .fb-divider { 
            flex: 0 0 1px !important;     
            width: 1px !important;
            min-width: 1px !important;
            height: 32px !important; 
            align-self: center !important;
            background: rgba(255, 255, 255, 0.6) !important;
            margin: 0 6px !important; /* Dialed back from 8px to 6px */
            display: block !important; 
            opacity: 1 !important;
        }

        /* [UPDATED] Keep Brand compact, let flex gap handle the spacing naturally */
        #floating-bar .fb-brand-container {
            flex: 0 0 auto !important;
        }
        
        #floating-bar select { width: 92px !important; height: 22px !important; font-size: 11px !important; }
        #floating-bar input[type="range"] { width: 40px !important; }
        
        #floating-bar .btn-snap { 
            padding: 0 15px !important; 
            font-size: 12px !important; 
            height: 24px !important;      
            width: 65px !important;
            margin-right: -4px !important; 
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            line-height: 1 !important;
        }
        
        #floating-bar .color-trigger-btn { width: 20px !important; height: 20px !important; }
        #floating-bar .size-dot-wrapper { width: 16px !important; height: 16px !important; }
        #floating-bar .size-dot { width: 100% !important; height: 100% !important; }
    `,

    // 3. ONBOARDING CSS
    getOnboardingStyle: () => `
        .onboarding-content { background: #1e1e1e; border: 1px solid #444; border-radius: 12px; width: 950px; height: 600px; display: flex; flex-direction: column; box-shadow: 0 15px 45px rgba(0,0,0,0.8); overflow: hidden; position: relative; }
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
        /* --- LAYER FIX: Modals Must Top Everything --- */
        .modal, #onboarding-wizard { z-index: 200000 !important; }

        .ob-footer { height: 50px; border-top: 1px solid #333; background: #0E1012; display: flex; justify-content: space-between; align-items: center; padding: 0 25px; flex-shrink: 0; }
        .ob-left-controls { display: flex; align-items: center; gap: 20px; }
        .ob-dots { display: flex; gap: 10px; }
        .dot { width: 8px; height: 8px; background: #555; border-radius: 50%; transition: 0.3s; cursor: pointer; border: 1px solid transparent; } 
        .dot.active { background: var(--accent); border: 1px solid var(--accent); box-shadow: 0 0 8px rgba(140, 250, 150, 0.5); } 
        .ob-actions { display: flex; gap: 15px; }

       /* --- CLEAN BUTTON PHYSICS (NO GLOW) --- */
        .ob-btn-pri, .ob-big-btn, #wiz-next, #wiz-finish, #ob-start-btn {
            background: var(--accent) !important;
            color: #0B0C0E !important;
            font-family: 'Orbitron', sans-serif !important;
            font-weight: 900 !important;
            letter-spacing: 1px !important;
            text-transform: uppercase !important;
            border: none !important;
            border-radius: 4px !important;
            padding: 8px 25px !important;
            font-size: 13px !important;
            cursor: pointer;
            /* Just a clean drop shadow, no inner glass or neon bleed */
            box-shadow: 0 2px 5px rgba(0,0,0,0.4) !important;
            transition: all 0.15s ease-out !important;
            pointer-events: auto !important; 
        }

        .ob-btn-pri:hover, .ob-big-btn:hover, #wiz-next:hover, #wiz-finish:hover, #ob-start-btn:hover {
            filter: brightness(1.1) !important; /* Slight brighten */
            /* Lift it slightly, keep shadow dark/clean, NO MINT GLOW */
            box-shadow: 0 4px 10px rgba(0,0,0,0.6) !important;
            transform: translateY(-1px) !important;
            color: #0B0C0E !important;
        }

        .ob-btn-pri:active, .ob-big-btn:active, #wiz-next:active, #wiz-finish:active, #ob-start-btn:active {
            filter: brightness(0.9) !important;
            /* Press it down into the page */
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.4) !important;
            transform: translateY(1px) !important;
        }

        /* --- SECONDARY GHOST BUTTONS --- */
        .ob-btn-sec, #wiz-back, #btn-run-setup, #ob-setup-btn, #wiz-btn-browse {
            background: rgba(255, 255, 255, 0.03) !important;
            color: #ccc !important;
            font-family: 'Orbitron', sans-serif !important;
            font-weight: 700 !important;
            letter-spacing: 1px !important;
            text-transform: uppercase !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            border-radius: 4px !important;
            padding: 7px 18px !important;
            font-size: 12px !important;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
            pointer-events: auto !important; /* GUARANTEES CLICKS */
        }

        .ob-btn-sec:hover, #wiz-back:hover, #btn-run-setup:hover, #ob-setup-btn:hover, #wiz-btn-browse:hover {
            background: rgba(255, 255, 255, 0.08) !important;
            color: #fff !important;
            border-color: rgba(255, 255, 255, 0.3) !important;
            box-shadow: 0 5px 15px rgba(0,0,0,0.5) !important;
            transform: translateY(-2px) scale(1.05) !important;
        }

        .ob-btn-sec:active, #wiz-back:active, #btn-run-setup:active, #ob-setup-btn:active, #wiz-btn-browse:active {
            background: rgba(0, 0, 0, 0.2) !important;
            transform: translateY(1px) scale(0.95) !important;
        }

        .ob-big-btn { margin-top: 15px; font-size: 15px !important; padding: 10px 30px !important; }

        .about-hero { 
            text-align: center; 
            padding: 20px 30px; 
            background: #12161a; /* Matches the new input/card backgrounds */
            border-radius: 8px; 
            border: 1px solid rgba(255, 255, 255, 0.05); /* Subtle edge */
            margin-bottom: 20px; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            gap: 0px; 
            box-shadow: inset 0 2px 10px rgba(0,0,0,0.5); /* Gives it a nice recessed look */
        }
        .about-logo { width: 80px; height: 80px; margin-bottom: 2px; }
        .about-ver { color: #777; font-size: 12px; margin-bottom: 0px; }
        .copyright-notice { margin-top: 0px; padding-top: 5px; text-align: center; font-size: 11px; color: #666; width: 100%; letter-spacing: 0.5px; }
        .ob-skip-label { color: #aaa; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 5px; }
        #ob-dont-show-container { display: flex; align-items: center; gap: 8px; color: #aaa; font-size: 12px; cursor: pointer; }
        #ob-dont-show-check { accent-color: var(--accent); cursor: pointer; }
    `,

// 4. ONBOARDING HTML (Slide 1 Title Correction)
    getOnboardingHtml: (features) => {
        const markupTitle = features.type === 'pro' ? 'Professional Markup Tools' : 'Essential Annotation Suite';
        
        return `
    <div id="onboarding-modal" class="modal" style="z-index: 200000; display: none;">
        <div class="onboarding-content">
            <div class="ob-header">
                <div class="ob-win-controls">
                    <span class="dot-fake red"></span><span class="dot-fake yellow"></span><span class="dot-fake green"></span>
                </div>
                <span class="ob-title brand-font">Welcome to ${features.appName}</span>
                <div style="width: 50px;"></div> 
            </div>
            <div class="ob-viewport">
                <div class="ob-slides-container">
                    
                    <div class="ob-slide active" data-step="0">
                        <div class="ob-icon pulse"><i class="fa-solid fa-ruler-combined"></i></div>
                        <h2>Precision Capture Made Simple</h2>
                        <p style="max-width: 600px; margin: 0 auto 10px auto;">Experience the perfect blend of professional accuracy and effortless speed.</p>
                        
                        <div class="ob-tip-box" style="margin-top: 5px; max-width: 575px; text-align: center;">
                            <i class="fa-solid fa-bolt"></i> <strong style="color:var(--accent); font-weight: bold;">The Core Concept:</strong> 
                            Use <strong style="color:#fff">Fullscreen Mode</strong> for speed, or the <strong style="color:#fff">Precision Viewfinder</strong> for exact control.
                        </div>

                         <ul class="ob-list ob-tight-list" style="max-width: 500px; width: 100%;">
                            <li style="display: flex; padding-bottom: 5px; margin-bottom: 10px; border-bottom: none; font-size: 13px;"> 
                                <strong style="color:var(--accent); font-weight: bold; min-width: 120px;">Fullscreen Mode:</strong> 
                                <span>(Default) Instantly freeze your screen and drag to highlight any area for a quick snap.</span>
                            </li>
                            <li style="display: flex; padding-bottom: 5px; margin-bottom: 10px; border-bottom: none; font-size: 13px;">
                                <strong style="color:var(--accent); font-weight: bold; min-width: 120px;">Precision Viewfinder:</strong> 
                                <span>Position the floating frame as a dedicated lens to capture exact pixel dimensions.</span>
                            </li>
                            <li style="display: flex; padding-bottom: 5px; margin-bottom: 10px; border-bottom: none; font-size: 13px;">
                                <strong style="color:var(--accent); font-weight: bold; min-width: 120px;">Drag-to-Share:</strong> 
                                <span>Click and hold the <div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/solid-drag-and-share.png'); background-color: #00bcd4 !important;"></div> button to drop your image directly into Slack, Discord, or Email.</span>
                            </li>
                            <li style="display: flex; padding-bottom: 5px; margin-bottom: 10px; border-bottom: none; font-size: 13px;">
                                <strong style="color:var(--accent); font-weight: bold; min-width: 120px;">Direct Import:</strong> 
                                <span><strong>Paste (Ctrl+V)</strong> or <strong>Drag & Drop</strong> any image file onto the window to begin annotating.</span>
                            </li>                      
                        </ul>
                    </div>

                    <div class="ob-slide" data-step="1">
                        <div class="ob-icon"><i class="fa-solid fa-highlighter"></i></div>
                        <h2>${markupTitle}</h2>
                        <p>${features.type === 'pro' ? 'Annotate your images with a suite of high-performance vector tools.' : 'Essential tools to highlight and annotate your captures with clarity.'}</p>
                        <div class="ob-tip-box" style="text-align: left; max-width: 700px; width: 100%; margin-top: 15px;">
                            <i class="fa-solid fa-bolt"></i> <strong style="color:var(--accent); font-weight: bold;">Workflow Secrets:</strong>
                            <ul style="padding-left: 15px; margin: 5px 0 0 0; list-style-type: disc;">
                                <li><strong style="color:#fff">Text Management:</strong> Drag the <strong>Mint Handle</strong> to move text. <strong>Double-click</strong> existing text to edit it, or right-click to fix spelling.</li>
                                <li><strong style="color:#fff">Quick Toggles:</strong> Double-click <strong>Shape</strong> icons for Solid Fill and <strong>Eraser</strong> to switch between Object and Brush modes.</li>
                                ${features.type === 'pro' ? `<li><strong style="color:#fff">Advanced Modes:</strong> Right-Click <strong>Line, Shapes, or Arrow</strong> to access professional sub-styles.</li>
                                <li><strong style="color:#fff">Smart Arrows:</strong> Press <span class="wiz-key">A</span> to cycle through V-Shape, Hand-Drawn, and Dot styles.</li>` : ''}
                            </ul>
                        </div>
                        <div class="ob-tip-box" style="text-align: left; max-width: 700px; width: 100%; margin-top: 15px;">
                            <i class="fa-solid fa-keyboard"></i> <strong style="color:var(--accent); font-weight: bold;">Essential Hotkeys:</strong>
                            <ul style="padding-left: 15px; margin: 5px 0 0 0; list-style-type: disc;">
                                <li><span class="wiz-key">Enter</span> Snap &nbsp; <span class="wiz-key">Ctrl</span> + <span class="wiz-key">S</span> Save &nbsp; <span class="wiz-key">Esc</span> Cancel</li>
                                <li><span class="wiz-key">A</span> Arrow &nbsp; <span class="wiz-key">P</span> Pen &nbsp; <span class="wiz-key">L</span> Line &nbsp; <span class="wiz-key">T</span> Text &nbsp; <span class="wiz-key">S</span> Square</li>
                                <li><strong style="color:var(--accent)">Need a reminder?</strong> Hold <span class="wiz-key">Alt</span> at any time to see the command Cheat Sheet.</li>
                            </ul>
                        </div>
                    </div>

                    <div class="ob-slide" data-step="2">
                        <div class="ob-icon"><i class="fa-solid fa-vector-square"></i></div>
                        <h2>Smart Workflow Assists</h2>
                        <p>Automation that keeps your work neat without extra effort.</p>
                        
                        ${features.type === 'pro' ? `
                        <div class="ob-tip-box" style="margin-top: 10px; max-width: 650px; width: 100%;">
                            <i class="fa-solid fa-magnet"></i> <strong style="color:var(--accent); font-weight: bold;">Smart Guides:</strong> Automatic alignment lines appear to help you center text and shapes perfectly.
                        </div>
                        <div class="ob-tip-box" style="margin-top: 10px; max-width: 650px; width: 100%;">
                            <i class="fa-solid fa-border-all"></i> <strong style="color:var(--accent); font-weight: bold;">Snap-to-Grid:</strong> 
                            Enable in Settings to lock your drawing precisely to the background coordinates.
                        </div>
                        ` : ''}
                        
                        <div class="ob-tip-box" style="margin-top: 10px; max-width: 650px; width: 100%;">                        
                            <i class="fa-solid fa-arrows-up-down-left-right"></i> <strong style="color:var(--accent); font-weight: bold;">Precision Nudge:</strong> Select any shape and use your <strong>Arrow Keys</strong> to move it exactly 1 pixel.
                        </div>
                        
                        <div class="ob-tip-box" style="margin-top: 10px; max-width: 650px; width: 100%;">
                             <i class="fa-solid fa-expand"></i> <strong style="color:var(--accent); font-weight: bold;">Focus Mode:</strong>
                             Interface handles hide automatically while you draw for a distraction-free view.
                        </div>
                    </div>

                    ${features.enableToolbox ? `
                    <div class="ob-slide" data-step="3">
                        <div class="ob-icon"><i class="fa-solid fa-toolbox"></i></div>
                        <h2>Power User Toolkit</h2>
                        <p>Specialized tools found in the <i class="fa-solid fa-toolbox"></i> menu for advanced workflows.</p>
                        <div class="ob-tip-box" style="text-align: left; max-width: 650px; width: 100%;">
                           <ul class="ob-list ob-tight-list" style="max-width: 600px; width: 100%; margin: 5px 0 0 0; padding-left: 10px; list-style-type: disc;">
                                <li style="font-size: 13px;">
                                    <div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/solid-eyedropper.png'); background-color: #fff; min-width: 32px; margin-right: 0;"></div> 
                                    <strong style="color:var(--accent); font-weight: bold; min-width: 145px;">Smart Eyedropper:</strong> 
                                    <span>Sample exact colors from your screen. <strong style="color:var(--accent)">Right-Click</strong> for the <strong style="color:var(--accent)">Micro-Lens</strong>.</span>
                                </li>
                                <li style="font-size: 13px;">
                                    <div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/solid-stamp.png'); background-color: #fff; min-width: 32px; margin-right: 0;"></div>
                                    <strong style="color:var(--accent); font-weight: bold; min-width: 145px;">Sequential Stamps:</strong> 
                                    <span>Place auto-incrementing numbers (1, 2, 3) or letters—perfect for step-by-step guides.</span>
                                </li>
                                <li style="font-size: 13px;">
                                    <div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/solid-magnifier.png'); background-color: #fff; min-width: 32px; margin-right: 0;"></div>
                                    <strong style="color:var(--accent); font-weight: bold; min-width: 145px;">Precision Magnifier:</strong>
                                    <span>Inspect pixels at up to 5x zoom. <strong style="color:var(--accent)">Ctrl+Scroll</strong> to adjust zoom levels.</span>
                                </li>
                                <li style="font-size: 13px;">
                                    <div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/solid-ocr.png'); background-color: #fff; min-width: 32px; margin-right: 0;"></div>
                                    <strong style="color:var(--accent); font-weight: bold; min-width: 145px;">Secure Offline OCR:</strong> 
                                    <span>Extract text from your screen locally. No data ever leaves your device.</span>
                                </li>
                                <li style="font-size: 13px;">
                                    <i class="fa-solid fa-eye-slash" style="color:#fff; min-width: 32px;"></i> 
                                    <strong style="color:var(--accent); font-weight: bold; min-width: 145px;">Privacy Blur:</strong> 
                                    <span>Permanently scramble sensitive information like passwords or personal details.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    ` : ''}

                    <div class="ob-slide" data-step="${features.enableToolbox ? 4 : 3}">
                        <div class="ob-icon"><i class="fa-solid fa-check-circle" style="color:var(--accent)"></i></div>
                        <h2>You're Ready!</h2>
                        <p>CapSize is highly customizable. Adjust your default canvas and hotkeys in the <strong>Settings</strong> <i class="fa-solid fa-gear"></i> menu at any time.</p>
                        
                        <div style="display: flex; gap: 15px; margin-top: 20px; justify-content: center;">
                            <button id="ob-start-btn" class="ob-btn-pri" style="font-size: 13px !important; padding: 10px 30px !important; height: 42px !important; border-radius: 4px; cursor: pointer;">Start Capturing</button>
                            <button id="ob-setup-btn" class="ob-btn-sec" style="font-size: 13px !important; padding: 10px 30px !important; height: 42px !important; border-radius: 4px; cursor: pointer;">Run Quick Setup</button>
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
                        ${Array(features.enableToolbox ? 5 : 4).fill('<span class="dot"></span>').join('')}
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
    },

    // 5. SETTINGS HTML
    getSettingsHtml: (features, settings) => `
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
                    <button class="tab-btn" data-tab="tab-out"><div class="tab-icon-mask" style="-webkit-mask-image: url('assets/icons/solid-output.png');"></div> Output</button>
                    
                    <div class="sidebar-section">User Guide</div>
                    <button class="tab-btn" data-tab="guide-basic"><i class="fa-solid fa-book"></i> Workflow</button>
                    <button class="tab-btn" data-tab="guide-draw"><i class="fa-solid fa-pen-ruler"></i> Drawing Tools</button>
                    ${features.enableToolbox ? `<button class="tab-btn" data-tab="guide-power"><i class="fa-solid fa-toolbox"></i> Toolbox</button>` : ''}
                    <button class="tab-btn" data-tab="guide-hotkeys"><i class="fa-solid fa-keyboard"></i> Hotkeys & Tips</button>
                </div>

                <div class="settings-main">
                    <div id="tab-about" class="tab-pane active">
                        <div class="about-hero" style="padding: 5px 30px;">
                            <img src="icon.png" class="about-logo" alt="Logo" style="width: 80px; height: 80px;">
                            
                            <div class="brand-font" style="font-size: 18px; font-weight: bold; color: #fff; margin-top: 0px;">
    <span style="position: relative; display: inline-block;">
        <span style="color:var(--accent);">Cap</span>Size
        <span class="edition-label" style="position: absolute !important; left: 100% !important; top: 0 !important; margin-left: 4px !important; transform: none !important;">${features.type === 'core' ? 'CORE' : 'PRO'}</span>
    </span>
</div>
                            <div class="about-ver">Version 1.0.0</div>

                            <div class="guide-btn-group" style="margin: 8px 0; display:flex; flex-direction:column; gap:10px; align-items:center;">
        
        ${features.type === 'core' ? `
        <div style="font-size: 11px; color: var(--accent); border: 1px dashed var(--accent); padding: 6px 15px; border-radius: 4px; opacity: 0.8;">
            <i class="fa-solid fa-file-import"></i> Drag & Drop your <b>.mint</b> file to unlock Pro
        </div>
        ` : `
        <div class="license-active-badge" style="display:flex; align-items:center; gap:8px; padding: 6px 15px; background: rgba(140, 250, 150, 0.1); border: 1px solid var(--accent); border-radius: 20px;">
            <i class="fa-solid fa-circle-check" style="color:var(--accent); font-size: 14px;"></i>
            <span style="color:var(--accent); font-family: 'Orbitron', sans-serif; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">License Active &bull; Pro Edition</span>
        </div>
        `}

        <div style="display:flex; gap:5px;">
            <button id="btn-check-updates" class="btn-reset" style="border: 1px solid var(--accent); color: var(--accent); padding-top:3px; font-size:8px;"><i class="fa-solid fa-rotate"></i> Updates</button>
            
            ${features.type === 'core' ? `
            <button id="btnUpgradePro" style="height: 24px; display: flex; align-items: center; justify-content: center; gap: 5px; background-color: #8CFA96; !important; border:none; color:#1e1e1e !important; font-weight:bold; padding:0 12px; border-radius:4px; cursor:pointer; font-size:11px; transition: 0.2s; text-transform: none;"><i class="fa-solid fa-rocket"></i> Get Key</button>
            ` : ''}
        </div>
    </div>

                            <p style="color:#ccc; font-size:13px; max-width:550px; margin: 10px auto 2px auto;">
                                 CapSize delivers the pixel-perfect accuracy professionals demand with the intuitive simplicity home users love.
                            </p>

                            <div style="display:flex; gap:20px; justify-content:center; margin-top: 10px; margin-bottom: 8px; font-size: 13px; color: #ccc;">
                                <span title="Zero telemetry, strictly offline"><div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/solid-offline.png');"></div> Zero Telemetry</span>
                                <span title="Optimized for Stylus & Touch"><div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/solid-stylus.png');"></div> Stylus Ready</span>
                            </div>
                            
                            <div style="display:flex; gap:10px; justify-content:center; margin-top:5px; margin-bottom: 10px;">
                                <button id="btn-replay-intro" class="ob-btn-pri" style="font-size:13px; padding: 6px 20px;"><i class="fa-solid fa-play"></i> Replay Tour</button>
                                <button id="btn-run-setup" class="ob-btn-sec" style="font-size:13px; padding: 5px 15px;"><i class="fa-solid fa-wand-magic-sparkles"></i> Run Setup Wizard</button>
                            </div>
                        </div>

                        <div class="setting-group">
                            <div class="st-title">Security & Info</div>
                            <div class="g-grid">
                                <div class="g-item" style="grid-column: 1 / -1;">
                                    <strong><i class="fa-solid fa-shield-halved"></i> Zero-Telemetry Policy</strong>
                                    CapSize is a strictly offline application. We do not track usage, collect analytics, or "phone home." Your canvas, data, and captures never leave your local hardware.
                                </div>
                                <div class="g-item" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 0;">
                                    <img src="mint_logic.png" alt="Mint Logic LLC" style="width: 150px; height: auto;">
                                    <div class="copyright-notice" style="margin-top: 10px; font-size: 10px;">
                                        &copy; 2026 Mint Logic. All rights reserved.
                                    </div>
                                </div>
                                <div class="g-item">
                                    <strong><i class="fa-brands fa-github"></i> Open Source</strong>
                                    Built with Electron, FontAwesome, and Tesseract.js.
                                    <br><span style="color:#777; font-size: 11px; font-style: italic;">Empowering developers with transparent tools.</span>
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
                                <div class="setting-label">Open at Login <div class="setting-desc">Launch CapSize automatically when System starts</div></div>
                                <label class="toggle"><input type="checkbox" data-setting="openAtLogin" ${settings.openAtLogin ? 'checked' : ''}><span class="slider"></span></label>
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">Always On Top <div class="setting-desc">Keep window floating above other applications</div></div>
                                <label class="toggle"><input type="checkbox" data-setting="alwaysOnTop" ${settings.alwaysOnTop ? 'checked' : ''}><span class="slider"></span></label>
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">Activation Trigger <div class="setting-desc">Global hotkey to toggle app visibility (e.g. PrintScreen, F12)</div></div>
                                <input type="text" data-setting="globalHotkey" class="st-input" value="${settings.globalHotkey}" placeholder="PrintScreen">
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">Precision Metrics <div class="setting-desc">Show dimensions (px) and angles next to cursor while drawing</div></div>
                                <label class="toggle"><input type="checkbox" data-setting="showMeasurements" ${settings.showMeasurements ? 'checked' : ''}><span class="slider"></span></label>
                            </div>
                        </div>
                        <div class="setting-group">
                            <div class="st-title">Startup Preferences <button class="btn-reset" onclick="resetSection('gen-win')">Reset</button></div>
                            <div class="setting-row">
                                <div class="setting-label">Initial Active Tool</div>
                                <select data-setting="startupTool" class="st-select">
                                    <option value="cursor" ${settings.startupTool === 'cursor' ? 'selected' : ''}>Cursor (Select)</option>
                                    <option value="pen" ${settings.startupTool === 'pen' ? 'selected' : ''}>Pen</option>
                                    <option value="arrow" ${settings.startupTool === 'arrow' ? 'selected' : ''}>Arrow</option>
                                </select>
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">Viewfinder Dimensions <div class="setting-desc">Width x Height in pixels (For Window Mode)</div></div>
                                <div style="display:flex; gap:5px;">
                                    <input type="number" data-setting="startupW" class="st-input" value="${settings.startupW}" style="width: 60px;">
                                    <span style="color:#888; align-self:center;">x</span>
                                    <input type="number" data-setting="startupH" class="st-input" value="${settings.startupH}" style="width: 60px;">
                                </div>
                            </div>
                            <div class="setting-row">
    <div class="setting-label">Start in Fullscreen Capture Mode 
        <div class="setting-desc">Automatically hide the window and freeze the screen on launch.</div>
    </div>
    <label class="toggle"><input type="checkbox" data-setting="startFullscreen" ${settings.startFullscreen ? 'checked' : ''}><span class="slider"></span></label>
</div>
                            <div class="setting-row">
                                <div class="setting-label">Show Tooltips <div class="setting-desc">Display hover labels for buttons</div></div>
                                <label class="toggle"><input type="checkbox" data-setting="showTooltips" ${settings.showTooltips !== false ? 'checked' : ''}><span class="slider"></span></label>
                            </div>
                            ${features.type === 'pro' ? `
                            <div class="setting-row">
                                <div class="setting-label">Focus Mode (Immersive) <div class="setting-desc">Hide resize handles and borders while drawing</div></div>
                                <label class="toggle"><input type="checkbox" data-setting="immersiveMode" ${settings.immersiveMode ? 'checked' : ''}><span class="slider"></span></label>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <div id="tab-draw" class="tab-pane">
                        <div class="setting-group">
                            <div class="st-title">Styles & Cursor <button class="btn-reset" onclick="resetSection('draw-style')">Reset</button></div>
                            <div class="setting-row">
                                <div class="setting-label">Cursor Style</div>
                                <select data-setting="cursorStyle" class="st-select">
                                    <option value="dot" ${settings.cursorStyle === 'dot' ? 'selected' : ''}>Dot (Color Match)</option>
                                    <option value="crosshair" ${settings.cursorStyle === 'crosshair' ? 'selected' : ''}>Crosshair (Precision)</option>
                                    <option value="outline" ${settings.cursorStyle === 'outline' ? 'selected' : ''}>Brush Outline</option>
                                </select>
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">Default Eraser Mode</div>
                                <select data-setting="defaultEraserMode" class="st-select">
                                    <option value="brush" ${settings.defaultEraserMode === 'brush' ? 'selected' : ''}>Brush (Pixel Erase)</option>
                                    <option value="object" ${settings.defaultEraserMode === 'object' ? 'selected' : ''}>Object (Full Delete)</option>
                                </select>
                            </div>
                            
                            ${features.type === 'pro' ? `
                            <div class="setting-row">
                                <div class="setting-label">Arrowhead Style</div>
                                <select data-setting="arrowStyle" class="st-select">
                                    <option value="v" ${settings.arrowStyle === 'v' ? 'selected' : ''}>Open V-Shape</option>
                                    <option value="hand" ${settings.arrowStyle === 'hand' ? 'selected' : ''}>Hand Drawn</option>
                                    <option value="triangle" ${settings.arrowStyle === 'triangle' ? 'selected' : ''}>Standard Triangle</option>
                                    <option value="concave" ${settings.arrowStyle === 'concave' ? 'selected' : ''}>Curved Back</option>
                                    <option value="dot" ${settings.arrowStyle === 'dot' ? 'selected' : ''}>Dot Endpoint</option>
                                </select>
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">Shadow Softness</div>
                                <div style="display:flex; align-items:center; gap:5px;">
                                    <input type="range" data-setting="shadowBlur" min="0" max="30" value="${settings.shadowBlur}">
                                    <span class="slider-val" style="color:var(--accent); font-size:11px; width:30px; text-align:right; font-weight: 600;"></span>
                                </div>
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">Shadow Distance</div>
                                <div style="display:flex; align-items:center; gap:5px;">
                                    <input type="range" data-setting="shadowDistance" min="0" max="20" value="${settings.shadowDistance}">
                                    <span class="slider-val" style="color:var(--accent); font-size:11px; width:30px; text-align:right; font-weight: 600;"></span>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        <div class="setting-group">
                            <div class="st-title">Stroke Properties <button class="btn-reset" onclick="resetSection('draw-shape')">Reset</button></div>
                            <div class="setting-row">
                                <div class="setting-label">Corner Style <div class="setting-desc">For lines, squares and polygons</div></div>
                                <select data-setting="cornerStyle" class="st-select">
                                    <option value="miter" ${settings.cornerStyle === 'miter' ? 'selected' : ''}>Miter (Sharp)</option>
                                    <option value="round" ${settings.cornerStyle === 'round' ? 'selected' : ''}>${features.type === 'pro' ? 'Round (Customizable)' : 'Rounded (Standard)'}</option>
                                </select>
                            </div>
                            
                            ${features.type === 'pro' ? `
                            <div class="setting-row">
                                <div class="setting-label">Square Corner Radius <div class="setting-desc">Radius in pixels when Corner Style is 'Round'</div></div>
                                <div style="display:flex; align-items:center; gap:5px;">
                                    <input type="range" data-setting="cornerRadius" min="0" max="50" step="1" value="${settings.cornerRadius || 10}">
                                    <span class="slider-val" style="color:var(--accent); font-size:11px; width:30px; text-align:right; font-weight: 600;"></span>
                                </div>
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">Dotted Line Style</div>
                                <select data-setting="dottedStyle" class="st-select">
                                    <option value="butt" ${settings.dottedStyle === 'butt' ? 'selected' : ''}>Flat Edges</option>
                                    <option value="round" ${settings.dottedStyle === 'round' ? 'selected' : ''}>Rounded Edges</option>
                                </select>
                            </div>
                            ` : ''}

                            <div class="setting-row">
                                <div class="setting-label">Default Line Width</div>
                                <input type="number" data-setting="defLineWidth" class="st-input" min="1" max="20" value="${settings.defLineWidth}">
                            </div>
                            
                            ${features.type === 'pro' ? `
                            <div class="setting-row">
                                <div class="setting-label">Highlighter Color <div class="setting-desc">Color used when Line tool is in Highlighter mode</div></div>
                                <input type="color" data-setting="highlighterColor" class="sleek-color" value="${settings.highlighterColor || '#FFFF00'}">
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">Highlighter Opacity</div>
                                <div style="display:flex; align-items:center; gap:5px;">
                                    <input type="range" data-setting="highlighterOpacity" min="0.1" max="0.9" step="0.1" value="${settings.highlighterOpacity}">
                                    <span class="slider-val" style="color:var(--accent); font-size:11px; width:30px; text-align:right; font-weight: 600;"></span>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        
                        ${features.type === 'pro' ? `
                        <div class="setting-group">
                            <div class="st-title">Snapping & Precision <button class="btn-reset" onclick="resetSection('draw-snap')">Reset</button></div>
                            <div class="setting-row">
                                <div class="setting-label">Snap to Grid <div class="setting-desc">Align shapes to grid (Disables Smart Guides)</div></div>
                                <label class="toggle"><input type="checkbox" data-setting="snapToGrid" ${settings.snapToGrid ? 'checked' : ''}><span class="slider"></span></label>
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">Smart Alignment Guides <div class="setting-desc">Show magenta lines when shapes align (Center/Edges)</div></div>
                                <label class="toggle"><input type="checkbox" data-setting="showSmartGuides" ${settings.showSmartGuides ? 'checked' : ''}><span class="slider"></span></label>
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">Point Snapping <div class="setting-desc">Magnetic pull when closing Polygons</div></div>
                                <select data-setting="magnetStrength" class="st-select">
                                    <option value="low" ${settings.magnetStrength === 'low' ? 'selected' : ''}>Low (10px)</option>
                                    <option value="medium" ${settings.magnetStrength === 'medium' ? 'selected' : ''}>Medium (20px)</option>
                                    <option value="high" ${settings.magnetStrength === 'high' ? 'selected' : ''}>High (40px)</option>
                                </select>
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">Angle Snap (Shift) <div class="setting-desc">Rotation increments when holding Shift</div></div>
                                <select data-setting="angleSnap" class="st-select">
                                    <option value="15" ${settings.angleSnap == 15 ? 'selected' : ''}>15 Degrees</option>
                                    <option value="45" ${settings.angleSnap == 45 ? 'selected' : ''}>45 Degrees</option>
                                    <option value="90" ${settings.angleSnap == 90 ? 'selected' : ''}>90 Degrees</option>
                                </select>
                            </div>
                        </div>
                        ` : ''}
                    </div>

                <div id="tab-app" class="tab-pane">
                        ${features.type === 'pro' ? `
                        <div class="setting-group">
                            <div class="st-title">Color Palette <button class="btn-reset" onclick="resetSection('app-palette')">Reset</button></div>
                            <div class="setting-row" style="align-items: flex-start;">
                                <div class="setting-label">
                                    Custom Swatches 
                                    <div class="setting-desc">Toggle to use your own colors. Click bars below to edit.</div>
                                    <div id="custom-palette-grid" style="display: grid; grid-template-columns: repeat(4, 50px); grid-auto-rows: 15px; gap: 10px 8px; margin-top: 10px; width: max-content;">
                                        ${settings.customColors.map((c, i) => `
    <div style="border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 1px; background: rgba(255,255,255,0.05);">
        <input type="color" class="palette-picker sleek-color" data-index="${i}" value="${c}" style="border-radius: 2px !important;">
    </div>
`).join('')}
                                    </div>
                                </div>
                                <label class="toggle"><input type="checkbox" data-setting="useCustomSwatches" ${settings.useCustomSwatches ? 'checked' : ''}><span class="slider"></span></label>
                            </div>
                        </div>
                        ` : ''}

                        <div class="setting-group">
                            <div class="st-title">Typography</div>
                            
                            <div class="setting-row">
                                <div class="setting-label">Default Font</div>
                                <select data-setting="defaultFont" class="st-select">
                                    <option value="Arial" ${settings.defaultFont === 'Arial' ? 'selected' : ''}>Arial</option>
                                    <option value="Varela Round" ${settings.defaultFont === 'Varela Round' ? 'selected' : ''}>Varela Round</option>
                                    <option value="Georgia" ${settings.defaultFont === 'Georgia' ? 'selected' : ''}>Georgia</option>
                                    <option value="Rokkitt" ${settings.defaultFont === 'Rokkitt' ? 'selected' : ''}>Rokkitt</option>
                                    <option value="Permanent Marker" ${settings.defaultFont === 'Permanent Marker' ? 'selected' : ''}>Permanent Marker</option>
                                </select>
                            </div>

                            <div class="setting-row" style="display: block;">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                                    <div class="setting-label">
                                        Font Library
                                        <div class="setting-desc">Pin your favorites or hide unused fonts.</div>
                                    </div>
                                    
                                    ${features.type === 'pro' ? `
                                    <button id="btn-import-font" class="btn-browse"><i class="fa-solid fa-plus"></i> Import TTF</button>
                                    ` : ''} 
                                </div>

                                <div class="font-manager-container">
                                    <div class="font-manager-header" id="font-manager-toggle">
                                        <span><i class="fa-solid fa-list"></i> Manage List</span>
                                        <i class="fa-solid fa-chevron-down" id="font-manager-chevron" style="transition: transform 0.2s;"></i>
                                    </div>
                                    <div class="font-manager-body" id="font-manager-list">
                                        </div>
                                </div>
                            </div>
                        </div>
                        
                        ${features.type === 'pro' ? `
                        <div class="setting-group">
                            <div class="st-title">Background Grid <button class="btn-reset" onclick="resetSection('app-grid')">Reset</button></div>
                            <div class="setting-row">
                                <div class="setting-label">Grid Size (px)</div>
                                <input type="number" data-setting="gridSize" class="st-input" value="${settings.gridSize}">
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">Grid Visibility</div>
                                <div style="display:flex; align-items:center; gap:5px;">
                                    <input type="range" data-setting="gridOpacity" min="0.1" max="1" step="0.1" value="${settings.gridOpacity}">
                                    <span class="slider-val" style="color:var(--accent); font-size:11px; width:30px; text-align:right; font-weight:600;"></span>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <div id="tab-out" class="tab-pane">
                        <div class="setting-group">
                            <div class="st-title">Image Export <button class="btn-reset" onclick="resetSection('out-img')">Reset</button></div>
                            <div class="setting-row">
                                <div class="setting-label">File Format</div>
                                <select data-setting="imageFormat" class="st-select">
                                    <option value="image/png" ${settings.imageFormat === 'image/png' ? 'selected' : ''}>PNG (Lossless)</option>
                                    <option value="image/jpeg" ${settings.imageFormat === 'image/jpeg' ? 'selected' : ''}>JPG (Compressed)</option>
                                    <option value="image/webp" ${settings.imageFormat === 'image/webp' ? 'selected' : ''}>WebP (Web)</option>
                                </select>
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">Quality (JPG/WebP)</div>
                                <select data-setting="imageQuality" class="st-select">
                                    <option value="1" ${settings.imageQuality === 1 ? 'selected' : ''}>100% (Lossless)</option>
                                    <option value="0.9" ${settings.imageQuality === 0.9 ? 'selected' : ''}>90% (High)</option>
                                    <option value="0.8" ${settings.imageQuality === 0.8 ? 'selected' : ''}>80% (Medium)</option>
                                    <option value="0.6" ${settings.imageQuality === 0.6 ? 'selected' : ''}>60% (Low)</option>
                                </select>
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">Canvas Margin (px) <div class="setting-desc">Add whitespace padding around the capture</div></div>
                                <input type="number" data-setting="exportPadding" class="st-input" value="${settings.exportPadding}" style="width: 80px;">
                            </div>
                            ${features.type === 'pro' ? `
                            <div class="setting-row">
                                <div class="setting-label">Auto-Watermark <div class="setting-desc">Text applied to bottom-right corner</div></div>
                                <input type="text" data-setting="watermarkText" class="st-input" value="${settings.watermarkText}" placeholder="e.g. Confidential">
                            </div>
                            ` : ''}
                        </div>
                        <div class="setting-group">
                        <div class="st-title">Saving Rules <button class="btn-reset" onclick="resetSection('out-save')">Reset</button></div>
                        <div class="setting-row">
                            <div class="setting-label">Save Directory</div>
                        </div>
                        <div class="browse-group" style="margin-bottom:15px;">
                            <input type="text" id="inp-save-path" class="st-input" style="flex:1;" value="${settings.savePath}" readonly placeholder="Default: Ask every time">
                            <button id="btn-browse-dir" class="btn-browse">Browse...</button>
                            <button id="btn-clear-dir" class="btn-browse" title="Clear"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        
                        ${features.type === 'pro' ? `
                        <div class="setting-row" style="display:block;">
                            <div class="setting-label" style="margin-bottom:5px;">
                                Filename Template 
                                <div class="setting-desc">Use variables to auto-name files.</div>
                            </div>
                            <input type="text" data-setting="filenameFmt" class="st-input" style="width:100%; font-family:'Consolas', monospace;" value="${settings.filenameFmt}">
                            
                            <div style="font-size:10px; color:#666; margin-top:5px; font-family:'Consolas', monospace; display:flex; gap:10px; flex-wrap:wrap;">
                            <span title="Sequence Number (0001)">{seq}</span>
                            <span title="Year (2026)">{Y}</span>
                            <span title="Month (01-12)">{M}</span>
                            <span title="Day (01-31)">{D}</span>
                            <span title="Hour (00-23)">{h}</span>
                            <span title="Minute">{m}</span>
                            <span title="Seconds">{s}</span>
                            <span title="Image Width">{width}</span>
                            <span title="Image Height">{height}</span>
                            </div>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Auto-Copy on Snap</div>
                            <label class="toggle"><input type="checkbox" data-setting="autoClipboard" ${settings.autoClipboard ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Auto-Hide on Share <div class="setting-desc">Close app to tray after using Drag-to-Share</div></div>
                            <label class="toggle"><input type="checkbox" data-setting="autoHideOnShare" ${settings.autoHideOnShare !== false ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                        ` : ''}
                    </div>
                    </div>

                    <div id="guide-basic" class="tab-pane">
                        <div class="setting-group">
                            <div class="st-title">1. Capture Modes</div>
                            <div class="g-grid">
                                <div class="g-item">
    <strong><i class="fa-solid fa-expand"></i> Fullscreen Capture Mode</strong>
    Switches to a full-screen canvas. The screen will "Freeze," allowing you to drag and highlight any area for a quick snap.
    <br><span style="color:var(--accent);">Note:</span> The "Screen Frozen" guide stays visible until you begin your selection.
</div>
                                <div class="g-item">
                                    <strong><div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/solid-exit-to-window-mode.png');"></div> Window Mode (Viewfinder)</strong>
                                    Use the floating frame as a dedicated lens. Resize it over the content you want to capture, or type exact pixels in the header.
                                    <br><span style="color:#888;">Best for: Specific dimensions, website headers, UI design.</span>
                                </div>
                            </div>
                        </div>
                        <div class="setting-group">
                            <div class="st-title">2. Floating Bar Controls</div>
                            <div class="g-grid">
                                <div class="g-item">
                                    <strong><div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/anchor.png');"></div> Dock Toolbar</strong>
                                    If your tools get lost or obscured, click this button to instantly dock the toolbar to the bottom-center of your screen.
                                </div>
                                ${features.type === 'pro' ? `
                                <div class="g-item">
                                    <strong><i class="fa-solid fa-display"></i> Monitor Jump</strong>
                                    Instantly move your capture window to the next available display.
                                    <br><span style="color:var(--accent);">Hotkey:</span> Ctrl + Shift + Right Arrow
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        <div class="setting-group">
                            <div class="st-title">3. Import & Export</div>
                            <div class="g-grid">
                                <div class="g-item">
                                    <strong><i class="fa-solid fa-file-import"></i> Direct Import</strong>
                                    Drag & Drop an image file anywhere onto the app window, or press <span style="color:var(--accent);">Ctrl+V</span> to paste an image from your clipboard.
                                </div>
                                <div class="g-item">
                                    <strong><div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/solid-drag-and-share.png'); background-color: #00bcd4 !important;"></div> Drag-to-Share</strong>
                                    Click and <span style="color:var(--accent);">Hold</span> the cyan drag button in the header. Drag your finished image directly into other applications, emails, or folders.
                                </div>
                                <div class="g-item" style="grid-column: 1 / -1;">
                                    <strong><div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/solid-output.png'); background-color: #FFD700 !important;"></div> Save & Close</strong>
                                    Clicking the yellow save button will execute your standard save settings (or open the prompt) and instantly minimize the application back to your system tray to keep your workflow fast.
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
                                
                                ${features.type === 'pro' ? `
                                <div class="g-item">
                                    <strong><div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/line.png');"></div> <i class="fa-solid fa-arrow-right" style="font-size:10px; margin:0 5px; color:#888;"></i> <div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/solid-highlighter.png');"></div> Line / Highlighter</strong>
                                    <span style="color:var(--accent);">Right-Click</span> the icon to toggle Highlighter mode (transparent yellow).
                                    <br><span style="color:var(--accent);">Curve:</span> Double-click the middle handle of a selected line to bend it.
                                </div>
                                <div class="g-item">
                                    <strong><i class="fa-solid fa-arrow-right-long"></i> Smart Arrow</strong>
                                    <span style="color:var(--accent);">Right-Click</span> the icon to choose styles (Dot, V, Hand-drawn).
                                    <br><span style="color:var(--accent);">Curve:</span> Double-click center handle to bend arrow.
                                    <br><span style="color:var(--accent);">Hotkeys:</span> Press <span style="color:var(--accent);">A</span> repeatedly to cycle styles.
                                </div>
                                ` : `
                                <div class="g-item">
                                    <strong><div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/line.png');"></div> Line Tool</strong>
                                    Draw straight lines. Drag the ends to resize. Hold <span style="color:var(--accent);">Shift</span> to snap to 45 degree angles.
                                </div>
                                <div class="g-item">
                                    <strong><i class="fa-solid fa-arrow-right-long"></i> Arrow Tool</strong>
                                    Draw simple arrows. Drag handles to reposition. Use stroke controls to adjust thickness.
                                </div>
                                `}
                            </div>
                        </div>

                        <div class="setting-group">
                            <div class="st-title">Shapes & Text</div>
                            <div class="g-grid">
                                ${features.type === 'pro' ? `
                                <div class="g-item">
                                    <strong><i class="fa-regular fa-square"></i> Shapes</strong>
                                    <span style="color:var(--accent);">Right-Click</span> the Star/Polygon tool to change shape types.
                                    <br><span style="color:var(--accent);">Double-Click</span> any shape tool to toggle Solid Fill.
                                    <br><span style="color:var(--accent);">Radius:</span> When drawing a square, use the floating bubble slider to adjust corner roundness.
                                </div>
                                ` : `
                                <div class="g-item">
                                    <strong><i class="fa-regular fa-square"></i> Shapes</strong>
                                    Draw Squares, Circles, or Stars. <span style="color:var(--accent);">Double-Click</span> the icon to toggle Solid Fill.
                                </div>
                                `}
                                
                                <div class="g-item">
                                    <strong><i class="fa-solid fa-font"></i> Text</strong>
                                    Click to type. Drag the small <span style="color:var(--accent);">Mint Handle</span> to move the text box.
                                    <br><span style="color:var(--accent);">Fix:</span> Right-click red underlined text to correct spelling.
                                    <br><span style="color:var(--accent);">Edit:</span> Double-click existing text on canvas to modify it.
                                </div>
                                <div class="g-item">
                                    <strong><i class="fa-solid fa-eraser"></i> Eraser Modes</strong>
                                    <span style="color:var(--accent);">Double-Click</span> the eraser to switch between "Brush Eraser" (pixels) and "Object Eraser" (deletes entire shapes).
                                </div>
                            </div>
                        </div>
                        
                        ${features.type === 'pro' ? `
                        <div class="setting-group">
                            <div class="st-title">Stroke & Context</div>
                            <div class="g-grid">
                                <div class="g-item">
                                    <strong><i class="fa-solid fa-ellipsis"></i> Dotted & Shadows</strong>
                                    Use the persistent <i class="fa-solid fa-ellipsis"></i> and <i class="fa-solid fa-layer-group"></i> toggle buttons next to the grid to apply styles to future shapes or modify selected ones.
                                </div>
                                <div class="g-item">
                                    <strong><i class="fa-solid fa-computer-mouse"></i> Right-Click Menu</strong>
                                    Right-Click any shape on the canvas to open a context menu.
                                    <br><span style="color:var(--accent);">Options:</span> Duplicate, Bring to Front, Send to Back, or Delete.
                                </div>
                            </div>
                        </div>
                    
                        <div class="setting-group">
                            <div class="st-title">Precision & Snapping</div>
                            <div class="g-grid">
                                <div class="g-item">
                                    <strong><i class="fa-solid fa-magnet"></i> Smart Alignment Guides</strong>
                                    When the grid is visible, magenta guides appear to help you align objects to centers, edges, and other shapes simultaneously.
                                </div>
                                <div class="g-item">
                                    <strong><i class="fa-solid fa-border-all"></i> Snap-to-Grid</strong>
                                    Forces all drawing and resizing to lock to the background coordinates for technical accuracy.
                                    <br><span style="color:#aaa; font-style:italic;">Note: Enabling this automatically disables Smart Guides to prevent conflicts.</span>
                                </div>
                                <div class="g-item">
                                    <strong><i class="fa-solid fa-arrows-up-down-left-right"></i> Pixel Nudge</strong>
                                    Select any shape and use your <span style="color:var(--accent);">Arrow Keys</span> to move it 1px.
                                    <br>Hold <span style="color:var(--accent);">Shift</span> + Arrow to jump 10px at a time.
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    ${features.enableToolbox ? `
                    <div id="guide-power" class="tab-pane">
                        <div class="setting-group">
                            <div class="st-title">Power Toolkit</div>
                            <div class="g-grid">
                                <div class="g-item">
                                    <strong><div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/solid-ocr.png'); background-color: #fff !important;"></div> Secure Offline OCR</strong>
                                    1. Snap your screen.<br>
                                    2. Select OCR tool.<br>
                                    3. Drag a box around text to copy it locally to your clipboard.
                                </div>
                                <div class="g-item">
                                    <strong><div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/blur.png'); background-color: #fff !important;"></div> Privacy Blur</strong>
                                    1. Snap your screen.<br>
                                    2. Drag a box over sensitive info (emails, passwords, faces).<br>
                                    <span>The area will be permanently scrambled using a secure pixel-filter.</span>
                                </div>

                                <div class="g-item">
                                    <strong><div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/solid-magnifier.png'); background-color: #fff !important;"></div> Precision Magnifier</strong>
                                    1. Snap your screen.<br>
                                    2. Activate from toolbox to inspect pixels.<br>
                                    <span style="color:var(--accent);">Scroll:</span> Resize lens.<br> 
                                    <span style="color:var(--accent);">Ctrl + Scroll:</span> Zoom Level.<br>
                                    <span style="color:var(--accent);">Shift + Scroll:</span> Border Thickness.
                                </div>
                                <div class="g-item">
                                    <strong><div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/solid-eyedropper.png'); background-color: #fff !important;"></div> Smart Eyedropper with Micro-Lens</strong>
                                    1. Snap your screen.<br>
                                    2. <span style="color:var(--accent);">Left-Click</span> to sample colors. The syringe cursor fills with the sampled color.<br>
                                    3. <span style="color:var(--accent);">Right-Click</span> to toggle the <span style="color:var(--accent);">Micro-Lens</span> for precise pixel selection.<br> Use your <span style="color:var(--accent);">Arrow Keys</span> for fine adjustments.
                                </div> 
                                <div class="g-item">
                                    <strong><div class="guide-icon-mint" style="-webkit-mask-image: url('assets/icons/solid-stamp.png'); background-color: #fff !important;"></div> Sequential Stamps</strong> 
                                    Click to place auto-incrementing numbers (1, 2, 3) or letters (A, B, C).
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
                    ` : ''}
                    
                    <div id="guide-hotkeys" class="tab-pane">
                        <div class="g-title" style="margin-top: 0;">Essential Shortcuts</div>
                        <div class="g-grid" style="margin-bottom: 25px; grid-template-columns: repeat(3, 1fr);">
                             <div class="g-item"><strong><span class="k-badge">ALT</span></strong>Hold for Cheat Sheet</div>
                             <div class="g-item"><strong><span class="k-badge">Ctrl</span>+<span class="k-badge">Z</span></strong>Undo</div>
                             <div class="g-item"><strong><span class="k-badge">Ctrl</span>+<span class="k-badge">Y</span></strong>Redo</div>
                             
                             <div class="g-item"><strong><span class="k-badge">Ctrl</span>+<span class="k-badge">C</span></strong>Copy Shape</div>
                             <div class="g-item"><strong><span class="k-badge">Ctrl</span>+<span class="k-badge">V</span></strong>Paste Shape</div>
                             <div class="g-item"><strong><span class="k-badge">Del</span></strong>Delete Shape</div>

                             <div class="g-item"><strong><span class="k-badge">P</span></strong>Pen Tool</div>
                             ${features.type === 'pro' ? `<div class="g-item"><strong><span class="k-badge">L</span></strong>Line / Highlighter</div>` : `<div class="g-item"><strong><span class="k-badge">L</span></strong>Line Tool</div>`}
                             ${features.type === 'pro' ? `<div class="g-item"><strong><span class="k-badge">A</span></strong>Arrows (Cycle)</div>` : `<div class="g-item"><strong><span class="k-badge">A</span></strong>Arrow Tool</div>`}
                             
                             <div class="g-item"><strong><span class="k-badge">S</span></strong>Square</div>
                             <div class="g-item"><strong><span class="k-badge">C</span></strong>Circle</div>
                             <div class="g-item"><strong><span class="k-badge">T</span></strong>Text</div>

                             ${features.type === 'pro' ? `
                             <div class="g-item"><strong><span class="k-badge">Y</span></strong>Triangle</div>
                             <div class="g-item"><strong><span class="k-badge">R</span></strong>Star</div>
                             <div class="g-item"><strong><span class="k-badge">G</span></strong>Polygon</div>

                             <div class="g-item"><strong><span class="k-badge">V</span></strong>Checkmark</div>
                             <div class="g-item"><strong><span class="k-badge">X</span></strong>X-Shape</div>
                             <div class="g-item"><strong><span class="k-badge">E</span></strong>Eraser</div>
                             
                             <div class="g-item"><strong><span class="k-badge">U</span></strong>Tools (Cycle)</div>
                             <div class="g-item"><strong><span class="k-badge">M</span></strong>Stamp Tool</div>
                             <div class="g-item"><strong><span class="k-badge">Ctrl</span>+<span class="k-badge">R</span></strong> Reset Stamp</div>

                             <div class="g-item"><strong><span class="k-badge">O</span></strong>OCR Scanner</div>
                             <div class="g-item"><strong><span class="k-badge">I</span></strong>Eyedropper</div>
                             <div class="g-item"><strong><span class="k-badge">B</span></strong>Blur Tool</div>
                             
                             <div class="g-item"><strong><span class="k-badge">Z</span></strong> Magnifier Tool</div>
                             <div class="g-item"><strong><span class="k-badge">Ctrl</span>+<span class="k-badge">Shift</span>+<span class="k-badge">Arrows</span></strong>Move Monitor</div>
                             ` : `
                             <div class="g-item"><strong><span class="k-badge">E</span></strong>Eraser</div>
                             <div class="g-item"><strong><span class="k-badge">R</span></strong>Star</div>
                             <div class="g-item"><strong><span class="k-badge">Enter</span></strong>Capture (Snap)</div>
                             `}
                        </div>

                        ${features.type === 'pro' ? `
                        <div class="setting-group">
                            <div class="st-title">Pro Manipulation</div>
                            <div class="setting-row" style="justify-content: flex-start; gap: 15px;">
                                <div style="font-size: 14px; color: var(--accent); width: 100px; text-align: center;"><span class="k-badge">Scroll</span></div>
                                <div class="setting-label">Resize Tool <div class="setting-desc">Hover canvas and scroll to change line width or text size.</div></div>
                            </div>
                            <div class="setting-row" style="justify-content: flex-start; gap: 15px;">
                                <div style="font-size: 14px; color: var(--accent); width: 100px; text-align: center;"><span class="k-badge">Shift</span>+<span class="k-badge">Scroll</span></div>
                                <div class="setting-label">Opacity / Border <div class="setting-desc">Adjusts Opacity for shapes, or Border Width for Magnifier.</div></div>
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
                        ` : ''}
                    </div>

                </div>
            </div>
        </div>
    </div>
    `,

    // 6. WIZARD HTML
    getWizardHtml: (features, settings) => `
    <div id="onboarding-wizard">
        <div class="wizard-content">
            <div class="wizard-header">
                <h2><i class="fa-solid fa-lightbulb"></i> Quick Setup</h2>
                <span id="wiz-step-info" style="color: #ccc; font-size: 14px;">Step 1 of 6</span>
            </div>
            <div class="wizard-body">
                <div id="wiz-page-1" class="wizard-page active">
                    <div class="wiz-page-title">Personalize Your Workflow</div>
                    <div class="wiz-page-content">
                        <p>Let's take a few seconds to configure CapSize to match your capturing style.</p>
                        <p>We'll set your preferred trigger, startup behavior, and focus mode. You can adjust these anytime in the <i class="fa-solid fa-gear"></i> Settings menu.</p>
                    </div>
                </div>

                <div id="wiz-page-2" class="wizard-page">
                    <div class="wiz-page-title">1. Activation Trigger</div>
                    <div class="wiz-page-content">
                        <p>Choose a global hotkey to instantly wake CapSize. When the app is hidden, pressing this key will freeze your screen and bring up your tools.</p>
                        <div class="setting-row" style="margin-top: 20px;">
                            <div class="setting-label">Global Hotkey <div class="setting-desc">e.g., F12, PrintScreen, or Ctrl+Space</div></div>
                            <input type="text" data-setting="globalHotkey" class="st-input" value="${settings.globalHotkey}" placeholder="PrintScreen" id="wiz-hotkey-input">
                        </div>
                        <p style="margin-top: 15px;">Active Key: <strong id="wiz-hotkey-display" style="color:var(--accent)">${settings.globalHotkey}</strong></p>
                    </div>
                </div>

                <div id="wiz-page-3" class="wizard-page">
    <div class="wiz-page-title">2. Initial Capture View</div>
    <div class="wiz-page-content">
        <p>How should the app look when you first activate it?</p>
        
        <ul style="list-style: none; padding-left: 0; margin-bottom: 20px;">
            <li style="margin-bottom: 15px;">
                <strong style="color:var(--accent); display:block; margin-bottom: 5px;">Fullscreen Capture Mode (Default):</strong>
                Instantly drag to highlight an area. Best for fast, free-form capturing.
            </li>
            <li style="margin-bottom: 15px;">
                <strong style="color:var(--accent); display:block; margin-bottom: 5px;">Precision Viewfinder:</strong>
                Starts with the floating window. Best for specific pixel dimensions or repetitive layouts.
            </li>
        </ul>

        <div class="setting-row" style="margin-top: 20px;">
            <div class="setting-label">Start in Fullscreen Capture Mode</div>
            <label class="toggle"><input type="checkbox" data-setting="startFullscreen" ${settings.startFullscreen ? 'checked' : ''}><span class="slider"></span></label>
        </div>
    </div>
</div>
                
                <div id="wiz-page-4" class="wizard-page">
                    <div class="wiz-page-title">3. Focus & Accuracy</div>
                    <div class="wiz-page-content">
                        <p>Customize how the window behaves while you are annotating.</p>
                        
                        <div class="setting-row" style="margin-top: 15px;">
                            <div class="setting-label">Stay on Top <div class="setting-desc">Always keep CapSize visible above other application windows.</div></div>
                            <label class="toggle"><input type="checkbox" data-setting="alwaysOnTop" ${settings.alwaysOnTop ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Canvas Metrics <div class="setting-desc">Show live pixel dimensions (W/H) next to your cursor.</div></div>
                            <label class="toggle"><input type="checkbox" data-setting="showMeasurements" ${settings.showMeasurements ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                        
                        <div class="setting-row">
                            <div class="setting-label">Focus Mode (Immersive) <div class="setting-desc">Hide resize handles and borders while drawing for a clearer view.</div></div>
                            <label class="toggle"><input type="checkbox" data-setting="immersiveMode" ${settings.immersiveMode ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                    </div>
                </div>

                <div id="wiz-page-save" class="wizard-page">
                    <div class="wiz-page-title">4. Output & Saving</div>
                    <div class="wiz-page-content">
                        <p>Choose where your captures should be stored and handled.</p>
                        
                        <div class="setting-row" style="margin-top: 15px;">
                            <div class="setting-label">Auto-Copy on Snap <div class="setting-desc">Instantly copy the final image to your clipboard every time you capture.</div></div>
                            <label class="toggle"><input type="checkbox" data-setting="autoClipboard" ${settings.autoClipboard ? 'checked' : ''}><span class="slider"></span></label>
                        </div>

                        <div class="setting-row" style="margin-top: 15px; display: block;">
                            <div class="setting-label" style="margin-bottom: 8px;">Default Save Path <div class="setting-desc">Leave blank to choose a folder manually for every capture.</div></div>
                            <div class="browse-group" style="display: flex; gap: 5px; width: 100%;">
                                <input type="text" id="wiz-save-path" class="st-input" style="flex:1;" value="${settings.savePath}" readonly placeholder="Default: Ask every time">
                                <button id="wiz-btn-browse" class="btn-browse">Browse...</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="wiz-page-5" class="wizard-page">
                    <div class="wiz-page-title">All Set!</div>
                    <div class="wiz-page-content">
                        <p>Configuration complete. Here are two final tips to speed up your work:</p>
                        
                        <ul style="margin-bottom: 15px; list-style: none; padding-left: 0;">
                            <li style="margin-bottom: 15px;">
                                <strong style="color:var(--accent); display:block; margin-bottom: 5px;">One-Touch Sharing:</strong> 
                                Use the <strong>Cyan Drag Button</strong> to instantly drop your work into other apps without saving.
                            </li>
                            <li style="margin-bottom: 15px;">
                                <strong style="color:var(--accent); display:block; margin-bottom: 5px;">Shape Toggles:</strong> 
                                Double-Click any shape tool (Square, Circle) to switch between Outline and Solid modes.
                            </li>
                            ${features.type === 'pro' ? `
                            <li style="margin-bottom: 15px;">
                                <strong style="color:var(--accent); display:block; margin-bottom: 5px;">Power Actions:</strong> 
                                Right-Click any shape on the canvas to quickly Duplicate, Reorder, or Delete it.
                            </li>` : ''}
                        </ul>

                        <div id="wiz-dont-show-container" style="margin-top: 25px;">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; color:#888; font-size:12px;">
                                <input type="checkbox" id="wiz-dont-show-check" checked> Configuration complete (Don't show wizard again)
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
    `,

    // 7. RADIUS BUBBLE HTML
    getRadiusBubbleHtml: () => `
    <div id="radius-bubble" class="hidden">
        <i class="fa-regular fa-square" style="color:var(--accent); font-size:14px;"></i>
        <span style="font-size:11px; color:#aaa; font-weight:bold; text-transform:uppercase; margin-right:5px;">Radius</span>
        <input type="range" id="radius-bubble-input" min="0" max="50" step="1" style="width:100px;">
        <span id="radius-bubble-val" style="color:var(--accent); font-weight:bold; font-family:'Consolas', monospace; font-size:12px; min-width:30px; text-align:right;">10px</span>
    </div>
    `,

    // 8. RADIUS BUBBLE CSS
    getRadiusBubbleStyle: () => `
        #radius-bubble {
            position: fixed; 
            bottom: 80px;       
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
            z-index: 50000;      
            transition: opacity 0.2s, transform 0.2s;
        }
        #radius-bubble.hidden { display: none !important; }
        #radius-bubble:hover { transform: translateX(-50%) translateY(-2px); }
    `,

    // 9. CONTEXT MENU STYLE
    getContextMenuStyle: () => `
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
    `,

    // 10. CONTEXT MENU HTML
    getContextMenuHtml: () => `
        <button class="ctx-item" id="cm-top"><i class="fa-solid fa-angles-up"></i> Bring to Front</button>
        <button class="ctx-item" id="cm-up"><i class="fa-solid fa-angle-up"></i> Bring Forward <span class="ctx-shortcut">]</span></button>
        <button class="ctx-item" id="cm-down"><i class="fa-solid fa-angle-down"></i> Send Backward <span class="ctx-shortcut">[</span></button>
        <button class="ctx-item" id="cm-bottom"><i class="fa-solid fa-angles-down"></i> Send to Back</button>
        <div class="ctx-divider"></div>
        <button class="ctx-item" id="cm-dupe"><i class="fa-solid fa-clone"></i> Duplicate <span class="ctx-shortcut">Ctrl+C</span></button>
        <div class="ctx-divider"></div>
        <button class="ctx-item ctx-danger" id="cm-del"><i class="fa-solid fa-trash"></i> Delete <span class="ctx-shortcut">Del</span></button>
    `,

    // 11. CHEAT SHEET (UPDATED FOR DYNAMIC BALANCE)
    getCheatSheetContent: (isPro) => {
        // Define tool sets
        const createTools = [
            { desc: 'Pen Tool', key: 'P' },
            { desc: isPro ? 'Line / Highlt.' : 'Line Tool', key: 'L' },
            { desc: isPro ? 'Arrows (Cycle)' : 'Arrow Tool', key: 'A' },
            { desc: 'Square', key: 'S' },
            { desc: 'Circle', key: 'C' },
            { desc: 'Text Tool', key: 'T' }
        ];

        if (isPro) {
            createTools.push(
                { desc: 'Triangle', key: 'Y' },
                { desc: 'Star', key: 'R' },
                { desc: 'Polygon', key: 'G' },
                { desc: 'Checkmark', key: 'V' },
                { desc: 'X-Shape', key: 'X' }
            );
        } else {
            createTools.push({ desc: 'Star', key: 'R' });
        }

        const utilityTools = [
            { desc: 'Snap Screen', key: 'Enter' },
            { desc: 'Eraser', key: 'E' }
        ];

        if (isPro) {
            utilityTools.push(
                { desc: 'Extra Tools (Cycle)', key: 'U' },
                { desc: 'Blur Tool', key: 'B' },
                { desc: 'OCR Scanner', key: 'O' },
                { desc: 'Eyedropper', key: 'I' },
                { desc: 'Magnifier Tool', key: 'Z' },
                { desc: 'Stamp (Cycle)', key: 'M' },
                { desc: 'Reset Stamp', key: 'Ctrl+R' }
            );
        }

        const editTools = [
            { desc: 'Undo / Redo', key: 'Ctrl+Z / Y' },
            { desc: 'Nudge Shape', key: 'Arrows' },
            { desc: 'Delete', key: 'Del' }
        ];

        if (isPro) {
            editTools.push(
                { desc: 'Move Screen', key: 'Ctrl+Shft+Arr' },
                { desc: 'Layer Order', key: '[  /  ]' },
                { desc: 'Adjust Size', key: 'Scroll' },
                { desc: 'Adjust Opacity', key: 'Shft+Scroll' }
            );
        }

        // Helper to render columns
        const renderCol = (title, items) => `
            <div style="display:flex; flex-direction:column; gap:2px;">
                <div class="hk-title">${title}</div>
                ${items.map(i => `
                    <div class="hk-row"><span class="hk-desc">${i.desc}</span><span class="hk-key">${i.key}</span></div>
                `).join('')}
            </div>
        `;

        return `
            <style>
                #hotkey-cheat-sheet .hk-desc { font-size: 11px !important; color: #bbb !important; }
                #hotkey-cheat-sheet .hk-key { font-size: 10px !important; padding: 1px 5px !important; min-width: 20px !important; height: 18px !important; line-height: 14px !important; }
                #hotkey-cheat-sheet .hk-row { padding: 3px 0 !important; border-bottom: 1px solid #2a2a2a !important; }
                #hotkey-cheat-sheet .hk-title { font-size: 12px !important; margin-bottom: 8px !important; padding-bottom: 4px !important; text-align: left; border-bottom: 1px solid var(--accent); }
            </style>
            ${renderCol('Create', createTools)}
            ${renderCol('Utility', utilityTools)}
            ${renderCol('Edit & View', editTools)}
            <div style="grid-column: 1 / -1; text-align:center; margin-top:10px; padding-top:8px; border-top:1px solid #333; font-size: 10px; color: #666; text-transform:uppercase; letter-spacing:1px;">
                Hold <strong>SHIFT</strong> to Snap Angles &nbsp;&bull;&nbsp; Release <strong>ALT</strong> to close
            </div>
        `;
    },

    // 12. EDITION LABEL CSS (Pro vs Core)
    getBrandingStyle: (isPro, labelColor) => `
        /* --- MAIN WINDOW BRANDING --- */
        .header { padding-right: 10px !important; } 
        .settings { margin-right: 5px !important; }
        .window-controls, #btn-help, .utility-buttons { flex-shrink: 0 !important; z-index: 50000 !important; }

        /* 1. Make Title Bigger & Prevent Wrapping */
        .header .title {
            font-size: 20px !important;
            white-space: nowrap !important;
            display: flex !important;
            align-items: center !important;
        }

        /* 2. Badge Styling (RIGID BLOCK) */
        .edition-label {
            /* 1. Force Exact Dimensions (Slightly larger now) */
            display: inline-block !important;
            width: 32px !important;       /* Bumped up from 28px */
            min-width: 32px !important;
            max-width: 32px !important;
            height: 14px !important;      /* Bumped up from 12px */
            
            /* 2. Lock Layout */
            box-sizing: border-box !important;
            overflow: hidden !important;  
            white-space: nowrap !important;
            
            /* 3. Typography & Alignment */
            font-family: 'Orbitron', sans-serif;
            font-size: 7.5px !important;  /* Bumped up from 6px */
            font-weight: 800;
            text-align: center !important;
            line-height: 13px !important; /* Adjusted to center in 14px box */
            letter-spacing: 0.5px;
            
            /* 4. Visuals */
            color: ${labelColor};
            border: 1px solid ${labelColor};
            border-radius: 3px;
            opacity: 1 !important;
            padding: 0 !important;
            
            /* 5. Positioning adjustments */
            vertical-align: middle;
            position: relative;
            top: -5px; /* Shifted down slightly to match the new height */
            margin-left: 4px;
        }
        
        /* 3. Logo & Layout Compensation */
        .logo-area { margin-right: 15px !important; gap: 7px !important; flex-shrink: 0 !important; min-width: fit-content !important; }
        .app-logo { margin-left: -4px !important; }
    `
};