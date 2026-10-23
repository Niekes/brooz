/**
 * Whether a URL belongs to the app itself: the app:// origin, or the Vite dev
 * server while `npm run dev` is running. Everything else is refused, both as
 * a navigation target and as an IPC sender.
 */
export function isAppOrigin(url: string, devUrl?: string): boolean {
    return url.startsWith('app://') || url === devUrl;
}
