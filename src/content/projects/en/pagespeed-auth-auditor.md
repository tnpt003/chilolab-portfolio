---
title: PageSpeed-Auth-Auditor
slug: pagespeed-auth-auditor
locale: en
description: A website QA app for Windows. Check URL health, crawl a whole site, run PageSpeed or Lighthouse audits (including pages behind a login) and export everything to Excel.
kind: auditor
order: 2
stack: ['Electron', 'Node.js', 'Lighthouse', 'Puppeteer', 'ExcelJS']
downloadNote: 'The app is not code-signed yet, so your browser and Windows may warn you when you download and run it. Keep the file and carry on; no admin rights needed. Google Chrome is required.'
install:
  - icon: download
    title: 'Download the installer'
    text: 'Press **Download the latest PageSpeed-Auth-Auditor for Windows** above to get `PageSpeed-Auth-Auditor-Setup-win.exe`. To run it without installing, pick the **Portable build**.'
  - icon: archive
    title: 'Keep the file'
    text: 'If your browser says the file is not commonly downloaded, choose **Keep** (Chrome) or **… → Keep → Show more → Keep anyway** (Edge).'
  - icon: shield
    title: 'Run the installer'
    text: 'Open the downloaded file. If Windows says "Windows protected your PC", click **More info → Run anyway**.'
  - icon: login
    title: 'Open the Login Browser'
    text: 'In the app, click **Open Login Browser** and sign in there if the website needs it. Then check URLs, crawl or measure speed. The installed app checks for updates itself.'
preview:
  image: ../../../assets/auditor-main-screen.png
  alt: PageSpeed-Auth-Auditor 1.2.2 main screen with step 1, open the Login Browser, and step 2, choose URLs by typing them or crawling a website.
gallery:
  - image: ../../../assets/auditor-gallery/crawl-running.png
    alt: Crawling chilolab.com; the results table shows each page's status, HTTP code and load time, with a filter box above it.
  - image: ../../../assets/auditor-gallery/batch-complete.png
    alt: A batch of 12 pages is done and the app asks whether to continue with the next batch or finish and keep the results.
  - image: ../../../assets/auditor-gallery/export-report.png
    alt: Notification that the Site Health report was exported to Excel, with buttons to open the file or its folder.
  - image: ../../../assets/auditor-gallery/audit-completed.png
    alt: The performance audit section after a run, with Performance, Accessibility and Best Practices selected for export.
  - image: ../../../assets/auditor-gallery/restore-prompt.png
    alt: After the app was closed mid-crawl, it reopens with a saved crawl of 35 results and Restore or Discard buttons.
  - image: ../../../assets/auditor-gallery/restored-crawl.png
    alt: The restored crawl, with a Continue Stopped Crawl button and the report export controls.
---

PageSpeed-Auth-Auditor is a desktop app (Electron) I made for website QA, with three workflows:

- Check the health of manually supplied URLs.
- Crawl from a start URL to discover pages and produce a Site Health report.
- Audit selected Desktop/Mobile URLs using PageSpeed Insights or Lighthouse.

The screenshots below show the real app crawling this very site, chilolab.com.

## Public and authenticated pages

PageSpeed Insights is intended for public pages. Lighthouse is a separate method for pages requiring the Login Browser session. A PageSpeed error does not automatically switch the audit to Lighthouse.

## Crawling large sites

The results table stays responsive with thousands of URLs: it shows the newest 500 rows, while the Excel report always contains every result. Crawl progress is saved to disk as it runs, so if the app is closed mid-crawl, freezes, or the Login Browser is closed, the next start can restore it to export or continue.

## Reports and requirements

The application exports Site Health and audit results as Excel reports, including Performance, Accessibility, Best Practices, and SEO scores when available.

It needs Windows 10 or later and Google Chrome. Releases live in a [public GitHub repository](https://github.com/tnpt003/pagespeed-auth-auditor-releases) with a step-by-step picture guide; it holds releases only, not the source code.
