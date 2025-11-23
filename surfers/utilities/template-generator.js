/**
 * TemplateGenerator - Dynamic comment generation with placeholders
 *
 * Combines Solution 1 (User Templates) + Solution 3 (Variable Placeholders):
 * - Users provide their own templates for authentic voice
 * - Placeholders add dynamic variety and personalization
 *
 * Supported Placeholders:
 * - {author_first}: First name of post author
 * - {comma}: Random comma (50% chance) for natural variation
 *
 * Example Templates:
 * - "Appreciate the insights" → "Appreciate the insights"
 * - "{author_first}, this is valuable" → "John, this is valuable"
 * - "Thanks for sharing{comma} {author_first}" → "Thanks for sharing John" OR "Thanks for sharing, John"
 */

window.TemplateGenerator = class TemplateGenerator {
  constructor() {
    this.templates = [];
    this.platform = 'facebook'; // Default platform
    this.defaultTemplates = {
      facebook: [
        "Great insight!",
        "Thanks for sharing this perspective",
        "This really resonates with me",
        "Valuable points here",
        "Appreciate you posting this",
        "Interesting take on this topic",
        "Well said!",
        "This adds a lot of value",
        "Love this perspective",
        "Thanks for the thoughtful post"
      ],
      linkedin: [
        "Great insight!",
        "Thanks for sharing this perspective",
        "This really resonates with me",
        "Valuable points here",
        "Appreciate you posting this",
        "Interesting take on this topic",
        "Well said!",
        "This adds a lot of value",
        "Love this perspective",
        "Thanks for the thoughtful post"
      ],
      twitter: [
        "Great point!",
        "Thanks for sharing",
        "This resonates",
        "Valuable insight",
        "Well said",
        "Interesting take",
        "Appreciate this",
        "Good perspective",
        "Love this",
        "Thoughtful thread"
      ],
      instagram: [
        "Love this!",
        "Amazing content",
        "This is great",
        "So inspiring",
        "Beautiful post",
        "Thanks for sharing",
        "Really appreciate this",
        "Well done",
        "This resonates",
        "Fantastic work"
      ],
      reddit: [
        "Great insight",
        "Thanks for sharing",
        "This is helpful",
        "Appreciate the perspective",
        "Well explained",
        "Interesting take",
        "Good points",
        "This adds value",
        "Thoughtful post",
        "Makes sense"
      ]
    };
  }

  /**
   * Set platform for template selection
   * @param {string} platform - Platform name (facebook, linkedin, etc.)
   */
  setPlatform(platform) {
    this.platform = platform || 'facebook';
  }

  /**
   * Set user-provided templates
   * @param {Array<string>} templates - Array of template strings
   */
  setTemplates(templates) {
    if (Array.isArray(templates) && templates.length > 0) {
      this.templates = templates.filter(t => t && t.trim().length > 0);
    } else {
      this.templates = [];
    }
  }

  /**
   * Get current templates (user or default for platform)
   * @returns {Array<string>}
   */
  getTemplates() {
    if (this.templates.length > 0) {
      return this.templates;
    }
    return this.defaultTemplates[this.platform] || this.defaultTemplates.facebook;
  }

  /**
   * Generate a comment from templates with placeholder substitution
   * @param {Object} context - Context for placeholder replacement
   * @param {string} context.authorName - Full name of post author
   * @returns {string} Generated comment
   */
  generateComment(context = {}) {
    const templates = this.getTemplates();
    const template = templates[Math.floor(Math.random() * templates.length)];

    return this.processTemplate(template, context);
  }

  /**
   * Process template placeholders
   * @param {string} template - Template string with placeholders
   * @param {Object} context - Context for replacement
   * @returns {string} Processed comment
   */
  processTemplate(template, context = {}) {
    let result = template;

    // {author_first} - Extract first name
    if (result.includes('{author_first}')) {
      const authorFirst = this.extractFirstName(context.authorName || '');
      result = result.replace(/{author_first}/g, authorFirst);
    }

    // {comma} - Optional comma (50% chance)
    if (result.includes('{comma}')) {
      const comma = Math.random() > 0.5 ? ',' : '';
      result = result.replace(/{comma}/g, comma);
    }

    return result;
  }

  /**
   * Extract first name from full name
   * @param {string} fullName - Full name string
   * @returns {string} First name or empty string
   */
  extractFirstName(fullName) {
    if (!fullName || typeof fullName !== 'string') {
      return '';
    }

    const trimmed = fullName.trim();
    if (!trimmed) {
      return '';
    }

    // Split by space and take first part
    const parts = trimmed.split(/\s+/);
    return parts[0];
  }

  /**
   * Load templates from Chrome storage for current platform
   * @returns {Promise<void>}
   */
  async loadFromStorage() {
    try {
      const result = await chrome.storage.sync.get(['platformComments']);
      if (result.platformComments && result.platformComments[this.platform]) {
        this.setTemplates(result.platformComments[this.platform]);
        console.log(`[TemplateGenerator] Loaded ${this.templates.length} user templates for ${this.platform}`);
      } else {
        this.setTemplates([]);
        console.log(`[TemplateGenerator] Using default templates for ${this.platform}`);
      }
    } catch (error) {
      console.error('[TemplateGenerator] Failed to load templates:', error);
      this.setTemplates([]);
    }
  }

  /**
   * Update templates (called when user saves new templates)
   * @param {Array<string>} templates - New template array
   */
  updateTemplates(templates) {
    this.setTemplates(templates);
    console.log(`[TemplateGenerator] Updated to ${this.templates.length} templates`);
  }
};
