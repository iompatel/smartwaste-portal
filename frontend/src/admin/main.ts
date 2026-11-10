import { bootstrapApplication } from '@angular/platform-browser';

import { App } from '../app/app';
import { adminConfig } from './admin.config';

bootstrapApplication(App, adminConfig).catch((error) => console.error(error));
