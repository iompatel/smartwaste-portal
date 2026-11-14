import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RolePillComponent } from './role-pill.component';

describe('RolePillComponent', () => {
  let component: RolePillComponent;
  let fixture: ComponentFixture<RolePillComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RolePillComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RolePillComponent);
    component = fixture.componentInstance;
    component.role = 'worker';
    fixture.detectChanges();
  });

  it('should render role text and class', () => {
    const pill = fixture.nativeElement.querySelector('.pill');
    expect(pill.textContent.trim()).toBe('worker');
    expect(pill.classList.contains('worker')).toBeTrue();
  });
});
