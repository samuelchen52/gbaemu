## About
A Game Boy Advance emulator, written in javascript.

## Usage
This project is hosted on Github at [https://samuelchen52.github.io/gbaemu/](https://samuelchen52.github.io/gbaemu/). To use, just select your desired GBA rom. You can also select a BIOS file beforehand, though this is optional and if not provided the [BIOS](https://github.com/Nebuleon/ReGBA/blob/master/bios/gba_bios.bin) file by [Normatt](https://github.com/Normmatt/gba_bios) will be used, or play around with a demo rom from [TONC](https://www.coranac.com/projects/#tonc) by clicking on the demo button. To save the current state of your game, create a save state, then export it. For the best experience, use the Chrome browser (other browsers may work, but no guarantee).

## Screenshots
The classic GBA BIOS boot screen

![ "GBA bios boot screen."](./resources/bootss.png "GBA bios boot screen.")

Some gameplay from Fire Emblem Sacred Stones

!["Fire Emblem Sacred Stones gameplay."](./resources/fess2.jpg "Fire Emblem Sacred Stones gameplay.")

Obligatory screenshot of the Pokemon Emerald start screen

!["Pokemon Emerald start screen."](./resources/pokemss.png "Pokemon Emerald start screen.")

## Planned Improvements / Features
* Semi-accurate CPU timings
* Optimizations for greater speed
* Savestates (✔) / Savegames
* Better UI 
* Sound (✔)
* Sound quality
* Tests

## Credit
[TONC](https://www.coranac.com/tonc/text/toc.htm) - very helpful write-up on the internals of GBA hardware

[GBATEK](https://problemkaputt.de/gbatek.htm) - reference sheet for GBA hardware

[No$gba](https://problemkaputt.de/gba.htm) / [mGBA](https://mgba.io/downloads.html) - established GBA emulators that were used for debugging

[Near / Talarubi](https://byuu.net/video/color-emulation/) - color correction

http://belogic.com/gba/ - documentation on gba audio internals