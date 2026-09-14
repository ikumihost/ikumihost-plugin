---
name: manage-files
description: Sync and publish a local website to IkumiHost — plan the sync, upload changed files, then publish once at the end.
---

This skill is used when a user is building or editing a local website with an AI agent and wants their changes live on their hosted IkumiHost website. Keep explanations simple and avoid technical jargon — the user just wants their site to be live, and does not need to know "uploading" and "publishing" are separate steps internally. Talk about the whole thing as "publishing."

Publish automatically after making a change — don't ask for permission first. A non-technical user doesn't distinguish "saved" from "live," so a routine "should I publish this?" question is just friction, not a real choice. Only hold off if the user's own words say so (e.g. "don't publish yet", "I have a few more changes coming first") — then keep working and publish once they're ready, or ask once, clearly, if it's genuinely unclear.

Once you start the sequence below, run it straight through with no questions in between — in particular, never pause between a successful upload and calling `publish()`. Both are automatic and immediate; the user should only ever see one outcome ("your site is live"), never a "files uploaded, should I publish?" moment.

Two ways to sync, pick based on how sure you are what changed:

- **You already know exactly which files changed** (you just edited them yourself in this conversation): call `upload_files` with just those files. Skips checking the rest of the site — much faster, especially on a site with many images or other large files that haven't changed.
- **You're not sure, or this is the first sync of the session**: call `plan_sync` with every local file. It checks the whole site and also catches files that were deleted locally and need removing remotely.

Either way:

1. For each file you're sending, get its size in bytes and the lowercase hex MD5 of its content (`md5 -q <file>` on macOS, `md5sum <file>` on Linux — one shell call for several files is fine).
2. Call `upload_files` (specific files) or `plan_sync` (everything) with that list (`path` relative to the website root, `size`, `md5`).
3. Follow the instructions in the response exactly — typically: save the returned upload script anywhere you can write to it (it only ever reads the website files, so a read-only website folder is fine — do not copy the website files anywhere), then run it with `sh`, passing the website folder's path as an argument. Confirm every line prints OK, then delete the script. Do not read, edit, or "improve" the script.
4. If a `plan_sync` response lists files that exist on the website but not locally, delete each with `delete_file` only if the user removed them on purpose — ask the user if unsure.
5. Call `publish` immediately once uploads/deletions are done — no confirmation, no pause. This is not a second decision; it's the completion of the one action the user already asked for.

Report the outcome to the user in plain words (what changed and that the site is now live), include the site's live URL so they can click straight to it, and mention anything the server flagged (e.g. a contact form handler was added).

If a tool asks for authorization or returns an authentication error, tell the user to connect the IkumiHost connector (Connect button) and log in with their IkumiHost account.
