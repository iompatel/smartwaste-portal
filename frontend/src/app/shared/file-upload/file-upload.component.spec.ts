import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileUploadComponent } from './file-upload.component';

describe('FileUploadComponent', () => {
  let component: FileUploadComponent;
  let fixture: ComponentFixture<FileUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileUploadComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FileUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should show preview box when previewUrl is provided', () => {
    component.previewUrl = 'https://example.com/test.jpg';
    fixture.detectChanges();

    const previewImg = fixture.nativeElement.querySelector('.preview-img');
    expect(previewImg).toBeTruthy();
    expect(previewImg.getAttribute('src')).toBe('https://example.com/test.jpg');
  });

  it('should remove file and emit null on removeFile()', () => {
    spyOn(component.fileSelected, 'emit');
    component.previewUrl = 'https://example.com/test.jpg';
    fixture.detectChanges();

    component.removeFile();
    expect(component.previewUrl).toBeNull();
    expect(component.fileSelected.emit).toHaveBeenCalledWith(null);
  });
});
