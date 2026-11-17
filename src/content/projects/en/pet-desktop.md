---
title: Pet Desktop
slug: pet-desktop
locale: en
description: An animated Windows desktop cat, with companion interactions and optional adventures.
kind: pet
order: 1
preview:
  image: ../../../assets/pet-battle-hub.png
  alt: Pet Desktop interface for choosing adventure and battle modes.
  caption: Actual application screenshot — development preview for 1.5; releases may differ.
video: /media/pet-intro.mp4
---

## A little desktop companion

Pet Desktop brings an animated cat to your Windows desktop. Pick it up, drag and drop it, pet it, feed it, play together, and customize its appearance and accessories.

Battle Mode is optional: your desktop becomes an adventure space with slimes, skills, and equipment. Outside battles, the cat remains a desktop companion.

## Technology

Built with C# / WPF on .NET 10, with an optional Python behavior service. C# handles movement, input, animation, and battles; local behavior remains available without the Python service.

## Installing

1. Download `PetComputer-win-Setup.exe` with the button above and run it; no admin rights needed.
2. If Windows SmartScreen says "Windows protected your PC", click **More info → Run anyway**. The installer is not code-signed yet.
3. The cat opens by itself. Installed copies update themselves, so there's no need to download again for new versions.

The Portable build (.zip) is for running from a folder without installing.
