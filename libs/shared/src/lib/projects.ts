/** Project contracts shared by apps/api and apps/web. */

export const PROJECT_NAME_MAX_LENGTH = 100;
export const PROJECT_DESCRIPTION_MAX_LENGTH = 2000;
export const PROJECT_KEY_MIN_LENGTH = 2;
export const PROJECT_KEY_MAX_LENGTH = 10;

/**
 * Uppercase letter, then uppercase letters/digits: "TF", "WEB2". Kept strict because
 * the key becomes part of task ids (TF-12) shown in URLs and commit messages.
 */
export const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;

export interface ProjectDto {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string | null;
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  key: string;
  description?: string | null;
}

/** Partial update. The key is deliberately not updatable. */
export interface UpdateProjectRequest {
  name?: string;
  /** `null` clears the description. */
  description?: string | null;
}

/**
 * Suggests a key from a project name: initials of the words, or the first letters
 * of a single word. "Team Flow web" -> "TFW", "Marketing" -> "MAR".
 * Returns '' when nothing usable is left (e.g. the name is only symbols).
 */
export function suggestProjectKey(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  // A key must start with a letter, so leading digits are dropped BEFORE shortening
  // ("2026roadmap" -> "ROA", not "202" -> "").
  const stripLeadingDigits = (s: string) => s.replace(/^[0-9]+/, '');
  const key =
    words.length > 1
      ? stripLeadingDigits(words.map((w) => w[0]).join('')).slice(
          0,
          PROJECT_KEY_MAX_LENGTH,
        )
      : stripLeadingDigits(words[0] ?? '').slice(0, 3);
  return key.length >= PROJECT_KEY_MIN_LENGTH ? key : '';
}
