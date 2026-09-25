# AI Builders Club: member projects

What members of the AI Builders Club at West Valley College are building:
**https://abc-wvc.github.io**

Every student has their own folder in `students/`, added by the student who made the work. The
club's main website is https://abc-wvc.pages.dev.

## Add your project

You can do all of this on github.com. No install, no git commands. About ten minutes.

1. Sign in to GitHub. A free account is fine.
2. Open [`students/_template/profile.json`](students/_template/profile.json) and copy everything in it.
3. Go back to the top of this repository and choose **Add file**, then **Create new file**.
4. For the name, type `students/your-handle/profile.json`. Your handle is lowercase letters, numbers
   and dashes, like `ada-l`. Paste what you copied. GitHub offers to make your own copy (a fork) of
   this repository first; say yes.
5. Fill it in (the fields are explained below). Delete the lines you do not need.
6. Optional: add a screenshot with **Add file**, **Upload files**, into `students/your-handle/images/`
   (PNG, JPG or WebP, under 500 KB). Optional: a `README.md` in your folder with the longer story;
   copy the one in `students/_template/`.
7. Choose **Propose changes**, then **Create pull request**. An automatic check runs in a minute and
   tells you exactly what to fix, if anything. An officer then reviews and merges it, and the site
   updates a few minutes later.

To change your folder later, open your `profile.json` on GitHub and choose the pencil. To take it
down, open a pull request that deletes your folder, or ask an officer.

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

- Review every pull request before merging: it is the student's own folder, nothing private is in
  it (read the text and the images), and the links go where they say.
- Merging publishes it. The page is built fresh from `main` each time.
- Preview on your computer: `node scripts/build.mjs`, then open `dist/index.html`.
- Tests: `npm test`. Change the club's own projects in `club.json`.

## How it works

`scripts/build.mjs` checks every folder in `students/` (skipping `_template`) and writes one static
page into `dist/`. A folder with any problem stops the build, so nothing is half published. The
page runs no scripts, escapes everything a student writes, only shows images stored here, and
carries a strict content security policy. GitHub Actions runs the check and tests on every pull
request and publishes to GitHub Pages on every merge to `main` (`.github/workflows/showcase.yml`).
