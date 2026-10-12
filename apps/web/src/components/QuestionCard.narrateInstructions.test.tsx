import type { TrainingQuestion } from "@hero-lang/learning-engine";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isLearningAudioPlaying, playLearningAudio, unlockAudio } from "../audio";
import { QuestionCard } from "./QuestionCard";

vi.mock("../audio", () => ({ isLearningAudioPlaying: vi.fn(), playLearningAudio: vi.fn(), unlockAudio: vi.fn() }));

function makeQuestion(overrides: Partial<TrainingQuestion>): TrainingQuestion {
  return {
    kind: "item",
    activity_type: "listen_and_choose",
    skill: "vocabulary",
    stat: "strength",
    variant: "target_to_base",
    id: "q",
    prompt: "Hund",
    prompt_hint: "Choose",
    options: [
      { id: "a", label: "dog" },
      { id: "b", label: "cat" }
    ],
    correct_option_id: "a",
    correct_answer_label: "dog",
    auto_narrate: true,
    instruction_audio_text: "Vælg ordet",
    instruction_audio_lang: "da-DK",
    ...overrides
  };
}

const withTarget = { auto_play_target_audio: true, replay_target_audio: true, target_audio_text: "hund", target_audio_lang: "da-DK" };
const baseProps = { language: "en", disabled: false, mode: "training" as const, index: 0, total: 2, onAnswer: vi.fn() };

function spokenTexts(): Array<string | undefined> {
  return vi.mocked(playLearningAudio).mock.calls.map((call) => call[1]);
}

async function autoplay(narrateInstructions: boolean | undefined, question: TrainingQuestion) {
  render(<QuestionCard {...baseProps} narrateInstructions={narrateInstructions} question={question} />);
  await act(async () => {
    vi.advanceTimersByTime(130);
  });
}

describe("QuestionCard spoken-instruction toggle", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.mocked(isLearningAudioPlaying).mockReturnValue(false);
    vi.mocked(unlockAudio).mockResolvedValue(true);
    vi.mocked(playLearningAudio).mockReset();
    vi.mocked(playLearningAudio).mockResolvedValue(true);
  });
  afterEach(() => vi.useRealTimers());

  it("speaks the instruction and the target when the toggle is on", async () => {
    await autoplay(true, makeQuestion(withTarget));
    expect(spokenTexts()).toEqual(["Vælg ordet", "hund"]);
  });

  it("speaks the instruction and the target by default (prop omitted)", async () => {
    await autoplay(undefined, makeQuestion(withTarget));
    expect(spokenTexts()).toEqual(["Vælg ordet", "hund"]);
  });

  it("skips only the instruction when the toggle is off and a target plays", async () => {
    await autoplay(false, makeQuestion(withTarget));
    expect(spokenTexts()).toEqual(["hund"]);
  });

  it("still speaks an instruction-only question when the toggle is off", async () => {
    await autoplay(false, makeQuestion({}));
    expect(spokenTexts()).toEqual(["Vælg ordet"]);
  });

  it("unlocks the answers after a skipped instruction", async () => {
    await autoplay(false, makeQuestion({ ...withTarget, requires_audio_before_answer: true }));
    expect((screen.getByRole("button", { name: "dog" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("the replay button speaks the instruction even when the toggle is off", async () => {
    const view = render(<QuestionCard {...baseProps} narrateInstructions={false} question={makeQuestion(withTarget)} />);
    await act(async () => {
      vi.advanceTimersByTime(130);
    });
    vi.mocked(playLearningAudio).mockClear();
    const replay = view.container.querySelector(".instruction-audio-button") as HTMLButtonElement;
    expect(replay).not.toBeNull();
    await act(async () => {
      fireEvent.click(replay);
    });
    expect(spokenTexts()[0]).toBe("Vælg ordet");
  });
});
