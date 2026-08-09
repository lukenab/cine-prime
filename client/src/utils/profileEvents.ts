export const PROFILE_UPDATED_EVENT = "cineprime:profile-updated";

export interface ProfileUpdatedDetail {
  accountId: string;
  avatarUrl: string | null;
}

export function publishProfileUpdated(detail: ProfileUpdatedDetail) {
  window.dispatchEvent(new CustomEvent<ProfileUpdatedDetail>(PROFILE_UPDATED_EVENT, { detail }));
}

