import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

bootstrapApplication(App, appConfig)
  .then(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('[App] Service Worker enregistré avec succès:', reg.scope))
        .catch((err) => console.error('[App] Échec de l\'enregistrement du Service Worker:', err));
    }
  })
  .catch((err) => console.error(err));
