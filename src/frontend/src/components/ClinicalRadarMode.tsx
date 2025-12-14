import { useState, useEffect, useRef } from 'react';
import { Radio, Search, AlertTriangle, ExternalLink, FileText, Globe, Bell, CheckCircle, Activity, Loader } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../types';

interface Alert {
    id?: number;
    drug: string;
    found_update: boolean;
    category: string;
    severity: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    source: string;
    source_url?: string;
    date: string;
    is_new?: boolean;
}

export default function ClinicalRadarMode() {
    const [isScanning, setIsScanning] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [monitoredTreatments, setMonitoredTreatments] = useState<string[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [briefing, setBriefing] = useState<{ podcast_url: string | null, transcript: string } | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'monitor' | 'alerts' | 'briefing'>('monitor');

    // Ambient animation refs
    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchTreatments();
        fetchAlertHistory();
    }, []);

    const fetchTreatments = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/radar/treatments`);
            setMonitoredTreatments(res.data.treatments);
            addLog(`Loaded ${res.data.count} unique monitoring targets.`);
        } catch (e) {
            console.error(e);
            addLog("Error loading treatments.");
        }
    };

    const fetchAlertHistory = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/radar/alerts`);
            setAlerts(res.data.alerts);
        } catch (e) {
            console.error(e);
        }
    };

    const addLog = (msg: string) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    };

    const startScan = async () => {
        setIsScanning(true);
        setActiveTab('monitor');
        // Don't clear alerts immediately, we'll append/merge
        setBriefing(null);
        setAudioUrl(null);
        setLogs([]);

        addLog("Initiating Clinical Radar scan sequence...");

        try {
            // Visualize scanning step-by-step
            for (const tx of monitoredTreatments) {
                addLog(`Checking regulatory databases for: ${tx}...`);
                await new Promise(r => setTimeout(r, 600)); // Visual delay
                addLog(`Scanning competitor landscape for: ${tx}...`);
                await new Promise(r => setTimeout(r, 400));
            }

            addLog("Processing findings with Gemini-2.0-Flash...");

            // Real call - backend now saves to DB
            const res = await axios.post(`${API_BASE_URL}/api/radar/scan`, { treatments: monitoredTreatments });
            const newFindings = res.data.alerts;

            addLog(`Scan complete. Found ${newFindings.length} actionable signals.`);

            // Refresh full history to get IDs and correct sorts
            await fetchAlertHistory();

            if (newFindings.length > 0) {
                // Auto generate podcast
                generateBriefing(newFindings);
            }

        } catch (e) {
            console.error(e);
            addLog("Scan failed. Connection error.");
        } finally {
            setIsScanning(false);
        }
    };

    const generateBriefing = async (currentAlerts: Alert[]) => {
        addLog("Synthesizing daily audio briefing...");
        try {
            const res = await axios.post(`${API_BASE_URL}/api/radar/briefing`, { alerts: currentAlerts });
            setBriefing(res.data);
            if (res.data.podcast_url) {
                setAudioUrl(`${API_BASE_URL}${res.data.podcast_url}`);
                addLog("Audio briefing generated successfully.");
            }
        } catch (e) {
            console.error(e);
            addLog("Failed to generate briefing.");
        }
    };

    // Derived state for notification badges
    const unreadCount = alerts.filter(a => a.is_new).length;

    const handleViewAlerts = async () => {
        setActiveTab('alerts');
        // Ideally mark as read when viewed? Or strictly when clicked?
        // Let's mark ALL as read when entering the tab for simplicity in demo
        if (unreadCount > 0) {
            const unreadIds = alerts.filter(a => a.is_new && a.id).map(a => a.id);
            if (unreadIds.length > 0) {
                try {
                    await axios.post(`${API_BASE_URL}/api/radar/read`, { ids: unreadIds });
                    // Optimistically update UI
                    setAlerts(prev => prev.map(a => ({ ...a, is_new: false })));
                } catch (e) {
                    console.error(e);
                }
            }
        }
    };

    return (
        <div className="fade-in" style={{ marginTop: 'var(--spacing-xl)', maxWidth: '1000px', margin: '0 auto' }}>

            {/* Header / StatusBar */}
            <div className="glass-card" style={{
                padding: 'var(--spacing-lg)',
                marginBottom: 'var(--spacing-xl)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'relative'
            }}>
                <div className="flex items-center gap-md">
                    <div style={{
                        width: '40px', height: '40px',
                        background: 'var(--gradient-primary)',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Radio color="white" size={20} className={isScanning ? "pulse-animation" : ""} />
                    </div>
                    <div>
                        <h2 className="gradient-text" style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>Clinical Radar</h2>
                        <p className="text-secondary" style={{ margin: 0 }}>Ambient Safety & Competitor Intelligence</p>
                    </div>
                </div>

                <div className="flex items-center gap-lg">
                    {/* Notification Bell */}
                    <div style={{ position: 'relative', cursor: 'pointer' }} onClick={handleViewAlerts}>
                        <Bell size={24} color={unreadCount > 0 ? "var(--color-primary)" : "var(--color-text-secondary)"} />
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                background: 'var(--color-error)',
                                color: 'white',
                                borderRadius: '50%',
                                fontSize: '10px',
                                padding: '2px 5px',
                                fontWeight: 'bold'
                            }}>
                                {unreadCount}
                            </span>
                        )}
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={startScan}
                        disabled={isScanning}
                        style={{ minWidth: '140px' }}
                    >
                        {isScanning ? (
                            <>
                                <Loader className="spin" size={18} /> Scanning...
                            </>
                        ) : (
                            <>
                                <Activity size={18} /> Run Scan
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-xl">

                {/* Left Panel: Monitor Targets */}
                <div className="col-span-1">
                    <div className="glass-card" style={{ padding: 'var(--spacing-lg)', height: '100%' }}>
                        <h4 className="flex items-center gap-sm" style={{ marginBottom: 'var(--spacing-md)' }}>
                            <Search size={18} /> Monitored Targets
                        </h4>
                        <div style={{
                            background: 'var(--color-bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--spacing-md)',
                            minHeight: '200px'
                        }}>
                            {monitoredTreatments.length === 0 ? (
                                <p className="text-secondary text-sm">No treatments found in patient records.</p>
                            ) : (
                                <div className="flex flex-col gap-sm">
                                    {monitoredTreatments.map((tx, i) => (
                                        <div key={i} className="flex items-center justify-between" style={{
                                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: 'var(--font-size-sm)'
                                        }}>
                                            <span>{tx}</span>
                                            <div className="indicator" style={{ background: isScanning ? 'var(--color-warning)' : 'var(--color-success)' }} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Live Logs */}
                        <h4 className="flex items-center gap-sm" style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-md)' }}>
                            <Activity size={18} /> System Logs
                        </h4>
                        <div ref={logContainerRef} style={{
                            background: '#000',
                            color: '#0f0',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            padding: 'var(--spacing-md)',
                            borderRadius: 'var(--radius-md)',
                            height: '150px',
                            overflowY: 'auto',
                            border: '1px solid #333'
                        }}>
                            {logs.length === 0 && <span style={{ opacity: 0.5 }}>System ready...</span>}
                            {logs.map((log, i) => (
                                <div key={i} style={{ marginBottom: '4px' }}>{log}</div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Results / Dashboard */}
                <div className="col-span-2">
                    {/* Tabs */}
                    <div className="flex gap-md" style={{ marginBottom: 'var(--spacing-md)' }}>
                        <button
                            className={`btn ${activeTab === 'monitor' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setActiveTab('monitor')}
                        >
                            <Globe size={16} /> Live Monitor
                        </button>
                        <button
                            className={`btn ${activeTab === 'alerts' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={handleViewAlerts}
                        >
                            <AlertTriangle size={16} /> Alerts ({alerts.length})
                        </button>
                        <button
                            className={`btn ${activeTab === 'briefing' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setActiveTab('briefing')}
                            disabled={!briefing}
                        >
                            <Radio size={16} /> Daily Briefing
                        </button>
                    </div>

                    <div className="glass-card" style={{ padding: 'var(--spacing-xl)', minHeight: '400px' }}>

                        {activeTab === 'monitor' && (
                            <div className="flex flex-col items-center justify-center h-full" style={{ textAlign: 'center', opacity: 0.8 }}>
                                {isScanning ? (
                                    <>
                                        <div className="pulse-circle" style={{
                                            width: '120px', height: '120px',
                                            background: 'var(--gradient-primary)', borderRadius: '50%',
                                            marginBottom: 'var(--spacing-lg)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <Globe size={48} color="white" className="spin" style={{ animationDuration: '3s' }} />
                                        </div>
                                        <h3>Scanning Global Databases...</h3>
                                        <p className="text-secondary max-w-md">
                                            Aggregating safety signals from FDA MedWatch, EMA, and ClinicalTrials.gov for your patient cohort.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <Globe size={64} color="var(--color-text-muted)" style={{ marginBottom: 'var(--spacing-lg)' }} />
                                        <h3>System Active</h3>
                                        <p className="text-secondary">
                                            Radar is monitoring {monitoredTreatments.length} active treatments. <br />
                                            {alerts.length} historical alerts on file.
                                        </p>
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 'alerts' && (
                            <div className="fade-in">
                                {alerts.length === 0 ? (
                                    <div className="text-center p-xl">
                                        <CheckCircle size={48} color="var(--color-success)" style={{ margin: '0 auto', marginBottom: '1rem' }} />
                                        <h3>No Alerts Found</h3>
                                        <p className="text-secondary">All monitored treatments are clear of safety signals.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-md">
                                        {alerts.map((alert, idx) => (
                                            <div key={idx} className="glass-card" style={{
                                                padding: 'var(--spacing-md)',
                                                borderLeft: `4px solid ${alert.severity === 'high' ? 'var(--color-error)' : 'var(--color-warning)'}`,
                                                background: alert.is_new ? 'rgba(255,255,255,0.05)' : 'transparent',
                                                opacity: alert.is_new ? 1 : 0.7
                                            }}>
                                                <div className="flex justify-between items-start mb-sm">
                                                    <div>
                                                        <div className="flex items-center gap-sm mb-xs">
                                                            {alert.is_new && (
                                                                <span className="badge" style={{ background: 'var(--color-primary)', color: 'white' }}>
                                                                    NEW
                                                                </span>
                                                            )}
                                                            <span className="badge" style={{
                                                                background: alert.severity === 'high' ? 'rgba(255,59,48,0.2)' : 'rgba(255,149,0,0.2)',
                                                                color: alert.severity === 'high' ? 'var(--color-error)' : 'var(--color-warning)',
                                                            }}>
                                                                {alert.category} • {alert.severity.toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <h4 style={{ margin: '4px 0' }}>{alert.title}</h4>
                                                    </div>
                                                    <span className="text-secondary text-sm">{alert.date}</span>
                                                </div>
                                                <p className="text-secondary text-sm mb-sm">{alert.description}</p>
                                                <div className="flex justify-between items-center text-xs text-muted">
                                                    <span>Drug: <b>{alert.drug}</b></span>

                                                    {alert.source_url ? (
                                                        <a
                                                            href={alert.source_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-xs hover-underline"
                                                            style={{ color: 'var(--color-primary)' }}
                                                        >
                                                            {alert.source} <ExternalLink size={12} />
                                                        </a>
                                                    ) : (
                                                        <span>Source: {alert.source}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'briefing' && briefing && (
                            <div className="fade-in">
                                <div style={{
                                    background: 'var(--gradient-card)',
                                    padding: 'var(--spacing-xl)',
                                    borderRadius: 'var(--radius-lg)',
                                    marginBottom: 'var(--spacing-xl)',
                                    textAlign: 'center'
                                }}>
                                    <div style={{
                                        width: '60px', height: '60px', margin: '0 auto',
                                        background: 'rgba(255,255,255,0.2)', borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        marginBottom: 'var(--spacing-md)'
                                    }}>
                                        <Radio size={30} color="white" />
                                    </div>
                                    <h3 style={{ color: 'white', marginBottom: 'var(--spacing-sm)' }}>Morning Safety Briefing</h3>
                                    <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 'var(--spacing-lg)' }}>
                                        {new Date().toLocaleDateString()} • {alerts.length} Updates
                                    </p>

                                    {audioUrl && (
                                        <audio controls style={{ width: '100%', maxWidth: '400px' }}>
                                            <source src={audioUrl} type="audio/mpeg" />
                                            Your browser does not support the audio element.
                                        </audio>
                                    )}
                                </div>

                                <div className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                                    <h4 className="flex items-center gap-sm mb-md">
                                        <FileText size={18} /> Transcript
                                    </h4>
                                    <p className="text-secondary" style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                                        {briefing.transcript}
                                    </p>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            <style>{`
                .pulse-animation {
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.8; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
