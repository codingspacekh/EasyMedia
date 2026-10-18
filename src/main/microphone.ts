// X4 Microphone access. macOS keeps its own list of apps allowed to use the microphone: the
// first time, the app asks (the system shows its dialog with NSMicrophoneUsageDescription);
// after a "no" it must not ask again, and the page shows where to change it. On Windows the
// Microphone privacy setting is checked by the browser itself when the microphone is opened.

export interface MediaAccess {
  getMediaAccessStatus(mediaType: 'microphone'): string;
  askForMediaAccess(mediaType: 'microphone'): Promise<boolean>;
}

/** `fakeMicrophone`: Chromium's test microphone is in use (end-to-end tests), so no OS check. */
export function microphoneAccess(
  platform: NodeJS.Platform,
  system: MediaAccess,
  fakeMicrophone: boolean,
): () => Promise<boolean> {
  return async () => {
    if (platform !== 'darwin' || fakeMicrophone) return true;
    const status = system.getMediaAccessStatus('microphone');
    if (status === 'granted') return true;
    if (status === 'not-determined') return system.askForMediaAccess('microphone');
    return false; // denied, or restricted by the school's settings
  };
}
