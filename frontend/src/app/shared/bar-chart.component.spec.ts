import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarChartComponent } from './bar-chart.component';

describe('BarChartComponent', () => {
  let component: BarChartComponent;
  let fixture: ComponentFixture<BarChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BarChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BarChartComponent);
    component = fixture.componentInstance;
  });

  it('should display empty message when data is empty', () => {
    component.data = [];
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector('.empty');
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain('No data to chart yet');
  });

  it('should normalize bar percentages relative to max value', () => {
    component.data = [
      { label: 'Plastic', value: 50 },
      { label: 'Organic', value: 100 },
    ];
    fixture.detectChanges();

    expect(component.normalized.length).toBe(2);
    expect(component.normalized[0].pct).toBe(50);
    expect(component.normalized[1].pct).toBe(100);

    const bars = fixture.nativeElement.querySelectorAll('.bar-row');
    expect(bars.length).toBe(2);
  });
});
