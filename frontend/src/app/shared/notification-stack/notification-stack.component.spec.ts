import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationStackComponent } from './notification-stack.component';

describe('NotificationStackComponent', () => {
  let component: NotificationStackComponent;
  let fixture: ComponentFixture<NotificationStackComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationStackComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationStackComponent);
    component = fixture.componentInstance;
    component.notifications = [
      { id: 1, userId: 1, title: 'Pickup scheduled', message: 'Worker assigned', read: false, createdAt: new Date().toISOString() },
      { id: 2, userId: 1, title: 'Ticket completed', message: 'Collection finished', read: true, createdAt: new Date().toISOString() },
    ];
    fixture.detectChanges();
  });

  it('should compute unread count accurately', () => {
    expect(component.unreadCount).toBe(1);
    const badge = fixture.nativeElement.querySelector('.notification-badge');
    expect(badge.textContent.trim()).toBe('1');
  });

  it('should toggle panel on bell trigger click', () => {
    expect(component.isOpen).toBeFalse();
    const bellBtn = fixture.nativeElement.querySelector('.bell-trigger-btn');
    bellBtn.click();
    fixture.detectChanges();

    expect(component.isOpen).toBeTrue();
    const panel = fixture.nativeElement.querySelector('.stack-panel');
    expect(panel).toBeTruthy();
  });

  it('should emit notificationClick on notification item click', () => {
    component.isOpen = true;
    fixture.detectChanges();

    spyOn(component.notificationClick, 'emit');
    const item = fixture.nativeElement.querySelector('.notification-item');
    item.click();

    expect(component.notificationClick.emit).toHaveBeenCalledWith(1);
  });

  it('should emit markAllRead on mark all button click', () => {
    component.isOpen = true;
    fixture.detectChanges();

    spyOn(component.markAllRead, 'emit');
    const markAllBtn = fixture.nativeElement.querySelector('.mark-all-btn');
    markAllBtn.click();

    expect(component.markAllRead.emit).toHaveBeenCalled();
  });
});
