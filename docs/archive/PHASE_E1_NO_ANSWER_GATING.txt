Danish Foundations Phase E.1 - no answer gating

Changes:
- Narration starts automatically but never disables answer controls.
- Visual and auditory questions can be answered immediately.
- The replay button remains optional.
- The fight speed-bonus timer may still wait for initial audio; correctness never does.

Apply from the repository root:

  unzip -o ~/Downloads/danish-foundations-phase-e1-no-answer-gating.zip -d .
  npm run check:danish
  GITHUB_PAGES=true GITHUB_PAGES_BASE=/danish-foundations/ npm run build:danish
  git add apps/web/src/components/QuestionCard.tsx apps/danish-foundations/src/App.tsx
  git commit -m "Allow answers during Danish narration"
  git push origin main
  git push danish main
