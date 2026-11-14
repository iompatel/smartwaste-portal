import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AvatarComponent } from './avatar.component';

describe('AvatarComponent', () => {
  let component: AvatarComponent;
  let fixture: ComponentFixture<AvatarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarComponent);
    component = fixture.componentInstance;
    component.name = 'Rahul Sharma';
    fixture.detectChanges();
  });

  it('should generate initials from name when no src provided', () => {
    expect(component.initials()).toBe('RS');
    const initialsEl = fixture.nativeElement.querySelector('.avatar-text');
    expect(initialsEl.textContent.trim()).toBe('RS');
  });

  it('should render image when src is provided', () => {
    component.src = 'https://example.com/avatar.jpg';
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.com/avatar.jpg');
  });

  it('should fallback to initials if image fails to load', () => {
    component.src = 'https://example.com/broken.jpg';
    fixture.detectChanges();

    component.onImageError();
    fixture.detectChanges();

    expect(component.hasError()).toBeTrue();
    const initialsEl = fixture.nativeElement.querySelector('.avatar-text');
    expect(initialsEl).toBeTruthy();
  });
});
