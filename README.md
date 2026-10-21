# IkumiHost plugin

Publish and manage a static website on [IkumiHost](https://ikumihost.com) from your AI assistant. You build the site in a local folder with your assistant, and this plugin lets the assistant put it online, with hosting, a CDN, SSL and custom domains handled by IkumiHost.

You need an IkumiHost account. Sign up at https://ikumihost.com (the trial lasts 15 days).

## What the plugin contains

- **A connector** (`.mcp.json`) that points your assistant at the IkumiHost MCP server, `https://mcp.ikumihost.com/mcp`. The first time you use it, click **Connect** and log in with your IkumiHost account (OAuth 2.1 with PKCE). The plugin stores no credentials and contains no code that runs on your machine.
- **A skill** (`skills/manage-files/SKILL.md`) that teaches the assistant the publishing workflow: which tool to use for a small edit, a few changed files or a full sync, how to prepare images, and how contact forms work.

## What it does, and what it sends

The assistant only ever sends your server **metadata** (file paths, sizes and MD5 hashes), never file contents through a tool call. To upload:

1. The server compares your files against what is already live and replies with a single shell command.
2. That command (`curl … https://mcp.ikumihost.com/u/<id> | sh -s <folder>`) downloads a short upload script generated just for that request. The script can be fetched once and expires after 15 minutes. It only uploads the listed files, using presigned links that are valid for one object each, to IkumiHost's storage bucket.
3. The assistant then calls `publish`, which refreshes the CDN and returns your live address.

Other tools list, read, edit (exact text replacement), download and delete files in your own site only. Your files can never reach another customer's site, and nobody else's files are reachable from yours.

Contact forms: on publish, any page with a `<form>` gets a small script from `api.ikumihost.com` that emails submissions to your account address.

## Using it in Cowork

Cowork blocks network access by default. Under **Settings → Capabilities → Allow network egress → Additional allowed domains**, add:

- `ai-labhost-1.s3.eu-west-3.amazonaws.com`
- `mcp.ikumihost.com`

## Support

https://ikumihost.com · admin@ikumihost.com
