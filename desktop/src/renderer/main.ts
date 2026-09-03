import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { rewriteNonHashAppPath } from './app/hash-location-rewrite';

if (rewriteNonHashAppPath(window.location)) {
  return;
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
