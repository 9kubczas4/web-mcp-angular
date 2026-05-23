import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { App } from './app';
import { APP_ROUTES } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(APP_ROUTES), provideLocationMocks()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the shell layout', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('nav[aria-label="Primary"]')).not.toBeNull();
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
});
