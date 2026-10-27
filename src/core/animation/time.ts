// AN8: frames and seconds. The timeline counts frames (the syllabus's word); the workbook's
// tasks give times in seconds, so both are shown and either can be typed.

/** The nearest whole frame to a time. */
export const framesFor = (seconds: number, fps: number): number => Math.round(seconds * fps);

export const secondsFor = (frames: number, fps: number): number => frames / fps;
