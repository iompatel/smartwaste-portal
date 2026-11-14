import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DonutChartComponent } from './donut-chart.component';

describe('DonutChartComponent', () => {
  let component: DonutChartComponent;
  let fixture: ComponentFixture<DonutChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DonutChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DonutChartComponent);
    component = fixture.componentInstance;
  });

  it('should display empty message when total is 0', () => {
    component.slices = [];
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector('.empty');
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain('No data to chart yet');
  });

  it('should calculate total and visible slices properly', () => {
    component.slices = [
      { label: 'Open', value: 30, color: '#3b82f6' },
      { label: 'Completed', value: 70, color: '#10b981' },
      { label: 'Empty', value: 0, color: '#6b7280' },
    ];
    fixture.detectChanges();

    expect(component.total).toBe(100);
    expect(component.visible.length).toBe(2);
    expect(component.visible[0].pct).toBe(30);
    expect(component.visible[1].pct).toBe(70);

    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeTruthy();

    const totalText = fixture.nativeElement.querySelector('.center strong');
    expect(totalText.textContent).toContain('100');
  });
});
