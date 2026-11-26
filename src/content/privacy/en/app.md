---
locale: en
part: app
title: The Desktop Pet app
---

This section covers the Desktop Pet app installed on Windows, not the website. The full terms are in EULA.txt beside DesktopPet.exe.

### Stays on your computer

- Settings, the cat's name, the farm, the diary and battle progress are kept in `%LOCALAPPDATA%\DesktopPet`. No accounts, ads or analytics.
- The AI is a Python program running on your computer; it sends nothing out.
- Walking on windows reads only window positions and sizes, never their contents. The weather reads only the colours of a small copy of the wallpaper, never stored or sent.

### Update checks

The installed app asks GitHub Releases for a newer version; GitHub sees your IP address as with any web request. Automatic updates can be switched off in Settings → General.

### Playing online (Epic Online Services)

Applies to releases that include online play.

- The app connects only when you press “Invite a friend” or “Join”.
- Only these are sent: the room code, the game version, the cat's name and coat, and the co-op battle's data (weapon, skills, what you do, where your cat is in the battle).
- Never sent: your Windows user name, window contents or lists, wallpaper, files, the farm, settings.
- Sign-in uses an anonymous EOS device identifier (Device ID); no Epic account is needed. By default traffic goes through Epic's relay, so neither side sees the other's IP address.
- The EOS library sends Epic service-quality data (a random session id, call counts, latency, error codes); data may be processed in the United States. See [Epic's privacy policy](https://www.epicgames.com/site/privacypolicy).

Questions about the app: use the [feedback page](/en/pet-desktop/feedback).
