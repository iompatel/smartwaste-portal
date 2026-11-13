import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TearButtonComponent } from './tear-button.component';

describe('TearButtonComponent', () => {
  let component: TearButtonComponent;
  let fixture: ComponentFixture<TearButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TearButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TearButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should default to primary variant and md size', () => {
    expect(component.variant).toBe('primary');
    expect(component.size).toBe('md');
    expect(component.disabled).toBeFalse();
    expect(component.loading).toBeFalse();
  });

  it('should emit both buttonClick and btnClick on click when enabled', () => {
    spyOn(component.buttonClick, 'emit');
    spyOn(component.btnClick, 'emit');

    const button = fixture.nativeElement.querySelector('button');
    button.click();

    expect(component.buttonClick.emit).toHaveBeenCalled();
    expect(component.btnClick.emit).toHaveBeenCalled();
  });

  it('should not emit events when disabled or loading', () => {
    spyOn(component.buttonClick, 'emit');
    spyOn(component.btnClick, 'emit');

    component.disabled = true;
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button');
    button.click();

    expect(component.buttonClick.emit).not.toHaveBeenCalled();
    expect(component.btnClick.emit).not.toHaveBeenCalled();

    component.disabled = false;
    component.loading = true;
    fixture.detectChanges();

    button.click();
    expect(component.buttonClick.emit).not.toHaveBeenCalled();
    expect(component.btnClick.emit).not.toHaveBeenCalled();
  });

  it('should display spinner when loading is true', () => {
    component.loading = true;
    fixture.detectChanges();

    const spinner = fixture.nativeElement.querySelector('.btn-spinner');
    expect(spinner).toBeTruthy();
  });
});
