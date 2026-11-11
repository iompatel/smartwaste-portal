import { bootstrapApplication } from '@angular/platform-browser';

import { App } from '../app/app';
import { workerConfig } from './worker.config';

bootstrapApplication(App, workerConfig).catch((error) => console.error(error));
