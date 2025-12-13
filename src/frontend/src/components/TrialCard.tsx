import type { TrialMatch } from '../types';
import { MapPin, Star, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react';

interface TrialCardProps {
    match: TrialMatch;
    onViewDetails?: (nctId: string) => void;
}

export default function TrialCard({ match, onViewDetails }: TrialCardProps) {
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
        <div className="glass-card slide-in" style={{
            padding: 'var(--spacing-xl)',
            marginBottom: 'var(--spacing-lg)'
        }}>
            {/* Header */}
            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div className="flex items-center gap-md">
                    {/* Fit Stars */}
                    <div className="flex gap-xs">
                        {[...Array(3)].map((_, i) => (
                            <Star
                                key={i}
                                size={20}
                                fill={i < stars ? getFitColor(match.fit_category) : 'transparent'}
                                color={i < stars ? getFitColor(match.fit_category) : 'var(--color-text-muted)'}
                            />
                        ))}
                    </div>
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

                <span className="badge badge-primary">{match.nct_id}</span>
            </div>

            {/* Title */}
            <h3 style={{
                fontSize: 'var(--font-size-xl)',
                marginBottom: 'var(--spacing-md)',
                color: 'var(--color-text-primary)'
            }}>
                {match.title}
            </h3>

            {/* Meta Info */}
            <div className="flex gap-lg" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <span className="badge badge-primary">{match.phase}</span>
                {match.nearest_site && (
                    <div className="flex items-center gap-sm text-secondary">
                        <MapPin size={16} />
                        <span style={{ fontSize: 'var(--font-size-sm)' }}>
                            {match.nearest_site.facility}, {match.nearest_site.city}
                            {match.distance_km && ` (${Math.round(match.distance_km)} km)`}
                        </span>
                    </div>
                )}
            </div>

            {/* Fit Score Progress Bar */}
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div className="flex justify-between" style={{ marginBottom: 'var(--spacing-sm)' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        Match Score
                    </span>
                    <span style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: '700',
                        color: getFitColor(match.fit_category)
                    }}>
                        {match.fit_score}/100
                    </span>
                </div>
                <div style={{
                    width: '100%',
                    height: '8px',
                    background: 'var(--color-bg-tertiary)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        width: `${match.fit_score}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${getFitColor(match.fit_category)}, ${getFitColor(match.fit_category)}dd)`,
                        borderRadius: 'var(--radius-full)',
                        transition: 'width 1s ease-out'
                    }} />
                </div>
            </div>

            {/* Explanation */}
            <p style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--spacing-lg)',
                lineHeight: '1.6'
            }}>
                {match.explanation}
            </p>

            {/* Criteria Lists */}
            <div className="flex flex-col gap-md" style={{ marginBottom: 'var(--spacing-lg)' }}>
                {/* Meets Criteria */}
                {match.meets_criteria.length > 0 && (
                    <div>
                        <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--spacing-sm)' }}>
                            <CheckCircle size={16} color="var(--color-success)" />
                            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--color-success)' }}>
                                Meets Criteria
                            </span>
                        </div>
                        <ul style={{ paddingLeft: 'var(--spacing-xl)', margin: '0' }}>
                            {match.meets_criteria.map((criteria, idx) => (
                                <li key={idx} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                    {criteria}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Fails Criteria */}
                {match.fails_criteria.length > 0 && (
                    <div>
                        <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--spacing-sm)' }}>
                            <XCircle size={16} color="var(--color-error)" />
                            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--color-error)' }}>
                                Exclusion Concerns
                            </span>
                        </div>
                        <ul style={{ paddingLeft: 'var(--spacing-xl)', margin: '0' }}>
                            {match.fails_criteria.map((criteria, idx) => (
                                <li key={idx} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                    {criteria}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Missing Info */}
                {match.missing_info.length > 0 && (
                    <div>
                        <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--spacing-sm)' }}>
                            <AlertCircle size={16} color="var(--color-warning)" />
                            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--color-warning)' }}>
                                Additional Info Needed
                            </span>
                        </div>
                        <ul style={{ paddingLeft: 'var(--spacing-xl)', margin: '0' }}>
                            {match.missing_info.map((info, idx) => (
                                <li key={idx} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                    {info}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-md">
                <button
                    className="btn btn-primary"
                    onClick={() => onViewDetails?.(match.nct_id)}
                    style={{ flex: '1' }}
                >
                    <ExternalLink size={18} />
                    View Full Details
                </button>
                <button className="btn btn-secondary">
                    Save for Later
                </button>
            </div>
        </div>
    );
}
