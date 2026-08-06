/**
 * Course-level configuration shared by all learning applications.
 *
 * This package deliberately contains no React code and no references to a
 * specific learning engine. It defines the stable boundary between the shared
 * application shell and course-specific content/runtime adapters.
 */

export type CourseCapability =
  | "story"
  | "study-book"
  | "parent-progress"
  | "dictionary-editor"
  | "labyrinth"
  | "mathematics"
  | "shop"
  | "profiles";

/**
 * A translatable label with a required fallback.
 * Locale keys should use BCP 47 language tags such as `it`, `da`, or `en`.
 */
export interface LocalizedText {
  readonly default: string;
  readonly [locale: string]: string;
}

/**
 * A course-defined dimension shown in parent/learner progress reporting.
 * `itemKinds` are semantic identifiers interpreted by the course adapter.
 */
export interface ProgressDimensionDefinition {
  readonly id: string;
  readonly label: LocalizedText;
  readonly description?: LocalizedText;
  readonly itemKinds: readonly string[];
}

/**
 * Minimal metadata required by the shared shell.
 *
 * `TPack` is intentionally generic so Armenian and Danish can retain their
 * existing content-pack types while the framework is introduced gradually.
 */
export interface CourseDefinition<TPack = unknown> {
  readonly id: string;
  readonly route: string;
  readonly storageNamespace: string;
  readonly title: LocalizedText;
  readonly baseLanguage: string;
  readonly targetLanguage: string;
  readonly pack: TPack;
  readonly capabilities: readonly CourseCapability[];
  readonly progressDimensions: readonly ProgressDimensionDefinition[];
}

/** Preserve literal types while validating a course definition. */
export function defineCourse<TPack>(
  definition: CourseDefinition<TPack>
): CourseDefinition<TPack> {
  return definition;
}

export function courseHasCapability(
  course: Pick<CourseDefinition, "capabilities">,
  capability: CourseCapability
): boolean {
  return course.capabilities.includes(capability);
}

export function localizeText(
  text: LocalizedText,
  locale: string | undefined
): string {
  if (!locale) return text.default;

  const exact = text[locale];
  if (exact) return exact;

  const baseLocale = locale.split("-")[0];
  return text[baseLocale] ?? text.default;
}
