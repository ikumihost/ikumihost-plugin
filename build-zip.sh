#!/bin/sh
# Builds the distributable plugin zip one level up (../ikumihost-plugin.zip).
# The manifest (.claude-plugin/plugin.json) must sit at the ZIP ROOT, so we
# zip the folder's contents from inside it — never the parent folder.
#
# The plugin is a thin pointer — skill + remote URL connector (.mcp.json
# points at mcp.ikumihost.com). No local server, nothing else to bundle.
#
# This zip is for local testing only — the plugin (skill + connector
# pointer) is what actually installs into Claude, via the marketplace
# (github:ikumihost/ikumihost-marketplace). Tool LOGIC and DEFINITIONS
# live server-side on mcp.ikumihost.com and update instantly on deploy;
# the skill itself only updates when the plugin is reinstalled/updated.
set -e
cd "$(dirname "$0")"

ZIP=../ikumihost-plugin.zip
rm -f "$ZIP"
zip -r "$ZIP" .claude-plugin .mcp.json skills \
  -x "*.DS_Store"

unzip -l "$ZIP"
