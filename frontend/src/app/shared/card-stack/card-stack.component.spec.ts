import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardStackComponent } from './card-stack.component';

describe('CardStackComponent', () => {
  let component: CardStackComponent;
  let fixture: ComponentFixture<CardStackComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardStackComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CardStackComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should start at activeIndex 0 with 4 Clean India cards', () => {
    expect(component.activeIndex).toBe(0);
    expect(component.cards.length).toBe(4);
  });

  it('should cycle forward on nextCard and wrap around', () => {
    component.nextCard();
    expect(component.activeIndex).toBe(1);

    component.nextCard();
    expect(component.activeIndex).toBe(2);

    component.nextCard();
    expect(component.activeIndex).toBe(3);

    component.nextCard();
    expect(component.activeIndex).toBe(0);
  });

  it('should cycle backward on prevCard and wrap around', () => {
    component.prevCard();
    expect(component.activeIndex).toBe(3);

    component.prevCard();
    expect(component.activeIndex).toBe(2);
  });

  it('should jump to specific index on goToIndex', () => {
    component.goToIndex(2);
    expect(component.activeIndex).toBe(2);

    // Should ignore invalid indices
    component.goToIndex(-1);
    expect(component.activeIndex).toBe(2);

    component.goToIndex(10);
    expect(component.activeIndex).toBe(2);
  });

  it('should calculate relative positions and transforms properly', () => {
    expect(component.getRelativePosition(0)).toBe(0);
    expect(component.getCardTransform(0)).toContain('scale(1)');

    component.nextCard(); // activeIndex is now 1
    expect(component.getRelativePosition(0)).toBe(3);
    expect(component.getRelativePosition(1)).toBe(0);
  });
});
