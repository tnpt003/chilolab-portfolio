---
title: Pet Desktop
slug: pet-desktop
locale: en
description: An animated cat that lives on your Windows desktop. Pick it up, pet it, feed it and dress it up; when you feel like it, take it on adventures against slimes. Installed copies update themselves.
kind: pet
order: 1
stack: ['C#', 'WPF', '.NET 10', 'Python']
featuredVersion: '1.5.2'
preview:
  image: ../../../assets/pet-battle-hub.png
  alt: Pet Desktop interface for choosing adventure and battle modes.
  caption: Actual application screenshot — development preview for 1.5; releases may differ.
video: /media/pet-promo.mp4
videoCaption: 1 minute 44 second promo video, with music. Recorded in the real app; published releases may differ slightly.
gallery:
  - image: ../../../assets/pet-gallery/fishing.png
    alt: Chilo the cat fishing at a small pond in the corner of the desktop.
  - image: ../../../assets/pet-gallery/cooking.png
    alt: Chilo cooking beside a bubbling pot over a fire.
  - image: ../../../assets/pet-gallery/portal.png
    alt: A purple portal appears next to the cat, labelled Click to enter.
  - image: ../../../assets/pet-gallery/chapter-map.png
    alt: The Chapter 1 map, The Slime Invasion, with five stages and Break through selected.
  - image: ../../../assets/pet-gallery/battle.png
    alt: Chilo lifted off the ground while slimes advance from the bottom of the screen.
  - image: ../../../assets/pet-gallery/victory.png
    alt: The victory panel after defeating the Slime King, with time, slimes defeated and the run’s upgrades.
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
