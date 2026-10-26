Readme · MD

# Ambrosia

Ambrosia is a Windows desktop app for organizing a music library with tags. You sort tracks into folders of tags (mood, scene, location, franchise...), review new music one track at a time, download playlists from YouTube, and let the app keep every track at a similar loudness.

Built with Electron, React and Vite. Your library is stored in a local SQLite database, and your music files stay as normal files on disk.

## What's new in 1.2.1

- **Normalize volume now counts the effects in Mix**: a layer is measured with its Tone, Filter, Mono, Reverb, Echo and Wobble before it plays (see Loudness and effects).

## What's new in 1.2.0

- **Mix page**: play several tracks at once, each layer with its own volume, pan, speed, fades, loop and pauses between loops, part played, tone, reverb, **filters**, **echo**, **wobble**, **mono**, **variation** and **start delay**.
- **Presets** and **Copy / Paste** of a layer's sound.
- **Mix controls**: master volume, limiter, fade out and pause, sleep timer.
- **Mixtapes**: save a mix, tag it, rename it, find it in the Library under **Mixtapes**, and play it to replace the current mix.
- **Tag merging**, **automatic updates** and a safer window (minimum width, no overlapping title bar).

## Install

1. Download the installer, `Ambrosia-Setup-<version>.exe`, from the project's releases.
2. Run it. Windows shows a blue **Windows protected your PC** screen, because the installer is not signed with a paid certificate. Click **More info**, then **Run anyway**.
3. Choose an install folder (or keep the default) and finish. Ambrosia appears in the Start Menu and on the desktop.

### Updating

Ambrosia looks for a new version 10 seconds after it starts, downloads it in the background, and installs it the next time you close the app. When one is ready, an **Update ready** badge appears in the title bar. Click it (or **Restart to update** in **Settings > Updates**) to install right away. Your library, settings and backups are kept.

- **Settings > Updates** shows your version, has a **Check for updates** button, and a switch to turn the automatic check off.
- Updates only work in the installed app, not from `npm run dev`.
- The first version with this feature has to be installed by hand. After that, updates install themselves.
- You can still update by running a new installer over the old one.

### Needed only for downloading

The **Download** page uses two free tools that are not bundled with the app. Install them once from PowerShell:

```powershell
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

Check that both work, then restart Ambrosia so it sees them:

```powershell
yt-dlp --version
ffmpeg -version
```

If a command is not found, close and reopen PowerShell, or sign out and back in, so that Windows refreshes its PATH. Everything else in Ambrosia works without these tools.

## First start

- The **library folder** is `Documents\Ambrosia`. Ambrosia creates it, with a `_Deleted` folder inside. You can pick another one in **Settings > Library**.
- To add music you already have, copy it into the library folder, then go to **Settings > Library**, click **Scan library**, and **Apply changes**. A first-level subfolder becomes the track's **Franchise** tag: a file in `Documents\Ambrosia\Chrono Trigger\` gets the tag `Chrono Trigger`.
- Tracks outside the library folder can stay where they are. Ambrosia remembers their paths.

## Using Ambrosia

### Keyboard shortcuts

Shortcuts work when no text field is focused. Press **Ctrl + Alt** together to turn them on or off (the badge in the title bar shows the state).

| Key                     | Action                                                                          |
| ----------------------- | ------------------------------------------------------------------------------- |
| Space                   | Play / pause                                                                    |
| N / P                   | Next / previous track                                                           |
| Left / Right            | Back / forward 10 seconds (hold to keep going)                                  |
| Up / Down               | Volume +/- 2 (+/- 5 after holding for 3 seconds)                                |
| S / R                   | Turn shuffle / repeat on or off                                                 |
| Q                       | Play a random track from the current filters                                    |
| 1 / 2 / 3 / 4 / 5       | Library / Review / Download / Settings / Mix                                    |
| /                       | Focus the search box, the tag box, or the first empty field of the current page |
| Ctrl + `+` / Ctrl + `-` | Zoom in / out by 5% (works in text fields too)                                  |

The Play/Pause keys of a keyboard or headset also control Ambrosia, through Windows media controls.

### Library

The main page lists your tracks. On the left, tags are grouped in **folders**.

- **Filter by tag**: click a tag once to include it, again to exclude it, a third time to clear it. Active filters show above the list, and clicking one clears it. **Any / All** decides whether a track needs one or every included tag.
- **Other filters**: Music / SFX / Mixtapes (see Mixtapes below), "Unreviewed only", and the search box in the top bar (it ignores case and accents). The number next to each tag counts the tracks that match the current filters.
- **Sort** with the menu in the top bar: name, loudness, length, or number of tags.
- **Tags on a track**: type in the `+ tag` field (suggestions appear after 3 letters, `Tab` accepts one, `Enter` adds it). Typing a new name creates the tag. Hover a tag and click the `x` to remove it.
- **Rename a track**: double-click its name. The file on disk is renamed too, and the extension is kept.
- **Buttons on a row**: play/pause, switch between Music and SFX, delete.
- **Player bar** at the bottom: play, pause, previous, next, shuffle, repeat, seek, volume. Previous and next follow the list as it is currently filtered and sorted.

### Tags and folders

- Tag names are written with a capital letter on each word (`Sea Of Stars`). Two tags cannot differ only by case or accents.
- **Rename a tag**: double-click it. **Move it to another folder**: right-click it.
- **Merge two tags**: right-click a tag and choose **Merge with another tag**. Pick the second tag in the list, type the name the merged tag should have (it starts with the first tag's name), then click **Merge**. Every track that had either tag gets the merged one. It stays in the folder of the tag you right-clicked, and the other tag is deleted. A backup is made first. If the folder is Franchise, a later scan of a subfolder with the old name creates that tag again.
- A tag without a folder is listed under **Ungrouped**, and disappears by itself when no track uses it.
- **Create a folder** with the field at the top of the sidebar. Drag folders to reorder them. Double-click to rename. Right-click for **Recolor**, **Rename**, and two ways to delete: with its tags, or keeping its tags as Ungrouped. Both ask for confirmation.
- The **Franchise** folder is fixed: it cannot be renamed, recolored or deleted.

### Review

Review shows your unreviewed tracks one at a time, in random order, and starts playing each one. Click tags in the folder columns to add or remove them (each column also has a field to create a new tag in that folder), then click **Finish** to mark the track as reviewed and move on. The trash button deletes it. Which folders get a column is set in **Settings > Review**.

### Download

Downloads a YouTube playlist or video as MP3 with yt-dlp (see the install section above).

1. Enter a folder name (the franchise) and the link, then **Start download**. Files go to `<library folder>\<franchise>`. The progress panel on the right follows the whole process, and you can leave the page while it runs. Windows shows a notification when the downloads finish.
2. **Rename rules**: each rule is a regular expression and a replacement, applied in order to the file names. Leave the replacement empty to delete what matches, use `$1` to keep a captured group. The names on the left highlight what the selected rule captures, and the inputs on the right show the result. A name you type yourself is left alone by the rules. The buttons under the rules add common patterns (leading track number, text in brackets, and more). Example: `^\d+\. FTL soundtrack-` with an empty replacement turns `01. FTL soundtrack-Space Cruise` into `Space Cruise`.
3. **Finish** renames the files, scans the library to add them, then measures their loudness. Nothing in your existing library is removed by this.

### Mix

Mix lets you play several tracks at the same time, for example a music track with rain and birds on top, and shape each one with its own settings. Each track in the mix is a **layer**. Open it with the **Mix** tab or the `5` key.

#### How layers get there

- Every track the main player starts in the Library (play button, next, previous, shuffle, `Q`, autoplay of the next track) is added to Mix as a layer that is **silent and paused**. Tracks played in Review are not added, because Review plays every unreviewed track by itself. Playing a track again does not add it twice.
- Silent means the layer's volume is 0. Raise it and press play to hear it on top of the main player. The main player and the mix are independent: pausing one does not pause the other.
- The mix lives while the app is open and is empty at the next start. To keep a mix, save it as a mixtape (see Mixtapes below).
- The list keeps up to 100 layers. Past that, the oldest layer that is not playing is dropped. If a track is deleted from the library, its layer disappears.
- Layers follow **Normalize volume** (Settings > Playback) and its target (Quiet, Normal or Loud) like the main player, so a quiet recording and a loud one start at a similar level. The effects are taken into account too: see "Loudness and effects" below.

#### The layer list

Each row has:

- a **play / pause** button,
- the track name (click it to select the layer and edit it in the bottom panel; the selected row is highlighted),
- a **volume** slider, which reads "Silent" at 0,
- **M** (mute) and **S** (solo). When at least one layer is solo, only the solo layers are heard. Muted layers stay muted even when solo,
- **Loop**, and a button to remove the layer.

A layer that reaches the end of its track stops by itself, unless Loop is on. The **Mix** tab shows a dot while at least one layer is playing.

#### The settings panel

On the Mix page the panel replaces the player bar at the bottom (the player's keyboard shortcuts still work). It shows the selected layer in ten boxes: **two rows of five** when the window is wide enough (about 1150 pixels), and fewer per row in a narrower window. The panel scrolls when the window is short. **Double-click any slider to put it back to its default.**

Top row:

- **Sound**
  - **Volume**: 0 to 100%.
  - **Pan**: left 100% to right 100%. Center is the default.
  - **Speed**: 0.25x to 2x.
  - **Keep pitch**: on by default. When off, speed changes the pitch too (slower is lower), like a tape.
  - **Mono**: plays both sides as one, then Pan places it. Useful to make a wide recording sound like one point in space.
- **Fades**
  - **Fade in** and **Fade out**: 0 to 30 seconds, in steps of half a second. The fade in happens each time the layer starts or loops, and the fade out ends when the part ends (it needs the length of the track, so it works on tracks the library knows the length of). Fades are counted in real time, so they keep their length when you change the speed, and a fade longer than the time that is left is shortened to fit. A layer you pause and resume gets only a very short fade in (50 ms) so that it does not click.
- **Part played**
  - **Start at** and **End at**: in seconds (up to 36000). Type a number and press Enter or leave the field. **End at 0 means "to the end of the track"**, and a value past the end is the same as the end. The field shows the length of the track.
  - **Random start**: each time the layer starts or loops, it begins somewhere random inside the part (at least half a second is always left to play).
- **Timing**
  - **Start delay**: how long the layer waits after you press play before it makes a sound, up to one hour. It applies to a fresh start (play, Play all, a mixtape starting), not when you resume a layer you paused, and not between loops (use the pause for that). Press pause during the wait to cancel it.
  - **Loop**: play the part again when it ends.
  - **Pause min** and **Pause max**: the silence between two loops, in seconds, up to one hour. Each time, the length is picked at random between the two. Leave both at 0 for no pause. Example: Loop on, min 20, max 90 gives rain that comes back every 20 to 90 seconds, or a bird that calls from time to time.
- **Space**
  - **Reverb**: 0 to 100%. A room of about 2.5 seconds, mixed in with the dry sound.

Bottom row:

- **Tone**: **Low**, **Mid** and **High**, from -12 to +12 dB. Low is a shelf at 200 Hz, Mid a bell at 1 kHz, High a shelf at 4 kHz.
- **Filter**
  - **Low cut**: removes sound below the chosen pitch, up to 1000 Hz. **Off** at the left end. Makes a sound thinner.
  - **High cut**: removes sound above the chosen pitch, from 20 kHz down to 200 Hz. **Off** at the right end. Makes a sound duller and farther away.
- **Echo**
  - **Amount**: how loud the echoes are (Off at 0). The sound itself is not changed.
  - **Time**: gap between echoes, 0.05 to 2 seconds.
  - **Repeats**: how many times the echo feeds back into itself, up to 90%. High values with a long time make long tails.
- **Wobble**
  - **Depth**: how far the volume goes down and up (Off at 0).
  - **Rate**: how fast, from 0.1 to 20 times per second. Slow is waves, fast is a flutter.
- **Variation**: a little random change **each time the layer starts or loops**, so a loop never sounds exactly the same.
  - **Vary volume**: the volume is lowered by up to this much. It never goes above the volume you set.
  - **Vary pan**: the pan moves left or right by up to this much.
  - **Vary speed**: the speed changes by up to this much either way (up to 50%).

In the header of the panel:

- **Preset...** applies a ready-made sound. A preset first puts the effects back to plain, then sets what it lists, so presets do not pile up on each other. That includes the part played, the pauses between loops and the start delay, which go back to their defaults. It keeps the volume, loop, mute and solo. You can still adjust anything afterwards.

  | Preset           | What it does                                                                         |
  | ---------------- | ------------------------------------------------------------------------------------ |
  | Cave             | Big, dark space: strong reverb, softer highs, a little more low.                     |
  | Distant          | Far away and softened: high cut at 3 kHz, some reverb, quieter highs.                |
  | Underwater       | Muffled and wobbly: high cut at 900 Hz, reverb, a slow gentle wobble.                |
  | Radio            | Narrow and mono: 400 Hz to 3.5 kHz with a boost in the mids.                         |
  | Telephone        | Very narrow and mono: 500 Hz to 3 kHz with a strong mid boost.                       |
  | Lo-fi            | Warm and dull: 120 Hz to 5 kHz, slightly slow, pitch follows speed.                  |
  | Echo hall        | Repeats that fade away, with a little reverb.                                        |
  | Pulse            | Volume goes up and down five times a second.                                         |
  | Natural ambience | Never quite the same twice: variation on volume, pan and speed, plus a random start. |

- **Copy** and **Paste**: copy the sound of the selected layer, select another layer, and paste. Paste gives it the pan, speed, keep pitch, fades, pauses between loops, tone, filter, echo, wobble, variation, mono and reverb of the copied layer. It does **not** change the volume, loop, mute, solo, part played, random start or start delay. Paste stays disabled until you copy. The copy is kept until you quit the app.
- **Reset effects** puts every setting above back to its default for the selected layer (this includes the part played, the pauses between loops and the start delay), except the volume, loop, mute and solo.

#### Mixing the whole mix

- **Master volume**: the level of all layers together, 0 to 100%.
- **Play all** starts every layer that is not silent. **Pause all** pauses every layer. **Unsolo all** turns every solo off. **Remove silent** drops the layers that are silent and paused. **Clear mix** empties the list.
- **Limiter**: a checkbox. When on, a safety limiter sits at the very end of the sound and presses down only the peaks (above about -3 dB), so stacking many layers does not clip or crackle. It is off by default, because it also slightly changes how a dense mix sounds.
- **Fade out and pause**: choose 5, 10, 30 or 60 seconds, then click the button. Everything fades to silence, then every layer is paused, and the level comes back so the next play is normal. The button is disabled while a fade is going on.
- **Sleep timer**: choose 15, 30, 45, 60, 90 or 120 minutes, then **Start sleep timer**. The mix plays until the end of that time, with the last 20 seconds used as a fade out, then pauses. The page shows about how many minutes are left. **Cancel** stops the timer, and also a fade that has started. The timer keeps running when you go to another page.
- Starting playback again during a fade (a layer's play button, **Play all**, or playing a mixtape) cancels the fade and brings the level back.
- **Save as mixtape...** and **Update "name"**: see Mixtapes.

#### Loudness and effects

Tone, filters, mono, reverb, echo and wobble change how loud a layer is, and the loudness stored for the track does not know that. So when **Normalize volume** is on, a layer that has one of those effects is measured **with its effects** before it plays:

- The first 30 seconds of the part played (from **Start at**, until **End at** or 30 seconds) are played through the same effects, silently, and measured with the same loudness method as the library. The layer is then brought to the target loudness, with the same limit as the main player (a boost never pushes the sound into distortion). Your volume slider, pan, speed, fades and loop are not part of the measurement, so moving them does not trigger it.
- A layer with no such effect keeps the correction of the plain track, with no extra work.
- The measurement runs about a third of a second after you stop changing a setting, and takes a moment. **A layer waits to start until it is done** (play, Play all, and a mixtape starting), and the Mixing box shows "Matching the loudness of N layers with their effects...". It never starts at the wrong level. When you change an effect on a layer that is playing, it keeps its level until the new measurement is ready, then moves to the new one smoothly.
- If a track cannot be read or its part is shorter than half a second, the layer falls back to the plain correction.
- **Several layers still add up.** Each layer reaches the same loudness on its own, so a mix of three has a higher total. Use the layers' volume sliders, the master volume and the **Limiter** to balance them.
- With **Normalize volume** off, none of this happens and the layers play at the level of their files.

#### Recipes

- **Rainy forest**: add a calm music track and a rain recording. Give the rain Loop, a 5 second fade in and fade out, **Natural ambience**, and volume 40%. Add a bird track with Loop, **Pause min** 20 and **Pause max** 90, **Vary pan** 60%, volume 25%.
- **Memory in a tunnel**: use **Underwater** or **Distant** on a melody and add **Echo hall** to a second copy of the track with a start delay of 2 seconds.
- **Falling asleep**: build a mix, turn on the **Limiter**, and start a 30 minute **sleep timer**.

### Mixtapes

A mixtape is a mix that you saved. It is stored in the library like a track, and listed in the **Mixtapes** category of the Library (next to All, Music and SFX).

- **Save as mixtape...** on the Mix page saves the current layers under a name: every layer with **all of its settings** (volume, mute, solo, loop, tone, filter, echo, wobble, variation, mono, fades, part played, timing and so on) and the master volume. A name has up to 60 characters, extra spaces are cleaned, and two mixtapes cannot have the same name (case and accents are ignored). A mixtape holds up to 200 layers.
- **Play** on a mixtape in the Library **replaces the current mix** with its layers and settings, switches the master volume to the saved one, selects the first layer, and starts every layer that is not silent. Play again to pause. A mixtape whose tracks were all deleted has nothing to play: it does not touch your current mix.
- When a mixtape is loaded, **Update "name"** on the Mix page replaces its content with your current layers. Use **Save as mixtape...** to keep the original and make a new one.
- In the list, a mixtape can be **tagged** like a track (tag filters, Any / All and the counts all include mixtapes), **renamed** with a double-click, and **deleted**. Deleting a mixtape never deletes the tracks in it. Search and the sort menu work too (by name or by number of tags).
- A mixtape only keeps tracks that are in the library: when you delete a track, it leaves the mixtapes that used it. Mixtapes created with an earlier version open with the new settings turned off, and sound as before.
- Merging two tags also merges them on mixtapes, and mixtapes are part of the backups and restores.

### Settings

- **Library**: library folder, **Scan library**, and the `_Deleted` folder (**Restore All** and **Delete All**).
- **Presets**: appearance presets (colors and density). Presets you save also keep the default volume, the loudness settings and the Review folders.
- **Appearance**: System / Light / Dark theme, accent color, density, and four background colors. Each color has a hex field with Copy and Paste buttons.
- **Playback**: default volume, and **Normalize volume**. Every track gets one volume adjustment so that all tracks play at about the same loudness, as streaming services do. Pick Quiet (-19), Normal (-14) or Loud (-11). A boost never pushes a track into distortion, so a very quiet track may stay below the target. The music files are never modified.
- **Review**, **Track list**: which folders appear in Review, and how many tracks the Library draws at a time.
- **Backups**: see below.
- **Updates**: your version, **Check for updates**, and the automatic check (see Updating above).

## Deleting, scanning and loudness

- **Delete** moves the file to the `_Deleted` folder inside the library folder. **Restore All in \_Deleted** puts every track back. **Delete All in \_Deleted** erases those files for good and forgets the tracks. A file you delete by hand from `_Deleted` is forgotten the next time Ambrosia starts or scans.
- **Scan library** adds new files, removes tracks whose files are gone, then measures the loudness of the new tracks. A backup is made first. If a whole folder cannot be found (an unplugged drive, a renamed folder), the tracks inside are left alone and the scan lists the folder.
- A file that is moved or renamed outside Ambrosia counts as one removed track and one new track, so it loses its tags. Rename tracks inside Ambrosia instead.

## Your data

| What              | Where                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Library database  | `%APPDATA%\ambrosia\ambrosia.db`                                   |
| Automatic backups | `%APPDATA%\ambrosia\backups`                                       |
| Manual backups    | your Downloads folder                                              |
| Music             | your library folder, and anywhere else your tracks were added from |

Backups contain tracks, tags, folders, mixtapes and settings, not the music files. The current mix (the layers on the Mix page) is not saved anywhere until you save it as a mixtape.

- A backup is made automatically once a day, and before applying a scan, deleting a folder together with its tags, merging tags, permanent track deletion, and any restore. The newest 10 automatic backups are kept.
- **Settings > Backups**: **Back up now**, **Open folder**, and **Restore** on any entry in the list or from a file. Restoring first saves a copy of your current library, so it can be undone.

## Development

```powershell
npm install
npm run dev     # run the app with hot reload
npm test        # unit tests
npm run lint
npm run dist    # build the installer into release/
npm run release # build and upload a release to GitHub (see below)
```

### Publishing a release

Installed copies of Ambrosia update from the project's GitHub releases.

1. Raise `version` in `package.json` (for example `1.2.1`).
2. Create a GitHub token that can write to the repository, and set it in PowerShell: `$env:GH_TOKEN = "<token>"`.
3. Run `npm run release`. It builds the installer and uploads `Ambrosia-Setup-<version>.exe`, its `.blockmap` and `latest.yml` to a **draft** release.
4. Open the draft on GitHub and click **Publish release**. Installed copies only see published releases.

Do not rename the uploaded files: `latest.yml` points to the installer by name.

Project layout:

```
electron/   main process: database, scan, downloads, backups, IPC handlers
src/        React app: pages, components, state, shared code
assets/     app icon
tools/      one-off scripts
```

Everything the page can ask the main process to do is defined once in `src/shared/api.ts` and `src/shared/channels.ts`, so a missing handler is a compile error. Commits follow the Conventional Commits format.

## Troubleshooting

- **"yt-dlp was not found"**: install it (see above) and restart Ambrosia.
- **No notification**: Windows needs the app to be installed, so notifications may not appear when running from `npm run dev`.
- **Tracks flagged as missing**: their files were moved or deleted outside Ambrosia. Put them back, or let **Apply changes** remove them.
- **A track plays at a different volume than others**: it may not be measured yet. Run **Apply changes**, or check that **Normalize volume** is on.
- **Shortcuts do nothing**: check the `Keys` badge in the title bar, and press Ctrl + Alt to turn them on. They are also off while a text field has focus.
- **Media keys do not control Ambrosia**: they only act while a track is loaded. Another media app may have taken them, so close it or press play in Ambrosia once.
- **A layer in Mix makes no sound**: its volume starts at 0 ("Silent"). Raise it, check that M (mute) is off and that no other layer is solo, then press play. If the layer has a **start delay**, wait for it, or set it back to 0.
- **A layer in Mix stopped by itself**: a track that reaches its end (or the **End at** time) stops unless **Loop** is on.
- **A loop is not perfectly seamless**: a plain loop (no part, no fade out, no pause, no random start, no variation) loops without a gap. Any of those settings makes the app start the layer again itself, which can leave a very short gap.
- **The sleep timer or fade did nothing**: the buttons need at least one layer playing. If the mix was already paused, there is nothing to fade.
- **The mix is empty after a restart**: the Mix page is not saved on its own. Save it as a mixtape first.
- **A layer takes a moment to start**: it is measuring its loudness with its effects (see Loudness and effects). Longer, stereo or high-quality tracks take longer, mostly the first time. Turn off **Normalize volume** to skip it.
- **The mix sounds harsh or crackles when many layers play**: lower the master volume or the layers' volumes, or turn on the **Limiter**.
- **A mixtape does not start**: its tracks may have been deleted from the library. Open it from the Library to see how many it has left.
