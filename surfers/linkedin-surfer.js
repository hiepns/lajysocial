/**
 * LinkedInAutoSurfer - Standalone LinkedIn automation
 *
 * Architecture:
 * - Fully self-contained (no inheritance)
 * - Uses shared utility modules via composition (window.CursorAnimator, window.TextTyper, etc.)
 * - Independent from base-surfer.js
 *
 * Utilities Used:
 * - CursorAnimator: Visual cursor & realistic clicks
 * - TextTyper: Human-like typing simulation
 * - DuplicateDetector: Prevent re-engagement (from engagement-helpers.js)
 * - SafetyLimits: Enforce hourly/daily limits (from engagement-helpers.js)
 * - DOMHelpers: DOM utilities
 */

window.LinkedInAutoSurfer = class LinkedInAutoSurfer {
  constructor() {
    this.isActive = false;
    this.engagementTimeout = null;
    this.platform = 'linkedin';
    this.selectors = {};

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
      postEngagementDelay: 3000,
      // Task 3.11: Enhanced filtering options
      skipCompanyPages: true,
      skipFriendActivities: true,
      timeFilterEnabled: true,
      maxPostAge: 72 // hours
    };


    this.sessionStats = {
      totalPostsViewed: 0,
      totalSeeMoreClicked: 0,
      totalPostsLiked: 0,
      totalComments: 0
    };

    // Utility composition
    this.cursor = new window.CursorAnimator();
    this.typer = new window.TextTyper();
    this.duplicateDetector = new window.DuplicateDetector();
    this.safetyLimits = new window.SafetyLimits();
    this.templateGenerator = new window.TemplateGenerator();

    this.init();
    this.cursor.createCursor();
  }

  // ========== INITIALIZATION ==========

  init() {
    this.loadSettings();
    this.initializePlatform();
    this.listenForMessages();
    this.templateGenerator.loadFromStorage();
  }

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
      const result = await chrome.storage.sync.get(['surfSettings']);
      if (result.surfSettings) {
        this.settings = { ...this.settings, ...result.surfSettings };
      }
    } catch (error) {
      console.log('Using default settings');
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
          this.testPostDetection();
          sendResponse({ success: true });
          return true;
        case 'testReactButton':
          this.testReactButton();
          sendResponse({ success: true });
          return true;
        case 'testCommentFlow':
          this.testCommentFlow();
          sendResponse({ success: true });
          return true;
        case 'testLinkedInExtract':
          this.testLinkedInExtract();
          sendResponse({ success: true });
          return true;
        case 'updateTemplates':
          this.templateGenerator.updateTemplates(message.templates);
          sendResponse({ success: true });
          return true;
      }
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
      if (this.shouldSkipPost(targetPost)) {
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
        await this.cursor.humanLikeClick(button, (msg) => DOMHelpers.showNotification(`Clicked "${button.textContent.trim()}" 👁️`, 'success'));
      }
    } catch (error) {
      console.log('Error clicking See More:', error);
    }
  }

  async likePost(post) {
    try {
      const postNumber = this.sessionStats.totalPostsViewed;
      let didLike = false;

      // Find all like/react buttons - the selector now contains multiple options
      const allLikeButtons = post.querySelectorAll(this.selectors.likeButton || this.selectors.upvoteButton);
      console.log(`[Like] Found ${allLikeButtons.length} potential like buttons`);

      // Filter out counters and find the actual react/like button
      let likeButton = null;
      let shortestLength = Infinity;

      allLikeButtons.forEach((btn, index) => {
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const hasCounterAttr = btn.hasAttribute('data-test-reactions-count') || btn.hasAttribute('data-test-icon-text-layout__text-container');

        console.log(`  Button ${index}: "${ariaLabel}" (hasCounter: ${hasCounterAttr})`);

        // Skip if it's a counter element
        if (hasCounterAttr) {
          console.log(`    Skipping - has counter attribute`);
          return;
        }

        // Skip if aria-label contains colon (usually means "Like: 26 people")
        if (ariaLabel.includes(':')) {
          console.log(`    Skipping - has colon in label (likely counter)`);
          return;
        }

        // Prefer shortest label (actual button vs counter display)
        if (ariaLabel.length > 0 && ariaLabel.length < shortestLength) {
          likeButton = btn;
          shortestLength = ariaLabel.length;
          console.log(`    Selected as candidate (shortest: ${ariaLabel.length})`);
        }
      });

      if (!likeButton) {
        console.log('[Like] No suitable like button found after filtering');
        return;
      }

      console.log(`[Like] Selected button with aria-label: "${likeButton.getAttribute('aria-label')}"`);

      const ariaPressed = likeButton.getAttribute('aria-pressed');
      const alreadyClicked = likeButton.getAttribute('data-surfer-liked');

      const isNotLiked = ariaPressed !== 'true';
      const notClickedByUs = !alreadyClicked;

      console.log(`[Like] ariaPressed: ${ariaPressed}, alreadyClicked: ${alreadyClicked}`);

      if (isNotLiked && notClickedByUs) {
        // Check safety limits
        if (!this.safetyLimits.canLike()) {
          console.log('[Safety] Like limit reached - skipping');
          return;
        }

        likeButton.setAttribute('data-surfer-liked', 'true');
        await DOMHelpers.sleep(Math.random() * 1000 + 500);

        await this.cursor.humanLikeClick(likeButton, (msg) => DOMHelpers.showNotification('Liked a post! ❤️', 'success'));
        didLike = true;
        this.sessionStats.totalPostsLiked++;

        // Record safety stats
        await this.safetyLimits.recordLike();
      } else {
        console.log('[Like] Post already liked or clicked by us');
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

        // Only check author engagement if we successfully extracted the author name
        if (authorName !== 'Unknown' && this.duplicateDetector.hasEngagedAuthor(authorName, 24)) {
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

  async addPositiveComment(post) {
    try {
      const commentButton = post.querySelector(this.selectors.commentButton || this.selectors.replyButton);
      if (!commentButton || commentButton.getAttribute('data-surfer-commented')) return false;

      commentButton.setAttribute('data-surfer-commented', 'true');
      await this.cursor.humanLikeClick(commentButton, (msg) => DOMHelpers.showNotification('Opening comment box...', 'success'));

      // Step 1: Establish scope anchor (priority order)
      let scopeRoot = post;
      if (!scopeRoot || !scopeRoot.querySelector) {
        scopeRoot = commentButton.closest('[data-urn]');
      }
      if (!scopeRoot) {
        scopeRoot = commentButton.closest('article');
      }
      if (!scopeRoot) {
        console.error('[Comment] Could not establish scope anchor - no post root found');
        return false;
      }

      console.log('[Comment] Scope root established:', scopeRoot.getAttribute('data-urn') || 'article');

      // Wait random delay for comment box to appear
      const randomDelay = 500 + Math.random() * 700; // 500-1200ms
      await DOMHelpers.sleep(randomDelay);

      // Step 2: Helper functions for hardened visibility/editability checks
      const isElementVisible = (el) => {
        const rect = el.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < viewportHeight * 1.5;
      };

      const isElementEditable = (el) => {
        return el.contentEditable === 'true' || el.tagName === 'TEXTAREA';
      };

      const getDistance = (el1, el2) => {
        const rect1 = el1.getBoundingClientRect();
        const rect2 = el2.getBoundingClientRect();
        const center1X = rect1.left + rect1.width / 2;
        const center1Y = rect1.top + rect1.height / 2;
        const center2X = rect2.left + rect2.width / 2;
        const center2Y = rect2.top + rect2.height / 2;
        return Math.sqrt(Math.pow(center2X - center1X, 2) + Math.pow(center2Y - center1Y, 2));
      };

      // Step 3: Find editable text area within scoped root
      const selectors = [
        '.ql-editor[contenteditable="true"]',
        '.comments-comment-box-comment__text-editor',
        '[role="textbox"]',
        '[contenteditable="true"]',
        'textarea'
      ];

      let candidates = [];
      for (const selector of selectors) {
        const elements = scopeRoot.querySelectorAll(selector);
        for (const el of elements) {
          if (isElementVisible(el) && isElementEditable(el)) {
            candidates.push(el);
          }
        }
      }

      console.log(`[Comment] Found ${candidates.length} candidate text areas within scope`);

      // Choose candidate closest to comment button
      let textArea = null;
      if (candidates.length > 0) {
        candidates.sort((a, b) => getDistance(commentButton, a) - getDistance(commentButton, b));
        textArea = candidates[0];
        console.log('[Comment] Selected closest textarea to comment button');
      }

      // Fallback: use focused element if it's editable/visible and inside post root
      if (!textArea) {
        const focused = document.activeElement;
        if (focused && scopeRoot.contains(focused) && isElementEditable(focused) && isElementVisible(focused)) {
          textArea = focused;
          console.log('[Comment] Using focused element as fallback');
        }
      }

      if (!textArea) {
        console.error('[Comment] No suitable text area found within scope');
        return false;
      }

      console.log('[Comment] Text area found, clicking to focus...');

      // Move cursor up from text area center and click (fixes border click issue)
      const rect = textArea.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const adjustedY = centerY - 10; // Move up 10 pixels

      // Create temporary element to click at adjusted position
      const clickTarget = document.elementFromPoint(centerX, adjustedY) || textArea;
      await this.cursor.humanLikeClick(clickTarget, (msg) => DOMHelpers.showNotification('Focusing comment input...', 'success'));
      await DOMHelpers.sleep(500);

      let randomResponse;

      // Check if Pro mode is enabled
      if (this.mode === 'pro') {
        const postContent = this.extractPostContent(post);
        console.log('[PRO MODE - LinkedIn] Extracted Post Content:', postContent);
        console.log('[PRO MODE - LinkedIn] Selected Persona:', this.proModeSettings?.persona || 'friendly');

        // For now, just log and use regular template
        console.log('[PRO MODE - LinkedIn] TODO: Call AI API to generate comment');

        randomResponse = this.templateGenerator.generateComment({
          authorName: this.getAuthorName(post)
        });
      } else {
        randomResponse = this.templateGenerator.generateComment({
          authorName: this.getAuthorName(post)
        });
      }

      await this.typer.typeText(textArea, randomResponse);
      await DOMHelpers.sleep(1000 + Math.random() * 1000);

      const submitButton = this.findSubmitButton(textArea, scopeRoot);

      if (submitButton) {
        await this.cursor.humanLikeClick(submitButton, (msg) => DOMHelpers.showNotification('Added positive comment! 💬', 'success'));
        return true;
      } else {
        console.error('[Comment] No submit button found');
        return false;
      }
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
        await this.cursor.humanLikeClick(likeButton, (msg) => DOMHelpers.showNotification('Test liked a post! ❤️', 'success'));

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
      await this.cursor.humanLikeClick(commentButton, (msg) => DOMHelpers.showNotification('Opening comment box...', 'success'));

      // Step 1: Establish scope anchor (priority order)
      let scopeRoot = post;
      if (!scopeRoot || !scopeRoot.querySelector) {
        scopeRoot = commentButton.closest('[data-urn]');
      }
      if (!scopeRoot) {
        scopeRoot = commentButton.closest('article');
      }
      if (!scopeRoot) {
        console.error('[Test Comment] Could not establish scope anchor - no post root found');
        return false;
      }

      console.log('[Test Comment] Scope root established:', scopeRoot.getAttribute('data-urn') || 'article');

      // Wait random delay for comment box to appear
      console.log('Step 2: Waiting for comment box to appear...');
      const randomDelay = 500 + Math.random() * 700; // 500-1200ms
      await DOMHelpers.sleep(randomDelay);

      // Step 2: Helper functions for hardened visibility/editability checks
      const isElementVisible = (el) => {
        const rect = el.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < viewportHeight * 1.5;
      };

      const isElementEditable = (el) => {
        return el.contentEditable === 'true' || el.tagName === 'TEXTAREA';
      };

      const getDistance = (el1, el2) => {
        const rect1 = el1.getBoundingClientRect();
        const rect2 = el2.getBoundingClientRect();
        const center1X = rect1.left + rect1.width / 2;
        const center1Y = rect1.top + rect1.height / 2;
        const center2X = rect2.left + rect2.width / 2;
        const center2Y = rect2.top + rect2.height / 2;
        return Math.sqrt(Math.pow(center2X - center1X, 2) + Math.pow(center2Y - center1Y, 2));
      };

      // Step 3: Find editable text area within scoped root
      console.log('Step 3: Searching for editable text area within scope...');
      const selectors = [
        '.ql-editor[contenteditable="true"]',
        '.comments-comment-box-comment__text-editor',
        '[role="textbox"]',
        '[contenteditable="true"]',
        'textarea'
      ];

      let candidates = [];
      for (const selector of selectors) {
        const elements = scopeRoot.querySelectorAll(selector);
        console.log(`Selector "${selector}" found ${elements.length} elements in scope`);
        for (const el of elements) {
          if (isElementVisible(el) && isElementEditable(el)) {
            candidates.push(el);
            console.log('  ✓ Candidate found:', el);
          }
        }
      }

      console.log(`[Test Comment] Found ${candidates.length} candidate text areas within scope`);

      // Choose candidate closest to comment button
      let textArea = null;
      if (candidates.length > 0) {
        candidates.sort((a, b) => getDistance(commentButton, a) - getDistance(commentButton, b));
        textArea = candidates[0];
        console.log('[Test Comment] Selected closest textarea to comment button');
      }

      // Fallback: use focused element if it's editable/visible and inside post root
      if (!textArea) {
        const focused = document.activeElement;
        if (focused && scopeRoot.contains(focused) && isElementEditable(focused) && isElementVisible(focused)) {
          textArea = focused;
          console.log('[Test Comment] Using focused element as fallback');
        }
      }

      if (!textArea) {
        console.error('[Test Comment] No suitable text area found within scope');
        DOMHelpers.showNotification('Could not find text area!', 'error');
        return false;
      }

      console.log('Step 4: Text area found!');
      console.log('  Tag:', textArea.tagName);
      console.log('  Classes:', textArea.className);
      console.log('  ContentEditable:', textArea.contentEditable);

      console.log('Step 5: Clicking text area to ensure focus...');
      textArea.click();
      textArea.focus();
      await DOMHelpers.sleep(500);

      let randomResponse;

      // Check if Pro mode is enabled
      if (this.mode === 'pro') {
        const postContent = this.extractPostContent(post);
        console.log('[PRO MODE TEST - LinkedIn] Extracted Post Content:', postContent);
        console.log('[PRO MODE TEST - LinkedIn] Selected Persona:', this.proModeSettings?.persona || 'friendly');

        console.log('[PRO MODE TEST - LinkedIn] TODO: Call AI API to generate comment');

        randomResponse = this.templateGenerator.generateComment({
          authorName: this.getAuthorName(post)
        });
      } else {
        randomResponse = this.templateGenerator.generateComment({
          authorName: this.getAuthorName(post)
        });
      }

      console.log('Step 6: Typing comment:', randomResponse);

      await this.typer.typeText(textArea, randomResponse);
      await DOMHelpers.sleep(1000 + Math.random() * 1000);

      console.log('Step 7: Looking for submit button...');
      const submitButton = this.findSubmitButton(textArea, scopeRoot);

      if (submitButton) {
        console.log('Step 8: Submit button found:', submitButton);
        console.log('  Button text:', submitButton.textContent.trim());
        console.log('  Button aria-label:', submitButton.getAttribute('aria-label'));
        console.log('  Button disabled:', submitButton.disabled);
        console.log('Step 9: Clicking submit button...');
        await this.cursor.humanLikeClick(submitButton, (msg) => DOMHelpers.showNotification('Added positive comment! 💬', 'success'));
        console.log('✓ Comment submitted successfully');
        DOMHelpers.showNotification(`Submitted: "${randomResponse}"`, 'success');
        return true;
      } else {
        console.error('[Test Comment] Submit button not found');
        DOMHelpers.showNotification(`Typed: "${randomResponse}" (submit button not found)`, 'error');
        return false;
      }

    } catch (error) {
      console.log('[Test Comment] Error:', error);
      return false;
    }
  }

  // ========== LINKEDIN-SPECIFIC METHODS ==========

  getPlatformSelectors() {
    return {
      posts: 'div[data-urn]', // More reliable selector for posts
      // Multiple like button selectors for better compatibility
      likeButton: 'button[aria-label*="React"], button[aria-label*="Like"], [aria-label*="React"][role="button"]',
      commentButton: '[aria-label*="Comment"][role="button"], button[aria-label*="Comment"]',
      commentBoxContainer: '.editor-container.relative, .comments-comment-box',
      // Multiple text area fallbacks for robustness
      textArea: '.ql-editor[contenteditable="true"]',
      textAreaFallbacks: [
        '.ql-editor[contenteditable="true"]',
        'div[role="textbox"][contenteditable="true"]',
        'textarea'
      ],

      // Data extraction selectors
      authorName: '.update-components-actor__name',
      authorBio: '.update-components-actor__description',
      postContent: '.feed-shared-update-v2__description',
      timestamp: '.update-components-actor__sub-description'
    };
  }

  getExpandKeywords() {
    return ['...more'];
  }

  /**
   * LinkedIn-specific "see more" button detection
   */
  findSeeMoreButtonsInPost(post) {
    const buttons = [];
    const expandKeywords = this.getExpandKeywords();

    // Query for clickable elements within the post
    const clickableElements = post.querySelectorAll(`
      button,
      span[role="button"],
      div[role="button"],
      a[role="button"]
    `);

    // Filter by text content matching keywords
    clickableElements.forEach(element => {
      const text = element.textContent.trim();
      const textLower = text.toLowerCase();
      const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();

      // Check if text or aria-label matches any keyword
      const matchesKeyword = expandKeywords.some(keyword =>
        textLower.includes(keyword.toLowerCase()) ||
        ariaLabel.includes(keyword.toLowerCase())
      );

      if (matchesKeyword) {
        buttons.push(element);
      }
    });

    return buttons;
  }

  /**
   * Global "see more" button detection for test function
   */
  findSeeMoreButtons() {
    const buttons = [];
    const posts = Array.from(document.querySelectorAll(this.selectors.posts));
    const expandKeywords = this.getExpandKeywords();

    posts.forEach((post, postIndex) => {
      const clickableElements = post.querySelectorAll(`
        button,
        span[role="button"],
        div[role="button"],
        a[role="button"]
      `);

      clickableElements.forEach(element => {
        const text = element.textContent.trim();
        const textLower = text.toLowerCase();
        const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();

        const matchesKeyword = expandKeywords.some(keyword =>
          textLower.includes(keyword.toLowerCase()) ||
          ariaLabel.includes(keyword.toLowerCase())
        );

        if (matchesKeyword) {
          buttons.push(element);
        }
      });
    });

    return buttons;
  }

  // Extract unique post identifier
  getPostUrn(post) {
    return post.getAttribute('data-urn');
  }

  // Extract post URL for tracking
  getPostUrl(post) {
    const urn = this.getPostUrn(post);
    return urn ? `linkedin://post/${urn}` : null;
  }

  // Extract author name
  getAuthorName(post) {
    // Try multiple selectors for author name (LinkedIn changes these frequently)
    const selectors = [
      '.update-components-actor__name',
      '.update-components-actor__title',
      '[data-attributed-to-actor-name]',
      '.feed-shared-actor__name',
      '.feed-shared-actor__title',
      'span.feed-shared-actor__name span[aria-hidden="true"]'
    ];

    for (const selector of selectors) {
      const nameElement = post.querySelector(selector);
      if (nameElement) {
        const name = nameElement.textContent?.trim();
        if (name && name !== '' && name.length > 1) {
          return name;
        }
      }
    }

    // Last resort: try to find any span with person name pattern
    const spans = post.querySelectorAll('span[aria-hidden="true"]');
    for (const span of spans) {
      const text = span.textContent?.trim();
      // Check if looks like a name (2-50 chars, contains space or is single word)
      if (text && text.length > 2 && text.length < 50 && /^[A-Za-z\s\-']+$/.test(text)) {
        return text;
      }
    }

    return 'Unknown';
  }

  // Extract post content
  getPostContent(post) {
    const contentElement = post.querySelector('.feed-shared-update-v2__description');
    return contentElement?.textContent?.trim().replace(/\s+/g, ' ') || '';
  }

  // Detect post age and promotion status
  getPostAge(post) {
    const timeElement = post.querySelector('.update-components-actor__sub-description');
    if (!timeElement) return { ageHours: null, isPromoted: false };

    const timeText = timeElement.textContent.trim();
    const isPromoted = timeText.toLowerCase().includes('promoted');

    // Parse "2h", "5m", "1d", "3w" format
    const match = timeText.match(/(\d+)\s*([smhdw])/i);
    if (!match) return { ageHours: null, isPromoted };

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const ageHours = {
      's': value / 3600,
      'm': value / 60,
      'h': value,
      'd': value * 24,
      'w': value * 24 * 7
    }[unit];

    return { ageHours, isPromoted };
  }

  // Detect company pages
  isCompanyPost(post) {
    const bio = post.querySelector('.update-components-actor__description')?.textContent?.trim();
    // Company pages show follower count like "1,234 followers"
    return /^\d[\d\s,.]*followers?$/i.test(bio || '');
  }

  // Detect friend activities ("John liked this", "Jane commented on this")
  isFriendActivity(post) {
    const contextElement = post.querySelector('.update-components-actor__supplementary-actor-info');
    if (!contextElement) return false;

    const text = contextElement.textContent.toLowerCase();
    return text.includes('commented on') ||
           text.includes('liked this') ||
           text.includes('shared this');
  }

  // Check if post should be skipped
  shouldSkipPost(post) {
    // Task 3.11: Enhanced filtering logic using settings

    // 1. Skip promoted posts (ads) - always skip regardless of settings
    const { ageHours, isPromoted } = this.getPostAge(post);
    if (isPromoted) {
      console.log('[LinkedIn] Skipping promoted post');
      return true;
    }

    // 2. Check post age if time filtering enabled
    if (this.settings.timeFilterEnabled && ageHours !== null) {
      if (ageHours > this.settings.maxPostAge) {
        console.log(`[LinkedIn] Skipping old post (${ageHours.toFixed(1)}h old, max: ${this.settings.maxPostAge}h)`);
        return true;
      }
    }

    // 3. Skip company pages if enabled
    if (this.settings.skipCompanyPages && this.isCompanyPost(post)) {
      console.log('[LinkedIn] Skipping company page post');
      return true;
    }

    // 4. Skip friend activities if enabled
    if (this.settings.skipFriendActivities && this.isFriendActivity(post)) {
      console.log('[LinkedIn] Skipping friend activity post');
      return true;
    }

    return false;
  }

  findSubmitButton(textArea, scopeRoot) {
    // Step 4: Hardened submit button finding with proper scoping
    const selectors = [
      'button[aria-label*="Post"]', // Aria-label based (most reliable)
      'button[aria-label*="Submit"]',
      'button.share-actions__primary-action',
      '.comments-comment-box__submit-button--cr', // Primary selector (most specific)
      'button.comments-comment-box__submit-button--cr', // With button tag
      '.comments-comment-box button.artdeco-button--primary', // Primary button in comment box
      'button[class*="comments-comment-box__submit-button"]', // Pattern match
      '.comments-comment-box button[class*="submit-button"]' // Generic pattern
    ];

    // Step 4a: Walk up max 6 parents from textarea to find submit button
    let container = textArea;
    for (let i = 0; i < 6; i++) {
      if (!container) break;

      for (const selector of selectors) {
        const btn = container.querySelector(selector);
        if (btn && !btn.disabled) {
          console.log(`[LinkedIn Submit] Found button in parent ${i} with selector: ${selector}`);
          return btn;
        }
      }
      container = container.parentElement;
    }

    // Step 4b: Search within scopeRoot if provided
    if (scopeRoot) {
      console.log('[LinkedIn Submit] Searching within scope root...');
      for (const selector of selectors) {
        const btn = scopeRoot.querySelector(selector);
        if (btn && !btn.disabled) {
          console.log(`[LinkedIn Submit] Found button in scope root with selector: ${selector}`);
          return btn;
        }
      }
    }

    // Step 4c: No global fallback - log error and return null
    console.error('[LinkedIn Submit] No submit button found - exhausted all scoped searches');
    return null;
  }

  // ========== LINKEDIN TEST FUNCTIONS ==========

  // Test post detection
  async testPostDetection() {
    console.log('=== LINKEDIN POST DETECTION TEST ===');
    const posts = document.querySelectorAll('div[data-urn]');
    console.log(`Found ${posts.length} posts`);

    if (posts.length > 0) {
      const post = posts[0];
      console.log('First post data:');
      console.log('  URN:', this.getPostUrn(post));
      console.log('  Author:', this.getAuthorName(post));
      console.log('  Content:', this.getPostContent(post).substring(0, 50) + '...');
      console.log('  Age:', this.getPostAge(post));
      console.log('  Company?', this.isCompanyPost(post));
      console.log('  Friend Activity?', this.isFriendActivity(post));
      console.log('  Should Skip?', this.shouldSkipPost(post));

      // Highlight for 3 seconds
      post.style.border = '3px solid red';
      setTimeout(() => post.style.border = '', 3000);

      DOMHelpers.showNotification('First post highlighted - check console', 'info');
    } else {
      DOMHelpers.showNotification('No posts found!', 'error');
    }
  }

  // Test React button
  async testReactButton() {
    console.log('=== LINKEDIN REACT BUTTON TEST ===');
    const posts = document.querySelectorAll('div[data-urn]');
    const visiblePosts = Array.from(posts).filter(p => DOMHelpers.isElementInViewport(p));

    if (visiblePosts.length > 0) {
      const post = visiblePosts[0];

      // Task 3.11: Test both old and new selectors
      const oldSelector = 'button[aria-label*="React"]';
      const newSelector = '[aria-label*="React"][role="button"]:not([data-test-reactions-count])';

      const reactButton = post.querySelector(newSelector) || post.querySelector(oldSelector);
      const matchedSelector = post.querySelector(newSelector) ? 'NEW (hardened)' : 'OLD (fallback)';

      console.log('React button found:', !!reactButton);
      console.log('  Matched selector:', matchedSelector);
      if (reactButton) {
        console.log('  aria-label:', reactButton.getAttribute('aria-label'));
        console.log('  aria-pressed:', reactButton.getAttribute('aria-pressed'));
        console.log('  role:', reactButton.getAttribute('role'));
        console.log('  Has counter attribute:', !!reactButton.getAttribute('data-test-reactions-count'));

        reactButton.style.border = '3px solid blue';
        setTimeout(() => reactButton.style.border = '', 3000);

        DOMHelpers.showNotification(`React button highlighted (${matchedSelector})`, 'info');
      } else {
        DOMHelpers.showNotification('No React button found!', 'error');
      }
    }
  }

  // Test comment flow
  async testCommentFlow() {
    console.log('=== LINKEDIN COMMENT FLOW TEST ===');
    const posts = document.querySelectorAll('div[data-urn]');
    const visiblePosts = Array.from(posts).filter(p => DOMHelpers.isElementInViewport(p));

    if (visiblePosts.length > 0) {
      const post = visiblePosts[0];

      console.log('Step 1: Find comment button');
      // Task 3.11: Test hardened comment button selector
      const oldCommentSelector = 'button[aria-label*="Comment"]';
      const newCommentSelector = '[aria-label*="Comment"][role="button"]';
      const commentButton = post.querySelector(newCommentSelector) || post.querySelector(oldCommentSelector);
      const commentSelectorMatch = post.querySelector(newCommentSelector) ? 'NEW (hardened)' : 'OLD (fallback)';

      console.log('  Found:', !!commentButton);
      console.log('  Matched selector:', commentSelectorMatch);

      if (commentButton) {
        console.log('Step 2: Clicking...');
        commentButton.click();
        await DOMHelpers.sleep(2000);

        console.log('Step 3: Find text area');
        // Task 3.11: Test multiple text area fallbacks
        const textAreaSelectors = this.selectors.textAreaFallbacks || ['.ql-editor[contenteditable="true"]'];
        let textArea = null;
        let matchedTextAreaSelector = null;

        for (const selector of textAreaSelectors) {
          textArea = document.querySelector(selector);
          if (textArea) {
            matchedTextAreaSelector = selector;
            break;
          }
        }

        console.log('  Found:', !!textArea);
        console.log('  Matched text area selector:', matchedTextAreaSelector);

        if (textArea) {
          console.log('Step 4: Find submit button (findSubmitButton logs selector internally)');
          const submitButton = this.findSubmitButton(textArea, post);
          console.log('  Found:', !!submitButton);

          if (submitButton) {
            submitButton.style.border = '3px solid green';
            setTimeout(() => submitButton.style.border = '', 3000);
            DOMHelpers.showNotification('Submit button highlighted!', 'success');
          } else {
            DOMHelpers.showNotification('Submit button not found!', 'error');
          }
        } else {
          DOMHelpers.showNotification('Text area not found!', 'error');
        }
      }
    }
  }

  // Test LinkedIn extraction
  async testLinkedInExtract() {
    console.log('=== LINKEDIN EXTRACTION TEST ===');
    const posts = document.querySelectorAll('div[data-urn]');
    const visiblePosts = Array.from(posts).filter(p => DOMHelpers.isElementInViewport(p));

    if (visiblePosts.length === 0) {
      DOMHelpers.showNotification('No visible posts found!', 'error');
      return;
    }

    const post = visiblePosts[0];

    console.log('========================================');
    console.log('📊 LINKEDIN POST EXTRACTION TEST');
    console.log('========================================');

    // Extract post content
    const postContent = this.getPostContent(post);
    console.log('\n📝 POST CONTENT:');
    console.log(postContent || '(empty)');
    console.log(`Length: ${postContent.length} characters`);

    // Extract author
    const authorName = this.getAuthorName(post);
    console.log('\n👤 POST AUTHOR:');
    console.log(`Name: ${authorName}`);
    console.log(`First Name: ${this.templateGenerator.extractFirstName(authorName)}`);

    // Extract post URN
    const postUrn = this.getPostUrn(post);
    console.log('\n🔗 POST URN:');
    console.log(postUrn || '(not found)');

    // Extract post age
    const postAge = this.getPostAge(post);
    console.log('\n⏰ POST AGE:');
    console.log(`${postAge} hours ago`);

    // Check if company post
    const isCompany = this.isCompanyPost(post);
    console.log('\n🏢 IS COMPANY POST:');
    console.log(isCompany ? 'Yes' : 'No');

    // Check if friend activity
    const isFriendActivity = this.isFriendActivity(post);
    console.log('\n👥 IS FRIEND ACTIVITY:');
    console.log(isFriendActivity ? 'Yes (shows who engaged)' : 'No (original post)');

    // Extract friends who engaged (if friend activity)
    if (isFriendActivity) {
      const friendActivityText = post.querySelector('.update-components-actor__description')?.textContent?.trim();
      console.log('\n👥 FRIENDS WHO ENGAGED:');
      console.log(friendActivityText || '(not found)');
    }

    // Should skip check
    const shouldSkip = this.shouldSkipPost(post);
    console.log('\n⚠️ SHOULD SKIP THIS POST:');
    console.log(shouldSkip ? 'Yes' : 'No');

    console.log('\n========================================');

    // Highlight the post
    post.style.border = '5px solid #0073b1';
    post.style.backgroundColor = 'rgba(0, 115, 177, 0.05)';
    setTimeout(() => {
      post.style.border = '';
      post.style.backgroundColor = '';
    }, 5000);

    // Show notification
    DOMHelpers.showNotification(
      `✅ Extracted: ${authorName} - ${postContent.substring(0, 30)}... (Check console for details)`,
      'success'
    );
  }
};
