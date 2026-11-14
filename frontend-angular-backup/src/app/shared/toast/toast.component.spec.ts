import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastContainerComponent } from './toast.component';
import { ToastService } from './toast.service';

describe('ToastContainerComponent', () => {
  let component: ToastContainerComponent;
  let fixture: ComponentFixture<ToastContainerComponent>;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastContainerComponent],
      providers: [ToastService],
    }).compileComponents();

    toastService = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(ToastContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render toasts added to ToastService with safe icons', () => {
    toastService.success('Success Title', 'Success message');
    fixture.detectChanges();

    const toastEls = fixture.nativeElement.querySelectorAll('.toast');
    expect(toastEls.length).toBe(1);

    const titleEl = fixture.nativeElement.querySelector('.toast-title');
    expect(titleEl.textContent).toBe('Success Title');

    const iconEl = fixture.nativeElement.querySelector('.toast-icon svg');
    expect(iconEl).toBeTruthy();
  });

  it('should dismiss toast on dismiss call', () => {
    const toastId = toastService.info('Notice');
    fixture.detectChanges();

    expect(toastService.toasts().length).toBe(1);
    component.dismiss(toastId);
    fixture.detectChanges();

    expect(toastService.toasts().length).toBe(0);
  });
});
