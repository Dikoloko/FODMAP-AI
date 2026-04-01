// Polyfill IndexedDB with an in-memory fake so Dexie works in Node/jsdom tests.
// Must run before any module that imports db.ts.
import 'fake-indexeddb/auto';

// Suppress jsdom's "Not implemented: navigation to another Document" warning that
// fires when exportData() calls anchor.click() for a file download.
window.HTMLAnchorElement.prototype.click = () => {};
