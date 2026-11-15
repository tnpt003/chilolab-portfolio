---
title: PageSpeed-Auth-Auditor
slug: pagespeed-auth-auditor
locale: en
description: A Windows QA application for site health checks, performance audits, and Excel reports.
kind: auditor
order: 2
---

## PageSpeed-Auth-Auditor

PageSpeed-Auth-Auditor is an Electron desktop application for website QA, with three workflows:

- Check the health of manually supplied URLs.
- Crawl from a start URL to discover pages and produce a Site Health report.
- Audit selected Desktop/Mobile URLs using PageSpeed Insights or Lighthouse.

## Public and authenticated pages

PageSpeed Insights is intended for public pages. Lighthouse is a separate method for pages requiring the Login Browser session. A PageSpeed error does not automatically switch the audit to Lighthouse.

## Reports and requirements

The application exports Site Health and audit results as Excel reports, including Performance, Accessibility, Best Practices, and SEO scores when available.

Windows 10 or later and Google Chrome are required. Development is currently local; no public source repository or download has been confirmed here.
