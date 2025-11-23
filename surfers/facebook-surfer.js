/**
 * FacebookAutoSurfer - Standalone Facebook automation
 * Complete independent implementation for Facebook Groups feed
 */

window.FacebookAutoSurfer = class FacebookAutoSurfer {
  constructor() {
    this.isActive = false;
    this.engagementTimeout = null;
    this.cursor = null;
    this.platform = 'facebook';
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
      postEngagementDelay: 3000
    };


    this.sessionStats = {
      totalPostsViewed: 0,
      totalSeeMoreClicked: 0,
      totalPostsLiked: 0,
      totalComments: 0
    };

    this.templateGenerator = new window.TemplateGenerator();

    this.init();
    this.createCursor();
  }

  // ========== FACEBOOK-SPECIFIC CONFIGURATION ==========

  getPlatformSelectors() {
    return {
      posts: '[role="main"] div.x78zum5.xdt5ytf[data-virtualized="false"]',
      likeButton: '[aria-label*="Like"]',
      commentButton: '[aria-label*="Comment"]',
      textArea: '[role="textbox"], [contenteditable="true"]',
      seeMore: '[role="button"]'
    };
  }

  getExpandKeywords() {
    return ['See more', 'See More', 'Continue reading', 'Read more', 'Show more'];
  }

  findSeeMoreButtonsInPost(post) {
    const buttons = [];
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
      const ariaLabel = (element.getAttribute('aria-label') || '');

      // Facebook requires exact matching
      const matchesKeyword = expandKeywords.some(keyword => {
        return text === keyword || ariaLabel === keyword;
      });

      if (matchesKeyword) {
        buttons.push(element);
      }
    });

    return buttons;
  }

  findSeeMoreButtons() {
    const buttons = [];

    console.log('=== FINDING SEE MORE BUTTONS FOR FACEBOOK ===');

    const allClickableElements = document.querySelectorAll(`
      div[role="button"],
      span[role="button"],
      button,
      a[role="button"],
      [tabindex="0"]:not(input):not(textarea),
      div[aria-label],
      span[aria-label]
    `);

    console.log(`Facebook: Found ${allClickableElements.length} total clickable elements on page`);

    const fbPatterns = [
      'See more',
      'See More',
      'Continue reading',
      'Show more',
      '...more',
      'Read more'
    ];

    allClickableElements.forEach((element, elemIndex) => {
      const text = element.textContent.trim();
      const ariaLabel = element.getAttribute('aria-label') || '';

      const matchesPattern = fbPatterns.some(pattern => {
        return text === pattern ||
          text.includes(pattern) ||
          ariaLabel === pattern ||
          ariaLabel.includes(pattern);
      });

      if (matchesPattern) {
        console.log(`[Facebook] Found potential button #${elemIndex}: "${text}" (aria: "${ariaLabel}")`);
        buttons.push(element);
      }
    });

    console.log(`Total buttons found: ${buttons.length}`);
    return buttons;
  }

  findSubmitButton(textArea, post) {
    console.log('[Facebook] Looking for submit button...');
    console.log('[Facebook] Starting from text area:', textArea);

    // Traverse up from text area to find the comment form container
    let container = textArea;
    for (let i = 0; i < 8; i++) {
      container = container.parentElement;
      if (!container) break;

      console.log(`[Facebook] Level ${i}: Checking container:`, container);

      // PRIORITY 1: Look for div with aria-label="Comment" that has an icon inside
      // This is the submit button (different from the opening comment button which has aria-pressed)
      const commentButtons = container.querySelectorAll('div[role="button"][aria-label="Comment"]');
      console.log(`[Facebook] Level ${i}: Found ${commentButtons.length} buttons with aria-label="Comment"`);

      for (const btn of commentButtons) {
        const hasPressed = btn.hasAttribute('aria-pressed');
        const hasIcon = btn.querySelector('i') || btn.querySelector('svg');
        console.log('[Facebook] Checking button:', {
          ariaLabel: btn.getAttribute('aria-label'),
          hasPressed: hasPressed,
          hasIcon: !!hasIcon,
          element: btn
        });

        // Skip if it has aria-pressed (that's the original comment opening button)
        if (hasPressed) {
          console.log('[Facebook] Skipping - has aria-pressed');
          continue;
        }

        // Check if it has an icon inside (submit buttons have icons)
        if (hasIcon) {
          console.log('[Facebook Submit] ✓ Found submit button with icon!');
          return btn;
        }
      }

      // PRIORITY 2: Look for other submit-like buttons
      const buttons = container.querySelectorAll('div[role="button"], button');
      console.log(`[Facebook] Level ${i}: Found ${buttons.length} total buttons`);

      for (const btn of buttons) {
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const text = btn.textContent.trim().toLowerCase();

        // Skip the original comment button (it has aria-pressed)
        if (btn.hasAttribute('aria-pressed')) {
          continue;
        }

        // Skip if it's the comment sticker button
        if (ariaLabel.includes('avatar sticker')) {
          continue;
        }

        // Skip if it's a clearly non-submit button
        if (ariaLabel.includes('Insert an emoji') ||
          ariaLabel.includes('Attach') ||
          ariaLabel.includes('Photo') ||
          ariaLabel.includes('GIF')) {
          continue;
        }

        // Look for Enter/Post/Send indicators
        if (ariaLabel.includes('Enter') ||
          text.includes('enter') ||
          ariaLabel.includes('Post') ||
          ariaLabel.includes('Send')) {
          console.log('[Facebook Submit] Found submit button:', btn);
          console.log('  aria-label:', ariaLabel);
          console.log('  text:', btn.textContent.trim());
          return btn;
        }
      }
    }

    console.log('[Facebook Submit] ✗ No submit button found after checking all levels');
    return null;
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
    this.showNotification('Auto surfing started! Using sequential engagement.', 'success');
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

    this.showNotification(
      `Session ended! Posts: ${this.sessionStats.totalPostsViewed}, Liked: ${this.sessionStats.totalPostsLiked}`,
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
        this.isElementInViewport(post) && !post.getAttribute('data-surfer-engaged')
      );

      // Step 2: If no visible posts, use smart scrolling to find one
      if (visiblePosts.length === 0) {
        console.log('[Engagement] No visible unengaged posts, starting smart scroll...');
        const foundPost = await this.smartScrollUntilNewPost();

        if (!foundPost) {
          console.log('[Engagement] No new posts found, waiting 7s before retry...');
          await this.sleep(7000);
          this.scheduleNextCycle();
          return;
        }

        posts = document.querySelectorAll(this.selectors.posts);
        visiblePosts = Array.from(posts).filter(post =>
          this.isElementInViewport(post) && !post.getAttribute('data-surfer-engaged')
        );

        if (visiblePosts.length === 0) {
          await this.sleep(5000);
          this.scheduleNextCycle();
          return;
        }
      }

      const targetPost = visiblePosts[0];

      // Step 3: Ensure post is fully engageable (interaction buttons visible)
      if (!this.isPostFullyEngageable(targetPost)) {
        console.log('[Engagement] Interaction buttons not fully visible, adjusting scroll...');
        await this.scrollPostIntoEngageableView(targetPost);
      }

      targetPost.setAttribute('data-surfer-engaged', 'true');
      this.sessionStats.totalPostsViewed++;

      console.log(`[Post #${this.sessionStats.totalPostsViewed}] Starting engagement`);

      // Step 4: Click "see more" if enabled
      if (this.settings.enableSeeMore) {
        await this.clickSeeMoreOnPost(targetPost);
        await this.sleep(this.settings.seeMoreDelay);
      }

      // Step 5: Auto like if enabled and passes probability check
      if (this.settings.enableAutoLike) {
        const likeRoll = Math.random() * 100;
        const shouldLike = likeRoll < this.settings.likeProbability;

        if (shouldLike) {
          await this.likePost(targetPost);
          await this.sleep(this.settings.likeDelay);
        }
      }

      // Step 6: Auto comment if enabled and passes probability check
      if (this.settings.enableAutoComment) {
        const commentRoll = Math.random() * 100;
        const shouldComment = commentRoll < this.settings.commentProbability;

        if (shouldComment) {
          await this.commentPost(targetPost);
          await this.sleep(this.settings.commentDelay);
        }
      }

      await this.sleep(this.settings.postEngagementDelay);
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
    const MIN_SCROLL = 250;
    const MAX_SCROLL = 600;
    const MIN_DELAY = 400;
    const MAX_DELAY = 800;
    const MAX_ATTEMPTS = 10;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 100;

      if (atBottom) {
        console.log('[Smart Scroll] Reached bottom of page');
        return false;
      }

      const randomScrollAmount = Math.floor(Math.random() * (MAX_SCROLL - MIN_SCROLL + 1)) + MIN_SCROLL;
      const randomDelay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;

      // 50% chance use keyboard, 50% mouse scroll for human-like behavior
      if (Math.random() < 0.5) {
        // Keyboard scrolling
        const keys = ['PageDown', 'ArrowDown', ' ']; // Space bar also scrolls
        const randomKey = keys[Math.floor(Math.random() * keys.length)];

        console.log(`[Smart Scroll] Using keyboard: ${randomKey}`);

        const keyEvent = new KeyboardEvent('keydown', {
          key: randomKey,
          code: randomKey === ' ' ? 'Space' : randomKey,
          keyCode: randomKey === 'PageDown' ? 34 : randomKey === 'ArrowDown' ? 40 : 32,
          which: randomKey === 'PageDown' ? 34 : randomKey === 'ArrowDown' ? 40 : 32,
          bubbles: true,
          cancelable: true
        });
        document.body.dispatchEvent(keyEvent);
      } else {
        // Mouse scrolling
        console.log(`[Smart Scroll] Using mouse scroll: ${randomScrollAmount}px`);
        await this.performScroll(randomScrollAmount);
      }

      await this.sleep(randomDelay);

      const posts = document.querySelectorAll(this.selectors.posts);
      const visibleUnengagedPosts = Array.from(posts).filter(post =>
        this.isElementInViewport(post) && !post.getAttribute('data-surfer-engaged')
      );

      if (visibleUnengagedPosts.length > 0) {
        console.log(`[Smart Scroll] Found ${visibleUnengagedPosts.length} new post(s) after ${attempt + 1} scroll(s)`);
        return true;
      }
    }

    console.log('[Smart Scroll] Max attempts reached, no new posts found');
    return false;
  }

  // ========== POST ENGAGEMENT ==========

  async clickSeeMoreOnPost(post) {
    try {
      const seeMoreButtons = this.findSeeMoreButtonsInPost(post);
      const visibleButtons = seeMoreButtons.filter(button =>
        this.isElementInViewport(button) && !button.getAttribute('data-surfer-clicked')
      );

      if (visibleButtons.length > 0) {
        const button = visibleButtons[0];
        button.setAttribute('data-surfer-clicked', 'true');
        this.sessionStats.totalSeeMoreClicked++;
        await this.humanLikeClick(button, `Clicked "${button.textContent.trim()}" 👁️`);
      }
    } catch (error) {
      console.log('Error clicking See More:', error);
    }
  }

  async likePost(post) {
    try {
      const allLikeButtons = post.querySelectorAll(this.selectors.likeButton);

      let likeButton = null;
      let shortestLength = Infinity;

      allLikeButtons.forEach(btn => {
        const ariaLabel = btn.getAttribute('aria-label') || '';

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
          likeButton.setAttribute('data-surfer-liked', 'true');

          // Wait random time
          await this.sleep(Math.random() * 1000 + 500);

          // Move cursor randomly first (human-like behavior)
          console.log('[Like] Moving cursor randomly before liking...');
          await this.moveRandomly(300);
          await this.sleep(100);

          // Click randomly within the like button area (not just center)
          console.log('[Like] Clicking like button at random position...');
          await this.randomClickWithinElement(likeButton, 'Liked a post! ❤️');
          this.sessionStats.totalPostsLiked++;
        }
      }
    } catch (error) {
      console.log('[Like] Error:', error);
    }
  }

  async commentPost(post) {
    try {
      const commented = await this.addPositiveComment(post);
      if (commented) {
        this.sessionStats.totalComments++;
      }
    } catch (error) {
      console.log('[Comment] Error:', error);
    }
  }

  async addPositiveComment(post) {
    try {
      // Find comment button within this specific post
      const commentButton = post.querySelector(this.selectors.commentButton);
      if (!commentButton || commentButton.getAttribute('data-surfer-commented')) {
        console.log('[Facebook Comment] No comment button or already commented');
        return false;
      }

      console.log('[Facebook Comment] Found comment button, clicking...');
      commentButton.setAttribute('data-surfer-commented', 'true');
      await this.humanLikeClick(commentButton, 'Opening comment box...');

      await this.sleep(2000);

      // Find text area within this post (search from post down)
      let textArea = null;
      const selectors = [
        '[role="textbox"]',
        '[contenteditable="true"]',
        'textarea',
        '.ql-editor'
      ];

      for (const selector of selectors) {
        const elements = post.querySelectorAll(selector);
        for (const el of elements) {
          const isVisible = (this.isElementInViewport(el) || el.offsetParent !== null);
          const isEditable = el.contentEditable === 'true' || el.getAttribute('contenteditable') === 'true' || el.tagName === 'TEXTAREA';

          if (isVisible && isEditable) {
            textArea = el;
            console.log('[Facebook Comment] Found text area:', el);
            break;
          }
        }
        if (textArea) break;
      }

      if (!textArea) {
        console.log('[Facebook Comment] No text area found');
        return false;
      }

      // Move cursor up from text area center and click (fixes border click issue)
      console.log('[Facebook Comment] Adjusting click position...');
      const rect = textArea.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const adjustedY = centerY - 15; // Move up 15 pixels

      // Find element at adjusted position
      const clickTarget = document.elementFromPoint(centerX, adjustedY) || textArea;
      console.log('[Facebook Comment] Click target found:', clickTarget);
      console.log('[Facebook Comment] About to call humanLikeClick...');
      await this.humanLikeClick(clickTarget, 'Focusing comment input...');
      console.log('[Facebook Comment] ✓ First click completed');
      await this.sleep(300);

      // Move cursor randomly for 500ms (human-like behavior)
      console.log('[Facebook Comment] Moving cursor randomly...');
      await this.moveRandomly(500);
      await this.sleep(200);

      // Type comment
      let randomResponse;

      // Check if Pro mode is enabled
      if (this.mode === 'pro') {
        const postContent = this.extractPostContent(post);
        console.log('[PRO MODE - Facebook] Extracted Post Content:', postContent);
        console.log('[PRO MODE - Facebook] Selected Persona:', this.proModeSettings?.persona || 'friendly');

        console.log('[PRO MODE - Facebook] TODO: Call AI API to generate comment');

        randomResponse = this.templateGenerator.generateComment({
          authorName: '' // Facebook surfer doesn't extract author names
        });
      } else {
        randomResponse = this.templateGenerator.generateComment({
          authorName: '' // Facebook surfer doesn't extract author names
        });
      }

      console.log('[Facebook Comment] Typing:', randomResponse);
      await this.typeText(textArea, randomResponse);
      console.log('[Facebook Comment] ✓ Typing completed');
      await this.sleep(300);

      // Move cursor randomly again for 500ms (human-like behavior)
      console.log('[Facebook Comment] Moving cursor randomly again...');
      await this.moveRandomly(500);
      await this.sleep(200);

      // Press Enter to submit (no programmatic clicks needed!)
      console.log('[Facebook Comment] Pressing Enter to submit...');

      // Dispatch Enter key events
      const enterKeyDown = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });

      const enterKeyPress = new KeyboardEvent('keypress', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });

      const enterKeyUp = new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });

      textArea.dispatchEvent(enterKeyDown);
      textArea.dispatchEvent(enterKeyPress);
      textArea.dispatchEvent(enterKeyUp);

      console.log('[Facebook Comment] ✓ Enter key pressed - comment submitted!');
      await this.sleep(500);

      return true;
    } catch (error) {
      console.log('[Facebook Comment] Error:', error);
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
      const visibleButtons = buttons.filter(button => this.isElementInViewport(button));
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

        this.showNotification(`Found button: "${testButton.textContent.trim()}"`, 'info');
      }
    } else {
      this.showNotification('No see more buttons found!', 'error');
    }
  }

  async testLikePost() {
    console.log('=== TESTING LIKE POST ===');
    console.log('Platform:', this.platform);
    console.log('Post selector:', this.selectors.posts);
    console.log('Like button selector:', this.selectors.likeButton);

    const posts = document.querySelectorAll(this.selectors.posts);
    const visiblePosts = Array.from(posts).filter(post => this.isElementInViewport(post));

    console.log(`Found ${posts.length} total posts, ${visiblePosts.length} visible posts`);

    if (visiblePosts.length > 0) {
      const testPost = visiblePosts[0];
      console.log('Testing first visible post:', testPost);

      const likeButton = testPost.querySelector(this.selectors.likeButton);
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
        await this.humanLikeClick(likeButton, 'Test liked a post! ❤️');

        this.showNotification('Like button clicked!', 'success');
      } else {
        this.showNotification('No like button found in first visible post!', 'error');
      }
    } else {
      this.showNotification('No visible posts found!', 'error');
    }
  }

  async testCommentPost() {
    console.log('=== TESTING COMMENT POST ===');
    console.log('Platform:', this.platform);
    console.log('Post selector:', this.selectors.posts);
    console.log('Comment button selector:', this.selectors.commentButton);

    const posts = document.querySelectorAll(this.selectors.posts);
    const visiblePosts = Array.from(posts).filter(post => this.isElementInViewport(post));

    console.log(`Found ${posts.length} total posts, ${visiblePosts.length} visible posts`);

    if (visiblePosts.length > 0) {
      const testPost = visiblePosts[0];
      console.log('Testing first visible post:', testPost);

      const commentButton = testPost.querySelector(this.selectors.commentButton);
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

        console.log('Attempting to add comment...');
        const result = await this.addPositiveComment(testPost);

        if (result) {
          this.showNotification('Comment submitted!', 'success');
        } else {
          this.showNotification('Comment typed but not submitted', 'error');
        }
      } else {
        this.showNotification('No comment button found in first visible post!', 'error');
      }
    } else {
      this.showNotification('No visible posts found!', 'error');
    }
  }

  // ========== HUMAN-LIKE BEHAVIOR ==========

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

  async humanLikeClick(element, notificationText = 'Clicked element') {
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

      this.showNotification(notificationText, 'success');
      await this.sleep(Math.random() * 500 + 200);

    } catch (error) {
      console.log('Error in humanLikeClick:', error);
      this.hideCursor();
    }
  }

  async moveRandomly(durationMs = 500) {
    // Move cursor to a random position on screen for human-like behavior
    if (!this.cursor) return;

    const randomX = Math.random() * window.innerWidth;
    const randomY = Math.random() * window.innerHeight;

    const currentX = parseFloat(this.cursor.style.left) || window.innerWidth / 2;
    const currentY = parseFloat(this.cursor.style.top) || window.innerHeight / 2;

    this.showCursor();
    await this.animateCursorMovement(currentX, currentY, randomX, randomY, durationMs);
    setTimeout(() => this.hideCursor(), 200);
  }

  async randomClickWithinElement(element, notificationText = 'Clicked element') {
    // Click at a random position within the element's bounds
    try {
      const rect = element.getBoundingClientRect();

      // Generate random position within element (with 10% padding from edges)
      const paddingX = rect.width * 0.1;
      const paddingY = rect.height * 0.1;
      const randomX = rect.left + paddingX + Math.random() * (rect.width - 2 * paddingX);
      const randomY = rect.top + paddingY + Math.random() * (rect.height - 2 * paddingY);

      if (!this.cursor) return;

      const currentX = parseFloat(this.cursor.style.left) || Math.random() * window.innerWidth;
      const currentY = parseFloat(this.cursor.style.top) || Math.random() * window.innerHeight;

      const distance = Math.sqrt(Math.pow(randomX - currentX, 2) + Math.pow(randomY - currentY, 2));
      const duration = Math.max(300, Math.min(1500, distance * 2));

      this.showCursor();
      await this.animateCursorMovement(currentX, currentY, randomX, randomY, duration);
      await this.sleep(Math.random() * 200 + 100);

      this.cursor.style.transform = 'scale(0.8)';
      this.cursor.style.background = 'rgba(255, 100, 100, 0.8)';

      element.click();

      await this.sleep(100);

      this.cursor.style.transform = 'scale(1)';
      this.cursor.style.background = 'rgba(255, 0, 0, 0.6)';

      setTimeout(() => this.hideCursor(), 500);

      this.showNotification(notificationText, 'success');
      await this.sleep(Math.random() * 500 + 200);

    } catch (error) {
      console.log('Error in randomClickWithinElement:', error);
      this.hideCursor();
    }
  }

  async typeText(textArea, text) {
    textArea.focus();

    const isContentEditable = textArea.contentEditable === 'true' || textArea.getAttribute('contenteditable') === 'true';

    if (isContentEditable) {
      textArea.focus();

      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      textArea.dispatchEvent(clickEvent);

      await this.sleep(300);

      textArea.innerHTML = '';
      textArea.textContent = '';

      if (document.execCommand) {
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
      }

      await this.sleep(200);

      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (document.execCommand) {
          document.execCommand('insertText', false, char);
        } else {
          textArea.textContent += char;
          textArea.innerHTML = textArea.textContent;
        }

        textArea.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: char
        }));

        await this.sleep(Math.random() * 100 + 50);

        if (Math.random() < 0.1) {
          await this.sleep(Math.random() * 500 + 200);
        }
      }

      textArea.dispatchEvent(new Event('input', { bubbles: true }));
      textArea.dispatchEvent(new Event('change', { bubbles: true }));
      textArea.blur();
      textArea.focus();

    } else {

      textArea.value = '';

      for (let i = 0; i < text.length; i++) {
        textArea.value += text[i];
        textArea.dispatchEvent(new Event('input', { bubbles: true }));

        await this.sleep(Math.random() * 100 + 50);

        if (Math.random() < 0.1) {
          await this.sleep(Math.random() * 500 + 200);
        }
      }
    }
  }

  // ========== UTILITIES ==========

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
      rect.bottom > 0 &&
      rect.left < (window.innerWidth || document.documentElement.clientWidth) &&
      rect.right > 0
    );
  }

  isPostFullyEngageable(post) {
    if (!this.isElementInViewport(post)) {
      return false;
    }

    const likeButton = post.querySelector(this.selectors.likeButton);
    const commentButton = post.querySelector(this.selectors.commentButton);

    const buttons = [likeButton, commentButton].filter(btn => btn);

    if (buttons.length === 0) {
      const rect = post.getBoundingClientRect();
      return rect.top >= 0 && rect.top < window.innerHeight * 0.8;
    }

    for (const button of buttons) {
      const rect = button.getBoundingClientRect();
      const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (fullyVisible) {
        return true;
      }
    }

    return false;
  }

  async scrollPostIntoEngageableView(post) {
    const likeButton = post.querySelector(this.selectors.likeButton);
    const commentButton = post.querySelector(this.selectors.commentButton);

    const buttons = [likeButton, commentButton].filter(btn => btn);

    if (buttons.length > 0) {
      let lowestButton = buttons[0];
      let lowestBottom = lowestButton.getBoundingClientRect().bottom;

      for (const button of buttons) {
        const bottom = button.getBoundingClientRect().bottom;
        if (bottom > lowestBottom) {
          lowestButton = button;
          lowestBottom = bottom;
        }
      }

      lowestButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.sleep(500);
    } else {
      post.scrollIntoView({ behavior: 'smooth', block: 'start' });
      await this.sleep(500);
    }
  }

  showNotification(message, type = 'info') {
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
};
