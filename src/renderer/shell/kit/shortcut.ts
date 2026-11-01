/**
 * The settings shortcut: ⌘, on macOS, Ctrl+, on Windows and Linux. Both
 * modifiers open it everywhere - Win+, belongs to the OS and never arrives -
 * the label names the one the platform uses.
 */

/** Whether a key press is the settings shortcut. */
export function isSettingsShortcut(event: KeyboardEvent): boolean {
    return (event.metaKey || event.ctrlKey) && event.key === ',';
}

/** The settings shortcut as the platform writes it. */
export function settingsShortcut(): string {
    return navigator.userAgent.includes('Mac') ? '⌘,' : 'Ctrl+,';
}
