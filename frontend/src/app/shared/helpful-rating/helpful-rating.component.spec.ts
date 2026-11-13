import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HelpfulRatingComponent } from './helpful-rating.component';

describe('HelpfulRatingComponent', () => {
  let component: HelpfulRatingComponent;
  let fixture: ComponentFixture<HelpfulRatingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelpfulRatingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HelpfulRatingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render 5 star buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.star-btn');
    expect(buttons.length).toBe(5);
  });

  it('should select rating and emit ratingChange', () => {
    spyOn(component.ratingChange, 'emit');

    component.selectRating(4);
    expect(component.rating).toBe(4);
    expect(component.ratingChange.emit).toHaveBeenCalledWith(4);
    expect(component.ratingText).toBe('Very Good');
  });

  it('should not change rating if readonly', () => {
    spyOn(component.ratingChange, 'emit');
    component.readonly = true;
    component.selectRating(5);

    expect(component.rating).toBe(0);
    expect(component.ratingChange.emit).not.toHaveBeenCalled();
  });

  it('should handle hover state when not readonly', () => {
    component.onHover(3);
    expect(component.currentDisplayRating).toBe(3);

    component.onLeave();
    expect(component.currentDisplayRating).toBe(0);
  });
});
