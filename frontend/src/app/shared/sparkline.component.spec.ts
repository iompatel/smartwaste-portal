import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SparklineComponent } from './sparkline.component';

describe('SparklineComponent', () => {
  let component: SparklineComponent;
  let fixture: ComponentFixture<SparklineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SparklineComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SparklineComponent);
    component = fixture.componentInstance;
  });

  it('should display empty state when peak is 0', () => {
    component.data = [];
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector('.empty');
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain('No data to chart yet');
  });

  it('should compute peak and latest properly when data is provided', () => {
    component.data = [5, 12, 8, 20, 15, 30, 25];
    fixture.detectChanges();

    expect(component.peak).toBe(30);
    expect(component.latest).toBe(25);
    expect(component.dayLabels.length).toBe(7);

    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeTruthy();

    const peakText = fixture.nativeElement.querySelector('.peak');
    expect(peakText.textContent).toContain('Peak 30');
  });
});
