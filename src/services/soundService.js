import { Howl } from 'howler';

export const SOUND_PRESETS = [
  {
    id: 'apple-pay',
    name: 'Apple Pay (Ding-Ding đôi)',
    badge: 'Apple / Sang trọng',
    description: 'Âm thanh thanh toán của Apple, cực kỳ bắt tai, hiện đại và sang trọng.',
    file: '/sounds/apple-pay.mp3',
  },
  {
    id: 'custom-notification',
    name: 'Âm thanh thông báo (Tải lên)',
    badge: 'Tùy chỉnh',
    description: 'Âm thanh thông báo hệ thống được tải lên.',
    file: '/sounds/notification.wav',
  },
  {
    id: 'imessage',
    name: 'iMessage iPhone',
    badge: 'Apple iOS',
    description: 'Âm báo tin nhắn kinh điển của iPhone, quen thuộc và êm ái.',
    file: '/sounds/imessage.mp3',
  },
  {
    id: 'coin-ding',
    name: 'Ăn xu vàng Mario',
    badge: 'Nintendo / Game vui',
    description: 'Tiếng "Ting" nhặt đồng xu vàng vui nhộn, sảng khoái và cực kỳ cuốn hút.',
    file: '/sounds/coin-ding.mp3',
  },
  {
    id: 'bubble-pop',
    name: 'Bong bóng nảy',
    badge: 'Studio UI Pop',
    description: 'Tiếng nổ bong bóng thực tế, giòn tan, nhộn nhịp, cực vui tai khi nhận tin nhắn.',
    file: '/sounds/bubble-pop.mp3',
  },
  {
    id: 'success-chime',
    name: 'Giai điệu chiến thắng',
    badge: 'Chime tươi vui',
    description: 'Chuỗi hợp âm 3 nốt vui tươi, mang lại cảm giác tích cực và hào hứng.',
    file: '/sounds/success-chime.mp3',
  },
  {
    id: 'apple-ding',
    name: 'Chuông bạc Apple Ding',
    badge: 'Apple Mail',
    description: 'Tiếng gõ chuông bạc ngân vang thanh thoát, rõ ràng và lịch sự.',
    file: '/sounds/apple-ding.mp3',
  },
  {
    id: 'crystal-glass',
    name: 'Pha lê ngân (macOS Glass)',
    badge: 'macOS Studio',
    description: 'Tiếng gõ ly pha lê mộc mạc, trong vắt với độ ngân âm vang tự nhiên.',
    file: '/sounds/crystal-glass.wav',
  },
  {
    id: 'mac-hero',
    name: 'Khải hoàn (macOS Hero)',
    badge: 'macOS Fanfare',
    description: 'Giai điệu chào đón ngân vang rộn rã cho thông báo mới.',
    file: '/sounds/mac-hero.wav',
  },
];

const STORAGE_KEYS = {
  SOUND_ENABLED: 'edumatch:sound-enabled',
  SOUND_VOLUME: 'edumatch:sound-volume',
  MESSAGE_SOUND: 'edumatch:message-sound',
  NOTIFICATION_SOUND: 'edumatch:notification-sound',
};

const DEFAULT_SETTINGS = {
  enabled: true,
  volume: 0.9,
  messageSound: 'apple-pay',
  notificationSound: 'custom-notification',
};

// Cached Howl instances for zero latency
const howlCache = new Map();
const listeners = new Set();

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function loadSettings() {
  if (!isBrowser()) return { ...DEFAULT_SETTINGS };
  try {
    const enabledRaw = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
    const volumeRaw = localStorage.getItem(STORAGE_KEYS.SOUND_VOLUME);
    const messageSound = localStorage.getItem(STORAGE_KEYS.MESSAGE_SOUND) || DEFAULT_SETTINGS.messageSound;
    const notificationSound = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_SOUND) || DEFAULT_SETTINGS.notificationSound;

    const enabled = enabledRaw === null ? DEFAULT_SETTINGS.enabled : enabledRaw === 'true';
    const volume = volumeRaw === null ? DEFAULT_SETTINGS.volume : Math.max(0, Math.min(1, Number(volumeRaw) || DEFAULT_SETTINGS.volume));

    return {
      enabled,
      volume,
      messageSound: SOUND_PRESETS.some((p) => p.id === messageSound) ? messageSound : DEFAULT_SETTINGS.messageSound,
      notificationSound: SOUND_PRESETS.some((p) => p.id === notificationSound) ? notificationSound : DEFAULT_SETTINGS.notificationSound,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let currentSettings = loadSettings();

function getHowl(soundId) {
  if (!isBrowser()) return null;
  const preset = SOUND_PRESETS.find((p) => p.id === soundId) || SOUND_PRESETS[0];
  if (!howlCache.has(preset.id)) {
    const sound = new Howl({
      src: [preset.file],
      preload: true,
      html5: false, // Use Web Audio for zero-lag responsive playback
      volume: currentSettings.volume,
    });
    howlCache.set(preset.id, sound);
  }
  const instance = howlCache.get(preset.id);
  if (instance) {
    instance.volume(currentSettings.volume);
  }
  return instance;
}

export const soundService = {
  getPresets() {
    return SOUND_PRESETS;
  },

  getSettings() {
    return { ...currentSettings };
  },

  updateSettings(partial) {
    currentSettings = { ...currentSettings, ...partial };
    if (isBrowser()) {
      try {
        if (typeof partial.enabled === 'boolean') {
          localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(partial.enabled));
        }
        if (typeof partial.volume === 'number') {
          localStorage.setItem(STORAGE_KEYS.SOUND_VOLUME, String(partial.volume));
          // Update all loaded instances volume
          howlCache.forEach((howl) => howl.volume(currentSettings.volume));
        }
        if (partial.messageSound) {
          localStorage.setItem(STORAGE_KEYS.MESSAGE_SOUND, partial.messageSound);
        }
        if (partial.notificationSound) {
          localStorage.setItem(STORAGE_KEYS.NOTIFICATION_SOUND, partial.notificationSound);
        }
      } catch {
        // Silently tolerate storage errors
      }
    }
    listeners.forEach((fn) => {
      try {
        fn(currentSettings);
      } catch {
        // Listener error ignored
      }
    });
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Preview a sound regardless of mute setting (e.g. for user choosing in modal).
   */
  preview(soundId) {
    if (!isBrowser()) return;
    try {
      const sound = getHowl(soundId);
      if (sound) {
        sound.stop();
        sound.volume(currentSettings.volume);
        sound.play();
      }
    } catch {
      // Autoplay or audio error
    }
  },

  /**
   * Play the configured sound when an incoming chat message arrives.
   */
  playMessageSound() {
    if (!isBrowser() || !currentSettings.enabled) return;
    try {
      const sound = getHowl(currentSettings.messageSound);
      if (sound) {
        sound.stop();
        sound.volume(currentSettings.volume);
        sound.play();
      }
    } catch {
      // Suppress autoplay policy error
    }
  },

  /**
   * Play the configured sound when a general notification arrives.
   */
  playNotificationSound() {
    if (!isBrowser() || !currentSettings.enabled) return;
    try {
      const sound = getHowl(currentSettings.notificationSound);
      if (sound) {
        sound.stop();
        sound.volume(currentSettings.volume);
        sound.play();
      }
    } catch {
      // Suppress autoplay policy error
    }
  },
};
