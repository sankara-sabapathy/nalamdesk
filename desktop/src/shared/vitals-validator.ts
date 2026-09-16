/**
 * Validation rules, conversion utilities, and coding constants for clinical vital sign observations.
 * Aligned with FHIR Observation resource guidelines, LOINC, and UCUM.
 */

export const LOINC_CODES: Readonly<Record<string, { code: string; display: string }>> = Object.freeze({
    bp_panel: { code: '85354-9', display: 'Blood pressure panel with all children optional' },
    systolic_bp: { code: '8480-6', display: 'Systolic blood pressure' },
    diastolic_bp: { code: '8462-4', display: 'Diastolic blood pressure' },
    temperature: { code: '8310-5', display: 'Body temperature' },
    pulse: { code: '8867-4', display: 'Heart rate' },
    respiratory_rate: { code: '9279-1', display: 'Respiratory rate' },
    spo2: { code: '2708-6', display: 'Oxygen saturation in Arterial blood' },
    height: { code: '8302-2', display: 'Body height' },
    weight: { code: '29463-7', display: 'Body weight' },
    bmi: { code: '39156-5', display: 'Body mass index (BMI) [Ratio]' }
});

export const UCUM_UNITS: Readonly<Record<string, string>> = Object.freeze({
    systolic_bp: 'mm[Hg]',
    diastolic_bp: 'mm[Hg]',
    temperature_f: '[degF]',
    temperature_c: 'Cel',
    pulse: '/min',
    respiratory_rate: '/min',
    spo2: '%',
    height_cm: 'cm',
    height_in: '[in_i]',
    weight_kg: 'kg',
    weight_lbs: '[lb_av]',
    bmi: 'kg/m2'
});

export const DEFAULT_VITAL_UNITS: Readonly<Record<string, string>> = Object.freeze({
    height: 'cm',
    weight: 'kg',
    bmi: 'kg/m2',
    temperature: '°F',
    systolic_bp: 'mmHg',
    diastolic_bp: 'mmHg',
    pulse: 'bpm',
    respiratory_rate: 'bpm',
    spo2: '%'
});

export function fToC(f: number): number {
    return Math.round(((f - 32) * 5 / 9) * 10) / 10;
}

export function cToF(c: number): number {
    return Math.round((c * 9 / 5 + 32) * 10) / 10;
}

export function kgToLbs(kg: number): number {
    return Math.round((kg * 2.20462262) * 10) / 10;
}

export function lbsToKg(lbs: number): number {
    return Math.round((lbs / 2.20462262) * 10) / 10;
}

export function cmToInches(cm: number): number {
    return Math.round((cm / 2.54) * 10) / 10;
}

export function inchesToCm(inches: number): number {
    return Math.round((inches * 2.54) * 10) / 10;
}

export function toCanonicalUcumUnit(field: string, displayUnit?: string): string {
    const unit = (displayUnit || '').trim().toLowerCase();
    switch (field) {
        case 'temperature':
            return unit.includes('c') ? UCUM_UNITS['temperature_c'] : UCUM_UNITS['temperature_f'];
        case 'weight':
            return unit.includes('lb') ? UCUM_UNITS['weight_lbs'] : UCUM_UNITS['weight_kg'];
        case 'height':
            return unit.includes('in') ? UCUM_UNITS['height_in'] : UCUM_UNITS['height_cm'];
        case 'systolic_bp':
        case 'diastolic_bp':
            return UCUM_UNITS['systolic_bp'];
        case 'pulse':
            return UCUM_UNITS['pulse'];
        case 'respiratory_rate':
            return UCUM_UNITS['respiratory_rate'];
        case 'spo2':
            return UCUM_UNITS['spo2'];
        case 'bmi':
            return UCUM_UNITS['bmi'];
        default:
            return displayUnit || '';
    }
}

export const ALLOWED_OBSERVATION_STATUSES = Object.freeze([
    'registered',
    'preliminary',
    'final',
    'amended',
    'corrected',
    'entered-in-error'
] as const);

export type ObservationStatus = typeof ALLOWED_OBSERVATION_STATUSES[number];

export interface VitalsRange {
    min: number;
    max: number;
    label: string;
    unit: string;
}

export const VITALS_PHYSIOLOGICAL_RANGES: Readonly<Record<string, VitalsRange>> = Object.freeze({
    systolic_bp: { min: 50, max: 300, label: 'Systolic Blood Pressure', unit: 'mmHg' },
    diastolic_bp: { min: 30, max: 200, label: 'Diastolic Blood Pressure', unit: 'mmHg' },
    pulse: { min: 30, max: 250, label: 'Pulse', unit: 'bpm' },
    temperature_f: { min: 50.0, max: 115.0, label: 'Temperature (°F)', unit: '°F' },
    temperature_c: { min: 10.0, max: 46.2, label: 'Temperature (°C)', unit: '°C' },
    respiratory_rate: { min: 8, max: 60, label: 'Respiratory Rate', unit: 'bpm' },
    spo2: { min: 50, max: 100, label: 'Oxygen Saturation (SpO2)', unit: '%' },
    height: { min: 20, max: 300, label: 'Height', unit: 'cm' },
    weight: { min: 0.5, max: 500, label: 'Weight', unit: 'kg' },
    weight_lbs: { min: 1.1, max: 1100, label: 'Weight', unit: 'lbs' },
    bmi: { min: 5, max: 100, label: 'BMI', unit: 'kg/m2' }
});

export interface ClinicalVitalsAlerts {
    hasAbnormal: boolean;
    alerts: string[];
}

export function evaluateVitalsAbnormalities(vitals: Record<string, unknown> | null | undefined): ClinicalVitalsAlerts {
    if (!vitals) return { hasAbnormal: false, alerts: [] };
    const alerts: string[] = [];

    const sys = Number(vitals['systolic_bp']);
    const dia = Number(vitals['diastolic_bp']);
    if (!Number.isNaN(sys) && sys > 0) {
        if (sys >= 160 || sys < 90) alerts.push(`Critical Systolic BP: ${sys} mmHg`);
        else if (sys >= 140) alerts.push(`High Systolic BP: ${sys} mmHg`);
    }
    if (!Number.isNaN(dia) && dia > 0) {
        if (dia >= 100 || dia < 60) alerts.push(`Critical Diastolic BP: ${dia} mmHg`);
        else if (dia >= 90) alerts.push(`High Diastolic BP: ${dia} mmHg`);
    }

    const pulse = Number(vitals['pulse']);
    if (!Number.isNaN(pulse) && pulse > 0) {
        if (pulse >= 120 || pulse < 50) alerts.push(`Abnormal Pulse: ${pulse} bpm`);
    }

    const temp = Number(vitals['temperature']);
    if (!Number.isNaN(temp) && temp > 0) {
        const units = (vitals['units'] as Record<string, string> | undefined)?.['temperature'] || '°F';
        const isC = units.includes('C') || units === 'Cel';
        const tempF = isC ? cToF(temp) : temp;
        if (tempF >= 100.4) alerts.push(`Fever: ${temp} ${units}`);
        else if (tempF < 95.0) alerts.push(`Hypothermia: ${temp} ${units}`);
    }

    const spo2 = Number(vitals['spo2']);
    if (!Number.isNaN(spo2) && spo2 > 0) {
        if (spo2 < 92) alerts.push(`Severe Hypoxia: ${spo2}% SpO2`);
        else if (spo2 < 95) alerts.push(`Low Oxygen: ${spo2}% SpO2`);
    }

    const rr = Number(vitals['respiratory_rate']);
    if (!Number.isNaN(rr) && rr > 0) {
        if (rr >= 28 || rr < 10) alerts.push(`Abnormal Resp Rate: ${rr} bpm`);
    }

    return {
        hasAbnormal: alerts.length > 0,
        alerts
    };
}

const CLINICAL_FIELDS = [
    'systolic_bp',
    'diastolic_bp',
    'pulse',
    'temperature',
    'respiratory_rate',
    'spo2',
    'height',
    'weight'
] as const;

export interface VitalsValidationResult {
    valid: boolean;
    errors: string[];
}

function isPresent(val: unknown): boolean {
    return val !== null && val !== undefined && val !== '' && !Number.isNaN(val);
}

function validateBloodPressure(payload: Record<string, unknown>, errors: string[]): void {
    const hasSys = isPresent(payload['systolic_bp']);
    const hasDia = isPresent(payload['diastolic_bp']);

    if (hasSys && !hasDia) {
        errors.push('Both systolic and diastolic blood pressure must be provided together');
    } else if (!hasSys && hasDia) {
        errors.push('Both systolic and diastolic blood pressure must be provided together');
    } else if (hasSys && hasDia) {
        const sys = Number(payload['systolic_bp']);
        const dia = Number(payload['diastolic_bp']);

        if (Number.isNaN(sys) || Number.isNaN(dia)) {
            errors.push('Blood pressure measurements must be valid numbers');
        } else {
            if (sys < VITALS_PHYSIOLOGICAL_RANGES['systolic_bp'].min || sys > VITALS_PHYSIOLOGICAL_RANGES['systolic_bp'].max) {
                errors.push(`Systolic BP must be between ${VITALS_PHYSIOLOGICAL_RANGES['systolic_bp'].min} and ${VITALS_PHYSIOLOGICAL_RANGES['systolic_bp'].max} mmHg`);
            }
            if (dia < VITALS_PHYSIOLOGICAL_RANGES['diastolic_bp'].min || dia > VITALS_PHYSIOLOGICAL_RANGES['diastolic_bp'].max) {
                errors.push(`Diastolic BP must be between ${VITALS_PHYSIOLOGICAL_RANGES['diastolic_bp'].min} and ${VITALS_PHYSIOLOGICAL_RANGES['diastolic_bp'].max} mmHg`);
            }
            if (sys <= dia) {
                errors.push('Systolic blood pressure must be greater than diastolic blood pressure');
            }
        }
    }
}

function validateSingleRange(
    fieldKey: string,
    value: unknown,
    range: VitalsRange,
    errors: string[]
): void {
    if (!isPresent(value)) return;
    const num = Number(value);
    if (Number.isNaN(num)) {
        errors.push(`${range.label} must be a valid number`);
        return;
    }
    if (num < range.min || num > range.max) {
        errors.push(`${range.label} must be between ${range.min} and ${range.max} ${range.unit}`);
    }
}

function validatePhysiologicalRanges(payload: Record<string, unknown>, errors: string[]): void {
    validateSingleRange('pulse', payload['pulse'], VITALS_PHYSIOLOGICAL_RANGES['pulse'], errors);
    validateSingleRange('respiratory_rate', payload['respiratory_rate'], VITALS_PHYSIOLOGICAL_RANGES['respiratory_rate'], errors);
    validateSingleRange('spo2', payload['spo2'], VITALS_PHYSIOLOGICAL_RANGES['spo2'], errors);
    validateSingleRange('height', payload['height'], VITALS_PHYSIOLOGICAL_RANGES['height'], errors);
    validateSingleRange('bmi', payload['bmi'], VITALS_PHYSIOLOGICAL_RANGES['bmi'], errors);

    // Weight check (kg vs lbs)
    if (isPresent(payload['weight'])) {
        const weightUnits = (payload['units'] as Record<string, string> | undefined)?.['weight'] || 'kg';
        const isLbs = weightUnits.toLowerCase().includes('lb');
        const range = isLbs ? VITALS_PHYSIOLOGICAL_RANGES['weight_lbs'] : VITALS_PHYSIOLOGICAL_RANGES['weight'];
        validateSingleRange('weight', payload['weight'], range, errors);
    }

    // Temperature check (check if unit is °C or °F)
    if (isPresent(payload['temperature'])) {
        const tempUnits = (payload['units'] as Record<string, string> | undefined)?.['temperature'] || '°F';
        const range = tempUnits === '°C' || tempUnits === 'degC' || tempUnits === 'Cel'
            ? VITALS_PHYSIOLOGICAL_RANGES['temperature_c']
            : VITALS_PHYSIOLOGICAL_RANGES['temperature_f'];
        validateSingleRange('temperature', payload['temperature'], range, errors);
    }
}

export function hasAnyVitalMeasurement(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') return false;
    const rec = payload as Record<string, unknown>;
    return CLINICAL_FIELDS.some(field => isPresent(rec[field]));
}

export function validateVitalsPayload(payload: unknown): VitalsValidationResult {
    const errors: string[] = [];

    if (!payload || typeof payload !== 'object') {
        return { valid: false, errors: ['Invalid vitals payload: object expected'] };
    }

    const rec = payload as Record<string, unknown>;

    // 1. All-empty check
    if (!hasAnyVitalMeasurement(rec)) {
        errors.push('At least one vital sign measurement is required');
        return { valid: false, errors };
    }

    // 2. Paired BP validation
    validateBloodPressure(rec, errors);

    // 3. Physiological range validations
    validatePhysiologicalRanges(rec, errors);

    // 4. Status validation if provided
    if (isPresent(rec['status'])) {
        const status = String(rec['status']).toLowerCase();
        if (!ALLOWED_OBSERVATION_STATUSES.includes(status as ObservationStatus)) {
            errors.push(`Invalid observation status: ${status}. Must be one of: ${ALLOWED_OBSERVATION_STATUSES.join(', ')}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

export function assertValidVitals(payload: unknown): void {
    const result = validateVitalsPayload(payload);
    if (!result.valid) {
        throw new Error(result.errors.join('; '));
    }
}

export function formatVitalsTextLines(vitals: Record<string, unknown> | null | undefined): string[] {
    if (!vitals) return [];
    const lines: string[] = [];

    if (isPresent(vitals['systolic_bp']) && isPresent(vitals['diastolic_bp'])) {
        lines.push(`BP: ${vitals['systolic_bp']}/${vitals['diastolic_bp']} mmHg`);
    }
    if (isPresent(vitals['pulse'])) {
        lines.push(`Pulse: ${vitals['pulse']} bpm`);
    }
    if (isPresent(vitals['temperature'])) {
        const tUnit = (vitals['units'] as Record<string, string> | undefined)?.['temperature'] || '°F';
        lines.push(`Temp: ${vitals['temperature']} ${tUnit}`);
    }
    if (isPresent(vitals['spo2'])) {
        lines.push(`SpO2: ${vitals['spo2']}%`);
    }
    if (isPresent(vitals['respiratory_rate'])) {
        lines.push(`RR: ${vitals['respiratory_rate']} bpm`);
    }
    if (isPresent(vitals['weight'])) {
        const wUnit = (vitals['units'] as Record<string, string> | undefined)?.['weight'] || 'kg';
        lines.push(`Weight: ${vitals['weight']} ${wUnit}`);
    }
    if (isPresent(vitals['height'])) {
        lines.push(`Height: ${vitals['height']} cm`);
    }
    if (isPresent(vitals['bmi'])) {
        lines.push(`BMI: ${vitals['bmi']}`);
    }

    return lines;
}
