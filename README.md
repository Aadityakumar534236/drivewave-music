# DriveWave Music

Build an ads-free Spotify-style music streaming web player where songs stream from a public Google Drive folder.

Specifications:

Spotify layout and design: Dark mode with a responsive sidebar (Home, Search, Library, Playlists), top search/navigation bar, main track grid and table list, and a sticky bottom player bar with seek bar, volume, shuffle, repeat, previous, next, and play/pause controls.

Google Drive sync via Public Folder ID: Loads and streams audio directly from a designated public Google Drive folder (folder permission 'Anyone with link can view'). Include a settings modal to configure or update the Google Drive Folder ID, with sensible default/demo tracks so it works out of the box.

Audio formats supported: MP3, WAV, FLAC, M4A, AAC, and OGG.

Anonymous track metadata: Clean file names into song titles automatically (removing track prefixes and extensions like '01 - ' or '.mp3'), and strictly display both Artist and Album as 'ME' across all lists, cards, and player views.

Access controls: Public ads-free streaming for all visitors; library is read-only for listeners because only the owner has upload rights to the Google Drive folder.


>>"This are the questions which maybe you will ask 
Do you already have a Google Drive folder set up that I should use?

Yes, I have the ID

Which audio formats should the player accept from the Drive folder?

All six as specced

How should song titles and artist/album info be derived from the files?

As specced

Is the intended access model: public streaming for all visitors, and uploads happen only via Google Drive by you?

Yes, as specced

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/91653337-1fe2-4aed-a9cd-e2dee23da39d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
