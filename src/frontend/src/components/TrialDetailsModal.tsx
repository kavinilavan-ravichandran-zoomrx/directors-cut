import { X, MapPin, Star, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react';
import type { TrialMatch } from '../types';

interface TrialDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    match: TrialMatch | null;
}

export default function TrialDetailsModal({ isOpen, onClose, match }: TrialDetailsModalProps) {
    if (!isOpen || !match) return null;

    const getFitColor = (category: string) => {
        switch (category) {
            case 'strong': return 'var(--color-success)';
            case 'moderate': return 'var(--color-warning)';
            case 'weak': return 'var(--color-text-tertiary)';
            case 'ineligible': return 'var(--color-error)';
            default: return 'var(--color-text-secondary)';
        }
    };

    const getFitStars = (score: number) => {
        if (score >= 80) return 3;
        if (score >= 50) return 2;
        return 1;
    };

    const stars = getFitStars(match.fit_score);

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--spacing-md)'
        }}>
            <div
                className="glass-card slide-up"
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '800px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    padding: 'var(--spacing-xl)',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border)'
                }}
            >
                {/* Header Actions */}
                <div className="flex justify-between items-start" style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <div className="flex flex-col gap-xs">
                        <div className="flex items-center gap-md">
                            <span className="badge badge-primary">{match.nct_id}</span>
                            <span className="badge" style={{
                                background: `${getFitColor(match.fit_category)}20`,
                                color: getFitColor(match.fit_category),
                                border: `1px solid ${getFitColor(match.fit_category)}40`,
                                textTransform: 'uppercase',
                                fontWeight: '700'
                            }}>
                                {match.fit_category} FIT
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            padding: 'var(--spacing-xs)'
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Title */}
                <h2 style={{
                    fontSize: 'var(--font-size-xl)',
                    marginBottom: 'var(--spacing-md)',
                    color: 'var(--color-text-primary)',
                    lineHeight: '1.4'
                }}>
                    {match.title}
                </h2>

                {/* Meta Info */}
                <div className="flex gap-lg slide-in" style={{ marginBottom: 'var(--spacing-2xl)', animationDelay: '0.1s' }}>
                    <span className="badge badge-secondary">{match.phase}</span>
                    {match.nearest_site && (
                        <div className="flex items-center gap-sm text-secondary">
                            <MapPin size={16} />
                            <span>
                                {match.nearest_site.facility}, {match.nearest_site.city}
                                {match.distance_km && ` (${Math.round(match.distance_km)} km)`}
                            </span>
                        </div>
                    )}
                </div>

                {/* Score Section */}
                <div className="glass-card slide-in" style={{
                    marginBottom: 'var(--spacing-xl)',
                    background: 'var(--color-bg-secondary)',
                    padding: 'var(--spacing-lg)',
                    animationDelay: '0.2s'
                }}>
                    <div className="flex justify-between items-end" style={{ marginBottom: 'var(--spacing-sm)' }}>
                        <div className="flex gap-xs">
                            {[...Array(3)].map((_, i) => (
                                <Star
                                    key={i}
                                    size={24}
                                    fill={i < stars ? getFitColor(match.fit_category) : 'transparent'}
                                    color={i < stars ? getFitColor(match.fit_category) : 'var(--color-text-muted)'}
                                />
                            ))}
                        </div>
                        <span style={{
                            fontSize: 'var(--font-size-lg)',
                            fontWeight: '700',
                            color: getFitColor(match.fit_category)
                        }}>
                            {match.fit_score}/100 Match Score
                        </span>
                    </div>

                    <p style={{
                        color: 'var(--color-text-secondary)',
                        lineHeight: '1.6',
                        marginTop: 'var(--spacing-md)'
                    }}>
                        {match.explanation}
                    </p>
                </div>

                {/* Criteria Analysis */}
                <div className="flex flex-col gap-lg slide-in" style={{ marginBottom: 'var(--spacing-2xl)', animationDelay: '0.3s' }}>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--spacing-sm)' }}>
                        Detailed Analysis
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                        {/* Meets Criteria */}
                        <div className="glass-card" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)', padding: 'var(--spacing-lg)' }}>
                            <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--spacing-md)' }}>
                                <CheckCircle size={20} color="var(--color-success)" />
                                <h4 style={{ margin: 0, color: 'var(--color-success)' }}>Why it Matches</h4>
                            </div>
                            <ul className="list-disc" style={{ paddingLeft: 'var(--spacing-lg)', margin: 0 }}>
                                {match.meets_criteria.length > 0 ? match.meets_criteria.map((criteria, idx) => (
                                    <li key={idx} style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--color-text-secondary)' }}>
                                        {criteria}
                                    </li>
                                )) : <li style={{ color: 'var(--color-text-muted)' }}>No specific inclusion matches listed.</li>}
                            </ul>
                        </div>

                        {/* Fails/Missing Criteria Group */}
                        <div className="flex flex-col gap-lg">
                            {/* Fails Criteria */}
                            {match.fails_criteria && match.fails_criteria.length > 0 && (
                                <div className="glass-card" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)', padding: 'var(--spacing-lg)' }}>
                                    <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--spacing-md)' }}>
                                        <XCircle size={20} color="var(--color-error)" />
                                        <h4 style={{ margin: 0, color: 'var(--color-error)' }}>Exclusion Risks</h4>
                                    </div>
                                    <ul className="list-disc" style={{ paddingLeft: 'var(--spacing-lg)', margin: 0 }}>
                                        {match.fails_criteria.map((criteria, idx) => (
                                            <li key={idx} style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--color-text-secondary)' }}>
                                                {criteria}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Missing Info */}
                            {match.missing_info && match.missing_info.length > 0 && (
                                <div className="glass-card" style={{ background: 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.2)', padding: 'var(--spacing-lg)' }}>
                                    <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--spacing-md)' }}>
                                        <AlertCircle size={20} color="var(--color-warning)" />
                                        <h4 style={{ margin: 0, color: 'var(--color-warning)' }}>Missing Information</h4>
                                    </div>
                                    <ul className="list-disc" style={{ paddingLeft: 'var(--spacing-lg)', margin: 0 }}>
                                        {match.missing_info.map((info, idx) => (
                                            <li key={idx} style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--color-text-secondary)' }}>
                                                {info}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end gap-md pt-lg" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <button className="btn btn-secondary" onClick={onClose}>
                        Close
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => window.open(`https://clinicaltrials.gov/study/${match.nct_id}`, '_blank')}
                    >
                        <ExternalLink size={18} />
                        View on ClinicalTrials.gov
                    </button>
                </div>
            </div>
        </div>
    );
}
