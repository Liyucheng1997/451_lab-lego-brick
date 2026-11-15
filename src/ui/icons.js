const svg = (inner) => `<svg viewBox="0 0 24 24">${inner}</svg>`;

export const ICONS = {
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  undo: svg('<path d="M9 7H5V3"/><path d="M5.5 7.2A8 8 0 1 1 4 12"/>'),
  redo: svg('<path d="M15 7h4V3"/><path d="M18.5 7.2A8 8 0 1 0 20 12"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  dusk: svg('<path d="M3 18h18M6 18a6 6 0 0 1 12 0"/><path d="M12 6V3M5.6 9.6 3.5 7.5M18.4 9.6l2.1-2.1M8 22h8"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  target: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7"/><path d="M12 17h.01"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>'),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  upload: svg('<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>'),
  brick: svg('<rect x="3" y="10" width="18" height="9" rx="2"/><rect x="5.5" y="6.5" width="4" height="3.5" rx="1"/><rect x="14.5" y="6.5" width="4" height="3.5" rx="1"/>'),
  hammer: svg('<path d="M14 6l4 4M3 21l9-9M12 4l8 8-3 3-8-8z"/>'),
  brush: svg('<path d="M18 3l3 3-9 9-3-3z"/><path d="M9 12c-3 0-5 2-5 5 0 1-1 2-2 2 2 2 6 2 8 0 1.5-1.5 2-3 2-4"/>'),
  dropper: svg('<path d="M14 4l6 6M17 7l-9.5 9.5L5 19l-1 1M7.5 16.5 5 14l9.5-9.5"/><path d="M15 3l6 6"/>'),
  rotate: svg('<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>'),
};
