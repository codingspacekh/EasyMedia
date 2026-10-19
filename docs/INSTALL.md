# Installing EasyMedia

EasyMedia is free. Download it from the project's **Releases** page on GitHub
(<https://github.com/codingspacekh/EasyMedia/releases>), under the newest version, in **Assets**.

| Your computer | Download | Size |
|---|---|---|
| Windows 11 (64-bit) | `EasyMedia-Setup-<version>.exe` (installer) | about 175 MB |
| Windows 11, without installing (e.g. from a USB stick) | `EasyMedia-<version>-win.zip`: unzip it and run `EasyMedia.exe` | about 235 MB |
| Mac with an Apple chip (M1, M2, M3, M4…) | `EasyMedia-<version>-mac-arm64.dmg` | about 190 MB |
| Mac with an Intel processor | `EasyMedia-<version>-mac-x64.dmg` | about 210 MB |

**Which Mac do I have?** Apple menu  ▸ **About This Mac**. If it says **Chip: Apple M…**, take
`arm64`. If it says **Processor: … Intel …**, take `x64`.

EasyMedia works offline once installed. It brings everything it needs with it (FFmpeg for video
and sound, and its fonts), so it looks and exports the same on every computer.

## Windows

1. Double-click `EasyMedia-Setup-<version>.exe`.
2. Windows may show **"Windows protected your PC"**. EasyMedia is safe, but it is not signed with a
   paid certificate. Click **More info**, then **Run anyway**.
3. Choose where to install it (your own user folder is fine; no administrator password is needed)
   and click **Install**. EasyMedia is in the Start menu.

**Microphone** (to record a voiceover): if recording says the microphone is blocked, open
**Settings ▸ Privacy & security ▸ Microphone** and turn on **Let desktop apps access your
microphone**.

**Uninstall:** Settings ▸ Apps ▸ Installed apps ▸ EasyMedia ▸ Uninstall. Your projects are kept.

## macOS

1. Double-click the `.dmg` file, then drag **EasyMedia** into the **Applications** folder.
2. Open EasyMedia from Applications. Because EasyMedia is not notarised by Apple (that costs a
   yearly fee), the Mac says it **"cannot be verified"** or **"cannot be opened"**. Click **Done**
   (or **Cancel**), not **Move to Trash**.
3. Open **System Settings ▸ Privacy & Security**, scroll down to **Security**, and click
   **Open Anyway** next to "EasyMedia was blocked…". Enter your password and click **Open**.
   - On older macOS versions you can instead **right-click** (or Control-click) EasyMedia in
     Applications, choose **Open**, then **Open** again.
4. You only do this once. After that EasyMedia opens normally.

**Microphone:** the first time you record a voiceover, the Mac asks whether EasyMedia may use the
microphone: click **Allow**. If you clicked Don't Allow, turn it on in **System Settings ▸ Privacy &
Security ▸ Microphone ▸ EasyMedia**.

**Uninstall:** drag EasyMedia from Applications to the Bin. Your projects are kept.

## The first time you open it

A **Welcome** page shows the three modes (Video, Audio, Learn) and where your work is saved.
**Help ▸ Welcome** shows it again. Rest the mouse on any button to see what it does.

- **File ▸ Save** makes a project file (`.mve`) and, if you used Audio mode, a folder of sound next
  to it. Your videos, pictures and music stay where they are.
- To move a project to another computer (for example from a Mac at school to a Windows laptop at
  home), use **File ▸ Package Project**: it copies the project and every file it uses into one
  folder. Open the `.mve` in that folder on the other computer.
- If EasyMedia closes unexpectedly, it offers to restore your work the next time it opens.

## For teachers

- The licences of everything EasyMedia includes are in **Help ▸ Licences** (also
  `THIRD_PARTY_LICENSES.txt` in the installation).
- The **Task checker** (Learn mode) lets you save a task's expected format, size and length as a
  `.mvetask` file for students to check their exports against.
