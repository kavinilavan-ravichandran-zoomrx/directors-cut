export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Location {
    facility: string;
    city: string;
    state?: string;
    country: string;
    lat?: number;
    lng?: number;
}

export interface PatientProfile {
    condition: string;
    condition_normalized?: string;
    histology?: string;
    stage?: string;
    line_of_therapy?: string;
    prior_treatments: string[];
    current_treatments?: string[];
    biomarkers: Record<string, any>;
    ecog?: number | string;
    age?: number;
    sex?: string;
    cns_involvement?: boolean;
    metastatic_sites?: string[];
    comorbidities?: string[];
    organ_function?: string;
    location?: {
        city: string;
        country: string;
        lat?: number;
        lng?: number;
    };
}

export interface TrialMatch {
    nct_id: string;
    title: string;
    phase: string;
    fit_score: number;
    fit_category: 'strong' | 'moderate' | 'weak' | 'ineligible';
    nearest_site?: Location;
    distance_km?: number;
    meets_criteria: string[];
    fails_criteria: string[];
    missing_info: string[];
    explanation: string;
}

export interface ScreenResponse {
    patient_profile: PatientProfile;
    matches: TrialMatch[];
}

export interface ListenerResponse {
    should_trigger: boolean;
    confidence: 'high' | 'medium' | 'low';
    trigger_reason?: string;
    patient_profile?: PatientProfile;
    matches?: TrialMatch[];
}
