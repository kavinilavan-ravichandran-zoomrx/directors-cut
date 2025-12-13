import { useState, useEffect } from 'react';
import { User, FileText, RefreshCw, Database, Trash2, CheckSquare, Square, Save, Edit2, Check } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../types';
import type { PatientProfile, TrialMatch } from '../types';
import EditPatientModal from './EditPatientModal';
import TrialDetailsModal from './TrialDetailsModal';

interface SavedPatient {
    patient_id: string;
    name: string;
    condition: string;
    age: number | null;
    sex: string | null;
    stage: string | null;
    trial_count: number;
}

interface PatientTrials {
    patient_id: string;
    name: string;
    selected_trials: TrialMatch[];
}

interface ChartData {
    patient: PatientProfile;
    matches: TrialMatch[];
}

export default function ChartPeekMode() {
    const [patients, setPatients] = useState<SavedPatient[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<string>('');
    const [patientTrials, setPatientTrials] = useState<PatientTrials | null>(null);
    const [chartData, setChartData] = useState<ChartData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [loadingPatients, setLoadingPatients] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    // New state for update flow
    const [isViewingFreshData, setIsViewingFreshData] = useState(false);
    const [selectedNewTrials, setSelectedNewTrials] = useState<string[]>([]);

    const patientName = patients.find(p => p.patient_id === selectedPatient)?.name || 'Unknown Patient';

    // Keep track of originally saved trials to compare against new search results
    const [savedTrials, setSavedTrials] = useState<any[]>([]);

    // Edit Profile state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Trial Details Modal state
    const [selectedDetailTrial, setSelectedDetailTrial] = useState<TrialMatch | null>(null);

    // Load saved patients on mount
    useEffect(() => {
        loadPatients();
    }, []);

    const loadPatients = async () => {
        setLoadingPatients(true);
        try {
            const response = await axios.get<{ patients: SavedPatient[] }>(`${API_BASE_URL}/api/patients`);
            setPatients(response.data.patients);
        } catch (error) {
            console.error('Error loading patients:', error);
        } finally {
            setLoadingPatients(false);
        }
    };

    const loadPatientFromDB = async (patientId: string) => {
        setIsLoading(true);
        setIsViewingFreshData(false); // Validating saved data
        setSelectedNewTrials([]);

        try {
            // Only load saved trials from DB - no LLM calls
            const trialsResponse = await axios.get<PatientTrials>(`${API_BASE_URL}/api/patients/${patientId}/trials`);
            setPatientTrials(trialsResponse.data);
            setSavedTrials(trialsResponse.data.selected_trials);

            // Get patient chart data (just profile, no new trial matching)
            const chartResponse = await axios.get<ChartData>(`${API_BASE_URL}/api/chart/${patientId}?skip_matching=true`);
            setChartData(chartResponse.data);
        } catch (error) {
            console.error('Error loading patient data:', error);
            // Try fallback without skip_matching parameter
            try {
                const trialsResponse = await axios.get<PatientTrials>(`${API_BASE_URL}/api/patients/${patientId}/trials`);
                setPatientTrials(trialsResponse.data);
                // Just set a basic chart data from the saved trials
                setChartData({
                    patient: {
                        condition: trialsResponse.data.selected_trials[0]?.explanation || 'Unknown',
                        prior_treatments: [],
                        biomarkers: {}
                    } as PatientProfile,
                    matches: trialsResponse.data.selected_trials
                });
            } catch (e) {
                alert('Error loading patient data. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const refreshTrials = async () => {
        if (!selectedPatient || !chartData) return;

        setIsRefreshing(true);
        try {
            // Call the full chart endpoint to get fresh trials from ClinicalTrials.gov
            const response = await axios.get<ChartData>(`${API_BASE_URL}/api/chart/${selectedPatient}`);
            setChartData(response.data);

            // Show fresh trials and enable selection mode
            setPatientTrials({
                ...patientTrials!,
                selected_trials: response.data.matches
            });
            setIsViewingFreshData(true);
            setSelectedNewTrials([]); // Reset selection
        } catch (error) {
            console.error('Error refreshing trials:', error);
            alert('Error refreshing trials. Please try again.');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleDeletePatient = async (e: React.MouseEvent, patientId: string, patientName: string) => {
        e.stopPropagation(); // Prevent selecting the patient when clicking delete

        if (!confirm(`Are you sure you want to delete ${patientName}? This action cannot be undone.`)) {
            return;
        }

        try {
            await axios.delete(`${API_BASE_URL}/api/patients/${patientId}`);

            // Remove from list
            setPatients(prev => prev.filter(p => p.patient_id !== patientId));

            // If selected, clear selection
            if (selectedPatient === patientId) {
                setSelectedPatient('');
                setPatientTrials(null);
                setChartData(null);
            }
        } catch (error) {
            console.error('Error deleting patient:', error);
            alert('Error deleting patient. Please try again.');
        }
    };

    const toggleTrialSelection = (nctId: string) => {
        if (!isViewingFreshData) return;

        setSelectedNewTrials(prev => {
            if (prev.includes(nctId)) {
                return prev.filter(id => id !== nctId);
            } else {
                if (prev.length >= 3) {
                    alert('You can only select up to 3 trials.');
                    return prev;
                }
                return [...prev, nctId];
            }
        });
    };

    const handleUpdatePatientTrials = async () => {
        if (!selectedPatient || !patientTrials || selectedNewTrials.length === 0) {
            alert('Please select at least one trial to save.');
            return;
        }

        setIsUpdating(true);
        try {
            // Filter the full match objects based on selected IDs
            const selectedTrialObjects = patientTrials.selected_trials.filter(
                t => selectedNewTrials.includes(t.nct_id)
            );

            await axios.put(`${API_BASE_URL}/api/patients/${selectedPatient}/trials`, {
                selected_trials: selectedTrialObjects
            });

            alert('Patient trials updated successfully!');

            // Reload patient list to update counts
            loadPatients();

            // Switch back to "Saved" view mode
            setIsViewingFreshData(false);

            // Update local state to reflect these are now the saved trials
            setPatientTrials(prev => ({
                ...prev!,
                selected_trials: selectedTrialObjects
            }));

        } catch (error) {
            console.error('Error updating patient trials:', error);
            alert('Error updating patient trials.');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleUpdateProfile = async (updatedData: any) => {
        if (!selectedPatient) return;

        // Optimistic update locally could be done here, but reloading is safer
        await axios.put(`${API_BASE_URL}/api/patients/${selectedPatient}`, updatedData);
        alert('Profile updated successfully!');
        loadPatientFromDB(selectedPatient);
        // Refresh patient list to show updated name/age in sidebar
        loadPatients();
    };

    useEffect(() => {
        if (selectedPatient) {
            loadPatientFromDB(selectedPatient);
        }
    }, [selectedPatient]);

    // Debug saved trials
    useEffect(() => {
        console.log('Saved Trials State:', savedTrials);
        console.log('Saved IDs:', savedTrials.map(t => t.nct_id));
    }, [savedTrials]);

    return (
        <div style={{ marginTop: 'var(--spacing-xl)' }}>
            {/* Header */}
            <div className="glass-card" style={{
                padding: 'var(--spacing-xl)',
                marginBottom: 'var(--spacing-xl)',
                borderRadius: 'var(--radius-2xl)'
            }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <div>
                        <h2 className="gradient-text" style={{ marginBottom: 'var(--spacing-xs)' }}>
                            Chart Peek - Saved Patients
                        </h2>
                        <p className="text-secondary" style={{ marginBottom: '0' }}>
                            View saved patients and their matched clinical trials
                        </p>
                    </div>
                    <button
                        className="btn btn-secondary"
                        onClick={loadPatients}
                        disabled={loadingPatients}
                    >
                        <RefreshCw size={18} className={loadingPatients ? 'spin' : ''} />
                        Refresh List
                    </button>
                </div>

                {/* Patient Selector */}
                {loadingPatients ? (
                    <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                        <p className="text-secondary" style={{ marginTop: 'var(--spacing-md)' }}>
                            Loading patients...
                        </p>
                    </div>
                ) : patients.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: 'var(--spacing-2xl)',
                        background: 'var(--color-bg-secondary)',
                        borderRadius: 'var(--radius-lg)'
                    }}>
                        <Database size={48} color="var(--color-text-muted)" style={{ marginBottom: 'var(--spacing-md)' }} />
                        <h4 style={{ marginBottom: 'var(--spacing-sm)' }}>No Saved Patients</h4>
                        <p className="text-secondary">
                            Use the Screener Mode to search for trials and save patients to your list.
                        </p>
                    </div>
                ) : (
                    <div className="flex gap-md" style={{ flexWrap: 'wrap' }}>
                        {patients.map((patient) => (
                            <div
                                key={patient.patient_id}
                                className={`btn ${selectedPatient === patient.patient_id ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setSelectedPatient(patient.patient_id)}
                                style={{
                                    minWidth: '200px',
                                    padding: 'var(--spacing-md)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    position: 'relative'
                                }}
                            >
                                <div className="flex items-center gap-sm">
                                    <User size={18} />
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontWeight: '600' }}>{patient.name}</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.8 }}>
                                            {patient.condition} • {patient.trial_count} trials
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className="btn-icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeletePatient(e, patient.patient_id, patient.name);
                                    }}
                                    title="Delete Patient"
                                    style={{
                                        padding: '4px',
                                        opacity: 1,
                                        marginLeft: 'var(--spacing-sm)',
                                        background: 'transparent',
                                        border: 'none',
                                        boxShadow: 'none',
                                        position: 'relative',
                                        zIndex: 10
                                    }}
                                >
                                    <Trash2 size={16} color="var(--color-error)" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Patient Details */}
            {selectedPatient && (
                <div className="flex gap-xl fade-in">
                    {/* Main Chart Area */}
                    <div style={{ flex: '1' }}>
                        <div className="glass-card" style={{
                            padding: 'var(--spacing-2xl)',
                            borderRadius: 'var(--radius-xl)'
                        }}>
                            {isLoading ? (
                                <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                                    <div className="loading-spinner" style={{ margin: '0 auto' }} />
                                    <p className="text-secondary" style={{ marginTop: 'var(--spacing-md)' }}>
                                        Loading patient data...
                                    </p>
                                </div>
                            ) : chartData ? (
                                <div>
                                    <div className="flex justify-between items-center" style={{ marginBottom: 'var(--spacing-lg)' }}>
                                        <h3 style={{ marginBottom: '0' }}>
                                            {patientTrials?.name || 'Patient'} - Medical Record
                                        </h3>
                                        <button
                                            className="btn btn-secondary btn-icon"
                                            onClick={() => setIsEditModalOpen(true)}
                                            title="Edit Profile"
                                            style={{ width: '32px', height: '32px', padding: 0 }}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    </div>

                                    <div className="flex flex-col gap-lg">
                                        {/* Demographics */}
                                        <div className="glass-card" style={{ padding: 'var(--spacing-lg)', background: 'var(--color-bg-secondary)' }}>
                                            <h4 style={{ marginBottom: '0' }}>Demographics</h4>
                                            <div className="flex gap-xl" style={{ flexWrap: 'wrap' }}>
                                                {chartData.patient.age && (
                                                    <div>
                                                        <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>Age</span>
                                                        <p style={{ fontWeight: '600', marginBottom: '0' }}>{chartData.patient.age} years</p>
                                                    </div>
                                                )}
                                                {chartData.patient.sex && (
                                                    <div>
                                                        <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>Sex</span>
                                                        <p style={{ fontWeight: '600', marginBottom: '0' }}>{chartData.patient.sex}</p>
                                                    </div>
                                                )}
                                                {chartData.patient.location && (
                                                    <div>
                                                        <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>Location</span>
                                                        <p style={{ fontWeight: '600', marginBottom: '0' }}>
                                                            {chartData.patient.location.city}, {chartData.patient.location.country}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Diagnosis */}
                                        <div className="glass-card" style={{ padding: 'var(--spacing-lg)', background: 'var(--color-bg-secondary)' }}>
                                            <h4 style={{ marginBottom: 'var(--spacing-md)' }}>Diagnosis</h4>
                                            <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600', marginBottom: 'var(--spacing-md)' }}>
                                                {chartData.patient.condition}
                                            </p>
                                            <div className="flex gap-sm">
                                                {chartData.patient.stage && (
                                                    <span className="badge badge-warning">Stage: {chartData.patient.stage}</span>
                                                )}
                                                {chartData.patient.line_of_therapy && (
                                                    <span className="badge badge-primary">Line: {chartData.patient.line_of_therapy}</span>
                                                )}
                                                {chartData.patient.ecog !== undefined && chartData.patient.ecog !== null && (
                                                    <span className="badge badge-success">ECOG: {chartData.patient.ecog}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Current Treatments */}
                                        <div className="glass-card" style={{ padding: 'var(--spacing-lg)', background: 'var(--color-bg-secondary)' }}>
                                            <h4 style={{ marginBottom: 'var(--spacing-md)' }}>Current Treatments</h4>
                                            {chartData.patient.current_treatments && chartData.patient.current_treatments.length > 0 ? (
                                                <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                                                    {chartData.patient.current_treatments.map((tx, idx) => (
                                                        <span key={idx} className="badge badge-success">{tx}</span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p style={{ marginBottom: '0', color: 'var(--color-text-secondary)' }}>-</p>
                                            )}
                                        </div>

                                        {/* Treatment History */}
                                        {chartData.patient.prior_treatments && chartData.patient.prior_treatments.length > 0 && (
                                            <div className="glass-card" style={{ padding: 'var(--spacing-lg)', background: 'var(--color-bg-secondary)' }}>
                                                <h4 style={{ marginBottom: 'var(--spacing-md)' }}>Treatment History</h4>
                                                <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                                                    {chartData.patient.prior_treatments.map((tx, idx) => (
                                                        <span key={idx} className="badge badge-primary">{tx}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Biomarkers */}
                                        {chartData.patient.biomarkers && Object.keys(chartData.patient.biomarkers).length > 0 && (
                                            <div className="glass-card" style={{ padding: 'var(--spacing-lg)', background: 'var(--color-bg-secondary)' }}>
                                                <h4 style={{ marginBottom: 'var(--spacing-md)' }}>Biomarkers</h4>
                                                <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                                                    {Object.entries(chartData.patient.biomarkers).map(([key, value]) => (
                                                        <span key={key} className="badge badge-success">
                                                            {key}: {String(value)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {/* Saved Trials Sidebar */}
                    <div style={{ width: '450px' }}>
                        <div className="glass-card" style={{
                            padding: 'var(--spacing-xl)',
                            borderRadius: 'var(--radius-xl)',
                            position: 'sticky',
                            top: 'var(--spacing-xl)'
                        }}>
                            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--spacing-lg)' }}>
                                <div className="flex items-center gap-md">
                                    <FileText size={24} color="var(--color-primary)" />
                                    <h4 style={{ marginBottom: '0' }}>Saved Trials</h4>
                                </div>
                                <button
                                    className="btn btn-secondary"
                                    onClick={refreshTrials}
                                    disabled={isRefreshing}
                                    title="Search for new trials from ClinicalTrials.gov"
                                >
                                    <RefreshCw size={18} className={isRefreshing ? 'spin' : ''} />
                                    {isRefreshing ? 'Searching...' : 'Find New'}
                                </button>
                            </div>

                            {isLoading ? (
                                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                                    <div className="loading-spinner" style={{ margin: '0 auto' }} />
                                </div>
                            ) : isRefreshing ? (
                                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                                    <div className="loading-spinner" style={{ margin: '0 auto', marginBottom: 'var(--spacing-md)' }} />
                                    <p className="text-secondary">Searching ClinicalTrials.gov...</p>
                                </div>
                            ) : patientTrials && patientTrials.selected_trials.length > 0 ? (
                                <div>
                                    {isViewingFreshData ? (
                                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                            <div className="glass-card" style={{
                                                padding: 'var(--spacing-md)',
                                                background: 'var(--color-bg-secondary)',
                                                border: '1px solid var(--color-primary)',
                                                marginBottom: 'var(--spacing-md)'
                                            }}>
                                                <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: '0', color: 'var(--color-primary)' }}>
                                                    Select up to 3 trials to save for this patient.
                                                </p>
                                            </div>
                                            <button
                                                className="btn btn-primary"
                                                style={{ width: '100%' }}
                                                onClick={handleUpdatePatientTrials}
                                                disabled={selectedNewTrials.length === 0 || isUpdating}
                                            >
                                                {isUpdating ? 'Updating...' : (
                                                    <>
                                                        <Save size={18} />
                                                        Update Patient Trials ({selectedNewTrials.length})
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{
                                            padding: 'var(--spacing-md)',
                                            background: 'var(--gradient-success)',
                                            borderRadius: 'var(--radius-lg)',
                                            marginBottom: 'var(--spacing-lg)'
                                        }}>
                                            <p style={{ color: 'white', fontWeight: '600', marginBottom: '0', textAlign: 'center' }}>
                                                {patientTrials.selected_trials.length} saved trials
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-md">
                                        {patientTrials.selected_trials.map((trial) => {
                                            const isSelected = selectedNewTrials.includes(trial.nct_id);
                                            const isAlreadySaved = isViewingFreshData && savedTrials.some(t => t.nct_id === trial.nct_id);
                                            if (isViewingFreshData && isAlreadySaved) console.log('Found saved trial match!', trial.nct_id);
                                            if (isViewingFreshData) console.log(`Checking trial ${trial.nct_id} against saved: ${savedTrials.map(t => t.nct_id).join(',')}`);
                                            return (
                                                <div
                                                    key={trial.nct_id}
                                                    className="glass-card"
                                                    style={{
                                                        padding: 'var(--spacing-lg)',
                                                        cursor: isViewingFreshData ? 'pointer' : 'default',
                                                        transition: 'all var(--transition-base)',
                                                        border: isSelected && isViewingFreshData ? '2px solid var(--color-primary)' : '1px solid transparent'
                                                    }}
                                                    onClick={() => {
                                                        if (isViewingFreshData) {
                                                            toggleTrialSelection(trial.nct_id);
                                                        } else {
                                                            setSelectedDetailTrial(trial);
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                                                        {isViewingFreshData && (
                                                            <div style={{ marginRight: 'var(--spacing-xs)' }}>
                                                                {isSelected ?
                                                                    <CheckSquare size={20} color="var(--color-primary)" /> :
                                                                    <Square size={20} color="var(--color-text-input)" />
                                                                }
                                                            </div>
                                                        )}
                                                        <span className="badge badge-primary" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                            {trial.nct_id}
                                                        </span>
                                                        <span className="badge" style={{
                                                            fontSize: 'var(--font-size-xs)',
                                                            background: trial.fit_category === 'strong' ? 'rgba(79, 172, 254, 0.2)' : 'rgba(254, 225, 64, 0.2)',
                                                            color: trial.fit_category === 'strong' ? 'var(--color-success)' : 'var(--color-warning)',
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            {trial.fit_score}% {trial.fit_category}
                                                        </span>
                                                        {isAlreadySaved && (
                                                            <span className="badge" style={{
                                                                fontSize: 'var(--font-size-xs)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                background: 'var(--color-success)',
                                                                color: 'white',
                                                                border: '1px solid transparent'
                                                            }}>
                                                                <Check size={12} strokeWidth={3} /> Saved
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p style={{
                                                        fontSize: 'var(--font-size-sm)',
                                                        marginBottom: 'var(--spacing-sm)',
                                                        fontWeight: '600'
                                                    }}>
                                                        {trial.title.length > 100 ? trial.title.substring(0, 100) + '...' : trial.title}
                                                    </p>
                                                    {!isViewingFreshData && (
                                                        <a
                                                            href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{
                                                                fontSize: 'var(--font-size-xs)',
                                                                color: 'var(--color-primary)',
                                                                textDecoration: 'none',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            View Details
                                                        </a>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-secondary" style={{ textAlign: 'center' }}>
                                    No saved trials. Click "Find New" to search ClinicalTrials.gov.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Edit Profile Modal */}
            {chartData && (
                <EditPatientModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    patientProfile={chartData.patient}
                    patientName={patientName}
                    onSave={handleUpdateProfile}
                />
            )}

            {/* Trial Details Modal */}
            <TrialDetailsModal
                isOpen={!!selectedDetailTrial}
                onClose={() => setSelectedDetailTrial(null)}
                match={selectedDetailTrial}
            />
        </div>
    );
}
