/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdatePromptComponent } from './update-prompt.component';
import { AppUpdateService } from '../../../services/update.service';
import { inject } from '@angular/core';

vi.mock('@angular/core', async () => {
    const actual = await vi.importActual('@angular/core');
    return { ...actual as any, inject: vi.fn() };
});

describe('UpdatePromptComponent', () => {
    let component: UpdatePromptComponent;
    let updates: AppUpdateService;

    beforeEach(() => {
        updates = {
            init: vi.fn(),
            destroy: vi.fn(),
            later: vi.fn(),
            updateNow: vi.fn(),
            install: vi.fn(),
            cancelDownload: vi.fn(),
            promptOpen: () => true,
            status: () => ({
                state: 'available',
                currentVersion: '0.0.8',
                availableVersion: '0.0.9',
                releaseNotes: 'Notes',
                canQuitAndInstall: true,
                verifiedSignature: false,
                integrityNote: 'This feed lists package checksums. NalamDesk does not claim full code-signature verification.'
            })
        } as any;
        vi.mocked(inject).mockReturnValue(updates);
        component = new UpdatePromptComponent();
        component.ngOnInit();
    });

    it('shows current vs new version without claiming signature verify', () => {
        expect(component.body).toContain('0.0.8');
        expect(component.body).toContain('0.0.9');
        expect(component.status.verifiedSignature).toBe(false);
        expect(component.status.integrityNote).not.toMatch(/full code-signature verification is complete/i);
        component.later();
        expect(updates.later).toHaveBeenCalled();
    });

    it('installs a downloaded update from the prompt', () => {
        updates.status = () => ({
            state: 'downloaded',
            currentVersion: '0.0.8',
            availableVersion: '0.0.9',
            canQuitAndInstall: true,
            verifiedSignature: false
        });
        expect(component.title).toMatch(/downloaded/i);
        component.install();
        expect(updates.install).toHaveBeenCalled();
    });
});
