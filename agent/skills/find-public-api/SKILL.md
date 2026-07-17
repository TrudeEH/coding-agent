---
name: find-public-api
description: Find and verify public APIs for application features, prototypes, scripts, tests, or data integrations. Use when a task needs an external API, free/public data source, hosted service, or API recommendation.
---

# Find Public API

Use [public-apis/public-apis](https://github.com/public-apis/public-apis) for discovery only. Catalog rows can be stale. Verify all final recommendations against official API documentation or upstream source.

## 1. Define need

Extract from request and project context:

- required operation and response data;
- client environment: browser, server, CLI, or mobile;
- geography, data freshness, expected volume, and latency needs;
- authentication, budget, license, privacy, and commercial-use constraints.

Ask user only when missing detail materially changes recommendation. Otherwise state assumptions.

## 2. Discover and verify

1. Search catalog category matching capability. Do not restrict search to Open Source Projects unless requirement calls for open-source software or self-hosting.
2. Shortlist candidates with plausible capability, maintained docs, HTTPS, and suitable auth, terms, and browser CORS support when needed.
3. Open official docs or upstream repository for every finalist. Verify required endpoint/operation, API version, auth, quota/rate limits, pricing, terms/license, data freshness, and CORS behavior where relevant.
4. Make harmless read-only request only when safe, practical, and credentials are not required. Never expose, invent, or commit credentials.

If catalog has no credible match, say so. Use general web search for an alternative only when needed, and identify it as outside catalog.

## 3. Recommend or integrate

Rank candidates against stated requirements, not popularity. Recommend one primary option; mention alternatives only for meaningful tradeoffs.

Before integration, inspect project language, dependency conventions, config, and secret-management pattern. Then:

- use official base URL and current documented API version;
- store secrets only in established environment/secret configuration;
- set timeouts; handle non-success responses, rate limits, malformed payloads, and network failures;
- validate external data and request only needed fields;
- add focused mocked/fixture test unless project uses live integration tests.

## 4. Report

Include:

- selected API and fit;
- catalog link, if used, plus official docs;
- verified auth, HTTPS, CORS, quota/pricing, and license/terms; mark unknown facts as unknown;
- minimal request example or completed integration when requested;
- key limitations and verification date.

Never present unverified catalog data as fact. “Public,” “free,” and “open source” do not mean anonymous, unrestricted, production-ready, or free at all usage levels.
