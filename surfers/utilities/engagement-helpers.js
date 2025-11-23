/**
 * Engagement Helpers - Duplicate detection and safety limits
 *
 * DuplicateDetector:
 * - URL tracking (Set of engaged URLs)
 * - Author cooldown (24-hour window)
 * - Content hash detection (prevents duplicate content)
 * - Chrome storage persistence
 * - Weekly auto-cleanup
 *
 * SafetyLimits:
 * - Hourly limits: 10 comments, 30 likes
 * - Daily limits: 50 comments, 200 likes
 * - Auto-reset timers
 * - Chrome storage persistence
 */

/**
 * DuplicateDetector - Prevents engaging with the same content/author repeatedly
 */
window.DuplicateDetector = class DuplicateDetector {
  constructor() {
    this.commentedUrls = new Set();
    this.commentedAuthors = new Map(); // author -> timestamp
    this.contentHashes = new Set();
    this.loadFromStorage();
  }

  async loadFromStorage() {
    try {
      const data = await chrome.storage.local.get([
        'commentedUrls',
        'commentedAuthors',
        'contentHashes',
        'lastCleanup'
      ]);

      if (data.commentedUrls) {
        this.commentedUrls = new Set(data.commentedUrls);
      }
      if (data.commentedAuthors) {
        this.commentedAuthors = new Map(Object.entries(data.commentedAuthors));
      }
      if (data.contentHashes) {
        this.contentHashes = new Set(data.contentHashes);
      }

      // Run cleanup weekly
      const lastCleanup = data.lastCleanup || 0;
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - lastCleanup > oneWeekMs) {
        await this.cleanup();
        await chrome.storage.local.set({ lastCleanup: Date.now() });
      }
    } catch (e) {
      console.error('Failed to load duplicate data', e);
    }
  }

  async saveToStorage() {
    try {
      await chrome.storage.local.set({
        commentedUrls: Array.from(this.commentedUrls),
        commentedAuthors: Object.fromEntries(this.commentedAuthors),
        contentHashes: Array.from(this.contentHashes)
      });
    } catch (e) {
      console.error('Failed to save duplicate data', e);
    }
  }

  // Check if post URL already engaged
  hasEngagedUrl(url) {
    if (!url) return false;
    return this.commentedUrls.has(url);
  }

  // Check if author engaged recently (within 24 hours)
  hasEngagedAuthor(authorName, windowHours = 24) {
    if (!authorName) return false;
    const lastTime = this.commentedAuthors.get(authorName);
    if (!lastTime) return false;

    const hoursSince = (Date.now() - lastTime) / (1000 * 60 * 60);
    return hoursSince < windowHours;
  }

  // Check if content is duplicate using simple hash
  async hasEngagedContent(content) {
    if (!content) return false;
    const hash = await this.simpleHash(content);
    return this.contentHashes.has(hash);
  }

  // Simple hash function (no crypto needed)
  async simpleHash(text) {
    const normalized = text.toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500); // First 500 chars only

    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  // Record engagement
  async recordEngagement(url, authorName, content) {
    if (url) this.commentedUrls.add(url);
    if (authorName) this.commentedAuthors.set(authorName, Date.now());

    if (content) {
      const hash = await this.simpleHash(content);
      this.contentHashes.add(hash);
    }

    await this.saveToStorage();
  }

  // Cleanup old data (run weekly or on init to prevent storage bloat)
  async cleanup() {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // Remove old author entries (older than 1 week)
    for (const [author, timestamp] of this.commentedAuthors.entries()) {
      if (timestamp < oneWeekAgo) {
        this.commentedAuthors.delete(author);
      }
    }

    // Limit URL storage to 10,000 entries (keep most recent 5,000)
    if (this.commentedUrls.size > 10000) {
      const urlArray = Array.from(this.commentedUrls);
      this.commentedUrls = new Set(urlArray.slice(-5000));
    }

    // Limit content hash storage to 10,000 entries (keep most recent 5,000)
    if (this.contentHashes.size > 10000) {
      const hashArray = Array.from(this.contentHashes);
      this.contentHashes = new Set(hashArray.slice(-5000));
    }

    await this.saveToStorage();
    console.log('[DuplicateDetector] Cleanup completed');
  }
};

/**
 * SafetyLimits - Enforces hourly and daily limits
 */
window.SafetyLimits = class SafetyLimits {
  constructor() {
    this.limits = {
      commentsPerHour: 10,
      commentsPerDay: 50,
      likesPerHour: 30,
      likesPerDay: 200
    };
    this.counters = {
      hourlyComments: 0,
      dailyComments: 0,
      hourlyLikes: 0,
      dailyLikes: 0,
      lastHourReset: Date.now(),
      lastDayReset: Date.now()
    };
    this.loadFromStorage();
  }

  async loadFromStorage() {
    try {
      const data = await chrome.storage.local.get(['safetyCounters']);
      if (data.safetyCounters) {
        this.counters = { ...this.counters, ...data.safetyCounters };
      }
      this.checkResets();
    } catch (e) {
      console.error('Failed to load safety counters', e);
    }
  }

  checkResets() {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;

    // Reset hourly counters
    if (now - this.counters.lastHourReset > hourMs) {
      this.counters.hourlyComments = 0;
      this.counters.hourlyLikes = 0;
      this.counters.lastHourReset = now;
    }

    // Reset daily counters
    if (now - this.counters.lastDayReset > dayMs) {
      this.counters.dailyComments = 0;
      this.counters.dailyLikes = 0;
      this.counters.lastDayReset = now;
    }
  }

  async saveToStorage() {
    await chrome.storage.local.set({
      safetyCounters: this.counters
    });
  }

  canComment() {
    this.checkResets();
    return this.counters.hourlyComments < this.limits.commentsPerHour &&
      this.counters.dailyComments < this.limits.commentsPerDay;
  }

  canLike() {
    this.checkResets();
    return this.counters.hourlyLikes < this.limits.likesPerHour &&
      this.counters.dailyLikes < this.limits.likesPerDay;
  }

  async recordComment() {
    this.counters.hourlyComments++;
    this.counters.dailyComments++;
    await this.saveToStorage();
  }

  async recordLike() {
    this.counters.hourlyLikes++;
    this.counters.dailyLikes++;
    await this.saveToStorage();
  }
};
