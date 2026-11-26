---
locale: en
part: site
title: Privacy policy
description: What ChiloLab and the Desktop Pet app collect, why, where it is stored and how to delete it.
lead: ChiloLab is the personal website of Nguyễn Tấn Phát. This page describes exactly what the website stores, and how the Desktop Pet app handles data.
updatedLabel: 'Last updated:'
updated: 2026-11-26
---

## What is stored

- **Account:** when you sign in with Google, the website receives your Google account ID, email and name. You can change your display name on the account page. The website never sees your Google password. When you sign in by email, the website stores your email; the 6-digit code is stored only as a hash and expires after 10 minutes. There are no passwords.
- **Comments:** the text, time, and the page or version you commented on. Comments are public with your display name; your email is never shown.
- **Feedback and bug reports:** what you send, the app version, the Windows version and a contact if you add one. Only the site owner can read them.
- **New version emails:** only if you choose them on your account page. The website stores the projects you picked, the email language and when you signed up. Emails go to your account's address. The website records who received each email so nobody gets it twice, and deletes that record 30 days after sending finishes.
- **Downloads:** only a daily counter per file, with no information about who downloaded.

## Cookies

Cookies are used only to keep you signed in: a session cookie (30 days) once you sign in and a temporary cookie (10 minutes) during Google sign-in. There are no advertising or tracking cookies.

## Automatic moderation

Comment text is checked automatically (a word list and an AI model on Cloudflare Workers AI) for abusive language and spam. Flagged comments are held for the site owner to review before they appear.

## Processors

- **Cloudflare:** hosting, database and backups, spam protection for the feedback form (Turnstile), comment moderation (Workers AI), page view statistics (Web Analytics — no cookies, no tracking of individuals).
- **Google:** confirms your identity when you choose “Continue with Google”.
- **Resend:** delivers the email with your sign-in code to the address you enter, and new version emails if you signed up for them.

IP addresses are used briefly to limit how often you can post and to stop spam; ChiloLab does not store IP addresses in its database.

## Retention and deletion

- You can edit or delete your comments at any time.
- Unticking a project on the [account page](/en/user/account#updates), or using the unsubscribe link in an email, removes that new version email signup at once.
- Deleting your account on the [account page](/en/user/account) immediately removes your name, email, email signups and the text of all your comments.
- Feedback is kept until the owner has handled and deleted it. To have it removed sooner, or for any question, use the [feedback page](/en/pet-desktop/feedback).
- Once a week the database is backed up to private storage that only the site owner can open, to recover from an incident. Each backup is kept for at most 12 weeks, so deleted data can remain in an older backup for up to 12 weeks before it is gone for good.
