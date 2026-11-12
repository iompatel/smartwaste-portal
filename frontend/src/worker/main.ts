import { bootstrapApplication } from '@angular/platform-browser';

import { App } from '../app/app';
import { redirectFromRenderOrigin } from '../app/core/canonical-origin';
import { workerConfig } from './worker.config';

if (
  !redirectFromRenderOrigin(
    'smartwaste-worker.onrender.com',
    'https://worker.smartwaste.dpdns.org',
  )
) {
  bootstrapApplication(App, workerConfig).catch((error) => console.error(error));
}
