# Installing OneEditor

OneEditor is free. Download it from the project's **Releases** page on GitHub
(<https://github.com/codingspacekh/OneEditor/releases>), under the newest version, in **Assets**.
You install it **once**: after that, new versions arrive in the app (see *Updates* below).

| Your computer | Download | Size |
|---|---|---|
| Windows 11 (64-bit) | `OneEditor-Setup-<version>.exe` (installer) | about 175 MB |
| Windows 11, without installing (e.g. from a USB stick) | `OneEditor-<version>-win.zip`: unzip it and run `OneEditor.exe` | about 235 MB |
| Mac with an Apple chip (M1, M2, M3, M4…) | `OneEditor-<version>-mac-arm64.dmg` | about 190 MB |
| Mac with an Intel processor | `OneEditor-<version>-mac-x64.dmg` | about 210 MB |

**Which Mac do I have?** Apple menu  ▸ **About This Mac**. If it says **Chip: Apple M…**, take
`arm64`. If it says **Processor: … Intel …**, take `x64`.

OneEditor works offline once installed. It brings everything it needs with it (FFmpeg for video
and sound, and its fonts), so it looks and exports the same on every computer.

## Windows

1. Double-click `OneEditor-Setup-<version>.exe`.
2. Windows may show **"Windows protected your PC"**. OneEditor is safe, but it is not signed with a
   paid certificate. Click **More info**, then **Run anyway**.
3. Choose where to install it (your own user folder is fine; no administrator password is needed)
   and click **Install**. OneEditor is in the Start menu.

**Microphone** (to record a voiceover): if recording says the microphone is blocked, open
**Settings ▸ Privacy & security ▸ Microphone** and turn on **Let desktop apps access your
microphone**.

**Uninstall:** Settings ▸ Apps ▸ Installed apps ▸ OneEditor ▸ Uninstall. Your projects are kept.

## macOS

1. Double-click the `.dmg` file, then drag **OneEditor** into the **Applications** folder.
2. Open OneEditor from Applications. Because OneEditor is not notarised by Apple (that costs a
   yearly fee), the Mac says it **"cannot be verified"** or **"cannot be opened"**. Click **Done**
   (or **Cancel**), not **Move to Trash**.
3. Open **System Settings ▸ Privacy & Security**, scroll down to **Security**, and click
   **Open Anyway** next to "OneEditor was blocked…". Enter your password and click **Open**.
   - On older macOS versions you can instead **right-click** (or Control-click) OneEditor in
     Applications, choose **Open**, then **Open** again.
4. You only do this once. After that OneEditor opens normally.

**Microphone:** the first time you record a voiceover, the Mac asks whether OneEditor may use the
microphone: click **Allow**. If you clicked Don't Allow, turn it on in **System Settings ▸ Privacy &
Security ▸ Microphone ▸ OneEditor**.

**Uninstall:** drag OneEditor from Applications to the Bin. Your projects are kept.

## Updates

From version 1.5 OneEditor looks for a newer version when it opens and every 6 hours (only the
version's name is asked for: nothing about you or your work is sent).

1. When one is out, a note at the bottom of the window says **"OneEditor 1.5.1 is out"**, with
   **What's new** and **Download**. Keep working while it downloads.
2. When it says **"1.5.1 is ready"**, click **Restart and update**, or **Later**: then it goes in
   the next time you close OneEditor. It never restarts by itself, and your projects are never
   touched.
3. After the update, the note says **"Updated to 1.5.1"** once, with what is new.

**Help ▸ Check for Updates…** shows your version, looks now, and has **Download updates by
itself** (off at first: turn it on to skip the Download step). Without the internet nothing is
said; it looks again later. A Mac that cannot put the update in by itself downloads the new
`.dmg` to **Downloads** instead: **Open it** and drag OneEditor into Applications again.

## The first time you open it

A **Welcome** page shows the three modes (Video, Audio, Learn) and where your work is saved.
**Help ▸ Welcome** shows it again. Rest the mouse on any button to see what it does.

- **File ▸ Save** makes a project file (`.mve`) and, if you used Audio mode, a folder of sound next
  to it. Your videos, pictures and music stay where they are.
- To move a project to another computer (for example from a Mac at school to a Windows laptop at
  home), use **File ▸ Package Project**: it copies the project and every file it uses into one
  folder. Open the `.mve` in that folder on the other computer.
- If OneEditor closes unexpectedly, it offers to restore your work the next time it opens.

## For teachers

- **Releasing a new version** (the maintainer): push the version tag; the Release workflow makes
  a draft release with the Windows installer. On the Mac with the signing certificate, run
  `npm run release:mac` to add the two Mac installers. Check the draft, then **publish** it: every
  installed OneEditor (1.5 or later) sees it within 6 hours, or at its next start.
- The licences of everything OneEditor includes are in **Help ▸ Licences** (also
  `THIRD_PARTY_LICENSES.txt` in the installation).
- The **Task checker** (Learn mode) lets you save a task's expected format, size and length as a
  `.mvetask` file for students to check their exports against.
