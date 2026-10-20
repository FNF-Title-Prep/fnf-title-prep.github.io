# Colorado Title Insurance Exam Prep

A self-paced study site for the Colorado title insurance exam: a Guided Path, flashcards, quizzes, and full practice exams.

Open `index.html`, or visit the hosted site.

**Accounts.** The first screen is "Create your account" (work email + password). In the default local mode, each person's progress and stats are kept under their account on that computer, with a Manager view (unlocked by a code) listing everyone who studied there — no server needed. Switching to a free Supabase project makes progress follow people to any device: see [docs/ACCOUNTS.md](docs/ACCOUNTS.md) and `supabase/schema.sql`.

**Printable flashcards.** The Flashcards tab offers a PDF for each content area, the Colorado law class handout, and all areas together (4 cards to a page; print, cut, fold). The PDFs in `assets/pdf/` are built from the site's own cards by `node tools/flashcard-pdfs.js` (needs `npm i playwright`). Run it again after changing any flashcard, then commit the new PDFs.

`assets/fonts/` holds the Inter typeface (SIL Open Font License; see `assets/fonts/LICENSE-Inter.txt`).
