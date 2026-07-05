import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapacitorApp.addListener('backButton', () => {
      if (location.pathname === '/' || location.pathname === '/login') {
        CapacitorApp.exitApp(); // only exit from the Dashboard (home) or login screen
      } else {
        navigate(-1); // otherwise, go back one page - matches normal Android app behavior
      }
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, [location, navigate]);
}