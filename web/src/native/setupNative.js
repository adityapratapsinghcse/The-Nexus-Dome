import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export async function setupNativeUI() {
  if (!Capacitor.isNativePlatform()) return; // no-op on web, only runs inside the Android app

  try {
    await StatusBar.setStyle({ style: Style.Dark }); // white icons/text, since your theme is dark
    await StatusBar.setBackgroundColor({ color: '#12161B' }); // matches --bg-deep exactly
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (err) {
    console.warn('StatusBar setup skipped:', err);
  }
}