export const ANNOUNCEMENT_DISMISSED_KEY = 'studentnest-more-accommodations-dismissed';

export const hasDismissedAnnouncement = (storage) => (
  storage.getItem(ANNOUNCEMENT_DISMISSED_KEY) === 'true'
);

export const rememberAnnouncementDismissal = (storage) => {
  storage.setItem(ANNOUNCEMENT_DISMISSED_KEY, 'true');
};
