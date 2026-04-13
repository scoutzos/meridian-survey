/**
 * Migrates localStorage answers from the old single-survey format
 * (key: "meridian_answers_${user}", question IDs: "0-0")
 * to the new multi-survey format
 * (key: "meridian_answers_${surveyId}_${user}", question IDs: "oa-0-0").
 *
 * Runs once per user. Idempotent — safe to call multiple times.
 */
export function migrateLocalStorage(user: string): void {
  const oldKey = `meridian_answers_${user}`;
  const newKey = `meridian_answers_operating-agreement_${user}`;
  const migrationFlag = `meridian_migrated_${user}`;

  // Already migrated
  if (localStorage.getItem(migrationFlag)) return;

  const oldData = localStorage.getItem(oldKey);
  if (!oldData) {
    // Nothing to migrate — mark done
    localStorage.setItem(migrationFlag, "1");
    return;
  }

  try {
    const parsed = JSON.parse(oldData) as Record<string, unknown>;
    const migrated: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(parsed)) {
      // If key already has oa- prefix, keep as-is
      if (key.startsWith("oa-")) {
        migrated[key] = value;
      } else {
        migrated[`oa-${key}`] = value;
      }
    }

    // Write new key (don't overwrite if it already has data)
    if (!localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, JSON.stringify(migrated));
    }

    // Remove old key
    localStorage.removeItem(oldKey);
    localStorage.setItem(migrationFlag, "1");
  } catch {
    // If parsing fails, just mark as done so we don't retry
    localStorage.setItem(migrationFlag, "1");
  }
}

/** Get the localStorage key for a specific survey and user */
export function getStorageKey(surveyId: string, user: string): string {
  return `meridian_answers_${surveyId}_${user}`;
}
