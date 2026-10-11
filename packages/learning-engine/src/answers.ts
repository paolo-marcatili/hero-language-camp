/** Only normalize typography. Do not accept arbitrary bag-of-words permutations. */
export function normalizeAnswer(value: string): string {
  return value.normalize("NFC").trim().toLowerCase().replace(/\s+/gu, " ")
    .replace(/[։.!?՞՜՛]+$/gu, "");
}

export function isCorrectAnswer(question: { correct_option_id: string; accepted_option_ids?: string[] }, answer: string): boolean {
  const normalized = normalizeAnswer(answer);
  return [question.correct_option_id, ...(question.accepted_option_ids ?? [])]
    .some((candidate) => normalizeAnswer(candidate) === normalized);
}
