import { WhatsAppMessageScanner } from './WhatsAppMessageScanner.js';

(() => {
  if (window.top !== window) {
    return;
  }
  const scanner = new WhatsAppMessageScanner();
  scanner.injectNetworkInterceptor();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scanner.start(), { once: true });
    return;
  }
  scanner.start();
})();
