/**
 * DOMHelpers - DOM utility functions
 *
 * Features:
 * - Promise-based delay helper
 * - Viewport visibility check
 * - Toast notification display (3s auto-dismiss)
 * - Button visibility verification
 * - Smart scroll positioning
 */

window.DOMHelpers = class DOMHelpers {
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
      rect.bottom > 0 &&
      rect.left < (window.innerWidth || document.documentElement.clientWidth) &&
      rect.right > 0
    );
  }

  static showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  static isPostFullyEngageable(post, selectors) {
    // Check if post AND its interaction buttons are visible and accessible

    // 1. Check if post container is at least partially visible
    if (!this.isElementInViewport(post)) {
      return false;
    }

    // 2. Find interaction buttons (like, comment)
    const likeButton = post.querySelector(selectors.likeButton || selectors.upvoteButton);
    const commentButton = post.querySelector(selectors.commentButton || selectors.replyButton);

    // 3. Collect valid buttons
    const buttons = [likeButton, commentButton].filter(btn => btn);

    if (buttons.length === 0) {
      // No buttons found (unusual), just check if post top is visible
      const rect = post.getBoundingClientRect();
      return rect.top >= 0 && rect.top < window.innerHeight * 0.8;
    }

    // 4. Check if at least one button is fully in viewport
    for (const button of buttons) {
      const rect = button.getBoundingClientRect();
      const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (fullyVisible) {
        return true; // At least one button fully visible
      }
    }

    return false;
  }

  static async scrollPostIntoEngageableView(post, selectors) {
    // Scrolls post so interaction buttons are comfortably visible

    // Find the lowest interaction element
    const likeButton = post.querySelector(selectors.likeButton || selectors.upvoteButton);
    const commentButton = post.querySelector(selectors.commentButton || selectors.replyButton);

    const buttons = [likeButton, commentButton].filter(btn => btn);

    if (buttons.length > 0) {
      // Find the button with lowest position (furthest down the page)
      let lowestButton = buttons[0];
      let lowestBottom = lowestButton.getBoundingClientRect().bottom;

      for (const button of buttons) {
        const bottom = button.getBoundingClientRect().bottom;
        if (bottom > lowestBottom) {
          lowestButton = button;
          lowestBottom = bottom;
        }
      }

      // Scroll so the lowest button is comfortably in view (centered)
      lowestButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.sleep(500);
    } else {
      // Fallback: scroll post top into view
      post.scrollIntoView({ behavior: 'smooth', block: 'start' });
      await this.sleep(500);
    }
  }
};
