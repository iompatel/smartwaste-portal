import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoaderComponent } from './loader.component';

describe('LoaderComponent', () => {
  let component: LoaderComponent;
  let fixture: ComponentFixture<LoaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoaderComponent);
    component = fixture.componentInstance;
    component.label = 'Loading Portal...';
    fixture.detectChanges();
  });

  it('should render label and svg spinner', () => {
    const labelEl = fixture.nativeElement.querySelector('.loader-label');
    expect(labelEl.textContent).toContain('Loading Portal...');

    const svg = fixture.nativeElement.querySelector('.spinner-svg');
    expect(svg).toBeTruthy();
  });
});
