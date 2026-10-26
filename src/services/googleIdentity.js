import api from './api';

let sdkPromise;
let challengePromise;
let challenge;
let initializedKey;
let credentialListener;

export function bindGoogleIdentity(google, { clientId, nonce, callback }) {
  const listener = { nonce, callback };
  credentialListener = listener;
  const key = `${clientId}:${nonce}`;
  if (initializedKey !== key) {
    google.initialize({
      client_id: clientId, nonce, ux_mode: 'popup', auto_select: false,
      callback: (response) => {
        if (credentialListener?.nonce === nonce) credentialListener.callback(response);
      },
    });
    initializedKey = key;
  }
  return () => { if (credentialListener === listener) credentialListener = undefined; };
}

export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const previous = document.getElementById('edumatch-google-identity');
    const script = previous || document.createElement('script');
    const timeout = setTimeout(() => finish(new Error('Chưa thể tải đăng nhập Google. Vui lòng thử lại.')), 12000);
    function finish(error) {
      clearTimeout(timeout);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      if (error) {
        script.remove();
        reject(error);
      } else resolve(window.google.accounts.id);
    }
    function onLoad() {
      finish(window.google?.accounts?.id ? null : new Error('Chưa thể khởi tạo đăng nhập Google.'));
    }
    function onError() {
      finish(new Error('Chưa thể tải đăng nhập Google. Vui lòng kiểm tra kết nối.'));
    }
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    if (!previous) {
      script.id = 'edumatch-google-identity';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    sdkPromise = undefined;
    throw error;
  });
  return sdkPromise;
}

// Share preparation across StrictMode's repeated mount and auth route changes.
export function getGoogleChallenge() {
  if (challenge && challenge.expiresAt > Date.now() + 10000) return Promise.resolve(challenge);
  if (!challengePromise) {
    challengePromise = api.get('/auth/google/challenge').then((response) => {
      if (!/^[a-f0-9]{64}$/.test(response?.nonce || '')) throw new Error('Chưa thể khởi tạo phiên đăng nhập Google.');
      challenge = { nonce: response.nonce, expiresAt: Date.now() + response.expires_in * 1000 };
      return challenge;
    }).finally(() => { challengePromise = undefined; });
  }
  return challengePromise;
}

export function clearGoogleChallenge() {
  challenge = undefined;
}
