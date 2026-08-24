/**
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { inject } from '@angular/core';
import { ChangePasswordComponent } from './change-password.component';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

vi.mock('@angular/core', async () => {
    const actual = await vi.importActual('@angular/core');
    return { ...actual as any, inject: vi.fn() };
});

describe('ChangePasswordComponent', () => {
    let auth: any;
    let router: any;
    let component: ChangePasswordComponent;

    beforeEach(() => {
        auth = {
            getUser: vi.fn(() => ({ id: 2, username: 'doctor', role: 'doctor', password_reset_required: 1 })),
            changeLoginPassword: vi.fn()
        };
        router = { navigate: vi.fn() };
        vi.mocked(inject).mockImplementation(token => token === AuthService ? auth : router);
        localStorage.clear();
        component = new ChangePasswordComponent();
    });

    it('requires the current credential as well as matching replacement passwords', () => {
        component.password = 'replacement';
        component.confirmPassword = 'replacement';
        expect(component.isValid()).toBe(false);
        component.currentPassword = 'temporary';
        expect(component.isValid()).toBe(true);
    });

    it('changes only the authenticated user credential and clears every plaintext input', async () => {
        auth.changeLoginPassword.mockResolvedValue({ success: true });
        component.currentPassword = 'temporary';
        component.password = 'replacement';
        component.confirmPassword = 'replacement';
        await component.onSubmit();
        expect(auth.changeLoginPassword).toHaveBeenCalledWith('temporary', 'replacement');
        expect(component.currentPassword).toBe('');
        expect(component.password).toBe('');
        expect(component.confirmPassword).toBe('');
        expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
        expect(JSON.parse(localStorage.getItem('nalamdesk_user')!)).toMatchObject({ password_reset_required: 0 });
    });

    it('clears plaintext inputs when the IPC call fails', async () => {
        auth.changeLoginPassword.mockRejectedValue(new Error('IPC failed'));
        component.currentPassword = 'temporary';
        component.password = 'replacement';
        component.confirmPassword = 'replacement';
        await component.onSubmit();
        expect(component.error).toBe('IPC failed');
        expect(component.currentPassword).toBe('');
        expect(component.password).toBe('');
        expect(component.confirmPassword).toBe('');
    });
});
