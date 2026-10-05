---
name: manage-files
description: Sync and publish a local website to IkumiHost — plan the sync, upload changed files, then publish once at the end.
---

This skill is used when a user is building or editing a local website with an AI agent and wants their changes live on their hosted IkumiHost website. Keep explanations simple and avoid technical jargon — the user just wants their site to be live, and does not need to know "uploading" and "publishing" are separate steps internally. Talk about the whole thing as "publishing."

Publish automatically after making a change — don't ask for permission first. A non-technical user doesn't distinguish "saved" from "live," so a routine "should I publish this?" question is just friction, not a real choice. Only hold off if the user's own words say so (e.g. "don't publish yet", "I have a few more changes coming first") — then keep working and publish once they're ready, or ask once, clearly, if it's genuinely unclear.

Once you start the sequence below, run it straight through with no questions in between — in particular, never pause between a successful upload and calling `publish()`. Both are automatic and immediate; the user should only ever see one outcome ("your site is live"), never a "files uploaded, should I publish?" moment.

Three ways to make a change live, pick based on the size of the change:

- **A small change to ONE file already on the website** (fixing a typo, changing a line or a label): call `edit_file` directly with the exact old text and the new text — no MD5s, no script, no upload step. Call `get_file` first if you don't already know the file's exact current text, since `edit_file` needs an exact match. Never re-create and re-upload a whole file just to change a few lines — `edit_file` is far cheaper and faster. Pass `publish: true` to make it live in the same call.
- **You already know exactly which files changed** (you just edited several of them yourself in this conversation, or are uploading new files): call `upload_files` with just those files. Skips checking the rest of the site — much faster, especially on a site with many images or other large files that haven't changed.
- **You're not sure, or this is the first sync of the session**: call `plan_sync` with every local file. It checks the whole site and also catches files that were deleted locally and need removing remotely.

If you used `edit_file` earlier in this conversation, make sure your local copy of that file reflects the edit before calling `plan_sync` — otherwise plan_sync sees your stale local copy as "changed" and will overwrite the live edit. Either apply the same change to your local file, or fetch the current version with `get_file` first.

For `upload_files`/`plan_sync`:

1. For each file you're sending, get its size in bytes and the lowercase hex MD5 of its content (`md5 -q <file>` on macOS, `md5sum <file>` on Linux — one shell call for several files is fine).
2. Call `upload_files` (specific files) or `plan_sync` (everything) with that list (`path` relative to the website root, `size`, `md5`). Put EVERY file from one change into a single call — each call produces its own upload script, so splitting a change across several calls means retyping several scripts. Never re-create a whole file just to change a few lines; use `edit_file` for that.
3. Follow the instructions in the response exactly — typically: save the returned upload script anywhere you can write to it (it only ever reads the website files, so a read-only website folder is fine — do not copy the website files anywhere), then run it with `sh`, passing the website folder's path as an argument. Confirm every line prints OK, then delete the script. Do not read, edit, or "improve" the script.
4. If a `plan_sync` response lists files that exist on the website but not locally, delete each with `delete_file` only if the user removed them on purpose — ask the user if unsure.
5. Call `publish` immediately once uploads/deletions are done — no confirmation, no pause. This is not a second decision; it's the completion of the one action the user already asked for.

If the site has (or the user wants) a contact form, no backend or third-party form service is needed — write a plain `<form method="post">` with named, labelled inputs, no custom `action` and no submit-handling JavaScript. IkumiHost wires it up automatically on publish to email the account owner; a submit handler that fakes "message sent" without actually sending anything, a `mailto:` link, or a call to some invented `/api/contact` endpoint would either be redundant or simply not work on this platform.

Images (photos, logos, anything not HTML, CSS or JS) are cached in visitors' browsers for a full year. If you replace a photo or image, give the new file a different name (e.g. `about-2.jpg` instead of `about.jpg`) and update every page that uses it, then delete the old file if nothing uses it anymore. Overwriting a file under the same name would leave returning visitors seeing the old image. Stylesheets and scripts don't need this — browsers always check them for changes, so editing them is enough.

Report the outcome to the user in plain words (what changed and that the site is now live), include the site's live URL so they can click straight to it, and mention anything the server flagged (e.g. a contact form handler was added).

If a tool asks for authorization or returns an authentication error, tell the user to connect the IkumiHost connector (Connect button) and log in with their IkumiHost account.
