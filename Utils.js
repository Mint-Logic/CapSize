// Utils.js
let toastTimeout;

export const showSystemToast = (msg, success = true) => {
    let toast = document.getElementById('sysToast');
    if (!toast) return;
    toast.className = ''; 
    toast.innerHTML = success ? `<i class="fa-solid fa-circle-check"></i> ${msg}` : `<i class="fa-solid fa-circle-exclamation"></i> ${msg}`;
    if (!success) toast.classList.add('error');
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => toast.classList.remove('show'), 3000);
};

export function showToast(message, duration = 1000) {
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
    }, duration); 
}

export function showConfirm(message, onYes) {
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

export function resolvePath(relativePath) {
    return new URL(relativePath, document.baseURI).href;
}