// Polyfills for Web APIs that the Copilot CLI expects but aren't in Node.js
// This file is injected into the CLI subprocess via NODE_OPTIONS

if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File {
    constructor(chunks, name, options = {}) {
      this.chunks = chunks;
      this.name = name;
      this.options = options;
      this.type = options.type || '';
      this.lastModified = options.lastModified || Date.now();
    }
  };
}

if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = class Blob {
    constructor(chunks = [], options = {}) {
      this.chunks = chunks;
      this.type = options.type || '';
    }
    
    get size() {
      return this.chunks.reduce((sum, chunk) => sum + (chunk.length || 0), 0);
    }
  };
}

// Suppress warnings about missing APIs
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  // Silently ignore warnings
});
