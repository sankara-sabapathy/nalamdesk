/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DialogService } from './dialog.service';

describe('DialogService', () => {
    let service: DialogService;

    beforeEach(() => {
        service = new DialogService();
    });

    describe('initial state', () => {
        it('should start closed', () => {
            expect(service.isOpen()).toBe(false);
        });

        it('should have default options', () => {
            expect(service.options().title).toBe('');
            expect(service.options().message).toBe('');
        });
    });

    describe('open', () => {
        it('should set isOpen to true', () => {
            service.open({ title: 'Test', message: 'Message' });
            expect(service.isOpen()).toBe(true);
        });

        it('should set options with defaults', () => {
            service.open({ title: 'Test Title', message: 'Test Message' });
            const opts = service.options();
            expect(opts.title).toBe('Test Title');
            expect(opts.message).toBe('Test Message');
            expect(opts.confirmText).toBe('OK');
            expect(opts.cancelText).toBe('Cancel');
            expect(opts.type).toBe('info');
            expect(opts.icon).toBe(true);
        });

        it('should allow overriding defaults', () => {
            service.open({
                title: 'Delete',
                message: 'Are you sure?',
                type: 'error',
                confirmText: 'Delete',
                cancelText: 'Keep',
                icon: false
            });
            const opts = service.options();
            expect(opts.type).toBe('error');
            expect(opts.confirmText).toBe('Delete');
            expect(opts.cancelText).toBe('Keep');
            expect(opts.icon).toBe(false);
        });

        it('should return a promise', () => {
            const result = service.open({ title: 'T', message: 'M' });
            expect(result).toBeInstanceOf(Promise);
        });
    });

    describe('confirm', () => {
        it('should close the dialog', () => {
            service.open({ title: 'T', message: 'M' });
            service.confirm();
            expect(service.isOpen()).toBe(false);
        });

        it('should resolve promise with true', async () => {
            const promise = service.open({ title: 'T', message: 'M' });
            service.confirm();
            const result = await promise;
            expect(result).toBe(true);
        });
    });

    describe('close', () => {
        it('should close the dialog', () => {
            service.open({ title: 'T', message: 'M' });
            service.close();
            expect(service.isOpen()).toBe(false);
        });

        it('should resolve promise with false', async () => {
            const promise = service.open({ title: 'T', message: 'M' });
            service.close();
            const result = await promise;
            expect(result).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('should handle confirm without open gracefully', () => {
            expect(() => service.confirm()).not.toThrow();
            expect(service.isOpen()).toBe(false);
        });

        it('should handle close without open gracefully', () => {
            expect(() => service.close()).not.toThrow();
            expect(service.isOpen()).toBe(false);
        });

        it('should handle multiple sequential opens', async () => {
            const promise1 = service.open({ title: 'First', message: 'M1' });
            // Opening a second dialog replaces the first
            const promise2 = service.open({ title: 'Second', message: 'M2' });
            expect(service.options().title).toBe('Second');
            service.confirm();
            const result2 = await promise2;
            expect(result2).toBe(true);
        });
    });
});
