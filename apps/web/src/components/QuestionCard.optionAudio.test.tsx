import type { TrainingQuestion } from "@hero-lang/learning-engine";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isLearningAudioPlaying, playLearningAudio, unlockAudio } from "../audio";
import { QuestionCard } from "./QuestionCard";

vi.mock("../audio", () => ({ isLearningAudioPlaying: vi.fn(), playLearningAudio: vi.fn(), unlockAudio: vi.fn() }));

const clip = {
  id: "letter_s_azure_neural",
  url: "/content-packs/da-foundations/audio/auto-neural/letter_s.mp3",
  source_type: "automated" as const,
  text: "æs",
  license: "test",
  review_status: "draft" as const
};

const question: TrainingQuestion = {
  kind: "grammar",
  activity_type: "listen_and_choose",
  skill: "comprehension",
  stat: "strength",
  variant: "letter_sound",
  id: "q",
  prompt: "👂",
  prompt_hint: "Find den første lyd.",
  options: [
    { id: "answer:s", label: "s", audio: [clip] },
    { id: "answer:7", label: "7" }
  ],
  correct_option_id: "answer:s",
  correct_answer_label: "s",
  option_audio_lang: "da-DK"
};

describe("QuestionCard option sound buttons", () => {
  beforeEach(() => {
    vi.mocked(isLearningAudioPlaying).mockReturnValue(false);
    vi.mocked(unlockAudio).mockResolvedValue(true);
    vi.mocked(playLearningAudio).mockReset();
    vi.mocked(playLearningAudio).mockResolvedValue(true);
  });

  it("plays the recorded clip of an option and keeps the label as the speech fallback text", () => {
    render(<QuestionCard language="da" disabled={false} mode="training" index={0} total={1} onAnswer={vi.fn()} question={question} />);
    fireEvent.click(screen.getByLabelText("🔊 s"));
    expect(playLearningAudio).toHaveBeenLastCalledWith([clip], "s", "da-DK");
  });

  it("uses browser speech only for options without a recording", () => {
    render(<QuestionCard language="da" disabled={false} mode="training" index={0} total={1} onAnswer={vi.fn()} question={question} />);
    fireEvent.click(screen.getByLabelText("🔊 7"));
    expect(playLearningAudio).toHaveBeenLastCalledWith([], "7", "da-DK");
  });
});
