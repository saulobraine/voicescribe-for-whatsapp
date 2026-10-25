import { AdminController } from './AdminController.js';

const controller = new AdminController();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => controller.initialize());
} else {
  controller.initialize();
}
