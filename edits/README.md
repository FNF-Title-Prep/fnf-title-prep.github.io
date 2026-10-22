# Edits: start here

This folder is the hand-off for future edits. Start a new Claude session on this
repository and say: "Read edits/README.md, then fix: <the problem>".

## The site

- Live link: https://fnf-title-prep.github.io
- Repository: FNF-Title-Prep/fnf-title-prep.github.io (moved from McflyMagic/co-title-exam)
- Publishes automatically from the `main` branch (GitHub Pages). A change is live about
  1 to 2 minutes after it is pushed to `main`.
- The whole site is one file: `index.html` (HTML, CSS and JavaScript together, no
  outside libraries). Images in `assets/img/`, font in `assets/fonts/`, printable
  flashcard PDFs in `assets/pdf/`.

## Owner and audience

- Owner: Martin Huff Jr. (Martin.Huffjr@fnf.com), Fidelity National Title, Grand Junction.
- Audience: new hires studying for the Colorado title insurance exam. The president of the
  company has the link.
- Exam facts used on the site: 75 questions, 75 minutes, 70% to pass. The real question
  pool is in the hundreds; some questions repeat and some are new. Do not claim exact
  question counts per area.

## Rules for every edit

1. Never mention where the questions came from, or any person's name, anywhere on the
   site, in commits or in file names.
2. Keep the copy short. No explanatory paragraphs; the site should explain itself.
3. Keep it clean and consistent with the current design (navy #1b2a4a, Inter font,
   spacing scale 4/8/12/16/24/32/48px).
4. Test on desktop and phone width (390px) before pushing. No sideways scrolling on phones.
5. After any flashcard change, rebuild the PDFs: `node tools/flashcard-pdfs.js`
   (needs `npm i playwright`), then commit the new files in `assets/pdf/`.
6. Push to `main`, then confirm the "pages build and deployment" run succeeded.
7. Report back to Martin in short, plain language, ending with what is needed from him.

## How the main parts work

- **Accounts (local mode):** `const CLOUD = { url:'local', ... }` near the top of the
  script. Sign-up needs an @fnf.com email; the name comes from the email
  (martin.huffjr@fnf.com becomes "Martin Huff Jr."). Progress is saved in that browser on
  that computer only. Details: `docs/ACCOUNTS.md`.
- **Manager view:** account menu, then "Manager view", code `martinhuff`. Lists everyone who
  has studied on that computer, with a Details panel for each person.
- **Sample new hire:** "Taylor Brooks" (taylor.brooks@example.com / Welcome2026!) is seeded
  so the Manager view is never empty. Turn off with `sample:false` in `CLOUD`.
- **Guided Path:** 10 steps. Step 1 is the big picture, steps 2 to 8 are the 7 content
  areas (lesson, flashcards, quiz at 80%), steps 9 and 10 are mock exams.
- **Tabs:** Guided Path, Flashcards, Quizzes, Mock Exam, My Progress, Quick Reference, Search.
- **Content lives in the script:** `CATS` (the 7 areas: lessons, flashcards, quizzes),
  `PRACTICE_QS` (exam-style questions), `GK_QUIZ`, and the Quick Reference tables.

## Known limits

- Progress does not follow a person to another computer or phone. To change that, switch
  to a free Supabase project (steps in `docs/ACCOUNTS.md`; the code is already written).
- Anyone with the link can open the site. Accounts are for tracking, not security.

## History of decisions (most recent last)

- Title: "Colorado Title Exam Prep". Fidelity National Title seal in the top-left corner.
- First screen is "Create your account"; small link at the bottom: "I don't want to track
  my progress (no account)". Email box placeholder: "@fnf.com".
- Hero line: "7 short lessons. Each section is a category from the test."
- Flashcard and quiz steps in the Guided Path show just a button, no instructions.
- Printable flashcard PDFs on the Flashcards tab: 4 cards per page, no card split across pages.
- Manual score-report entry on My Progress stays.
- Top bar spacing evened out on every screen size.
- Final walkthrough fixes: phone exam buttons, Manager Details panel on phones, full
  question grid on desktop.
- Moved to the free GitHub organization FNF-Title-Prep so the link is
  fnf-title-prep.github.io.
