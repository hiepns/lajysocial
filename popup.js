document.addEventListener('DOMContentLoaded', function () {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const testSeeMoreBtn = document.getElementById('testSeeMoreBtn');
  const testLikeBtn = document.getElementById('testLikeBtn');
  const testCommentBtn = document.getElementById('testCommentBtn');
  const testLinkedInExtractBtn = document.getElementById('testLinkedInExtractBtn');
  const supportBtn = document.getElementById('supportBtn');
  const supportQRContainer = document.getElementById('supportQRContainer');
  const statusDiv = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  const platformText = document.getElementById('platform-text');

  const scrollSpeedMinSlider = document.getElementById('scrollSpeedMin');
  const scrollSpeedMaxSlider = document.getElementById('scrollSpeedMax');
  const scrollSpeedValue = document.getElementById('scrollSpeedValue');
  const scrollSpeedMinValue = document.getElementById('scrollSpeedMinValue');
  const scrollSpeedMaxValue = document.getElementById('scrollSpeedMaxValue');

  const enableAutoLikeCheckbox = document.getElementById('enableAutoLike');
  const likeDelaySlider = document.getElementById('likeDelay');
  const likeDelayValue = document.getElementById('likeDelayValue');
  const likeProbabilitySlider = document.getElementById('likeProbability');
  const likeProbabilityValue = document.getElementById('likeProbabilityValue');

  const enableAutoCommentCheckbox = document.getElementById('enableAutoComment');
  const commentDelaySlider = document.getElementById('commentDelay');
  const commentDelayValue = document.getElementById('commentDelayValue');
  const commentProbabilitySlider = document.getElementById('commentProbability');
  const commentProbabilityValue = document.getElementById('commentProbabilityValue');

  const enableSeeMoreCheckbox = document.getElementById('enableSeeMore');
  const seeMoreDelaySlider = document.getElementById('seeMoreDelay');
  const seeMoreDelayValue = document.getElementById('seeMoreDelayValue');

  const langBtn = document.getElementById('langBtn');
  const themeBtn = document.getElementById('themeBtn');
  const modeBtn = document.getElementById('modeBtn');

  // LinkedIn-specific options
  const linkedinOptionsCard = document.getElementById('linkedinOptionsCard');
  const skipCompanyPagesCheckbox = document.getElementById('skipCompanyPages');
  const skipFriendActivitiesCheckbox = document.getElementById('skipFriendActivities');
  const timeFilterEnabledCheckbox = document.getElementById('timeFilterEnabled');
  const maxPostAgeInput = document.getElementById('maxPostAge');
  const maxPostAgeValue = document.getElementById('maxPostAgeValue');

  const commentTemplatesTextarea = document.getElementById('commentTemplates');
  const saveTemplatesBtn = document.getElementById('saveTemplatesBtn');

  const freeModeSection = document.getElementById('freeModeSection');
  const proModeSection = document.getElementById('proModeSection');
  const personaSelect = document.getElementById('personaSelect');
  const customPresetSection = document.getElementById('customPresetSection');
  const savePresetBtn = document.getElementById('savePresetBtn');
  const currentPlatformSpan = document.getElementById('currentPlatform');

  let currentTab = null;
  let currentLang = 'en';
  let currentTheme = 'light';
  let currentMode = 'free';
  let currentPlatform = 'facebook';

  const translations = {
    en: {
      title: "Engagency",
      startBtn: "Start Surfing",
      stopBtn: "Stop",
      statusActive: "Active - Auto Surfing",
      statusInactive: "Inactive",
      detectingPlatform: "Detecting platform...",
      platform: "Platform",
      contentScriptNotLoaded: "Content script not loaded",
      pleaseRefresh: "Please refresh the page",
      platformNotSupported: "Platform not supported",
      autoScrolling: "Auto Scrolling",
      expandContent: "Expand Content",
      autoLike: "Auto Like",
      autoComment: "Auto Comment",
      testingTools: "Testing Tools",
      scrollSpeedRange: "Scroll Speed Range",
      clickDelay: "Click Delay",
      likeDelay: "Like Delay",
      likeProbability: "Like Probability",
      commentDelay: "Comment Delay",
      commentProbability: "Comment Probability",
      min: "Min",
      max: "Max",
      fasterSlower: "Faster ← → Slower",
      moreFrequent: "More Frequent ← → Less Frequent",
      neverAlways: "Never ← → Always",
      testSeeMore: 'Test "See More"',
      testLike: 'Test "Like Post"',
      testComment: 'Test "Comment"',
      commentTemplates: "Comment Templates",
      templateInstructions: "Enter your comment templates (one per line)",
      templateTip: "💡 Use {author_first} for first name, {comma} for optional comma",
      saveTemplates: "Save Templates",
      templatesSaved: "Templates saved!",
      supportMe: "Support Me",
      buyMeAPhin: "Buy me a phin ☕",
      hideQRCode: "Thank YOU so much",
      linkedinOptions: "LinkedIn Options",
      skipCompanyPages: "Skip Company Pages",
      skipFriendActivities: "Skip Friend Activities",
      timeFilterEnabled: "Time Filter",
      maxPostAge: "Max Post Age",
      maxPostAgeHint: "Only engage with posts newer than this (in hours)"
    },
    vi: {
      title: "Lướt Tự Động",
      startBtn: "Bắt Đầu",
      stopBtn: "Dừng",
      statusActive: "Ai đang lướt mệt rã rời 😪",
      statusInactive: "Tool Ai đã sẵn sàng!! Ấn nút Bắt đầu để lướt hoy",
      detectingPlatform: "Đang nhận diện nền tảng...",
      platform: "Nền tảng",
      contentScriptNotLoaded: "Vội thế! Chưa tải xong web đã mở tool rồi",
      pleaseRefresh: "Làm ơn F5/tải lại web giùm tui",
      platformNotSupported: "Nền tảng không được hỗ trợ",
      autoScrolling: "Tự lướt",
      expandContent: "Tự ấn xem thêm",
      autoLike: "Tự thả tim",
      autoComment: "Bình Luận Tự Động",
      testingTools: "Công Cụ Kiểm Tra",
      scrollSpeedRange: "Phạm Vi Tốc Độ Cuộn",
      clickDelay: "Độ Trễ Click",
      likeDelay: "Độ Trễ Thích",
      likeProbability: "Xác Suất Thích",
      commentDelay: "Độ Trễ Bình Luận",
      commentProbability: "Xác Suất Bình Luận",
      min: "Tối thiểu",
      max: "Tối đa",
      fasterSlower: "Nhanh hơn ← → Chậm hơn",
      moreFrequent: "Thường xuyên hơn ← → Ít hơn",
      neverAlways: "Không bao giờ ← → Luôn luôn",
      testSeeMore: 'test Xem thêm',
      testLike: 'test Tự thả like',
      testComment: 'test Tự bình luận',
      commentTemplates: "Mẫu Bình Luận",
      templateInstructions: "✍️ Mẫu bình luận của bạn (mỗi dòng 1 mẫu)",
      templateTip: "💡 Dùng {author_first} cho tên, {comma} cho dấu phẩy tùy chọn",
      saveTemplates: "Lưu Mẫu",
      templatesSaved: "Đã lưu!",
      supportMe: "Ủng Hộ Tui",
      buyMeAPhin: "Ủng hộ tui ly phin ☕",
      hideQRCode: "Xin cảm ơn rất nhiều",
      linkedinOptions: "Tùy Chọn LinkedIn",
      skipCompanyPages: "Bỏ Qua Trang Công Ty",
      skipFriendActivities: "Bỏ Qua Hoạt Động Bạn Bè",
      timeFilterEnabled: "Lọc Theo Thời Gian",
      maxPostAge: "Tuổi Bài Viết Tối Đa",
      maxPostAgeHint: "Chỉ tương tác với bài viết mới hơn mức này (tính bằng giờ)"
    }
  };

  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function updateStatus() {
    const t = translations[currentLang];

    try {
      currentTab = await getCurrentTab();

      const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'getStatus' });

      if (response.isActive) {
        statusDiv.className = 'status active';
        statusText.textContent = t.statusActive;
        startBtn.disabled = true;
        stopBtn.disabled = false;
      } else {
        statusDiv.className = 'status inactive';
        statusText.textContent = t.statusInactive;
        startBtn.disabled = false;
        stopBtn.disabled = true;
      }

      if (response.platform) {
        currentPlatform = response.platform;
        platformText.textContent = `${t.platform}: ${response.platform.charAt(0).toUpperCase() + response.platform.slice(1)}`;
        currentPlatformSpan.textContent = response.platform.charAt(0).toUpperCase() + response.platform.slice(1);

        // Load platform-specific comments
        loadPlatformComments(currentPlatform);

        // Show/hide LinkedIn-specific options
        if (currentPlatform === 'linkedin') {
          linkedinOptionsCard.style.display = 'block';
        } else {
          linkedinOptionsCard.style.display = 'none';
        }
      } else {
        platformText.textContent = t.platformNotSupported;
        startBtn.disabled = true;
        linkedinOptionsCard.style.display = 'none';
      }
    } catch (error) {
      statusDiv.className = 'status inactive';
      statusText.textContent = t.contentScriptNotLoaded;
      platformText.textContent = t.pleaseRefresh;
      startBtn.disabled = true;
      stopBtn.disabled = true;
    }
  }

  function toggleMode() {
    currentMode = currentMode === 'free' ? 'pro' : 'free';

    if (currentMode === 'pro') {
      modeBtn.textContent = 'PRO';
      modeBtn.style.background = 'var(--accent-primary)';
      modeBtn.style.color = '#fff';
      freeModeSection.style.display = 'none';
      proModeSection.style.display = 'block';
    } else {
      modeBtn.textContent = 'FREE';
      modeBtn.style.background = 'rgba(255, 255, 255, 0.4)';
      modeBtn.style.color = 'var(--text-primary)';
      freeModeSection.style.display = 'block';
      proModeSection.style.display = 'none';
    }

    chrome.storage.sync.set({ mode: currentMode });
  }

  function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';

    if (currentTheme === 'dark') {
      document.body.classList.add('dark-mode');
      themeBtn.textContent = '☀️';
    } else {
      document.body.classList.remove('dark-mode');
      themeBtn.textContent = '🌙';
    }

    chrome.storage.sync.set({ theme: currentTheme });
  }

  function updateLanguage() {
    const t = translations[currentLang];

    // Update title and buttons
    document.getElementById('title').textContent = `🌊 ${t.title}`;
    startBtn.textContent = t.startBtn;
    stopBtn.textContent = t.stopBtn;

    // Update card headers
    document.getElementById('autoScrollingLabel').textContent = t.autoScrolling;
    document.getElementById('expandContentLabel').textContent = t.expandContent;
    document.getElementById('autoLikeLabel').textContent = t.autoLike;
    document.getElementById('autoCommentLabel').textContent = t.autoComment;
    document.getElementById('testingToolsLabel').textContent = t.testingTools;
    document.getElementById('supportLabel').textContent = t.supportMe;

    // Update support button text based on current state
    if (supportQRContainer.style.display === 'none') {
      supportBtn.textContent = t.buyMeAPhin;
    } else {
      supportBtn.textContent = t.hideQRCode;
    }

    // Update labels
    document.getElementById('scrollSpeedRangeLabel').textContent = t.scrollSpeedRange;
    document.getElementById('minLabel').textContent = t.min;
    document.getElementById('maxLabel').textContent = t.max;
    document.getElementById('clickDelayLabel').textContent = t.clickDelay;
    document.getElementById('fasterSlowerLabel').textContent = t.fasterSlower;
    document.getElementById('likeDelayLabel').textContent = t.likeDelay;
    document.getElementById('likeProbabilityLabel').textContent = t.likeProbability;
    document.getElementById('moreFrequentLabel1').textContent = t.moreFrequent;
    document.getElementById('neverAlwaysLabel1').textContent = t.neverAlways;
    document.getElementById('commentDelayLabel').textContent = t.commentDelay;
    document.getElementById('commentProbabilityLabel').textContent = t.commentProbability;
    document.getElementById('moreFrequentLabel2').textContent = t.moreFrequent;
    document.getElementById('neverAlwaysLabel2').textContent = t.neverAlways;

    // Update test buttons
    testSeeMoreBtn.textContent = t.testSeeMore;
    testLikeBtn.textContent = t.testLike;
    testCommentBtn.textContent = t.testComment;

    // Update template labels
    document.getElementById('templateInstructionsLabel').textContent = t.templateInstructions;
    document.getElementById('templateTipLabel').textContent = t.templateTip;
    document.getElementById('saveTemplatesLabel').textContent = t.saveTemplates;

    // Update LinkedIn options labels
    document.getElementById('linkedinOptionsLabel').textContent = t.linkedinOptions;
    document.getElementById('skipCompanyPagesLabel').textContent = t.skipCompanyPages;
    document.getElementById('skipFriendActivitiesLabel').textContent = t.skipFriendActivities;
    document.getElementById('timeFilterEnabledLabel').textContent = t.timeFilterEnabled;
    document.getElementById('maxPostAgeLabel').textContent = t.maxPostAge;
    document.getElementById('maxPostAgeHint').textContent = t.maxPostAgeHint;

    // Update status text if needed
    updateStatus();
  }

  function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'vi' : 'en';
    langBtn.textContent = currentLang === 'en' ? '🇻🇳' : 'EN';
    updateLanguage();
    chrome.storage.sync.set({ language: currentLang });
  }

  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['surfSettings', 'theme', 'language', 'mode', 'platformComments', 'proModeSettings']);

      if (result.theme) {
        currentTheme = result.theme;
        if (currentTheme === 'dark') {
          document.body.classList.add('dark-mode');
          themeBtn.textContent = '☀️';
        } else {
          document.body.classList.remove('dark-mode');
          themeBtn.textContent = '🌙';
        }
      }

      if (result.language) {
        currentLang = result.language;
        langBtn.textContent = currentLang === 'en' ? '🇻🇳' : 'EN';
        updateLanguage();
      }

      if (result.mode) {
        currentMode = result.mode;
        if (currentMode === 'pro') {
          modeBtn.textContent = 'PRO';
          modeBtn.style.background = 'var(--accent-primary)';
          modeBtn.style.color = '#fff';
          freeModeSection.style.display = 'none';
          proModeSection.style.display = 'block';
        }
      }

      if (result.surfSettings) {
        const settings = result.surfSettings;
        scrollSpeedMinSlider.value = settings.scrollSpeedMin || 2000;
        scrollSpeedMaxSlider.value = settings.scrollSpeedMax || 4000;

        enableAutoLikeCheckbox.checked = settings.enableAutoLike || false;
        likeDelaySlider.value = settings.likeDelay || 5000;
        likeProbabilitySlider.value = settings.likeProbability || 70;

        enableAutoCommentCheckbox.checked = settings.enableAutoComment || false;
        commentDelaySlider.value = settings.commentDelay || 8000;
        commentProbabilitySlider.value = settings.commentProbability || 30;

        enableSeeMoreCheckbox.checked = settings.enableSeeMore || false;
        seeMoreDelaySlider.value = settings.seeMoreDelay || 2000;

        // LinkedIn-specific settings
        skipCompanyPagesCheckbox.checked = settings.skipCompanyPages !== undefined ? settings.skipCompanyPages : true;
        skipFriendActivitiesCheckbox.checked = settings.skipFriendActivities !== undefined ? settings.skipFriendActivities : true;
        timeFilterEnabledCheckbox.checked = settings.timeFilterEnabled !== undefined ? settings.timeFilterEnabled : true;
        maxPostAgeInput.value = settings.maxPostAge || 72;

        updateSliderValues();
      }

      if (result.proModeSettings) {
        const proSettings = result.proModeSettings;
        if (proSettings.persona) {
          personaSelect.value = proSettings.persona;
        }
      }
    } catch (error) {
      console.log('Could not load settings');
    }
  }

  async function loadPlatformComments(platform) {
    try {
      const result = await chrome.storage.sync.get(['platformComments']);

      if (result.platformComments && result.platformComments[platform]) {
        commentTemplatesTextarea.value = result.platformComments[platform].join('\n');
      } else {
        // Keep the default visible text from HTML if no saved comments
        // Don't override the textarea content on first load
      }
    } catch (error) {
      console.log('Could not load platform comments');
    }
  }

  function updateSliderValues() {
    const minSpeed = parseInt(scrollSpeedMinSlider.value);
    const maxSpeed = parseInt(scrollSpeedMaxSlider.value);

    if (minSpeed > maxSpeed) {
      scrollSpeedMaxSlider.value = minSpeed;
    }

    scrollSpeedMinValue.textContent = (scrollSpeedMinSlider.value / 1000) + 's';
    scrollSpeedMaxValue.textContent = (scrollSpeedMaxSlider.value / 1000) + 's';
    scrollSpeedValue.textContent = (scrollSpeedMinSlider.value / 1000) + 's - ' + (scrollSpeedMaxSlider.value / 1000) + 's';
    likeDelayValue.textContent = (likeDelaySlider.value / 1000) + 's';
    likeProbabilityValue.textContent = likeProbabilitySlider.value + '%';
    commentDelayValue.textContent = (commentDelaySlider.value / 1000) + 's';
    commentProbabilityValue.textContent = commentProbabilitySlider.value + '%';
    seeMoreDelayValue.textContent = (seeMoreDelaySlider.value / 1000) + 's';

    // Update LinkedIn max post age display
    const hours = parseInt(maxPostAgeInput.value);
    maxPostAgeValue.textContent = hours + ' hour' + (hours !== 1 ? 's' : '');
  }

  async function saveSettings() {
    const settings = {
      scrollSpeedMin: parseInt(scrollSpeedMinSlider.value),
      scrollSpeedMax: parseInt(scrollSpeedMaxSlider.value),
      enableAutoLike: enableAutoLikeCheckbox.checked,
      likeDelay: parseInt(likeDelaySlider.value),
      likeProbability: parseInt(likeProbabilitySlider.value),
      enableAutoComment: enableAutoCommentCheckbox.checked,
      commentDelay: parseInt(commentDelaySlider.value),
      commentProbability: parseInt(commentProbabilitySlider.value),
      enableSeeMore: enableSeeMoreCheckbox.checked,
      seeMoreDelay: parseInt(seeMoreDelaySlider.value),
      // LinkedIn-specific settings
      skipCompanyPages: skipCompanyPagesCheckbox.checked,
      skipFriendActivities: skipFriendActivitiesCheckbox.checked,
      timeFilterEnabled: timeFilterEnabledCheckbox.checked,
      maxPostAge: parseInt(maxPostAgeInput.value)
    };

    try {
      await chrome.storage.sync.set({ surfSettings: settings });

      if (currentTab) {
        chrome.tabs.sendMessage(currentTab.id, {
          action: 'updateSettings',
          settings: settings
        });
      }
    } catch (error) {
      console.log('Could not save settings');
    }
  }

  async function saveTemplates() {
    const templates = commentTemplatesTextarea.value
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    try {
      // Get existing platform comments
      const result = await chrome.storage.sync.get(['platformComments']);
      const platformComments = result.platformComments || {};

      // Update comments for current platform
      platformComments[currentPlatform] = templates;

      await chrome.storage.sync.set({ platformComments: platformComments });

      // Show success feedback
      const originalText = saveTemplatesBtn.textContent;
      saveTemplatesBtn.textContent = translations[currentLang].templatesSaved || 'Saved!';
      saveTemplatesBtn.style.background = '#4CAF50';
      setTimeout(() => {
        saveTemplatesBtn.textContent = originalText;
        saveTemplatesBtn.style.background = 'var(--accent-secondary)';
      }, 2000);

      // Send to content script
      if (currentTab) {
        chrome.tabs.sendMessage(currentTab.id, {
          action: 'updateTemplates',
          platform: currentPlatform,
          templates: templates
        });
      }
    } catch (error) {
      console.log('Could not save templates');
    }
  }

  startBtn.addEventListener('click', async function () {
    if (currentTab) {
      chrome.tabs.sendMessage(currentTab.id, { action: 'start' });
      setTimeout(updateStatus, 500);
    }
  });

  stopBtn.addEventListener('click', async function () {
    if (currentTab) {
      chrome.tabs.sendMessage(currentTab.id, { action: 'stop' });
      setTimeout(updateStatus, 500);
    }
  });

  testSeeMoreBtn.addEventListener('click', async function () {
    if (currentTab) {
      chrome.tabs.sendMessage(currentTab.id, { action: 'testSeeMore' });
    }
  });

  testLikeBtn.addEventListener('click', async function () {
    if (currentTab) {
      chrome.tabs.sendMessage(currentTab.id, { action: 'testLike' });
    }
  });

  testCommentBtn.addEventListener('click', async function () {
    if (currentTab) {
      chrome.tabs.sendMessage(currentTab.id, { action: 'testComment' });
    }
  });

  testLinkedInExtractBtn.addEventListener('click', async function () {
    if (currentTab) {
      chrome.tabs.sendMessage(currentTab.id, { action: 'testLinkedInExtract' });
    }
  });

  supportBtn.addEventListener('click', function () {
    const t = translations[currentLang];
    // Toggle QR code visibility
    if (supportQRContainer.style.display === 'none') {
      supportQRContainer.style.display = 'block';
      supportBtn.textContent = t.hideQRCode;
    } else {
      supportQRContainer.style.display = 'none';
      supportBtn.textContent = t.buyMeAPhin;
    }
  });

  scrollSpeedMinSlider.addEventListener('input', function () {
    updateSliderValues();
    saveSettings();
  });

  scrollSpeedMaxSlider.addEventListener('input', function () {
    updateSliderValues();
    saveSettings();
  });

  enableAutoLikeCheckbox.addEventListener('change', function () {
    saveSettings();
  });

  likeDelaySlider.addEventListener('input', function () {
    updateSliderValues();
    saveSettings();
  });

  likeProbabilitySlider.addEventListener('input', function () {
    updateSliderValues();
    saveSettings();
  });

  enableAutoCommentCheckbox.addEventListener('change', function () {
    saveSettings();
  });

  commentDelaySlider.addEventListener('input', function () {
    updateSliderValues();
    saveSettings();
  });

  commentProbabilitySlider.addEventListener('input', function () {
    updateSliderValues();
    saveSettings();
  });

  enableSeeMoreCheckbox.addEventListener('change', function () {
    saveSettings();
  });

  seeMoreDelaySlider.addEventListener('input', function () {
    updateSliderValues();
    saveSettings();
  });

  saveTemplatesBtn.addEventListener('click', saveTemplates);

  modeBtn.addEventListener('click', toggleMode);
  langBtn.addEventListener('click', toggleLanguage);
  themeBtn.addEventListener('click', toggleTheme);

  personaSelect.addEventListener('change', function() {
    if (personaSelect.value === 'custom') {
      customPresetSection.style.display = 'block';
    } else {
      customPresetSection.style.display = 'none';
    }

    // Save persona selection
    chrome.storage.sync.get(['proModeSettings'], function(result) {
      const proSettings = result.proModeSettings || {};
      proSettings.persona = personaSelect.value;
      chrome.storage.sync.set({ proModeSettings: proSettings });
    });
  });

  savePresetBtn.addEventListener('click', async function() {
    const presetName = document.getElementById('presetName').value.trim();
    const presetReference = document.getElementById('presetReference').value.trim();

    if (!presetName || !presetReference) {
      alert('Please provide both preset name and reference comments');
      return;
    }

    try {
      const result = await chrome.storage.sync.get(['proModeSettings']);
      const proSettings = result.proModeSettings || {};

      proSettings.customPresets = proSettings.customPresets || [];
      proSettings.customPresets.push({
        name: presetName,
        reference: presetReference
      });

      await chrome.storage.sync.set({ proModeSettings: proSettings });

      // Show success feedback
      const originalText = savePresetBtn.textContent;
      savePresetBtn.textContent = 'Preset Saved!';
      savePresetBtn.style.background = '#4CAF50';
      setTimeout(() => {
        savePresetBtn.textContent = originalText;
        savePresetBtn.style.background = 'var(--accent-primary)';
      }, 2000);
    } catch (error) {
      console.log('Could not save preset');
    }
  });

  // LinkedIn-specific option event listeners
  skipCompanyPagesCheckbox.addEventListener('change', function() {
    saveSettings();
  });

  skipFriendActivitiesCheckbox.addEventListener('change', function() {
    saveSettings();
  });

  timeFilterEnabledCheckbox.addEventListener('change', function() {
    saveSettings();
  });

  maxPostAgeInput.addEventListener('input', function() {
    updateSliderValues();
    saveSettings();
  });

  loadSettings();
  updateStatus();
});