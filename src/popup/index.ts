import { PopupController } from './PopupController.js';

const controller = new PopupController();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => controller.initialize());
} else {
  controller.initialize();
}
