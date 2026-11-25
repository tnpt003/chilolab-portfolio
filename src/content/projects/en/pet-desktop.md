---
title: Pet Desktop
slug: pet-desktop
locale: en
description: A little cat that lives right on your Windows desktop. Pick it up, pet it, feed it and dress it up; whenever you like, take it on adventures against slimes. The app updates itself when a new version is out.
kind: pet
order: 1
stack: ['C#', 'WPF', '.NET 10', 'Python']
featuredVersion: '1.5.2'
downloadNote: 'The installer is not code-signed yet, so your browser and Windows may warn you when you download and run it. Keep the file and carry on; no admin rights needed.'
install:
  - icon: download
    title: 'Download the installer'
    text: 'Press **Download Pet Desktop** above to get `PetComputer-win-Setup.exe`. To run it without installing, pick the Portable build (.zip).'
  - icon: archive
    title: 'Keep the file'
    text: 'If your browser says the file is not commonly downloaded, choose **Keep** (Chrome) or **… → Keep → Show more → Keep anyway** (Edge).'
  - icon: shield
    title: 'Run the installer'
    text: 'Open the downloaded file. If Windows says "Windows protected your PC", click **More info → Run anyway**.'
  - icon: cat
    title: 'Meet Chilo'
    text: 'The cat opens on your desktop by itself. The app updates itself, so new versions need no new download.'
preview:
  image: ../../../assets/pet-battle-hub.png
  alt: Pet Desktop interface for choosing adventure and battle modes.
video: /media/pet-promo.mp4
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

Pet Desktop puts Chilo the cat on your Windows desktop. It wanders around, goes fishing and cooks right on your screen. You can pick it up, drag it around, pet it, feed it, play together, and change its look and accessories.

Battle Mode is an extra you can take or leave: your desktop turns into an adventure with slimes, skills and gear. Outside battles, the cat simply keeps you company.

## Technology

I built Pet Desktop with C# / WPF on .NET 10, plus an optional Python behavior service. Movement, input, animation and battles all run in C#, so the cat works just fine without the Python service.
