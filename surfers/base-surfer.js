/**
 * BaseAutoSurfer - Shared automation base class
 *
 * Used by: Twitter, Instagram, Reddit surfers
 * Architecture: Uses shared utility modules via composition
 *
 * Utilities (from surfers/utilities/):
 * - CursorAnimator (cursor-animator.js): Visual cursor & clicks
 * - TextTyper (text-typer.js): Human-like typing
 * - DuplicateDetector (engagement-helpers.js): Prevent re-engagement
 * - SafetyLimits (engagement-helpers.js): Rate limiting
 * - DOMHelpers (dom-helpers.js): DOM utilities
 *
 * PLATFORM-SPECIFIC CLASSES SHOULD OVERRIDE:
 * 1. getPlatformSelectors() - Return platform-specific DOM selectors
 * 2. findSeeMoreButtonsInPost(post) - Platform-specific "see more" detection logic
 * 3. findSeeMoreButtons() - Global "see more" detection for test function
 */

window.BaseAutoSurfer = class BaseAutoSurfer {
  constructor() {
    this.isActive = false;
    this.engagementTimeout = null;
    this.platform = 'unknown'; // Platform subclasses should set this
    this.selectors = {}; // Platform subclasses should populate this via getPlatformSelectors()

    this.settings = {
      scrollSpeedMin: 2000,
      scrollSpeedMax: 4000,
      enableAutoLike: false,
      likeDelay: 5000,
      likeProbability: 70,
      enableAutoComment: false,
      commentDelay: 8000,
      commentProbability: 30,
      enableSeeMore: false,
      seeMoreDelay: 2000,
      postEngagementDelay: 3000
    };


    this.sessionStats = {
      totalPostsViewed: 0,
      totalSeeMoreClicked: 0,
      totalPostsLiked: 0,
      totalComments: 0
    };

    // Initialize shared utilities
    this.cursor = new window.CursorAnimator();
    this.typer = new window.TextTyper();
    this.duplicateDetector = new window.DuplicateDetector();
    this.safetyLimits = new window.SafetyLimits();
    this.templateGenerator = new window.TemplateGenerator();

    this.init();
    this.cursor.createCursor();
  }

  /**
   * HOOK: Platform-specific selector configuration
   * Override this in platform subclasses to return selectors object with:
   * - posts: Main post/article container selector
   * - likeButton or upvoteButton: Like/reaction button selector
   * - commentButton or replyButton: Comment/reply button selector
   * - textArea: Comment input field selector
   * - seeMore: Expand content button selector
   *
   * @returns {Object} Selectors object
   */
  getPlatformSelectors() {
    throw new Error('getPlatformSelectors() must be implemented by platform subclass');
  }

  /**
   * HOOK: Platform-specific "see more" button detection within a post
   * Override this in platform subclasses if default logic doesn't work
   *
   * @param {HTMLElement} post - The post element to search within
   * @returns {Array<HTMLElement>} Array of "see more" buttons found
   */
  findSeeMoreButtonsInPost(post) {
    const buttons = [];

    // Default keywords - platform subclasses can override with their own
    const expandKeywords = this.getExpandKeywords();

    const clickableElements = post.querySelectorAll(`
      button,
      span[role="button"],
      div[role="button"],
      a[role="button"],
      [tabindex="0"],
      span[data-testid],
      div[data-testid]
    `);

    clickableElements.forEach(element => {
      const text = element.textContent.trim();
      const textLower = text.toLowerCase();
      const ariaLabel = (element.getAttribute('aria-label') || '');
      const ariaLabelLower = ariaLabel.toLowerCase();

      const matchesKeyword = expandKeywords.some(keyword => {
        if (this.platform === 'facebook') {
          return text === keyword || ariaLabel === keyword;
        }
        return textLower.includes(keyword.toLowerCase()) ||
          ariaLabelLower.includes(keyword.toLowerCase());
      });

      if (matchesKeyword) {
        buttons.push(element);
      }
    });

    return buttons;
  }

  /**
   * HOOK: Platform-specific "see more" button detection (global search)
   * Override this in platform subclasses if default logic doesn't work
   * Used primarily by testSeeMoreButtons() function
   *
   * @returns {Array<HTMLElement>} Array of all "see more" buttons found on page
   */
  findSeeMoreButtons() {
    const buttons = [];

    // Convert NodeList to Array to allow push operations
    let posts = Array.from(document.querySelectorAll(this.selectors.posts));

    if (posts.length === 0 && this.platform === 'facebook') {
      // Facebook fallback - try alternative selectors
      const altSelectors = [
        'div[data-pagelet="FeedUnit"]',
        '[role="main"] > div > div',
        'div[data-testid="story-subtilte"]',
        'div[aria-posinset]',
        '.story_body_container'
      ];

      for (let selector of altSelectors) {
        const altPosts = document.querySelectorAll(selector);
        if (altPosts.length > 0) {
          posts.push(...altPosts);
          break;
        }
      }
    }

    const expandKeywords = this.getExpandKeywords();

    // Special Facebook handling - search globally
    if (this.platform === 'facebook') {
      const allClickableElements = document.querySelectorAll(`
        div[role="button"],
        span[role="button"],
        button,
        a[role="button"],
        [tabindex="0"]:not(input):not(textarea),
        div[aria-label],
        span[aria-label]
      `);

      allClickableElements.forEach(element => {
        const text = element.textContent.trim();
        const ariaLabel = element.getAttribute('aria-label') || '';

        const matchesPattern = expandKeywords.some(pattern => {
          return text === pattern ||
            text.includes(pattern) ||
            ariaLabel === pattern ||
            ariaLabel.includes(pattern);
        });

        if (matchesPattern) {
          buttons.push(element);
        }
      });

      return buttons;
    }

    // Default logic for other platforms
    posts.forEach((post, postIndex) => {
      const clickableElements = post.querySelectorAll(`
        button,
        span[role="button"],
        div[role="button"],
        a[role="button"],
        [tabindex="0"],
        span[data-testid],
        div[data-testid]
      `);

      clickableElements.forEach(element => {
        const text = element.textContent.trim();
        const textLower = text.toLowerCase();
        const ariaLabel = (element.getAttribute('aria-label') || '');
        const ariaLabelLower = ariaLabel.toLowerCase();

        const matchesKeyword = expandKeywords.some(keyword => {
          if (this.platform === 'facebook') {
            return text === keyword || ariaLabel === keyword;
          }
          return textLower.includes(keyword.toLowerCase()) ||
            ariaLabelLower.includes(keyword.toLowerCase());
        });

        // Special patterns for non-Facebook platforms
        const isEllipsis = text === '...' || text === '…' || /^\.\.\.$/.test(text);
        const hasExpandPattern = text.includes('...') || ariaLabelLower.includes('expand');

        if (matchesKeyword || isEllipsis || hasExpandPattern) {
          buttons.push(element);
        }
      });
    });
    return buttons;
  }

  /**
   * Helper: Get platform-specific expand keywords
   * Can be overridden by platform subclasses
   *
   * @returns {Array<string>} Array of keywords to look for
   */
  getExpandKeywords() {
    if (this.platform === 'facebook') {
      return ['See more', 'See More', 'Continue reading', 'Read more', 'Show more'];
    } else if (this.platform === 'twitter') {
      return ['Show more', 'Show this thread', 'Show replies'];
    } else if (this.platform === 'linkedin') {
      return ['see more', 'See more', 'Show more'];
    } else {
      return ['show more', 'see more', 'See more', 'Show more', 'read more', 'Read more'];
    }
  }

  /**
   * HOOK: Find submit button for comment
   * Override this in platform subclasses for platform-specific submit button detection
   *
   * @param {HTMLElement} textArea - The text area element (can be used for context)
   * @param {HTMLElement} post - The post element to search within
   * @returns {HTMLElement|null} Submit button or null
   */
  findSubmitButton(textArea, post) {
    // Default generic selectors for platforms without specific overrides
    const selectors = [
      '[type="submit"]',
      'button[type="submit"]',
      'button[aria-label*="Post"]',
      'button[aria-label*="Submit"]',
      'button[aria-label*="Reply"]'
    ];

    // First try to find within the post context
    if (post) {
      for (const selector of selectors) {
        const btn = post.querySelector(selector);
        if (btn && !btn.disabled) {
          console.log(`[Submit] Found button in post with selector: ${selector}`);
          return btn;
        }
      }
    }

    // Fallback: try to find near the text area by traversing up
    let container = textArea;
    for (let i = 0; i < 5; i++) {
      container = container.parentElement;
      if (!container) break;

      for (const selector of selectors) {
        const btn = container.querySelector(selector);
        if (btn && !btn.disabled) {
          console.log(`[Submit] Found button in parent container with selector: ${selector}`);
          return btn;
        }
      }
    }

    console.log('[Submit] No submit button found with default selectors');
    return null;
  }

  // ========== INITIALIZATION ==========

  init() {
    this.loadSettings();
    this.initializePlatform();
    this.listenForMessages();
    this.templateGenerator.setPlatform(this.platform);
    this.templateGenerator.loadFromStorage();
  }

  /**
   * Initialize platform-specific configuration
   * Called during init() - sets up selectors from getPlatformSelectors()
   */
  initializePlatform() {
    try {
      this.selectors = this.getPlatformSelectors();
      console.log(`[${this.platform}] Platform initialized with selectors:`, this.selectors);
    } catch (error) {
      console.error('Platform initialization failed:', error);
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['surfSettings', 'mode', 'proModeSettings']);
      if (result.surfSettings) {
        this.settings = { ...this.settings, ...result.surfSettings };
      }
      if (result.mode) {
        this.mode = result.mode;
      }
      if (result.proModeSettings) {
        this.proModeSettings = result.proModeSettings;
      }
    } catch (error) {
      console.log('Using default settings');
    }
  }

  /**
   * Extract post content for Pro mode AI processing
   * @param {HTMLElement} post - The post element to extract content from
   * @returns {Object} Extracted content with text and author info
   */
  extractPostContent(post) {
    try {
      // Try to extract post text content
      let postText = '';
      const textSelectors = [
        '[data-ad-comet-preview="message"]', // Facebook
        '.feed-shared-update-v2__description', // LinkedIn
        '[data-testid="tweetText"]', // Twitter
        '.update-components-text' // LinkedIn alternative
      ];

      for (const selector of textSelectors) {
        const textElement = post.querySelector(selector);
        if (textElement) {
          postText = textElement.textContent.trim();
          break;
        }
      }

      // If no specific selector worked, try getting all text
      if (!postText) {
        postText = post.textContent.trim().substring(0, 500); // Limit to 500 chars
      }

      const extractedContent = {
        text: postText,
        platform: this.platform,
        timestamp: new Date().toISOString()
      };

      return extractedContent;
    } catch (error) {
      console.error('[Post Extraction] Failed:', error);
      return { text: '', platform: this.platform, timestamp: new Date().toISOString() };
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({ surfSettings: this.settings });
    } catch (error) {
      console.log('Could not save settings');
    }
  }

  // ========== MESSAGE PASSING ==========

  listenForMessages() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case 'start':
          this.start();
          sendResponse({ success: true });
          return true;
        case 'stop':
          this.stop();
          sendResponse({ success: true });
          return true;
        case 'updateSettings':
          this.settings = { ...this.settings, ...message.settings };
          this.saveSettings();
          sendResponse({ success: true });
          return true;
        case 'getStatus':
          sendResponse({
            isActive: this.isActive,
            platform: this.platform,
            stats: this.sessionStats
          });
          return true;
        case 'testSeeMore':
          this.testSeeMoreButtons();
          sendResponse({ success: true });
          return true;
        case 'testLike':
          this.testLikePost();
          sendResponse({ success: true });
          return true;
        case 'testComment':
          this.testCommentPost();
          sendResponse({ success: true });
          return true;
        case 'testPostDetection':
          if (typeof this.testPostDetection === 'function') {
            this.testPostDetection();
          } else {
            console.log('testPostDetection not implemented for this platform');
          }
          sendResponse({ success: true });
          return true;
        case 'testReactButton':
          if (typeof this.testReactButton === 'function') {
            this.testReactButton();
          } else {
            console.log('testReactButton not implemented for this platform');
          }
          sendResponse({ success: true });
          return true;
        case 'testCommentFlow':
          if (typeof this.testCommentFlow === 'function') {
            this.testCommentFlow();
          } else {
            console.log('testCommentFlow not implemented for this platform');
          }
          sendResponse({ success: true });
          return true;
        case 'updateTemplates':
          // Only update if the templates are for this platform
          if (message.platform === this.platform) {
            this.templateGenerator.updateTemplates(message.templates);
          }
          sendResponse({ success: true });
          return true;
      }
      // Only return true if we called sendResponse above
      return false;
    });
  }

  // ========== START/STOP CONTROL ==========

  start() {
    if (this.isActive) return;

    this.isActive = true;

    this.sessionStats = {
      totalPostsViewed: 0,
      totalSeeMoreClicked: 0,
      totalPostsLiked: 0,
      totalComments: 0
    };

    console.log('=== SESSION STARTED ===');
    console.log('Session statistics reset');
    console.log('Settings:', this.settings);
    console.log('Auto Like:', this.settings.enableAutoLike);
    console.log('Auto Comment:', this.settings.enableAutoComment);
    console.log('See More:', this.settings.enableSeeMore);

    this.startSequentialEngagement();
    DOMHelpers.showNotification('Auto surfing started! Using sequential engagement.', 'success');
  }

  stop() {
    this.isActive = false;

    if (this.engagementTimeout) {
      clearTimeout(this.engagementTimeout);
      this.engagementTimeout = null;
    }

    console.log('=== SESSION ENDED ===');
    console.log('📊 Session Statistics:');
    console.log(`  Total Posts Viewed: ${this.sessionStats.totalPostsViewed}`);
    console.log(`  Total "See More" Clicked: ${this.sessionStats.totalSeeMoreClicked}`);
    console.log(`  Total Posts Liked: ${this.sessionStats.totalPostsLiked}`);
    console.log(`  Total Comments Added: ${this.sessionStats.totalComments}`);
    console.log('======================');

    DOMHelpers.showNotification(
      `Session ended! Posts: ${this.sessionStats.totalPostsViewed}, Liked: ${this.sessionStats.totalPostsLiked}, Comments: ${this.sessionStats.totalComments}`,
      'info'
    );
  }

  // ========== SEQUENTIAL ENGAGEMENT CYCLE ==========

  async startSequentialEngagement() {
    const engagementCycle = async () => {
      if (!this.isActive) return;

      // Step 1: Check for visible unengaged posts
      let posts = document.querySelectorAll(this.selectors.posts);
      let visiblePosts = Array.from(posts).filter(post =>
        DOMHelpers.isElementInViewport(post) && !post.getAttribute('data-surfer-engaged')
      );

      // Step 2: If no visible posts, use smart scrolling to find one
      if (visiblePosts.length === 0) {
        console.log('[Engagement] No visible unengaged posts, starting smart scroll...');
        const foundPost = await this.smartScrollUntilNewPost();

        if (!foundPost) {
          // No new posts found after scrolling, wait and retry
          console.log('[Engagement] No new posts found, waiting 7s before retry...');
          await DOMHelpers.sleep(7000);
          this.scheduleNextCycle();
          return;
        }

        // Re-check for visible posts after smart scrolling
        posts = document.querySelectorAll(this.selectors.posts);
        visiblePosts = Array.from(posts).filter(post =>
          DOMHelpers.isElementInViewport(post) && !post.getAttribute('data-surfer-engaged')
        );

        if (visiblePosts.length === 0) {
          // Still no posts (shouldn't happen, but safety check)
          await DOMHelpers.sleep(5000);
          this.scheduleNextCycle();
          return;
        }
      }

      const targetPost = visiblePosts[0];

      // Step 3: Check if platform wants to skip this post (promoted ads, etc.)
      if (typeof this.shouldSkipPost === 'function' && this.shouldSkipPost(targetPost)) {
        targetPost.setAttribute('data-surfer-engaged', 'true'); // Mark as seen
        console.log('[Engagement] Post skipped by platform filter');
        this.scheduleNextCycle(); // Skip to next post
        return;
      }

      // Step 4: Ensure post is fully engageable (interaction buttons visible)
      if (!DOMHelpers.isPostFullyEngageable(targetPost, this.selectors)) {
        console.log('[Engagement] Interaction buttons not fully visible, adjusting scroll...');
        await DOMHelpers.scrollPostIntoEngageableView(targetPost, this.selectors);
      }

      targetPost.setAttribute('data-surfer-engaged', 'true');
      this.sessionStats.totalPostsViewed++;

      console.log(`[Post #${this.sessionStats.totalPostsViewed}] Starting engagement`);

      // Step 5: Click "see more" if enabled
      if (this.settings.enableSeeMore) {
        await this.clickSeeMoreOnPost(targetPost);
        await DOMHelpers.sleep(this.settings.seeMoreDelay);
      }

      // Step 6: Auto like if enabled and passes probability check
      if (this.settings.enableAutoLike) {
        const likeRoll = Math.random() * 100;
        const shouldLike = likeRoll < this.settings.likeProbability;

        if (shouldLike) {
          await this.likePost(targetPost);
          await DOMHelpers.sleep(this.settings.likeDelay);
        }
      }

      // Step 7: Auto comment if enabled and passes probability check
      if (this.settings.enableAutoComment) {
        const commentRoll = Math.random() * 100;
        const shouldComment = commentRoll < this.settings.commentProbability;

        if (shouldComment) {
          await this.commentPost(targetPost);
          await DOMHelpers.sleep(this.settings.commentDelay);
        }
      }

      await DOMHelpers.sleep(this.settings.postEngagementDelay);
      this.scheduleNextCycle();
    };

    engagementCycle();
  }

  scheduleNextCycle() {
    if (!this.isActive) return;

    this.engagementTimeout = setTimeout(() => {
      this.startSequentialEngagement();
    }, 100);
  }

  async performScroll(scrollAmount = null) {
    const scrollHeight = scrollAmount || Math.floor(window.innerHeight * 0.8);
    window.scrollBy({
      top: scrollHeight,
      behavior: 'smooth'
    });
  }

  async smartScrollUntilNewPost() {
    const MIN_SCROLL = 250; // minimum pixels to scroll
    const MAX_SCROLL = 600; // maximum pixels to scroll
    const MIN_DELAY = 400; // minimum ms to wait between scrolls
    const MAX_DELAY = 800; // maximum ms to wait between scrolls
    const MAX_ATTEMPTS = 10; // max scroll attempts before giving up

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Check if we're at the bottom of the page
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 100; // 100px threshold

      if (atBottom) {
        console.log('[Smart Scroll] Reached bottom of page');
        return false;
      }

      // Random scroll amount and delay for human-like behavior
      const randomScrollAmount = Math.floor(Math.random() * (MAX_SCROLL - MIN_SCROLL + 1)) + MIN_SCROLL;
      const randomDelay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;

      // Perform small incremental scroll with randomization
      await this.performScroll(randomScrollAmount);
      await DOMHelpers.sleep(randomDelay);

      // Check for visible unengaged posts
      const posts = document.querySelectorAll(this.selectors.posts);
      const visibleUnengagedPosts = Array.from(posts).filter(post =>
        DOMHelpers.isElementInViewport(post) && !post.getAttribute('data-surfer-engaged')
      );

      if (visibleUnengagedPosts.length > 0) {
        console.log(`[Smart Scroll] Found ${visibleUnengagedPosts.length} new post(s) after ${attempt + 1} scroll(s)`);
        return true;
      }
    }

    console.log('[Smart Scroll] Max attempts reached, no new posts found');
    return false;
  }

  getRandomScrollDelay() {
    const min = this.settings.scrollSpeedMin || 2000;
    const max = this.settings.scrollSpeedMax || 4000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ========== POST ENGAGEMENT ==========

  async clickSeeMoreOnPost(post) {
    try {
      const seeMoreButtons = this.findSeeMoreButtonsInPost(post);
      const visibleButtons = seeMoreButtons.filter(button =>
        DOMHelpers.isElementInViewport(button) && !button.getAttribute('data-surfer-clicked')
      );

      if (visibleButtons.length > 0) {
        const button = visibleButtons[0];
        button.setAttribute('data-surfer-clicked', 'true');
        this.sessionStats.totalSeeMoreClicked++;
        await this.cursor.humanLikeClick(button, (msg) => DOMHelpers.showNotification(msg, 'success'), `Clicked "${button.textContent.trim()}" 👁️`);
      }
    } catch (error) {
      console.log('Error clicking See More:', error);
    }
  }

  async likePost(post) {
    try {
      const postNumber = this.sessionStats.totalPostsViewed;
      let didLike = false;

      // Find all like buttons and filter out counters (e.g., "Like: 26 people")
      const allLikeButtons = post.querySelectorAll(this.selectors.likeButton || this.selectors.upvoteButton);

      // Filter: prefer buttons with shortest aria-label (avoids "Like: X people" counters)
      let likeButton = null;
      let shortestLength = Infinity;

      allLikeButtons.forEach(btn => {
        const ariaLabel = btn.getAttribute('aria-label') || '';

        // Prefer exact match "Like" or shortest label without colons
        if (!ariaLabel.includes(':') && ariaLabel.length < shortestLength) {
          likeButton = btn;
          shortestLength = ariaLabel.length;
        }
      });

      if (likeButton) {
        const ariaPressed = likeButton.getAttribute('aria-pressed');
        const alreadyClicked = likeButton.getAttribute('data-surfer-liked');

        const isNotLiked = ariaPressed !== 'true';
        const notClickedByUs = !alreadyClicked;

        if (isNotLiked && notClickedByUs) {
          // Check safety limits
          if (!this.safetyLimits.canLike()) {
            console.log('[Safety] Like limit reached - skipping');
            return;
          }

          likeButton.setAttribute('data-surfer-liked', 'true');
          await DOMHelpers.sleep(Math.random() * 1000 + 500);

          await this.cursor.humanLikeClick(likeButton, (msg) => DOMHelpers.showNotification(msg, 'success'), 'Liked a post! ❤️');
          didLike = true;
          this.sessionStats.totalPostsLiked++;

          // Record safety stats
          await this.safetyLimits.recordLike();
        }
      }
    } catch (error) {
      console.log('[Like] Error:', error);
    }
  }

  async commentPost(post) {
    try {
      // Safety checks
      if (!this.safetyLimits.canComment()) {
        console.log('[Safety] Comment limit reached - skipping');
        return;
      }

      // Duplicate checks
      try {
        const postUrl = this.getPostUrl(post);
        const authorName = this.getAuthorName(post);
        const content = this.getPostContent(post);

        if (this.duplicateDetector.hasEngagedUrl(postUrl)) {
          console.log('[Skip] Already engaged with this URL');
          return;
        }

        if (this.duplicateDetector.hasEngagedAuthor(authorName, 24)) {
          console.log(`[Skip] Already engaged with ${authorName} in last 24h`);
          return;
        }

        if (await this.duplicateDetector.hasEngagedContent(content)) {
          console.log('[Skip] Duplicate content detected');
          return;
        }
      } catch (e) {
        // If platform doesn't implement extraction methods, just warn and proceed
        console.log('[Duplicate] Could not extract post data for duplicate check:', e.message);
      }

      const commented = await this.addPositiveComment(post);
      if (commented) {
        this.sessionStats.totalComments++;
        await this.safetyLimits.recordComment();

        // Record for duplicate detection
        try {
          const postUrl = this.getPostUrl(post);
          const authorName = this.getAuthorName(post);
          const content = this.getPostContent(post);
          await this.duplicateDetector.recordEngagement(postUrl, authorName, content);
        } catch (e) {
          console.log('[Duplicate] Failed to record engagement:', e.message);
        }
      }
    } catch (error) {
      console.log('[Comment] Error:', error);
    }
  }

  // Default extraction methods (to be overridden)
  getPostUrl(post) { return null; }
  getAuthorName(post) { return null; }
  getPostContent(post) { return null; }

  async addPositiveComment(post) {
    try {
      const commentButton = post.querySelector(this.selectors.commentButton || this.selectors.replyButton);
      if (!commentButton || commentButton.getAttribute('data-surfer-commented')) return false;

      commentButton.setAttribute('data-surfer-commented', 'true');
      await this.cursor.humanLikeClick(commentButton, (msg) => DOMHelpers.showNotification(msg, 'success'), 'Opening comment box...');

      await DOMHelpers.sleep(2000);

      // LinkedIn-specific handling
      if (this.platform === 'linkedin') {
        const commentInputs = [
          '.comments-comment-box__form',
          '.comments-comment-texteditor',
          '.ql-editor[data-placeholder]',
          '[data-placeholder="Add a comment…"]',
          '.editor-container'
        ];

        let commentInput = null;
        for (const selector of commentInputs) {
          const el = document.querySelector(selector);
          if (el) {
            commentInput = el;
            break;
          }
        }

        if (commentInput) {
          await this.cursor.humanLikeClick(commentInput, (msg) => DOMHelpers.showNotification(msg, 'success'), 'Activating comment field...');
          await DOMHelpers.sleep(1000);
        }
      }

      // Find editable text area
      let textArea = null;
      const selectors = [
        '.ql-editor[contenteditable="true"]',
        '.comments-comment-box-comment__text-editor',
        '[role="textbox"]',
        '[contenteditable="true"]',
        'textarea',
        '.ql-editor'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const isVisible = (DOMHelpers.isElementInViewport(el) || el.offsetParent !== null);
          const isEditable = el.contentEditable === 'true' || el.getAttribute('contenteditable') === 'true' || el.tagName === 'TEXTAREA';

          if (isVisible && isEditable) {
            textArea = el;
            break;
          }
        }
        if (textArea) break;
      }

      if (textArea) {
        console.log('[Comment] Text area found, clicking to focus...');

        // Move cursor up from text area center and click (fixes border click issue)
        const rect = textArea.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const adjustedY = centerY - 10; // Move up 10 pixels

        // Create temporary element to click at adjusted position
        const clickTarget = document.elementFromPoint(centerX, adjustedY) || textArea;
        await this.cursor.humanLikeClick(clickTarget, (msg) => DOMHelpers.showNotification(msg, 'success'), 'Focusing comment input...');
        await DOMHelpers.sleep(500);

        let randomResponse;

        // Check if Pro mode is enabled
        if (this.mode === 'pro') {
          const postContent = this.extractPostContent(post);
          console.log('[PRO MODE] Extracted Post Content:', postContent);
          console.log('[PRO MODE] Selected Persona:', this.proModeSettings?.persona || 'friendly');

          // For now, just log and use regular template
          // In future: Call AI API here with postContent and persona
          console.log('[PRO MODE] TODO: Call AI API to generate comment based on:', {
            postContent: postContent,
            persona: this.proModeSettings?.persona,
            customPreset: this.proModeSettings?.customPresets
          });

          // Use regular template for now
          randomResponse = this.templateGenerator.generateComment({
            authorName: '' // Base surfer doesn't extract author names
          });
        } else {
          // Free mode: use regular template generation
          randomResponse = this.templateGenerator.generateComment({
            authorName: '' // Base surfer doesn't extract author names
          });
        }

        await this.typer.typeText(textArea, randomResponse);
        await DOMHelpers.sleep(1000 + Math.random() * 1000);

        const submitButton = this.findSubmitButton(textArea, post);

        if (submitButton) {
          await this.cursor.humanLikeClick(submitButton, (msg) => DOMHelpers.showNotification(msg, 'success'), 'Added positive comment! 💬');
          return true;
        }
      }
      return false;
    } catch (error) {
      console.log('[Comment] Could not add comment:', error);
      return false;
    }
  }

  // ========== TEST FUNCTIONS ==========

  async testSeeMoreButtons() {
    console.log('=== TESTING SEE MORE BUTTONS ===');
    console.log('Platform:', this.platform);
    console.log('Post selector:', this.selectors.posts);

    const buttons = this.findSeeMoreButtons();
    console.log(`Found ${buttons.length} see more buttons`);

    if (buttons.length > 0) {
      const visibleButtons = buttons.filter(button => DOMHelpers.isElementInViewport(button));
      console.log(`${visibleButtons.length} are visible`);

      if (visibleButtons.length > 0) {
        const testButton = visibleButtons[0];
        console.log('Testing first visible button:', testButton);
        console.log('Button text:', testButton.textContent.trim());
        console.log('Button aria-label:', testButton.getAttribute('aria-label'));

        testButton.style.border = '3px solid red';
        testButton.style.backgroundColor = 'yellow';

        setTimeout(() => {
          testButton.style.border = '';
          testButton.style.backgroundColor = '';
        }, 3000);

        DOMHelpers.showNotification(`Found button: "${testButton.textContent.trim()}"`, 'info');
      }
    } else {
      DOMHelpers.showNotification('No see more buttons found!', 'error');
    }
  }

  async testLikePost() {
    console.log('=== TESTING LIKE POST ===');
    console.log('Platform:', this.platform);
    console.log('Post selector:', this.selectors.posts);
    console.log('Like button selector:', this.selectors.likeButton || this.selectors.upvoteButton);

    const posts = document.querySelectorAll(this.selectors.posts);
    const visiblePosts = Array.from(posts).filter(post => DOMHelpers.isElementInViewport(post));

    console.log(`Found ${posts.length} total posts, ${visiblePosts.length} visible posts`);

    if (visiblePosts.length > 0) {
      const testPost = visiblePosts[0];
      console.log('Testing first visible post:', testPost);

      const likeButton = testPost.querySelector(this.selectors.likeButton || this.selectors.upvoteButton);
      console.log('Like button found:', !!likeButton);

      if (likeButton) {
        console.log('Like button element:', likeButton);
        console.log('Like button aria-label:', likeButton.getAttribute('aria-label'));
        console.log('Like button aria-pressed:', likeButton.getAttribute('aria-pressed'));

        likeButton.style.border = '3px solid red';
        likeButton.style.backgroundColor = 'yellow';

        setTimeout(() => {
          likeButton.style.border = '';
          likeButton.style.backgroundColor = '';
        }, 3000);

        console.log('Attempting to click like button...');
        await this.cursor.humanLikeClick(likeButton, (msg) => DOMHelpers.showNotification(msg, 'success'), 'Test liked a post! ❤️');

        DOMHelpers.showNotification('Like button clicked!', 'success');
      } else {
        DOMHelpers.showNotification('No like button found in first visible post!', 'error');
      }
    } else {
      DOMHelpers.showNotification('No visible posts found!', 'error');
    }
  }

  async testCommentPost() {
    console.log('=== TESTING COMMENT POST ===');
    console.log('Platform:', this.platform);
    console.log('Post selector:', this.selectors.posts);
    console.log('Comment button selector:', this.selectors.commentButton || this.selectors.replyButton);

    const posts = document.querySelectorAll(this.selectors.posts);
    const visiblePosts = Array.from(posts).filter(post => DOMHelpers.isElementInViewport(post));

    console.log(`Found ${posts.length} total posts, ${visiblePosts.length} visible posts`);

    if (visiblePosts.length > 0) {
      const testPost = visiblePosts[0];
      console.log('Testing first visible post:', testPost);

      const commentButton = testPost.querySelector(this.selectors.commentButton || this.selectors.replyButton);
      console.log('Comment button found:', !!commentButton);

      if (commentButton) {
        console.log('Comment button element:', commentButton);
        console.log('Comment button aria-label:', commentButton.getAttribute('aria-label'));

        commentButton.style.border = '3px solid red';
        commentButton.style.backgroundColor = 'yellow';

        setTimeout(() => {
          commentButton.style.border = '';
          commentButton.style.backgroundColor = '';
        }, 3000);

        console.log('Attempting to open comment box and type...');
        await this.testAddPositiveComment(testPost);

        DOMHelpers.showNotification('Comment typed (not submitted)!', 'success');
      } else {
        DOMHelpers.showNotification('No comment button found in first visible post!', 'error');
      }
    } else {
      DOMHelpers.showNotification('No visible posts found!', 'error');
    }
  }

  async testAddPositiveComment(post) {
    try {
      const commentButton = post.querySelector(this.selectors.commentButton || this.selectors.replyButton);
      if (!commentButton) {
        console.log('No comment button found');
        return false;
      }

      console.log('Step 1: Clicking comment button...');
      await this.cursor.humanLikeClick(commentButton, (msg) => DOMHelpers.showNotification(msg, 'success'), 'Opening comment box...');

      console.log('Step 2: Waiting for comment box to appear...');
      await DOMHelpers.sleep(2000);

      if (this.platform === 'linkedin') {
        console.log('Step 3: LinkedIn detected - looking for comment input area...');

        const commentInputs = [
          '.comments-comment-box__form',
          '.comments-comment-texteditor',
          '.ql-editor[data-placeholder]',
          '[data-placeholder="Add a comment…"]',
          '.editor-container'
        ];

        let commentInput = null;
        for (const selector of commentInputs) {
          const el = document.querySelector(selector);
          if (el) {
            console.log(`Found comment input with selector: ${selector}`, el);
            commentInput = el;
            break;
          }
        }

        if (commentInput) {
          console.log('Step 4: Clicking into LinkedIn comment input area...');
          await this.cursor.humanLikeClick(commentInput, (msg) => DOMHelpers.showNotification(msg, 'success'), 'Activating comment field...');
          await DOMHelpers.sleep(1000);
        }
      }

      console.log('Step 5: Searching for editable text area...');
      let textArea = null;
      const selectors = [
        '.ql-editor[contenteditable="true"]',
        '.comments-comment-box-comment__text-editor',
        '[role="textbox"]',
        '[contenteditable="true"]',
        'textarea',
        '.ql-editor'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        console.log(`Selector "${selector}" found ${elements.length} elements`);

        for (const el of elements) {
          const isVisible = (DOMHelpers.isElementInViewport(el) || el.offsetParent !== null);
          const isEditable = el.contentEditable === 'true' || el.getAttribute('contenteditable') === 'true' || el.tagName === 'TEXTAREA';

          console.log(`  Element: visible=${isVisible}, editable=${isEditable}`, el);

          if (isVisible && isEditable) {
            textArea = el;
            console.log('✓ Found visible & editable text area:', el);
            break;
          }
        }

        if (textArea) break;
      }

      if (!textArea) {
        console.log('✗ Could not find editable text area');
        DOMHelpers.showNotification('Could not find text area!', 'error');
        return false;
      }

      console.log('Step 6: Text area found!');
      console.log('  Tag:', textArea.tagName);
      console.log('  Classes:', textArea.className);
      console.log('  ContentEditable:', textArea.contentEditable);
      console.log('  Placeholder:', textArea.getAttribute('data-placeholder'));

      console.log('Step 7: Clicking text area to ensure focus...');
      textArea.click();
      textArea.focus();
      await DOMHelpers.sleep(500);

      let randomResponse;

      // Check if Pro mode is enabled
      if (this.mode === 'pro') {
        const postContent = this.extractPostContent(post);
        console.log('[PRO MODE TEST] Extracted Post Content:', postContent);
        console.log('[PRO MODE TEST] Selected Persona:', this.proModeSettings?.persona || 'friendly');

        // For now, just log and use regular template
        console.log('[PRO MODE TEST] TODO: Call AI API to generate comment');

        randomResponse = this.templateGenerator.generateComment({
          authorName: '' // Base surfer doesn't extract author names
        });
      } else {
        randomResponse = this.templateGenerator.generateComment({
          authorName: '' // Base surfer doesn't extract author names
        });
      }

      console.log('Step 8: Typing comment:', randomResponse);

      await this.typer.typeText(textArea, randomResponse);
      await DOMHelpers.sleep(1000 + Math.random() * 1000);

      console.log('Step 9: Looking for submit button...');
      const submitButton = this.findSubmitButton(textArea, post);

      if (submitButton) {
        console.log('Step 10: Submit button found:', submitButton);
        console.log('  Button text:', submitButton.textContent.trim());
        console.log('  Button aria-label:', submitButton.getAttribute('aria-label'));
        console.log('  Button disabled:', submitButton.disabled);
        console.log('Step 11: Clicking submit button...');
        await this.cursor.humanLikeClick(submitButton, (msg) => DOMHelpers.showNotification(msg, 'success'), 'Added positive comment! 💬');
        console.log('✓ Comment submitted successfully');
        DOMHelpers.showNotification(`Submitted: "${randomResponse}"`, 'success');
        return true;
      } else {
        console.log('✗ Submit button not found or disabled');
        DOMHelpers.showNotification(`Typed: "${randomResponse}" (submit button not found)`, 'error');
        return false;
      }

    } catch (error) {
      console.log('[Test Comment] Error:', error);
      return false;
    }
  }

};
