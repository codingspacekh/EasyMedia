// jsdom has no canvas: the preview's text canvas simply draws nothing in component tests
// (text drawing is tested in core, and for real in the E2E tests).
HTMLCanvasElement.prototype.getContext = () => null;
