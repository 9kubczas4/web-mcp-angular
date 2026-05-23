import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { ROUTE_PATH } from '../../app.route-paths';

import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), provideLocationMocks()],
    }).compileComponents();
  });

  it('renders without throwing', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders every route from ROUTE_PATH in the overview', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h1')?.textContent).toContain('WebMCP Angular Demo');

    const text = host.textContent ?? '';
    for (const path of Object.values(ROUTE_PATH)) {
      expect(text).toContain(path);
    }
  });
});
