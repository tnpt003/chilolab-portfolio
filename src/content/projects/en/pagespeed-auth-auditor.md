---
title: PageSpeed-Auth-Auditor
slug: pagespeed-auth-auditor
locale: en
description: A website QA app for Windows. Check URL health, crawl a whole site, run PageSpeed or Lighthouse audits (including pages behind a login) and export everything to Excel.
kind: auditor
order: 2
stack: ['Electron', 'Node.js', 'Lighthouse', 'Puppeteer', 'ExcelJS']
preview:
  image: ../../../assets/auditor-main-screen.png
  alt: PageSpeed-Auth-Auditor main screen with four numbered steps - open the login browser, enter URLs, choose desktop or mobile, run the audit.
  caption: Actual main-screen capture, taken from the app's user guide.
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
