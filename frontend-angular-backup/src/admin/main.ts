import { bootstrapApplication } from '@angular/platform-browser';

import { App } from '../app/app';
import { redirectFromRenderOrigin } from '../app/core/canonical-origin';
import { adminConfig } from './admin.config';

if (
  !redirectFromRenderOrigin(
    'smartwaste-admin.onrender.com',
    'https://admin.smartwaste.dpdns.org',
  )
) {
  bootstrapApplication(App, adminConfig).catch((error) => console.error(error));
}
