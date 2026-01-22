import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QueueComponent } from './queue.component';
import { Router } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe.skip('QueueComponent', () => {
    let component: QueueComponent;
    let fixture: ComponentFixture<QueueComponent>;
    let electronMock: any;
    let routerMock: any;

    beforeEach(async () => {
        electronMock = {
            db: {
                getQueue: vi.fn().mockResolvedValue([]),
                updateQueueStatus: vi.fn().mockResolvedValue({}),
                removeFromQueue: vi.fn().mockResolvedValue({})
            }
        };
        (window as any).electron = electronMock;

        routerMock = {
            navigate: vi.fn()
        };

        await TestBed.configureTestingModule({
            imports: [QueueComponent],
            providers: [
                { provide: Router, useValue: routerMock }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(QueueComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should navigate on consult start', async () => {
        const queueData = [{ id: 1, patient_id: 101, status: 'waiting', check_in_time: '2023-10-27 12:00:00' }];
        electronMock.db.getQueue.mockResolvedValue(queueData);

        fixture.detectChanges(); // ngOnInit
        await component.refreshQueue();

        await component.updateStatus(1, 'in-consult');
        expect(electronMock.db.updateQueueStatus).toHaveBeenCalled();
        expect(routerMock.navigate).toHaveBeenCalledWith(['/visit', 101]);
    });
});
