import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardFlipComponent } from './card-flip.component';

describe('CardFlipComponent', () => {
  let component: CardFlipComponent;
  let fixture: ComponentFixture<CardFlipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardFlipComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CardFlipComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should start unflipped by default', () => {
    expect(component.isFlipped).toBeFalse();
    const container = fixture.nativeElement.querySelector('.kokonut-card-flip-container');
    expect(container.classList.contains('is-flipped')).toBeFalse();
  });

  it('should toggle flip on toggleFlip and emit event', () => {
    spyOn(component.cardFlipped, 'emit');

    component.toggleFlip();
    expect(component.isFlipped).toBeTrue();
    expect(component.cardFlipped.emit).toHaveBeenCalledWith(true);

    component.toggleFlip();
    expect(component.isFlipped).toBeFalse();
    expect(component.cardFlipped.emit).toHaveBeenCalledWith(false);
  });

  it('should display Clean India slogan when flipped', () => {
    component.slogan = 'Clean India, Green India';
    component.sloganHindi = 'एक कदम स्वच्छता की ओर';
    component.toggleFlip();
    fixture.detectChanges();

    const hindiEl = fixture.nativeElement.querySelector('.slogan-hindi');
    expect(hindiEl.textContent).toContain('एक कदम स्वच्छता की ओर');
  });
});
