Readme · MD

# Ambrosia

Ambrosia is a Windows desktop app for organizing a music library with tags. You sort tracks into folders of tags (mood, scene, location, franchise...), review new music one track at a time, download playlists from YouTube, and let the app keep every track at a similar loudness.

Built with Electron, React and Vite. Your library is stored in a local SQLite database, and your music files stay as normal files on disk.

## Install

1. Download the installer, `Ambrosia Setup <version>.exe`, from the project's releases.
2. Run it. Windows shows a blue **Windows protected your PC** screen, because the installer is not signed with a paid certificate. Click **More info**, then **Run anyway**.
3. Choose an install folder (or keep the default) and finish. Ambrosia appears in the Start Menu and on the desktop.

### Updating

Run the new installer over the old one. Your library, settings and backups are kept.

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
| 1 / 2 / 3 / 4           | Library / Review / Download / Settings                                          |
| /                       | Focus the search box, the tag box, or the first empty field of the current page |
| Ctrl + `+` / Ctrl + `-` | Zoom in / out by 5% (works in text fields too)                                  |

The Play/Pause keys of a keyboard or headset also control Ambrosia, through Windows media controls.

### Library

The main page lists your tracks. On the left, tags are grouped in **folders**.

- **Filter by tag**: click a tag once to include it, again to exclude it, a third time to clear it. Active filters show above the list, and clicking one clears it. **Any / All** decides whether a track needs one or every included tag.
- **Other filters**: Music / SFX, "Unreviewed only", and the search box in the top bar (it ignores case and accents). The number next to each tag counts the tracks that match the current filters.
- **Sort** with the menu in the top bar: name, loudness, length, or number of tags.
- **Tags on a track**: type in the `+ tag` field (suggestions appear after 3 letters, `Tab` accepts one, `Enter` adds it). Typing a new name creates the tag. Hover a tag and click the `x` to remove it.
- **Rename a track**: double-click its name. The file on disk is renamed too, and the extension is kept.
- **Buttons on a row**: play/pause, switch between Music and SFX, delete.
- **Player bar** at the bottom: play, pause, previous, next, shuffle, repeat, seek, volume. Previous and next follow the list as it is currently filtered and sorted.

### Tags and folders

- Tag names are written with a capital letter on each word (`Sea Of Stars`). Two tags cannot differ only by case or accents.
- **Rename a tag**: double-click it. **Move it to another folder**: right-click it.
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

### Settings

- **Library**: library folder, **Scan library**, and the `_Deleted` folder (**Restore All** and **Delete All**).
- **Presets**: appearance presets (colors and density). Presets you save also keep the default volume, the loudness settings and the Review folders.
- **Appearance**: System / Light / Dark theme, accent color, density, and four background colors. Each color has a hex field with Copy and Paste buttons.
- **Playback**: default volume, and **Normalize volume**. Every track gets one volume adjustment so that all tracks play at about the same loudness, as streaming services do. Pick Quiet (-19), Normal (-14) or Loud (-11). A boost never pushes a track into distortion, so a very quiet track may stay below the target. The music files are never modified.
- **Review**, **Track list**: which folders appear in Review, and how many tracks the Library draws at a time.
- **Backups**: see below.

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

Backups contain tracks, tags, folders and settings, not the music files.

- A backup is made automatically once a day, and before applying a scan, deleting a folder together with its tags, permanent track deletion, and any restore. The newest 10 automatic backups are kept.
- **Settings > Backups**: **Back up now**, **Open folder**, and **Restore** on any entry in the list or from a file. Restoring first saves a copy of your current library, so it can be undone.

## Development

```powershell
npm install
npm run dev     # run the app with hot reload
npm test        # unit tests
npm run lint
npm run dist    # build the installer into release/
```

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
