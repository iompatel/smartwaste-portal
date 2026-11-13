import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ProfileDropdownComponent } from './profile-dropdown.component';

describe('ProfileDropdownComponent', () => {
  let component: ProfileDropdownComponent;
  let fixture: ComponentFixture<ProfileDropdownComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileDropdownComponent, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileDropdownComponent);
    component = fixture.componentInstance;
    component.user = {
      id: 1,
      firstName: 'Aum',
      lastName: 'Patel',
      email: 'aum@example.com',
      role: 'user',
      mobile: '9876543210',
      address: 'Test Address',
      gender: 'Male',
      profileImage: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    fixture.detectChanges();
  });

  it('should compute full name properly', () => {
    expect(component.userName).toBe('Aum Patel');
  });

  it('should toggle menu on click', () => {
    expect(component.isOpen).toBeFalse();
    const btn = fixture.nativeElement.querySelector('.profile-trigger-btn');
    btn.click();
    fixture.detectChanges();

    expect(component.isOpen).toBeTrue();
    const menu = fixture.nativeElement.querySelector('.dropdown-menu');
    expect(menu).toBeTruthy();
  });

  it('should emit themeSelected when clicking theme button', () => {
    component.isOpen = true;
    fixture.detectChanges();

    spyOn(component.themeSelected, 'emit');
    const darkBtn = fixture.nativeElement.querySelectorAll('.theme-btn')[1];
    darkBtn.click();

    expect(component.themeSelected.emit).toHaveBeenCalledWith('dark');
  });

  it('should emit logout on logout click', () => {
    component.isOpen = true;
    fixture.detectChanges();

    spyOn(component.logout, 'emit');
    const logoutBtn = fixture.nativeElement.querySelector('.logout-menu-btn');
    logoutBtn.click();

    expect(component.logout.emit).toHaveBeenCalled();
  });
});
