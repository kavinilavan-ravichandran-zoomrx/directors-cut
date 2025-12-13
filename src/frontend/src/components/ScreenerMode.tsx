import { useState, useRef } from 'react';
import { Mic, MicOff, Search, Edit2, UserPlus, Brain, FlaskConical, Loader, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../types';
import type { PatientProfile, TrialMatch } from '../types';
import TrialCard from './TrialCard';
import SavePatientModal from './SavePatientModal';

type LoadingStage = 'idle' | 'extracting' | 'fetching' | 'evaluating' | 'done';

export default function ScreenerMode() {
    const [isRecording, setIsRecording] = useState(false);
    const [query, setQuery] = useState('');
    const [loadingStage, setLoadingStage] = useState<LoadingStage>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [trialsCount, setTrialsCount] = useState(0);
    const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
    const [matches, setMatches] = useState<TrialMatch[]>([]);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const toggleRecording = async () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);

        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please allow microphone permissions.');
        }
    };

    const stopRecording = async () => {
        if (!mediaRecorderRef.current) return;

        setIsRecording(false);
        setIsTranscribing(true);

        try {
            const audioBlob = await new Promise<Blob>((resolve) => {
                const mediaRecorder = mediaRecorderRef.current!;
                mediaRecorder.onstop = () => {
                    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    resolve(blob);
                };
                mediaRecorder.stop();
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
            });

            const formData = new FormData();
            formData.append('audio', audioBlob, 'screener_input.webm');

            const response = await axios.post<{ success: boolean; transcript: string }>(
                `${API_BASE_URL}/api/transcribe`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );

            if (response.data.success) {
                // Append to existing query if any, or set as new
                setQuery(prev => prev ? `${prev} ${response.data.transcript}` : response.data.transcript);
            }
        } catch (error) {
            console.error('Error transcribing audio:', error);
            alert('Error transcribing audio. Please try again.');
        } finally {
            setIsTranscribing(false);
        }
    };

    const processProfileToTrials = async (profile: PatientProfile) => {
        try {
            // Stage 2: Fetch trials from ClinicalTrials.gov
            setLoadingStage('fetching');
            setStatusMessage('Searching ClinicalTrials.gov...');

            // Second API call: Just fetch trials (fast)
            const searchResponse = await axios.post<{ trials_count: number; trials: any[] }>(
                `${API_BASE_URL}/api/search_trials`,
                { patient_profile: profile }
            );

            const { trials_count, trials } = searchResponse.data;
            setTrialsCount(trials_count);

            // Stage 3: Evaluate trials with LLM (slow part)
            setLoadingStage('evaluating');
            setStatusMessage(`${trials_count} trials found. Evaluating eligibility (this may take 2-3 minutes)...`);

            // Third API call: Evaluate trials with LLM
            const evalResponse = await axios.post<{ matches: TrialMatch[] }>(
                `${API_BASE_URL}/api/evaluate_trials`,
                { patient_profile: profile, trials: trials }
            );

            // Show matches
            setMatches(evalResponse.data.matches);
            setStatusMessage('');
            setLoadingStage('done');

        } catch (error) {
            console.error('Error screening patient:', error);
            alert('Error processing request. Please try again.');
            setLoadingStage('idle');
            setStatusMessage('');
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset state
        setPatientProfile(null);
        setMatches([]);
        setTrialsCount(0);
        setStatusMessage('');
        setQuery('');

        setLoadingStage('extracting');
        setStatusMessage('Analyzing medical image with Gemini Vision...');

        const formData = new FormData();
        formData.append('image', file);

        try {
            // Stage 1: Extract from Image
            const extractResponse = await axios.post<{ patient_profile: PatientProfile }>(
                `${API_BASE_URL}/api/extract/image`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );

            // Show extracted profile immediately
            const profile = extractResponse.data.patient_profile;
            setPatientProfile(profile);

            // Continue with Stage 2 & 3
            await processProfileToTrials(profile);

        } catch (error) {
            console.error('Error processing image:', error);
            alert('Error processing image. Please try again.');
            setLoadingStage('idle');
            setStatusMessage('');
        }

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSearch = async () => {
        if (!query.trim()) return;

        // Reset state
        setPatientProfile(null);
        setMatches([]);
        setTrialsCount(0);
        setStatusMessage('');

        // Stage 1: Extracting patient profile
        setLoadingStage('extracting');
        setStatusMessage('Analyzing patient description with AI...');

        try {
            // First API call: Extract profile only
            const extractResponse = await axios.post<{ patient_profile: PatientProfile }>(
                `${API_BASE_URL}/api/extract`,
                { query: query }
            );

            // Show extracted profile immediately
            const profile = extractResponse.data.patient_profile;
            setPatientProfile(profile);

            // Continue handling
            await processProfileToTrials(profile);

        } catch (error) {
            console.error('Error screening patient:', error);
            alert('Error processing request. Please try again.');
            setLoadingStage('idle');
            setStatusMessage('');
        }
    };

    return (
        <div style={{ marginTop: 'var(--spacing-xl)' }}>
            {/* Input Section */}
            <div className="glass-card" style={{
                padding: 'var(--spacing-2xl)',
                marginBottom: 'var(--spacing-xl)',
                borderRadius: 'var(--radius-2xl)'
            }}>
                <h2 className="gradient-text" style={{ marginBottom: 'var(--spacing-lg)' }}>
                    Patient Screener
                </h2>
                <p className="text-secondary" style={{ marginBottom: 'var(--spacing-xl)' }}>
                    Describe your patient using voice or text or upload a picture of the patient chart, and we'll find matching clinical trials instantly.
                </p>

                {/* Voice/Text/Image Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                />
                <div className="flex gap-md" style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <div className="flex flex-col gap-sm">
                        <button
                            className={`btn ${isRecording ? 'btn-primary pulse' : 'btn-secondary'}`}
                            onClick={toggleRecording}
                            disabled={(loadingStage !== 'idle' && loadingStage !== 'done') || isTranscribing}
                            style={{ minWidth: '140px' }}
                        >
                            {isTranscribing ? (
                                <>
                                    <Loader size={20} className="spin" />
                                    Transcribing...
                                </>
                            ) : isRecording ? (
                                <>
                                    <MicOff size={20} />
                                    Stop
                                </>
                            ) : (
                                <>
                                    <Mic size={20} />
                                    Voice Input
                                </>
                            )}
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={loadingStage !== 'idle' && loadingStage !== 'done'}
                            style={{ minWidth: '140px' }}
                        >
                            <ImageIcon size={20} />
                            Upload Report
                        </button>
                    </div>
                    <div style={{ flex: '1', position: 'relative' }}>
                        <textarea
                            className="input"
                            placeholder="e.g., 62-year-old woman, metastatic TNBC, failed AC-T and capecitabine, BRCA wild-type, ECOG 1, Chennai"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            rows={3}
                            style={{
                                resize: 'none',
                                width: '100%',
                                height: '100%'
                            }}
                        />
                    </div>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={handleSearch}
                    disabled={loadingStage !== 'idle' && loadingStage !== 'done'}
                    style={{ width: '100%' }}
                >
                    {loadingStage !== 'idle' && loadingStage !== 'done' ? (
                        <>
                            <div className="loading-spinner" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <Search size={20} />
                            Find Matching Trials
                        </>
                    )}
                </button>
            </div>

            {/* Patient Profile Card - Shows during extraction and after */}
            {(loadingStage === 'extracting' || patientProfile) && (
                <div className="fade-in">
                    <div className="glass-card" style={{
                        padding: 'var(--spacing-xl)',
                        marginBottom: 'var(--spacing-xl)',
                        borderRadius: 'var(--radius-xl)'
                    }}>
                        <div className="flex justify-between items-center" style={{ marginBottom: 'var(--spacing-lg)' }}>
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
                                    <Brain size={20} color="white" />
                                </div>
                                <h3 style={{ marginBottom: '0' }}>
                                    {loadingStage === 'extracting' ? 'Extracting Patient Profile...' : 'Extracted Patient Profile'}
                                </h3>
                            </div>
                            <div className="flex gap-sm">
                                {matches.length > 0 && (
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setShowSaveModal(true)}
                                    >
                                        <UserPlus size={18} />
                                        Save Patient
                                    </button>
                                )}
                                {patientProfile && (
                                    <button
                                        className="btn btn-secondary btn-icon"
                                        onClick={() => setIsEditingProfile(!isEditingProfile)}
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {loadingStage === 'extracting' ? (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                                <div className="loading-spinner" style={{ margin: '0 auto', marginBottom: 'var(--spacing-md)' }} />
                                <p className="text-secondary">Analyzing patient description with AI...</p>
                            </div>
                        ) : patientProfile && (
                            <div className="flex flex-col gap-md">
                                <div className="flex gap-lg" style={{ flexWrap: 'wrap' }}>
                                    <div>
                                        <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>Condition</span>
                                        <p style={{ fontWeight: '600', marginBottom: '0' }}>{patientProfile.condition}</p>
                                    </div>
                                    {patientProfile.stage && (
                                        <div>
                                            <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>Stage</span>
                                            <p style={{ fontWeight: '600', marginBottom: '0' }}>{patientProfile.stage}</p>
                                        </div>
                                    )}
                                    {patientProfile.line_of_therapy && (
                                        <div>
                                            <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>Line of Therapy</span>
                                            <p style={{ fontWeight: '600', marginBottom: '0' }}>{patientProfile.line_of_therapy}</p>
                                        </div>
                                    )}
                                    {patientProfile.ecog !== undefined && patientProfile.ecog !== null && (
                                        <div>
                                            <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>ECOG</span>
                                            <p style={{ fontWeight: '600', marginBottom: '0' }}>{patientProfile.ecog}</p>
                                        </div>
                                    )}
                                </div>

                                {patientProfile.prior_treatments && patientProfile.prior_treatments.length > 0 && (
                                    <div>
                                        <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>Prior Treatments</span>
                                        <div className="flex gap-sm" style={{ marginTop: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                                            {patientProfile.prior_treatments.map((tx, idx) => (
                                                <span key={idx} className="badge badge-primary">{tx}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {patientProfile.biomarkers && Object.keys(patientProfile.biomarkers).length > 0 && (
                                    <div>
                                        <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>Biomarkers</span>
                                        <div className="flex gap-sm" style={{ marginTop: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                                            {Object.entries(patientProfile.biomarkers).map(([key, value]) => (
                                                <span key={key} className="badge badge-success">
                                                    {key}: {String(value)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {patientProfile.location && (
                                    <div>
                                        <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>Location</span>
                                        <p style={{ fontWeight: '600', marginBottom: '0' }}>
                                            {patientProfile.location.city}, {patientProfile.location.country}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Matching Trials Card - Shows during fetching/evaluating and after */}
            {(loadingStage === 'fetching' || loadingStage === 'evaluating' || (loadingStage === 'done' && patientProfile)) && (
                <div className="fade-in">
                    <div className="glass-card" style={{
                        padding: 'var(--spacing-xl)',
                        marginBottom: 'var(--spacing-xl)',
                        borderRadius: 'var(--radius-xl)'
                    }}>
                        <div className="flex items-center gap-md" style={{ marginBottom: 'var(--spacing-lg)' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                background: 'var(--gradient-success)',
                                borderRadius: 'var(--radius-lg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <FlaskConical size={20} color="white" />
                            </div>
                            <h3 style={{ marginBottom: '0' }}>
                                {loadingStage === 'fetching' || loadingStage === 'evaluating' ? 'Finding Clinical Trials...' : 'Matching Trials'}
                            </h3>
                            {matches.length > 0 && (
                                <span className="badge badge-primary">
                                    {matches.length} found
                                </span>
                            )}
                        </div>

                        {(loadingStage === 'fetching' || loadingStage === 'evaluating') ? (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                                <div className="loading-spinner" style={{ margin: '0 auto', marginBottom: 'var(--spacing-md)' }} />
                                <p className="text-secondary" style={{ marginBottom: 'var(--spacing-sm)', fontWeight: '600' }}>
                                    {statusMessage || 'Processing...'}
                                </p>
                                {trialsCount > 0 && (
                                    <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', marginBottom: '0' }}>
                                        ⏱️ Eligibility evaluation may take 2-3 minutes
                                    </p>
                                )}
                            </div>
                        ) : matches.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                                <p className="text-secondary">No matching trials found. Try adjusting the search criteria.</p>
                            </div>
                        ) : (
                            <div>
                                {matches.map((match) => (
                                    <TrialCard
                                        key={match.nct_id}
                                        match={match}
                                        onViewDetails={(nctId) => window.open(`https://clinicaltrials.gov/study/${nctId}`, '_blank')}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Save Patient Modal */}
            {patientProfile && (
                <SavePatientModal
                    isOpen={showSaveModal}
                    onClose={() => setShowSaveModal(false)}
                    patientProfile={patientProfile}
                    matches={matches}
                    onSave={async (name: string, selectedTrials: TrialMatch[]) => {
                        try {
                            await axios.post(`${API_BASE_URL}/api/patients/save`, {
                                name,
                                patient_profile: patientProfile,
                                selected_trials: selectedTrials
                            });
                            alert(`Patient "${name}" saved successfully! You can view them in Chart Peek mode.`);
                        } catch (error) {
                            console.error('Error saving patient:', error);
                            alert('Error saving patient. Please try again.');
                        }
                    }}
                />
            )}
        </div>
    );
}
