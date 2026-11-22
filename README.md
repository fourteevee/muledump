# Muledump — Exalt update

This fork brings [Jakcodex/Muledump](https://github.com/jakcodex/muledump) 9.6.5 up to date with today's RotMG (Exalt). The original stopped working after Deca changed how account data is requested, and its item, skin and class data were years out of date.

**Download:** grab the latest zip from the [Releases page](../../releases).

## What's new in this fork

**Loading accounts works again**
- Uses Deca's current login flow: `account/verify` for an access token, then `char/list`, sent as POST requests.
- Old cached account data that is missing the new fields is refreshed automatically once.

**Up-to-date game data**
- Item, skin and class data plus item sprites, rebuilt from the current Exalt client: 13,173 items (up from 4,043), 19 classes (up from 16, adding Kensei, Druid and Summoner) and 1,473 skins (up from 680), plus the new slot types (maces, sheaths, sigils).

**Exalt-era items**
- **Enchantments:** enchanted items show marker icons, and their tooltips list every enchantment with its effect and the item's rarity (Uncommon / Rare / Legendary / Divine).
- **Shiny** item variants get a sparkle marker.

**New storage and account panels** (each can be toggled in Options)
- Potion Storage, Material Storage, Pets, Forge Blueprints, Gift Chest and temporary gifts.
- Consumable quickslots (replacing the old HP/MP pot counts) and backpack extenders (16 backpack slots).
- Large Exalt vaults: chests beyond the old 140-slot layouts are shown below the layout instead of being dropped.
- Account level and XP, account-level boosts, fortune tokens, forge fire energy, and owned titles, emotes and entrances.

**Character stats**
- **Exaltations:** per-class exaltation levels, with the bonus each one gives your stats.
- Character stats (PCStats) decoded from the new Exalt format, including newer dungeons.
- Fame bonuses and goals use the current fame system; class stars use the current thresholds (20 / 500 / 1,500 / 5,000 / 15,000 base fame).

**Totals** count gift chests, potion storage, material storage, pets and quickslots.

**ST Set Collection tracker**
- Open **Totals → ST Set Collection** (all accounts) or the same entry in an account's menu (one account).
- Shows every ST set grouped by class, which pieces you own and how many, sets complete, pieces owned, and how many full sets you could assemble.
- Filter by complete / incomplete / missing 1 piece / started / not started, by class, and with or without the legacy sets. Click a piece to find the accounts holding it.
- See [the help page](docs/muledump/stsets.md).

## How to use it

1. **Install the CORS extension** for your browser (same requirement as the original, see [Requirements](REQUIREMENTS.md)). Muledump can't contact Deca's servers without it.
2. **Download and unzip** the latest release.
3. **Open `muledump.html`** in that browser.
4. **Add your accounts.** First-time setup walks you through it in SetupTools, or copy `accounts_sample.js` to `accounts.js` and fill in your login email and password.
5. Muledump loads each account. Respect Deca's rate limits: too many accounts at once gets you blocked for about 10 minutes, so leave the "Account Load Delay" setting on automatic.

Your credentials stay in your browser or in your local `accounts.js`. `accounts.js` is in `.gitignore`, so never commit it.

**Coming from the original Muledump?** Copy your `accounts.js` (or a SetupTools backup) into the new folder and open `muledump.html`. Your options carry over, and old caches refresh on first load.

## Regenerating game data (for maintainers)

When Deca adds items, rebuild `lib/constants.js`, `lib/sheets.js`, `lib/renders.png` and `lib/stsets.js` from the game client with the scripts in [`tools/datagen`](tools/datagen). You need Python 3 with `UnityPy` and `Pillow`.

```bash
# 1. export the client's text assets (XML) and texture atlases from RotMG Exalt's resources.assets
python dump_text.py    "<RotMG Exalt>/RotMG Exalt_Data/resources.assets" gamedata/
python dump_atlases.py "<RotMG Exalt>/RotMG Exalt_Data/resources.assets" atlases/

# 2. keep a copy of the original 9.6.5 lib/constants.js as lib/constants.js.orig, then rebuild
python build_muledump_data.py gamedata/ atlases/ ../../lib/ out/
# copy out/constants.js, out/sheets.js, out/renders.png into lib/

# 3. rebuild the ST set list used by the ST Set Collection tracker
python build_stsets.py gamedata/ ../../lib/stsets.js
```

## Not changed / not tested
- Muledump Online (the GitHub Pages hosted version) still points at the original project.
- Tested with regular (email) accounts. Steam and Kongregate logins use the same new flow but haven't been tested.
- One Click Login is unchanged from 9.6.5.

---

# Jakcodex / Muledump

## Welcome

This is a fork of Atomizer's [Muledump](https://github.com/atomizer).

## Synopsis

This tool allows you to list contents of all your accounts in a single page (characters, their stats and items, items in vaults). Also it generates a summary of all the items - you probably saw screenshots of these in trading forum ([example](https://imgur.com/dDA2vC9)).

The point of playing the game is to have fun. Muling is not fun. I am trying to increase overall fun ratio by decreasing amount of time spent fussing with mules and storagekeeping.

## Requirements

Currently due to how Deca handles requests to ROTMG servers a browser extension is required to use this Muledump.

See the [Requirements](REQUIREMENTS.md) page for more information.

### Head over to [Installation and Setup](https://github.com/jakcodex/muledump/wiki/Installation-and-Setup) in the wiki for a detailed setup guide.

[Steam Users Setup Guide](https://github.com/jakcodex/muledump/wiki/Steam-Users-Setup-Guide)

[Kongregate Users Setup Guide](https://github.com/jakcodex/muledump/wiki/Kongregate-Users-Setup-Guide)

[One Click Login Setup Guide](https://github.com/jakcodex/muledump/wiki/One-Click-Login)

## Release Information

The current version is Jakcodex/Muledump v9.6.

Muledump Online is available hosted on Github [here](https://jakcodex.github.io/muledump/muledump.html).

All released versions are available for download [here](https://github.com/jakcodex/muledump/releases).

## Muledump Online Version

- Open [https://jakcodex.github.io/muledump/muledump.html](https://jakcodex.github.io/muledump/muledump.html)
- Returning users can upload a backup or import their existing accounts.js file
- New users will be guided through first time setup
- This version runs entirely on your local computer and is updated automatically with new releases
- All user and account data submitted and stored in this version never leaves your computer

## Muledump Local Version

- Unzip the latest muledump release
- Open **`muledump.html`**
- First time users will be guided thru Muledump setup
- Returning users are ready to go immediately

## Main Features

- Manage all of your ROTMG accounts from a single interface
- [SetupTools](docs/setuptools/index.md) - An easy to use, browser-based user interface for managing Muledump
- [Groups Manager](docs/setuptools/help/groups-manager/manager.md) - Account grouping and ordering utility to customize the Muledump accounts list
- [Muledump Online](https://jakcodex.github.io/muledump/muledump.html) - Load Muledump directly from Github using SetupTools
- [One Click Login](https://github.com/jakcodex/muledump/wiki/One-Click-Login) - Login to your accounts via Exalt, the browser or Flash Projector with one click
- [Storage Compression](https://github.com/jakcodex/muledump/wiki/Storage-Compression) - Store more data in the browser than previously possible
- [Muledump Totals](https://github.com/jakcodex/muledump/wiki/Totals) - Filtering on fame bonus, feed power, soulbound, tradeable, ut, and st, and specified accounts, and easy switching between pre-defined totals configs
- [White Bag Tracker](docs/muledump/whitebags.md) - Track your white bag collection the way you want to
- Archive Backups - Backup and restore Muledump with account data to prevent having to reload unnecessarily
- Skin Wardrobe - View all skins owned by your accounts
- MuleQueue - Task queuing to control the flow of requests from Muledump
- Vault display is fully customizable and comes with four pre-defined layouts
- Full character skin and dye support in portraits
- Character sorting by fame, exp, total fame, class, active time, maxed stats, and custom lists
- Custom character lists allow you to create custom Muledump account layouts showing only characters you specify
- Exporting works with the following modes: text, csv, json, image, imgur, paste
- Fully compliant with Deca rate limiting

## Not so obvious features

- click on item to filter accounts that hold it
- click on account name for individual options menu
- shift+click an account to filter totals display
- ctrl-click account name to temporarily hide it from totals
- ctrl-click on an item to open its Realmeye menu
- ctrl-click on two items to open the Realmeye Trading menu
- logins thru muledump count towards daily login calendar
- account settings include automatic reload, login-only (daily calendar only), and cache disable
- right click anywhere on a mule to access the mule menu
- active mulequeue can be resumed if muledump is closed or reloaded
- See a full list of available actions at the [Keyboard and Mouse Controls](https://github.com/jakcodex/muledump/wiki/Keyboard-and-Mouse-Controls) wiki

## Check out the [Frequently Asked Questions](https://github.com/jakcodex/muledump/wiki/Frequently-Asked-Questions) and explore the [wiki](https://github.com/jakcodex/muledump/wiki) for more information!

<a id="jakcodex-supportandcontributions"></a>
## Support and Contributions

Jakcodex/Muledump operates its own Discord server - [https://discord.gg/JFS5fqW](https://discord.gg/JFS5fqW).

Feel free to join and ask for help getting setup, hear about new updates, offer your suggestions and feedback, or just say hi. We love to hear from the community!

If you encounter a bug, have a feature request, or have any other feedback you can also check out the [issue tracker](https://github.com/jakcodex/muledump/issues) to see if it's already being discussed. If not then you can [submit a new issue](https://github.com/jakcodex/muledump/issues/new).

If you are interested in helping test new versions of this software before release then check out [Muledump Preview](https://github.com/jakcodex/muledump-preview/) for the recent stable development builds of Muledump.

Feel free to submit pull requests or patches if you have any Muledump changes you'd like to contribute. See [Contributing](https://github.com/jakcodex/muledump/wiki/Contributing) for more information.

## Version and Update Information

Muledump versions are described as x.y.p where x is the major version, y is the minor version, and p is the patch version.

All version increments are published as an official Muledump Local release.

Muledump Online always runs the latest version of Muledump with all patches.

## Special Thanks

Muledump Renders are maintained by [tuvior](https://github.com/tuvior).

Thanks to [Atomizer](https://github.com/atomizer) for all the original Muledump work and for his [endorsement](https://github.com/atomizer/muledump#on-indefinite-hiatus-an-active-fork-is-here).

Thanks to [Wawawa](https://github.com/wawawawawawawa) for his progress tracking feature.

This project uses open source libraries from many projects. See our dependencies to check them out.

This project uses textures and animated graphics courtesy of [Loading.io](https://www.loading.io).

## FYI

The following paths are for Github Pages configuration and are not apart of the Muledump code: _layouts, assets, and _config.yml.

## Donations

People ask about donating to the Jakcodex/Muledump project rather frequently. This project has not been without its expenses, so your contributions are welcome and appreciated.

If you are so inclined, you can donate to one of these locations:

##### Paypal
paypal@jakcodex.io

## Privacy Policy

Click to read more about our [Privacy Policy](privacy-policy.md).

## Jakcodex/Muledump License

Copyright 2020 [Jakcodex](https://github.com/jakcodex)

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
