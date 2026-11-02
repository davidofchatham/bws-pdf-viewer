#!/usr/bin/env bash
#
# Fail if tracked files carry personal or client-identifying content.
#
# WHY THIS EXISTS: this repo is PUBLIC, and git history cannot be un-leaked by a later
# delete. The guard runs at push, when personal or client-identifying content is still
# one revert away.
#
# Scope is the TRACKED tree only. .scratch/ and .claude/ are gitignored working
# surfaces and are deliberately out of scope -- their whole purpose is to hold
# what must not be committed.
#
# Convention to converge on: every fixture value uses a reserved domain, preferably
# @example.test (the allowlist below also admits example.com, .org and .net).
#
# Copy-in template. Adapted from Site Views' scripts/check-tracked-pii.sh (read 2026-10-02);
# the adaptations are listed in the body of the commit that added this file (git log -- scripts/).
# Why each rule looks the way it does: the bws-reference tracker practice, section "The guards".
# Usage: bash scripts/check-tracked-pii.sh
# CI proves it still fails on a hit (scripts/self-test-guards.sh).

set -uo pipefail

# Paths never scanned.
#   libs, package-lock.json     -- third-party; their domains are not ours
#   this script                 -- it necessarily contains every pattern below
EXCLUDES='^(libs/|package-lock\.json$|scripts/check-tracked-pii\.sh$)'

# Domains that may legitimately appear: upstream projects, specs, and the
# reserved test domains (RFC 2606 / RFC 6761). Matched with an optional
# subdomain prefix, so www.w3.org clears on the w3.org entry.
ALLOWED_DOMAINS='wordpress\.org|github\.com|githubusercontent\.com|generatepress\.com|generateblocks\.com|advancedcustomfields\.com|litespeedtech\.com|cloudflare\.com|php\.net|w3\.org|keepachangelog\.com|semver\.org|adr\.github\.io|wsform\.com|bridgewebsolutions\.com|getcomposer\.org|packagist\.org|example\.(com|org|net)|[a-z0-9-]+\.(test|invalid|localhost)|github\.io|opensource\.org|yoursite\.com|ctx\.app|testing-page-flip\.com'

# github.io/opensource.org: upstream docs and licence links. yoursite.com: placeholder in the archived
# speckit quickstart. ctx.app: a JS property (canvas context), not a host. testing-page-flip.com: the
# upstream flipbook dev-server allowedHosts entry in webpack.config.js.
# Emails get their own, much smaller list -- see rule 2.
ALLOWED_EMAIL_DOMAINS='example\.(com|org|net)|[a-z0-9-]+\.(test|invalid|localhost)'

# --others surfaces files not yet committed; --exclude-standard keeps .gitignore
# honored, so .scratch/ stays out. Without it a brand-new file's PII would pass
# locally and only fail once committed -- after the value is already in history.
FILES=$( { git ls-files; git ls-files --others --exclude-standard; } | sort -u | grep -Ev "$EXCLUDES")
[ -z "$FILES" ] && { echo "No files to scan."; exit 0; }

fail=0
report() {
	# $1 = what was found, $2 = grep output
	[ -z "$2" ] && return 0
	fail=1
	echo "::error::$1"
	printf '%s\n' "$2" | sed 's/^/    /'
	echo
}

# 1. Absolute paths into the author's own checkout or home directory.
#
#    NARROWED DELIBERATELY to paths bearing an identifying segment. A bare drive
#    letter is not one: docs may write 'U:\' or 'X:\path\to\plugin' as
#    placeholders, and those name nobody. Matching every "<letter>:\" also
#    collides with PHP's own escapes -- "exists:\n" is a drive path by that
#    rule -- so the pattern would have taught people to ignore it, which is the
#    failure mode a hard-fail guard cannot survive.
hits=$(printf '%s\n' "$FILES" | xargs -d '\n' grep -nIE \
	'([A-Za-z]:[\\/](Users|Dev|Resources|Repos|Environments)[\\/]|/home/[a-z][a-z0-9_-]*/|/Users/[A-Za-z])' 2>/dev/null || true)
report "Absolute local path in a tracked file" "$hits"

# 2. Email addresses. Only RESERVED test domains pass -- deliberately NOT the
#    hostname allowlist. Reusing that list here would exempt the author's own mail
#    domain, so a real mailbox would sail through while a stranger's gmail was
#    caught: precisely backwards. Upstream project hostnames are legitimate to cite;
#    addresses AT them are not.
hits=$(printf '%s\n' "$FILES" | xargs -d '\n' grep -nIEo \
	'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' 2>/dev/null \
	| grep -Ev "@([a-z0-9-]+\.)*($ALLOWED_EMAIL_DOMAINS)$" || true)
report "Email address in a tracked file" "$hits"

# 3. Domains outside the allowlist. This is the one that catches client
#    infrastructure -- a real hostname in a config example reads as documentation
#    and is indistinguishable from a placeholder until someone knows the client.
hits=$(printf '%s\n' "$FILES" | xargs -d '\n' grep -nIEo \
	'\b[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*\.(com|org|net|io|co|us|dev|app|cloud|site|online|xyz)\b' 2>/dev/null \
	| grep -Ev ":([a-z0-9-]+\.)*($ALLOWED_DOMAINS)$" || true)
report "Domain outside the allowlist in a tracked file" "$hits"

if [ "$fail" -ne 0 ]; then
	cat <<-'MSG'
	Tracked files must not name the author's machine, mailbox, or a client's
	infrastructure. Replace with a reserved placeholder (example.com, *.test),
	or -- if the value is genuinely public and belongs here -- add it to
	ALLOWED_DOMAINS in this script, in the same commit, with a reason.
	MSG
	exit 1
fi

echo "Tracked tree clean: no local paths, emails, or unlisted domains."
