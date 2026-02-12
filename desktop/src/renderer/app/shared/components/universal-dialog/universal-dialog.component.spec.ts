/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UniversalDialogComponent } from './universal-dialog.component';

describe('UniversalDialogComponent', () => {
    let component: UniversalDialogComponent;

    beforeEach(() => {
        component = new UniversalDialogComponent();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.style.overflow = '';
    });

    describe('initial state', () => {
        it('should have default title', () => {
            expect(component.title).toBe('Notification');
        });

        it('should have empty message', () => {
            expect(component.message).toBe('');
        });

        it('should be closed by default', () => {
            expect(component.isOpen).toBe(false);
        });

        it('should have icon enabled by default', () => {
            expect(component.icon).toBe(true);
        });

        it('should show default actions by default', () => {
            expect(component.showDefaultActions).toBe(true);
        });

        it('should not be animated in', () => {
            expect(component.animateIn).toBe(false);
        });
    });

    describe('hasIconContent', () => {
        it('should return false when no icon content projected', () => {
            expect(component.hasIconContent).toBe(false);
        });

        it('should return true when icon content is present', () => {
            (component as any).iconContent = {} as any;
            expect(component.hasIconContent).toBe(true);
        });
    });

    describe('hasActionsContent', () => {
        it('should return false when no actions content projected', () => {
            expect(component.hasActionsContent).toBe(false);
        });

        it('should return true when actions content is present', () => {
            (component as any).actionsContent = {} as any;
            expect(component.hasActionsContent).toBe(true);
        });
    });

    describe('ngOnChanges', () => {
        it('should set body overflow hidden when opening', () => {
            component.isOpen = true;
            component.ngOnChanges({
                isOpen: { currentValue: true, previousValue: false, firstChange: false, isFirstChange: () => false }
            });
            expect(document.body.style.overflow).toBe('hidden');
        });

        it('should trigger animate in with delay when opening', () => {
            component.isOpen = true;
            component.ngOnChanges({
                isOpen: { currentValue: true, previousValue: false, firstChange: false, isFirstChange: () => false }
            });
            expect(component.animateIn).toBe(false);
            vi.advanceTimersByTime(15);
            expect(component.animateIn).toBe(true);
        });

        it('should reset body overflow when closing', () => {
            document.body.style.overflow = 'hidden';
            component.isOpen = false;
            component.ngOnChanges({
                isOpen: { currentValue: false, previousValue: true, firstChange: false, isFirstChange: () => false }
            });
            expect(document.body.style.overflow).toBe('');
            expect(component.animateIn).toBe(false);
        });

        it('should clear previous timer on rapid open/close', () => {
            component.isOpen = true;
            component.ngOnChanges({
                isOpen: { currentValue: true, previousValue: false, firstChange: false, isFirstChange: () => false }
            });

            // Immediately close before the timer fires
            component.isOpen = false;
            component.ngOnChanges({
                isOpen: { currentValue: false, previousValue: true, firstChange: false, isFirstChange: () => false }
            });

            vi.advanceTimersByTime(15);
            expect(component.animateIn).toBe(false); // Timer should be cleared
        });

        it('should not do anything for non-isOpen changes', () => {
            component.ngOnChanges({
                title: { currentValue: 'New', previousValue: 'Old', firstChange: false, isFirstChange: () => false }
            });
            expect(document.body.style.overflow).toBe('');
        });
    });

    describe('ngOnDestroy', () => {
        it('should reset body overflow', () => {
            document.body.style.overflow = 'hidden';
            component.ngOnDestroy();
            expect(document.body.style.overflow).toBe('');
        });

        it('should clear animation timer', () => {
            component.isOpen = true;
            component.ngOnChanges({
                isOpen: { currentValue: true, previousValue: false, firstChange: false, isFirstChange: () => false }
            });
            component.ngOnDestroy();
            vi.advanceTimersByTime(15);
            expect(component.animateIn).toBe(false);
        });
    });

    describe('close', () => {
        it('should set animateIn to false immediately', () => {
            component.animateIn = true;
            component.close();
            expect(component.animateIn).toBe(false);
        });

        it('should emit isOpenChange and cancelDialog after animation delay', () => {
            const isOpenChangeSpy = vi.spyOn(component.isOpenChange, 'emit');
            const cancelDialogSpy = vi.spyOn(component.cancelDialog, 'emit');

            component.close();
            expect(isOpenChangeSpy).not.toHaveBeenCalled();

            vi.advanceTimersByTime(200);
            expect(isOpenChangeSpy).toHaveBeenCalledWith(false);
            expect(cancelDialogSpy).toHaveBeenCalled();
        });
    });

    describe('onBackdropClick', () => {
        it('should call close', () => {
            const closeSpy = vi.spyOn(component, 'close');
            component.onBackdropClick();
            expect(closeSpy).toHaveBeenCalled();
        });
    });

    describe('onConfirm', () => {
        it('should emit confirmDialog', () => {
            const confirmDialogSpy = vi.spyOn(component.confirmDialog, 'emit');
            component.onConfirm();
            expect(confirmDialogSpy).toHaveBeenCalled();
        });

        it('should also close the dialog', () => {
            const closeSpy = vi.spyOn(component, 'close');
            component.onConfirm();
            expect(closeSpy).toHaveBeenCalled();
        });
    });
});
