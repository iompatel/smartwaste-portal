import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let component: EmptyStateComponent;
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
    component = fixture.componentInstance;
    component.title = 'No Data Found';
    component.message = 'Please check back later';
    component.icon = 'empty-tickets';
    fixture.detectChanges();
  });

  it('should render title, message, and icon', () => {
    const el = fixture.nativeElement;
    expect(el.querySelector('.empty-state-title').textContent).toContain('No Data Found');
    expect(el.querySelector('.empty-state-message').textContent).toContain('Please check back later');
    expect(el.querySelector('.empty-state-icon svg')).toBeTruthy();
  });

  it('should render actions and trigger callbacks on click', () => {
    let clicked = false;
    component.actions = [
      {
        label: 'Retry Action',
        callback: () => { clicked = true; },
        variant: 'primary',
      },
    ];
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.empty-state-actions button');
    expect(button).toBeTruthy();
    expect(button.textContent).toContain('Retry Action');

    button.click();
    expect(clicked).toBeTrue();
  });
});
