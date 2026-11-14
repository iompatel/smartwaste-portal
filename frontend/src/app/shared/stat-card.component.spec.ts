import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatCardComponent } from './stat-card.component';

describe('StatCardComponent', () => {
  let component: StatCardComponent;
  let fixture: ComponentFixture<StatCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatCardComponent);
    component = fixture.componentInstance;
    component.label = 'Total Tickets';
    component.value = 42;
    component.icon = 'tickets';
    fixture.detectChanges();
  });

  it('should render label and value', () => {
    const el = fixture.nativeElement;
    expect(el.querySelector('.label').textContent).toContain('Total Tickets');
    expect(el.querySelector('h3').textContent).toContain('42');
  });

  it('should render icon container with matching icon class', () => {
    const iconContainer = fixture.nativeElement.querySelector('.card-icon');
    expect(iconContainer).toBeTruthy();
    expect(iconContainer.classList.contains('tickets')).toBeTrue();
  });
});
