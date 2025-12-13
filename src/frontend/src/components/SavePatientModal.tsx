import { useState } from 'react';
import { X, Check, User, Star } from 'lucide-react';
import type { PatientProfile, TrialMatch } from '../types';

interface SavePatientModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientProfile: PatientProfile;
    matches: TrialMatch[];
    onSave: (name: string, selectedTrials: TrialMatch[]) => void;
}

export default function SavePatientModal({
    isOpen,
    onClose,
    patientProfile,
    matches,
    onSave
}: SavePatientModalProps) {
    const [patientName, setPatientName] = useState('');
    const [selectedTrials, setSelectedTrials] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const toggleTrialSelection = (nctId: string) => {
        if (selectedTrials.includes(nctId)) {
            setSelectedTrials(selectedTrials.filter(id => id !== nctId));
        } else if (selectedTrials.length < 3) {
            setSelectedTrials([...selectedTrials, nctId]);
        }
    };

    const handleSave = async () => {
        if (!patientName.trim()) {
            alert('Please enter a patient name');
            return;
        }
        if (selectedTrials.length === 0) {
            alert('Please select at least one trial');
            return;
        }

        setIsSaving(true);
        const selected = matches.filter(m => selectedTrials.includes(m.nct_id));
        await onSave(patientName, selected);
        setIsSaving(false);
        onClose();
    };

    const getFitColor = (category: string) => {
        switch (category) {
            case 'strong': return 'var(--color-success)';
            case 'moderate': return 'var(--color-warning)';
            case 'weak': return 'var(--color-text-tertiary)';
            default: return 'var(--color-error)';
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(8px)'
        }}>
            <div className="glass-card slide-in" style={{
                width: '90%',
                maxWidth: '700px',
                maxHeight: '85vh',
                overflow: 'auto',
                padding: 'var(--spacing-2xl)',
                borderRadius: 'var(--radius-2xl)'
            }}>
                {/* Header */}
                <div className="flex justify-between items-center" style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <div className="flex items-center gap-md">
                        <div style={{
                            width: '48px',
                            height: '48px',
                            background: 'var(--gradient-primary)',
                            borderRadius: 'var(--radius-lg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <User size={24} color="white" />
                        </div>
                        <div>
                            <h2 className="gradient-text" style={{ marginBottom: '0' }}>Save to Patient List</h2>
                            <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', marginBottom: '0' }}>
                                Save patient profile with selected trials
                            </p>
                        </div>
                    </div>
                    <button
                        className="btn btn-secondary btn-icon"
                        onClick={onClose}
                        style={{ padding: 'var(--spacing-sm)' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Patient Name Input */}
                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: '600' }}>
                        Patient Name *
                    </label>
                    <input
                        type="text"
                        className="input"
                        placeholder="Enter patient name"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        style={{ width: '100%' }}
                    />
                </div>

                {/* Patient Profile Summary */}
                <div style={{
                    background: 'var(--color-bg-secondary)',
                    padding: 'var(--spacing-lg)',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: 'var(--spacing-xl)'
                }}>
                    <h4 style={{ marginBottom: 'var(--spacing-md)' }}>Patient Profile</h4>
                    <div className="flex gap-lg" style={{ flexWrap: 'wrap' }}>
                        <div>
                            <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>Condition</span>
                            <p style={{ marginBottom: '0', fontWeight: '600' }}>{patientProfile.condition}</p>
                        </div>
                        {patientProfile.stage && (
                            <div>
                                <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>Stage</span>
                                <p style={{ marginBottom: '0', fontWeight: '600' }}>{patientProfile.stage}</p>
                            </div>
                        )}
                        {patientProfile.age && (
                            <div>
                                <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>Age</span>
                                <p style={{ marginBottom: '0', fontWeight: '600' }}>{patientProfile.age}</p>
                            </div>
                        )}
                        {patientProfile.sex && (
                            <div>
                                <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>Sex</span>
                                <p style={{ marginBottom: '0', fontWeight: '600' }}>{patientProfile.sex}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Trial Selection */}
                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <h4 style={{ marginBottom: 'var(--spacing-md)' }}>
                        Select Trials (up to 3)
                        <span className="badge badge-primary" style={{ marginLeft: 'var(--spacing-sm)' }}>
                            {selectedTrials.length}/3 selected
                        </span>
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        {matches.slice(0, 10).map((match) => (
                            <div
                                key={match.nct_id}
                                onClick={() => toggleTrialSelection(match.nct_id)}
                                style={{
                                    padding: 'var(--spacing-lg)',
                                    background: selectedTrials.includes(match.nct_id)
                                        ? 'rgba(99, 102, 241, 0.2)'
                                        : 'var(--color-bg-secondary)',
                                    borderRadius: 'var(--radius-lg)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    border: selectedTrials.includes(match.nct_id)
                                        ? '2px solid var(--color-primary)'
                                        : '2px solid transparent'
                                }}
                            >
                                <div className="flex justify-between items-center">
                                    <div style={{ flex: 1 }}>
                                        <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--spacing-xs)' }}>
                                            <Star
                                                size={16}
                                                fill={getFitColor(match.fit_category)}
                                                color={getFitColor(match.fit_category)}
                                            />
                                            <span className="badge" style={{
                                                background: `${getFitColor(match.fit_category)}20`,
                                                color: getFitColor(match.fit_category),
                                                fontSize: 'var(--font-size-xs)'
                                            }}>
                                                {match.fit_score}% {match.fit_category}
                                            </span>
                                            <span className="badge badge-primary" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                {match.nct_id}
                                            </span>
                                        </div>
                                        <p style={{
                                            marginBottom: '0',
                                            fontWeight: '500',
                                            fontSize: 'var(--font-size-sm)'
                                        }}>
                                            {match.title.length > 80 ? match.title.slice(0, 80) + '...' : match.title}
                                        </p>
                                    </div>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: selectedTrials.includes(match.nct_id)
                                            ? 'var(--color-primary)'
                                            : 'var(--color-bg-tertiary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginLeft: 'var(--spacing-md)'
                                    }}>
                                        {selectedTrials.includes(match.nct_id) && <Check size={18} color="white" />}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-md" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={isSaving || !patientName.trim() || selectedTrials.length === 0}
                    >
                        {isSaving ? (
                            <>
                                <div className="loading-spinner" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Check size={18} />
                                Save Patient
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
