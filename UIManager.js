// UIManager.js
import { userSettings } from './Config.js';

export const UIManager = {
    currentTooltipTarget: null,

    initTooltips: function() {
        const tooltipEl = document.createElement('div');
        tooltipEl.className = 'custom-tooltip';
        document.body.appendChild(tooltipEl);

        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest('[title], [data-original-title]');
            if (!target) return;

            if (target.hasAttribute('title')) {
                const text = target.getAttribute('title');
                target.setAttribute('data-original-title', text);
                target.removeAttribute('title');
            }

            if (userSettings.showTooltips === false) return; 

            const text = target.getAttribute('data-original-title');
            if (!text) return;

            this.currentTooltipTarget = target;
            tooltipEl.textContent = text;
            tooltipEl.classList.add('visible');

            const rect = target.getBoundingClientRect();
            const tipRect = tooltipEl.getBoundingClientRect();
            
            let top = rect.bottom + 8;
            let left = rect.left + (rect.width / 2) - (tipRect.width / 2);

            if (top + tipRect.height > window.innerHeight - 5) top = rect.top - tipRect.height - 8;
            if (left < 5) left = 5;
            if (left + tipRect.width > window.innerWidth) left = window.innerWidth - tipRect.width - 5;

            tooltipEl.style.top = top + 'px';
            tooltipEl.style.left = left + 'px';
        });

        document.addEventListener('mouseout', (e) => {
            const target = e.target.closest('[data-original-title]');
            if (target) {
                if (e.relatedTarget && target.contains(e.relatedTarget)) return;
                if (target === this.currentTooltipTarget) this.currentTooltipTarget = null;
                const text = target.getAttribute('data-original-title');
                if (text) {
                    target.setAttribute('title', text);
                    target.removeAttribute('data-original-title');
                }
                tooltipEl.classList.remove('visible');
            }
        });

        document.addEventListener('mousedown', () => {
            tooltipEl.classList.remove('visible');
            this.currentTooltipTarget = null;
        });
    },

    updateTooltip: function(el, text) {
        if (!el) return;
        el.setAttribute('data-original-title', text);
        if (el.hasAttribute('title')) el.removeAttribute('title');
        const tipEl = document.querySelector('.custom-tooltip');
        if (this.currentTooltipTarget === el && tipEl && tipEl.classList.contains('visible')) {
            tipEl.textContent = text;
        }
    },

    initTabsAndSliders: function() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = btn.dataset.tab;
                let currentPane = null;
                
                document.querySelectorAll('.tab-btn').forEach(b => {
                    if (b.classList.contains('active')) currentPane = document.getElementById(b.dataset.tab);
                    b.classList.remove('active');
                });
                
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                if (currentPane) currentPane.scrollTop = 0; 

                btn.classList.add('active');
                const targetPane = document.getElementById(tabId);
                if (targetPane) {
                    targetPane.classList.add('active');
                    targetPane.scrollTop = 0; 
                }
                this.updateAllSliderTooltips();
            });
        });

        this.updateAllSliderTooltips();
        document.addEventListener('input', (e) => {
            if(e.target.tagName === 'INPUT' && e.target.type === 'range') this.updateAllSliderTooltips();
        });
    },

    updateAllSliderTooltips: function() {
        document.querySelectorAll('input[type="range"]').forEach(input => {
            const val = parseFloat(input.value); let text = val;
            if (input.id.includes('opacity') || (input.dataset.setting && input.dataset.setting.includes('Opacity'))) text = Math.round(val * 100) + '%';
            else if (input.id.includes('size') || input.dataset.setting === 'shadowBlur' || input.dataset.setting === 'shadowDistance' || input.dataset.setting === 'cornerRadius') text = val + 'px';
            else if (input.dataset.setting === 'imageQuality') text = Math.round(val * 100) + '%';
            
            input.title = text;
            const valDisplay = input.parentElement.querySelector('.slider-val');
            if (valDisplay) valDisplay.textContent = text;
        });
    },

    initFloatingMenus: function(handleToolClick) {
        const menus = [
            { btnId: 'fb-btn-tools',       menuId: 'fb-tools-menu',       trigger: 'click' },      
            { btnId: 'fb-btn-multishape',  menuId: 'fb-shape-menu',       trigger: 'contextmenu' }, 
            { btnId: 'fb-btn-arrow-multi', menuId: 'fb-arrow-menu',       trigger: 'contextmenu' }, 
            { btnId: 'btn-footer-extras',  menuId: 'footer-extras-menu',  trigger: 'click' }       
        ];

        function closeAllMenus(exceptMenuId = null) {
            menus.forEach(m => {
                const menuEl = document.getElementById(m.menuId);
                if (menuEl && menuEl.id !== exceptMenuId) {
                    menuEl.classList.remove('show');
                }
            });
            ['shape-menu', 'arrow-menu'].forEach(id => {
                const el = document.getElementById(id);
                if(el && el.id !== exceptMenuId) el.classList.remove('show');
            });
        }

        menus.forEach(item => {
            const btn = document.getElementById(item.btnId);
            const menu = document.getElementById(item.menuId);

            if (btn && menu) {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);

                if (item.trigger === 'contextmenu') {
                    newBtn.onclick = (e) => {
                        if (typeof handleToolClick === 'function') handleToolClick(newBtn);
                    };
                }

                newBtn.addEventListener(item.trigger, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const isOpen = menu.classList.contains('show');
                    closeAllMenus(item.menuId);
                    if (isOpen) menu.classList.remove('show'); else menu.classList.add('show');
                });
            }
        });

        window.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown') && !e.target.closest('.tool-btn')) closeAllMenus();
        });

        const toolsMenu = document.getElementById('fb-tools-menu');
        if (toolsMenu) {
            toolsMenu.querySelectorAll('.dropdown-item').forEach(item => {
                item.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    toolsMenu.classList.remove('show');
                    const toolId = item.dataset.tool || item.dataset.t;
                    if (!toolId) return;
                    if (typeof handleToolClick === 'function') handleToolClick({ dataset: { t: toolId } });
                };
            });
        }
    }
};

// --- HEADER SPIN ARROW LOGIC ---
let spinInterval;
let spinTimeout;

window.startSpin = function(inputId, delta) {
    window.adjustDim(inputId, delta);
    window.stopSpin();
    spinTimeout = setTimeout(() => {
        let speed = 150; 
        const spinLoop = () => {
            window.adjustDim(inputId, delta);
            speed = Math.max(10, speed * 0.85); 
            spinInterval = setTimeout(spinLoop, speed);
        };
        spinLoop();
    }, 500); 
};

window.stopSpin = function() {
    clearTimeout(spinTimeout);
    clearTimeout(spinInterval);
};

window.adjustDim = function(inputId, delta) {
    const input = document.getElementById(inputId);
    if(input) {
        let val = parseInt(input.value) || 0;
        val += delta;
        if(val < 1) val = 1;
        input.value = val;
        input.dispatchEvent(new Event('change'));
    }
};

// [NEW] SECURE EVENT BINDER
window.initSpinners = function() {
    // 1. Find all elements attempting to use the blocked inline script
    const spinners = document.querySelectorAll('[onpointerdown*="startSpin"]');
    
    spinners.forEach(el => {
        const downCode = el.getAttribute('onpointerdown');
        // 2. Extract the target ID and the math delta (+1 or -1)
        const match = downCode.match(/startSpin\(['"]([^'"]+)['"],\s*(-?\d+)\)/);
        
        if (match) {
            const targetId = match[1];
            const delta = parseInt(match[2]);

            // 3. Strip the unsafe inline attributes from the DOM
            el.removeAttribute('onpointerdown');
            el.removeAttribute('onpointerup');
            el.removeAttribute('onpointerleave');

            // 4. Securely attach the JavaScript listeners
            el.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                window.startSpin(targetId, delta);
            });
            el.addEventListener('pointerup', window.stopSpin);
            el.addEventListener('pointerleave', window.stopSpin);
        }
    });
};