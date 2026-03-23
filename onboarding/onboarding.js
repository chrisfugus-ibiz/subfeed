// Mark onboarding as seen
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.local.set({ onboardingSeen: true, onboardingSeenAt: Date.now() });
}
