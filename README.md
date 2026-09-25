# AI Builders Club: member projects

What members of the AI Builders Club at West Valley College are building:
**https://abc-wvc.github.io**

Every student has their own folder in `students/`, added by the student who made the work. The
club's main website is https://abc-wvc.pages.dev.

## Add your project

You can do all of this on github.com. No install, no git commands. About ten minutes.

1. Sign in to GitHub. A free account is fine. The buttons below only show up once you are signed in.
2. Open [`students/_template/profile.json`](students/_template/profile.json) and copy everything in it.
3. Go back to the top of this repository. Choose the **+** button next to the green **Code** button
   (on some screens it says **Add file**), then **Create new file**. If GitHub asks to make your own
   copy of this repository (a fork) first, choose **Fork this repository**.
4. For the name, type `students/your-handle/profile.json`. Your handle is lowercase letters, numbers
   and dashes, like `ada-l`. Paste what you copied.
5. Fill it in (the fields are explained below). Delete the lines you do not need. Adding a
   screenshot in step 7? Keep the `image` line and put your file's name in it, like `my-game.png`.
6. Choose the green **Commit changes...** button, then **Propose changes**. On the next page, choose
   **Create pull request**. If a title box opens, choose **Create pull request** again below it.
7. Optional: add a screenshot to the same pull request (PNG, JPG or WebP, under 500 KB).
   - On your pull request, choose your branch name near the top. It looks like `your-username:patch-1`.
   - Open `students/your-handle/`. Choose the **+** button (**Add file**), then **Upload files**.
   - On your computer, put the screenshot in a folder named `images`. Drag that folder onto the page.
   - Choose **Commit directly to the patch-1 branch** (your branch's name), then the green
     **Commit changes** button.

   A `README.md` with the longer story goes in the same way, with **Create new file** instead of
   **Upload files**. Copy the one in `students/_template/`.

An automatic check reads your folder and says exactly what to fix, if anything. Open the **Checks**
tab on your pull request to see it. The first time, the check waits until an officer starts it. An
officer then reviews and merges your pull request, and the site updates a few minutes later.

To change your folder later, open your `profile.json` on GitHub, choose the pencil icon, and then do
step 6 again. To take it down, open a pull request that deletes your folder, or ask an officer.

## The rules

- **Opt in only.** You add yourself. Nobody adds you, and nobody changes your folder but you.
- **Your name, your way.** Use the name you want the public to see. A first name and last initial,
  or a nickname, is fine.
- **Nothing private.** Never put a G number, email, phone number or address anywhere in your
  folder, including inside links. The check blocks the common ones; officers check the rest.
- **Your own work.** Screenshots and art you made. If you built it with a team, name them.
- **Links start with https://.**

## profile.json

| Field | Needed? | What it is |
|---|---|---|
| `name` | yes | The name shown on the card, up to 40 characters |
| `major` | no | Up to 60 characters |
| `about` | no | One or two sentences about you, up to 280 characters |
| `github` | no | Your GitHub username; the card links to it |
| `projects` | yes | One to six projects, each with the fields below |

Each project:

| Field | Needed? | What it is |
|---|---|---|
| `title` | yes | Up to 60 characters |
| `summary` | no | What it does and what you made it with, up to 200 characters |
| `link` | no | Where people can try it or see it |
| `code` | no | Where the code lives, usually its own GitHub repository |
| `image` | no | A file name in your folder's `images/`, like `screenshot.png` |
| `tags` | no | Up to five short words, like `agents` or `python` |

Keep each project's code in its own repository (yours, or one in the club organization) and link
it with `code`. This folder is the introduction; the repository is the project.

## For officers

- A student's first pull request says **Awaiting approval**, and its check does not run until you
  start it. Read **Files changed** first (nothing should touch `.github/`), then choose **Awaiting
  approval** and **Approve workflows to run**. It asks again after each change until the student's
  first pull request is merged. This is GitHub's default for first-time contributors.
- Review every pull request before merging: it is the student's own folder, nothing private is in
  it (read the text and the images), and the links go where they say.
- Merging publishes it. The page is built fresh from `main` each time.
- Preview on your computer: `node scripts/build.mjs`, then open `dist/index.html`.
- Tests: `npm test`. Change the club's own projects in `club.json`.

## How it works

`scripts/build.mjs` checks every folder in `students/` (skipping `_template`) and writes one static
page into `dist/`. A folder with any problem stops the build, so nothing is half published. The
page runs no scripts, escapes everything a student writes, only shows images stored here, and
carries a strict content security policy. Links to other websites open in a new tab, with a small
arrow and a hidden "(opens in a new tab)" for screen readers; links inside abc-wvc.github.io stay in
the same tab. GitHub Actions runs the check and tests on every pull
request and publishes to GitHub Pages on every merge to `main` (`.github/workflows/showcase.yml`).
