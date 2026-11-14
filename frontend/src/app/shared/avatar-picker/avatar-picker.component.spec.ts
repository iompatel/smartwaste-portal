import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AvatarPickerComponent } from './avatar-picker.component';

describe('AvatarPickerComponent', () => {
  let component: AvatarPickerComponent;
  let fixture: ComponentFixture<AvatarPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarPickerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarPickerComponent);
    component = fixture.componentInstance;
    component.name = 'Test User';
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit null on clearPhoto', () => {
    spyOn(component.imageChanged, 'emit');
    component.imageSrc = 'data:image/png;base64,...';
    component.clearPhoto();

    expect(component.imageSrc).toBeNull();
    expect(component.imageChanged.emit).toHaveBeenCalledWith(null);
  });
});
