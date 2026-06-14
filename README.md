# CapSize

A precision screen capture and annotation tool designed to bypass the sluggishness of traditional web-based capture utilities. CapSize acts as a dedicated viewfinder, allowing users to type exact pixel dimensions or crop regions directly with an "instant freeze" canvas.

## Features
* **WGC Capture Pipeline:** Uses a custom native C++ node addon to hook directly into the Windows Graphics Capture API, avoiding Chromium's delayed capture window.
* **Offline OCR:** Extracts text locally via an embedded Tesseract.js WebAssembly worker. No data leaves your machine.
* **Vector Markup Engine:** Real-time canvas drawing with support for quadratic Bezier curves, automated sequential step stamps, and smart guides.
* **Privacy Defenses:** Includes a permanent pixel-scramble blur tool to redact sensitive PII (passwords, faces, emails) natively before distribution.

## Architecture
Built with Electron, HTML5 Canvas, and a custom native sidecar for Windows API bindings. The project relies on a 3-tier capture pipeline (WGC API -> Electron Desktop Capturer -> PowerShell reflection fallback) to ensure 100% hardware compatibility across hybrid-GPU laptop configurations.

## Development & Installation

Ensure you have Node.js installed, then clone the repository and run:

```bash
# Install required dependencies
npm install

# Run the app in core mode
npm start

# Run the app simulating the pro environment flags
npm run start:pro
