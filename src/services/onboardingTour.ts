const TOUR_COMPLETE_KEY = "oyi_onboarding_tour_complete";
const TOUR_PENDING_KEY = "oyi_onboarding_tour_pending";

function write(key: string, value: string) {
  try {
    if (typeof window !== "undefined") localStorage.setItem(key, value);
  } catch {}
}

function remove(key: string) {
  try {
    if (typeof window !== "undefined") localStorage.removeItem(key);
  } catch {}
}

export function markOnboardingTourPending() {
  write(TOUR_PENDING_KEY, "1");
}

export function completeOnboardingTour() {
  write(TOUR_COMPLETE_KEY, new Date().toISOString());
  remove(TOUR_PENDING_KEY);
}

export function replayOnboardingTour() {
  remove(TOUR_COMPLETE_KEY);
  write(TOUR_PENDING_KEY, "1");
}

export function isOnboardingTourComplete() {
  try {
    return typeof window !== "undefined" && Boolean(localStorage.getItem(TOUR_COMPLETE_KEY));
  } catch {
    return false;
  }
}
