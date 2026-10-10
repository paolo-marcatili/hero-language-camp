import type { TrainingQuestion } from "@hero-lang/learning-engine";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isLearningAudioPlaying, playLearningAudio, unlockAudio } from "../audio";
import { QuestionCard } from "./QuestionCard";

vi.mock("../audio", () => ({ isLearningAudioPlaying: vi.fn(), playLearningAudio: vi.fn(), unlockAudio: vi.fn() }));

function makeQuestion(overrides: Partial<TrainingQuestion> & Pick<TrainingQuestion, "id">): TrainingQuestion {
  return {
    kind: "item",
    activity_type: "select_translation",
    skill: "vocabulary",
    stat: "strength",
    variant: "target_to_base",
    prompt: "Hund",
    prompt_hint: "Choose",
    options: [
      { id: "a", label: "dog" },
      { id: "b", label: "cat" }
    ],
    correct_option_id: "a",
    correct_answer_label: "dog",
    ...overrides
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const answer = (label: string) => screen.getByRole("button", { name: label }) as HTMLButtonElement;

describe("QuestionCard narration gate", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.mocked(isLearningAudioPlaying).mockReturnValue(false);
    vi.mocked(unlockAudio).mockResolvedValue(true);
    vi.mocked(playLearningAudio).mockReset();
  });
  afterEach(() => vi.useRealTimers());

  function setup() {
    const narration = deferred<boolean>();
    vi.mocked(playLearningAudio).mockReturnValueOnce(narration.promise);
    const onAudioStarted = vi.fn();
    const props = { language: "en", disabled: false, mode: "training" as const, index: 0, total: 2, onAnswer: vi.fn(), onAudioStarted };
    const a = makeQuestion({ id: "q-a" }); // no narration required, so audioStarted becomes true
    const b = makeQuestion({
      id: "q-b",
      requires_audio_before_answer: true,
      auto_narrate: true,
      instruction_audio_text: "Vælg ordet",
      instruction_audio_lang: "da-DK"
    });
    const view = render(<QuestionCard {...props} question={a} />);
    expect(answer("dog").disabled).toBe(false);
    view.rerender(<QuestionCard {...props} index={1} question={b} />); // no key: same instance, as in LevelPlacementPanel before the fix
    act(() => {
      vi.advanceTimersByTime(130);
    }); // auto_narrate fires after 120 ms
    expect(playLearningAudio).toHaveBeenCalledTimes(1);
    expect(answer("dog").disabled).toBe(true);
    return { narration, onAudioStarted };
  }

  it("enables answers once the next question's required narration finishes", async () => {
    const { narration } = setup();
    await act(async () => {
      narration.resolve(true);
    });
    expect(answer("dog").disabled).toBe(false); // FAILS on the old code, passes after the lane-7 fix
  });

  it("reports the first narration to the parent exactly once", async () => {
    const { narration, onAudioStarted } = setup();
    await act(async () => {
      narration.resolve(true);
    });
    expect(onAudioStarted).toHaveBeenCalledTimes(1);
  });
});
