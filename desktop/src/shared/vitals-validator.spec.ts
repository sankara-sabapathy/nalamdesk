import { describe, it, expect } from 'vitest';
import {
    LOINC_CODES,
    UCUM_UNITS,
    fToC,
    cToF,
    kgToLbs,
    lbsToKg,
    cmToInches,
    inchesToCm,
    toCanonicalUcumUnit,
    evaluateVitalsAbnormalities,
    validateVitalsPayload,
    formatVitalsTextLines
} from './vitals-validator';

describe('vitals-validator', () => {
    describe('LOINC & UCUM constants', () => {
        it('has valid LOINC codes for all 8 physiological vital sign observations', () => {
            expect(LOINC_CODES.bp_panel.code).toBe('85354-9');
            expect(LOINC_CODES.systolic_bp.code).toBe('8480-6');
            expect(LOINC_CODES.diastolic_bp.code).toBe('8462-4');
            expect(LOINC_CODES.temperature.code).toBe('8310-5');
            expect(LOINC_CODES.pulse.code).toBe('8867-4');
            expect(LOINC_CODES.spo2.code).toBe('2708-6');
            expect(LOINC_CODES.respiratory_rate.code).toBe('9279-1');
            expect(LOINC_CODES.weight.code).toBe('29463-7');
            expect(LOINC_CODES.height.code).toBe('8302-2');
            expect(LOINC_CODES.bmi.code).toBe('39156-5');
        });

        it('maps display units to canonical UCUM units', () => {
            expect(toCanonicalUcumUnit('temperature', '°F')).toBe(UCUM_UNITS.temperature_f);
            expect(toCanonicalUcumUnit('temperature', '°C')).toBe(UCUM_UNITS.temperature_c);
            expect(toCanonicalUcumUnit('weight', 'kg')).toBe(UCUM_UNITS.weight_kg);
            expect(toCanonicalUcumUnit('weight', 'lbs')).toBe(UCUM_UNITS.weight_lbs);
            expect(toCanonicalUcumUnit('systolic_bp', 'mmHg')).toBe('mm[Hg]');
            expect(toCanonicalUcumUnit('pulse', 'bpm')).toBe('/min');
        });
    });

    describe('Conversions', () => {
        it('converts temperature between °F and °C accurately', () => {
            expect(fToC(98.6)).toBe(37.0);
            expect(fToC(212)).toBe(100.0);
            expect(cToF(37.0)).toBe(98.6);
            expect(cToF(100.0)).toBe(212.0);
        });

        it('converts weight between kg and lbs accurately', () => {
            expect(kgToLbs(70)).toBe(154.3);
            expect(lbsToKg(154.3)).toBe(70.0);
        });

        it('converts height between cm and inches accurately', () => {
            expect(cmToInches(177.8)).toBe(70.0);
            expect(inchesToCm(70.0)).toBe(177.8);
        });
    });

    describe('Range Validation with Units', () => {
        it('validates weight in lbs without triggering kg limits', () => {
            const validLbs = validateVitalsPayload({
                patient_id: 1,
                weight: 165,
                units: { weight: 'lbs' }
            });
            expect(validLbs.valid).toBe(true);

            const outOfRangeLbs = validateVitalsPayload({
                patient_id: 1,
                weight: 1200,
                units: { weight: 'lbs' }
            });
            expect(outOfRangeLbs.valid).toBe(false);
            expect(outOfRangeLbs.errors[0]).toContain('Weight must be between 1.1 and 1100 lbs');
        });

        it('validates temperature in °C without triggering °F limits', () => {
            const validC = validateVitalsPayload({
                patient_id: 1,
                temperature: 37.2,
                units: { temperature: '°C' }
            });
            expect(validC.valid).toBe(true);

            const outOfRangeC = validateVitalsPayload({
                patient_id: 1,
                temperature: 48,
                units: { temperature: '°C' }
            });
            expect(outOfRangeC.valid).toBe(false);
            expect(outOfRangeC.errors[0]).toContain('Temperature (°C) must be between 10 and 46.2 °C');
        });
    });

    describe('Clinical Vitals Abnormalities Evaluation', () => {
        it('detects hypertensive, tachycardia, and hypoxic states', () => {
            const normal = evaluateVitalsAbnormalities({
                systolic_bp: 120,
                diastolic_bp: 80,
                pulse: 72,
                temperature: 98.4,
                spo2: 99,
                respiratory_rate: 16
            });
            expect(normal.hasAbnormal).toBe(false);
            expect(normal.alerts).toHaveLength(0);

            const abnormal = evaluateVitalsAbnormalities({
                systolic_bp: 165,
                diastolic_bp: 102,
                pulse: 130,
                temperature: 102.5,
                spo2: 90,
                respiratory_rate: 30
            });
            expect(abnormal.hasAbnormal).toBe(true);
            expect(abnormal.alerts.some(a => a.includes('Critical Systolic BP'))).toBe(true);
            expect(abnormal.alerts.some(a => a.includes('Critical Diastolic BP'))).toBe(true);
            expect(abnormal.alerts.some(a => a.includes('Abnormal Pulse'))).toBe(true);
            expect(abnormal.alerts.some(a => a.includes('Fever'))).toBe(true);
            expect(abnormal.alerts.some(a => a.includes('Severe Hypoxia'))).toBe(true);
            expect(abnormal.alerts.some(a => a.includes('Abnormal Resp Rate'))).toBe(true);
        });

        it('detects fever when temperature is entered in °C', () => {
            const feverC = evaluateVitalsAbnormalities({
                temperature: 38.5,
                units: { temperature: '°C' }
            });
            expect(feverC.hasAbnormal).toBe(true);
            expect(feverC.alerts[0]).toContain('Fever: 38.5 °C');
        });
    });

    describe('formatVitalsTextLines', () => {
        it('formats vitals lines using active units', () => {
            const lines = formatVitalsTextLines({
                systolic_bp: 120,
                diastolic_bp: 80,
                pulse: 75,
                temperature: 37.0,
                weight: 154,
                units: { temperature: '°C', weight: 'lbs' }
            });

            expect(lines).toContain('BP: 120/80 mmHg');
            expect(lines).toContain('Pulse: 75 bpm');
            expect(lines).toContain('Temp: 37 °C');
            expect(lines).toContain('Weight: 154 lbs');
        });
    });
});
