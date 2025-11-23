/**
 * CursorAnimator - Visual cursor with realistic movement and clicks
 *
 * Features:
 * - Visual red cursor element creation
 * - Bezier curve animation for realistic movement
 * - Human-like click simulation with visual feedback
 * - Random movement timing
 */

window.CursorAnimator = class CursorAnimator {
  constructor() {
    this.cursor = null;
  }

  createCursor() {
    if (this.cursor) return;

    this.cursor = document.createElement('div');
    this.cursor.style.cssText = `
      position: fixed;
      width: 20px;
      height: 20px;
      background: rgba(255, 0, 0, 0.6);
      border: 2px solid rgba(255, 0, 0, 0.9);
      border-radius: 50%;
      pointer-events: none;
      z-index: 999999;
      transition: all 0.1s ease-out;
      display: block;
      box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
      left: 50%;
      top: 50%;
    `;
    document.body.appendChild(this.cursor);
  }

  showCursor() {
    if (this.cursor) {
      this.cursor.style.opacity = '1';
    }
  }

  hideCursor() {
    if (this.cursor) {
      this.cursor.style.opacity = '0.3';
    }
  }

  async moveCursorTo(element) {
    if (!this.cursor) return;

    const rect = element.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    const currentX = parseFloat(this.cursor.style.left) || Math.random() * window.innerWidth;
    const currentY = parseFloat(this.cursor.style.top) || Math.random() * window.innerHeight;

    const distance = Math.sqrt(Math.pow(targetX - currentX, 2) + Math.pow(targetY - currentY, 2));
    const duration = Math.max(300, Math.min(1500, distance * 2));

    this.showCursor();
    await this.animateCursorMovement(currentX, currentY, targetX, targetY, duration);
  }

  async animateCursorMovement(startX, startY, endX, endY, duration) {
    return new Promise(resolve => {
      const startTime = Date.now();
      const deltaX = endX - startX;
      const deltaY = endY - startY;

      const controlPointX = startX + deltaX * 0.5 + (Math.random() - 0.5) * 100;
      const controlPointY = startY + deltaY * 0.5 + (Math.random() - 0.5) * 100;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easeProgress = 1 - Math.pow(1 - progress, 3);

        const t = easeProgress;
        const invT = 1 - t;

        const x = invT * invT * startX + 2 * invT * t * controlPointX + t * t * endX;
        const y = invT * invT * startY + 2 * invT * t * controlPointY + t * t * endY;

        this.cursor.style.left = x + 'px';
        this.cursor.style.top = y + 'px';

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      animate();
    });
  }

  async humanLikeClick(element, notificationCallback) {
    try {
      await this.moveCursorTo(element);
      await this.sleep(Math.random() * 200 + 100);

      this.cursor.style.transform = 'scale(0.8)';
      this.cursor.style.background = 'rgba(255, 100, 100, 0.8)';

      element.click();

      await this.sleep(100);

      this.cursor.style.transform = 'scale(1)';
      this.cursor.style.background = 'rgba(255, 0, 0, 0.6)';

      setTimeout(() => this.hideCursor(), 500);

      if (notificationCallback) {
        notificationCallback('Clicked element');
      }
      await this.sleep(Math.random() * 500 + 200);

    } catch (error) {
      console.log('Error in humanLikeClick:', error);
      this.hideCursor();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};
