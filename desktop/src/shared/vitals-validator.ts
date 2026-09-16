/**
 * Validation rules and utilities for clinical vital sign observations.
 * Aligned with FHIR Observation resource guidelines.
 */

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
    bmi: { min: 5, max: 100, label: 'BMI', unit: 'kg/m2' }
});

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
    validateSingleRange('weight', payload['weight'], VITALS_PHYSIOLOGICAL_RANGES['weight'], errors);
    validateSingleRange('bmi', payload['bmi'], VITALS_PHYSIOLOGICAL_RANGES['bmi'], errors);

    // Temperature check (check if unit is °C or °F)
    if (isPresent(payload['temperature'])) {
        const tempUnits = (payload['units'] as Record<string, string> | undefined)?.['temperature'] || '°F';
        const range = tempUnits === '°C' || tempUnits === 'degC'
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
        lines.push(`Temp: ${vitals['temperature']} °F`);
    }
    if (isPresent(vitals['spo2'])) {
        lines.push(`SpO2: ${vitals['spo2']}%`);
    }
    if (isPresent(vitals['respiratory_rate'])) {
        lines.push(`RR: ${vitals['respiratory_rate']} bpm`);
    }
    if (isPresent(vitals['weight'])) {
        lines.push(`Weight: ${vitals['weight']} kg`);
    }
    if (isPresent(vitals['height'])) {
        lines.push(`Height: ${vitals['height']} cm`);
    }
    if (isPresent(vitals['bmi'])) {
        lines.push(`BMI: ${vitals['bmi']}`);
    }

    return lines;
}
