const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron'); 

const LicenseManager = {
    getLicensePath: (appName) => {
        const storagePath = path.join(app.getPath('appData'), 'MintLogic', appName);
        if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });
        return path.join(storagePath, 'license.bin'); 
    },

    // NEW: Replaces the math-heavy sealToHardware
    saveLicense: (data, appName) => {
        if (!safeStorage.isEncryptionAvailable()) return false;
        
        try {
            // Asks Windows DPAPI to encrypt the JSON based on the logged-in User's credentials
            const encryptedString = safeStorage.encryptString(JSON.stringify(data));
            fs.writeFileSync(LicenseManager.getLicensePath(appName), encryptedString);
            return true;
        } catch (e) {
            console.error("Passkey Encryption Failed:", e);
            return false;
        }
    },

    // NEW: Replaces the math-heavy validate logic
    loadLicense: (appName) => {
        const filePath = LicenseManager.getLicensePath(appName);
        
        // 1. If no file exists, app is in Core mode
        if (!fs.existsSync(filePath)) return { valid: false, reason: "No license found." };
        
        // 2. If OS security is disabled
        if (!safeStorage.isEncryptionAvailable()) return { valid: false, reason: "DPAPI unavailable." };

        try {
            // 3. Ask Windows to decrypt it
            const encryptedBuffer = fs.readFileSync(filePath); // <-- Reads the raw binary Buffer natively!
            const decryptedString = safeStorage.decryptString(encryptedBuffer);
            const data = JSON.parse(decryptedString);
            
            // 4. Verify it's actually unlocked for this app
            if (data && data.unlocked && data.app === appName) {
                return { valid: true, data };
            }
            
            return { valid: false, reason: "Invalid passkey data." };
        } catch (e) {
            // If they copy-pasted the file from another PC, decryption instantly crashes here
            return { valid: false, reason: "Hardware mismatch (Decryption failed)." };
        }
    }
};

module.exports = LicenseManager;