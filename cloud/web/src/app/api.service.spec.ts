import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { environment } from '../environments/environment';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('uses the configured cloud API base path', () => {
    service.getClinics().subscribe();
    const req = httpMock.expectOne(`${environment.cloudApiBase}/clinics`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('does not hardcode the default cloud API port in request URLs', () => {
    service.getSlots('clinic-1').subscribe();
    const req = httpMock.expectOne(`${environment.cloudApiBase}/slots/clinic-1`);
    expect(req.request.url).not.toContain(':3001');
    req.flush([]);
  });
});
