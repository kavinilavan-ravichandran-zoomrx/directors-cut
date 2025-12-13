import { useState, useEffect } from 'react';
import { X, Check, Save } from 'lucide-react';
import type { PatientProfile } from '../types';

interface EditPatientModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientProfile: PatientProfile;
    patientName: string;
    onSave: (updatedData: any) => Promise<void>;
}

export default function EditPatientModal({
    isOpen,
    onClose,
    patientProfile,
    patientName,
    onSave
}: EditPatientModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        age: '',
        sex: '',
        condition: '',
        stage: '',
        ecog: '',
        prior_treatments: '',
        current_treatments: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: patientName || '',
                age: patientProfile.age?.toString() || '',
                sex: patientProfile.sex || '',
                condition: patientProfile.condition || '',
                stage: patientProfile.stage || '',
                ecog: patientProfile.ecog?.toString() || '',
                prior_treatments: patientProfile.prior_treatments ? patientProfile.prior_treatments.join(', ') : '',
                current_treatments: patientProfile.current_treatments ? patientProfile.current_treatments.join(', ') : ''
            });
        }
    }, [isOpen, patientProfile, patientName]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({
                name: formData.name,
                age: formData.age ? parseInt(formData.age) : null,
                sex: formData.sex,
                condition: formData.condition,
                stage: formData.stage,
                ecog: formData.ecog,
                prior_treatments: formData.prior_treatments.split(',').map(s => s.trim()).filter(Boolean),
                current_treatments: formData.current_treatments.split(',').map(s => s.trim()).filter(Boolean)
            });
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to save changes');
        } finally {
            setIsSaving(false);
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
                maxWidth: '600px',
                padding: 'var(--spacing-2xl)',
                borderRadius: 'var(--radius-2xl)'
            }}>
                {/* Header */}
                <div className="flex justify-between items-center" style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <div className="flex items-center gap-md">
                        <div style={{
                            width: '40px',
                            height: '40px',
                            background: 'var(--gradient-primary)',
                            borderRadius: 'var(--radius-lg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Save size={20} color="white" />
                        </div>
                        <div>
                            <h2 className="gradient-text" style={{ marginBottom: '0', fontSize: 'var(--font-size-xl)' }}>Edit Patient Profile</h2>
                        </div>
                    </div>
                    <button
                        className="btn btn-secondary btn-icon"
                        onClick={onClose}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)', marginBottom: 'var(--spacing-xl)', maxHeight: '60vh', overflowY: 'auto', paddingRight: 'var(--spacing-sm)' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                        <h4 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)' }}>Demographics</h4>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '600' }}>Full Name</label>
                        <input
                            type="text"
                            className="input"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '600' }}>Age</label>
                        <input
                            type="number"
                            className="input"
                            value={formData.age}
                            onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '600' }}>Sex</label>
                        <select
                            className="input"
                            value={formData.sex}
                            onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                            style={{ width: '100%' }}
                        >
                            <option value="">Select...</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div style={{ gridColumn: 'span 2', marginTop: 'var(--spacing-md)' }}>
                        <h4 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)' }}>Diagnosis</h4>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '600' }}>Condition</label>
                        <input
                            type="text"
                            className="input"
                            value={formData.condition}
                            onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '600' }}>Stage</label>
                        <input
                            type="text"
                            className="input"
                            value={formData.stage}
                            onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div>
                        <input
                            type="text"
                            className="input"
                            value={formData.ecog}
                            onChange={(e) => setFormData({ ...formData, ecog: e.target.value })}
                            style={{ width: '100%' }}
                            placeholder="e.g. 0, 1, 0-1"
                        />
                    </div>

                    <div style={{ gridColumn: 'span 2', marginTop: 'var(--spacing-md)' }}>
                        <h4 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)' }}>Clinical Details</h4>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '600' }}>Current Treatments (comma separated)</label>
                        <textarea
                            className="input"
                            value={formData.current_treatments}
                            onChange={(e) => setFormData({ ...formData, current_treatments: e.target.value })}
                            style={{ width: '100%', minHeight: '60px', resize: 'vertical' }}
                            placeholder="e.g. Pembrolizumab, Carboplatin"
                        />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '600' }}>Treatment History (comma separated)</label>
                        <textarea
                            className="input"
                            value={formData.prior_treatments}
                            onChange={(e) => setFormData({ ...formData, prior_treatments: e.target.value })}
                            style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
                            placeholder="e.g. Doxorubicin, Cyclophosphamide"
                        />
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
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving...' : (
                            <>
                                <Check size={18} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
