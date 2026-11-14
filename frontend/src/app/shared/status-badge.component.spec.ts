import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusBadgeComponent } from './status-badge.component';

describe('StatusBadgeComponent', () => {
  let component: StatusBadgeComponent;
  let fixture: ComponentFixture<StatusBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusBadgeComponent);
    component = fixture.componentInstance;
    component.status = 'in_progress';
    fixture.detectChanges();
  });

  it('should format underscore status to readable space label', () => {
    expect(component.label).toBe('in progress');
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge.textContent.trim()).toBe('in progress');
    expect(badge.classList.contains('in_progress')).toBeTrue();
  });
});
