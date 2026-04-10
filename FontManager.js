// FontManager.js
import { SYSTEM_FONTS, userSettings } from './Config.js';

export const FontManager = {
    loadCustomFonts: async function(onComplete) {
        if (userSettings.customFonts && userSettings.customFonts.length > 0) {
            for (const font of userSettings.customFonts) {
                try {
                    const fontFace = new FontFace(font.name, `url(${font.data})`);
                    const loadedFace = await fontFace.load();
                    document.fonts.add(loadedFace);
                } catch (e) {
                    console.warn(`Failed to load font ${font.name}:`, e);
                }
            }
        }
        if (onComplete) onComplete();
    },

    renderList: function(onPin, onVis, onDel) {
        const listContainer = document.getElementById('font-manager-list');
        if (!listContainer) return;
        listContainer.innerHTML = ''; 

        const sysItems = SYSTEM_FONTS.map(name => ({
            name: name, type: 'system', pinned: userSettings.pinnedFonts.includes(name), hidden: userSettings.hiddenFonts.includes(name)
        }));

        const custItems = userSettings.customFonts.map((f, index) => ({
            name: f.name, type: 'custom', index: index, pinned: userSettings.pinnedFonts.includes(f.name), hidden: userSettings.hiddenFonts.includes(f.name)
        }));

        const allFonts = [...sysItems, ...custItems];
        allFonts.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return a.name.localeCompare(b.name);
        });

        // Expose handlers globally so the inline HTML strings can trigger them
        window._fontPinHandler = onPin;
        window._fontVisHandler = onVis;
        window._fontDelHandler = onDel;

        allFonts.forEach(font => {
            const row = document.createElement('div');
            row.className = `font-row ${font.hidden ? 'is-hidden' : ''}`;
            
            row.innerHTML = `
                <div class="font-info">
                    <span class="font-name"></span> <span class="font-badge ${font.type}">${font.type}</span>
                </div>
                <div class="font-actions">
                    <button class="font-btn pin ${font.pinned ? 'active' : ''}" title="${font.pinned ? 'Unpin' : 'Pin to Top'}" onclick="window._fontPinHandler('${font.name.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-thumbtack"></i>
                    </button>
                    
                    <button class="font-btn visible ${font.hidden ? 'hidden-state' : 'visible-state'}" title="${font.hidden ? 'Show' : 'Hide'}" onclick="window._fontVisHandler('${font.name.replace(/'/g, "\\'")}')">
                        <i class="fa-solid ${font.hidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    
                    ${font.type === 'custom' ? `
                    <button class="font-btn delete" title="Delete Font" onclick="window._fontDelHandler(${font.index})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    ` : '<div style="width:24px;"></div>'} 
                </div>
            `;

            const nameSpan = row.querySelector('.font-name');
            nameSpan.textContent = font.name; 
            nameSpan.style.fontFamily = `'${font.name}', sans-serif`;

            listContainer.appendChild(row);
        });
    },

    updateDropdowns: function(onSelect) {
        const menus = [
            { btn: document.getElementById('font-family'), menu: document.getElementById('font-family-menu') },
            { btn: document.getElementById('fb-font-family'), menu: document.getElementById('fb-font-family-menu') }
        ];
        
        let allItems = SYSTEM_FONTS.map(name => ({ name, type: 'System', isCustom: false }));
        if (userSettings.customFonts && userSettings.customFonts.length > 0) {
            userSettings.customFonts.forEach(f => { allItems.push({ name: f.name, type: 'Custom', isCustom: true }); });
        }
        allItems = allItems.filter(f => !userSettings.hiddenFonts.includes(f.name));

        const pinned = []; const standard = []; const custom = [];
        allItems.forEach(f => {
            if (userSettings.pinnedFonts.includes(f.name)) pinned.push(f);
            else if (f.isCustom) custom.push(f);
            else standard.push(f);
        });

        const sortFn = (a, b) => a.name.localeCompare(b.name);
        pinned.sort(sortFn); standard.sort(sortFn); custom.sort(sortFn);

        let html = '';
        const buildGroup = (label, items, prefix='') => {
            if(items.length === 0) return '';
            let groupHtml = `<div class="font-optgroup">${label}</div>`;
            items.forEach(f => {
                groupHtml += `<button class="dropdown-item font-option" data-font="${f.name}" style="font-family: '${f.name}', sans-serif;">
                    <span style="pointer-events:none;">${prefix}${f.name}</span>
                </button>`;
            });
            return groupHtml;
        };

        html += buildGroup('Favorites', pinned, '★ ');
        html += buildGroup('Standard', standard);
        html += buildGroup('My Fonts', custom);

        menus.forEach(m => {
            if (!m.btn || !m.menu) return;
            const currentVal = m.btn.value;
            m.menu.innerHTML = html;

            m.menu.querySelectorAll('.font-option').forEach(opt => {
                opt.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const fontName = opt.dataset.font;

                    menus.forEach(btnPair => {
                        if(btnPair.btn) {
                            btnPair.btn.value = fontName;
                            const label = btnPair.btn.querySelector('.font-label');
                            if(label) { label.textContent = fontName; label.style.fontFamily = `'${fontName}', sans-serif`; }
                        }
                    });

                    if(onSelect) onSelect('fontFamily', fontName);
                    m.menu.classList.remove('show');
                };
            });

            const exists = allItems.some(o => o.name === currentVal);
            if (!exists && allItems.length > 0) {
                const fallback = allItems[0].name;
                m.btn.value = fallback;
                const lbl = m.btn.querySelector('.font-label');
                if(lbl) { lbl.textContent = fallback; lbl.style.fontFamily = `'${fallback}', sans-serif`; }
                if (m.btn.id === 'font-family' && onSelect) onSelect('fontFamily', fallback);
            }
        });
    }
};