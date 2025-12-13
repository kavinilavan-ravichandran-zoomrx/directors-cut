import { useState, useRef, useEffect } from 'react';
import { Radio, AlertCircle, Lightbulb, Mic, MicOff, Loader } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../types';
import type { ListenerResponse } from '../types';
import TrialCard from './TrialCard';

export default function ListenerMode() {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [analysis, setAnalysis] = useState<ListenerResponse | null>(null);
    const [context, setContext] = useState<any>({});
    const [recordingDuration, setRecordingDuration] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    const startRecording = async () => {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Create MediaRecorder
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

            mediaRecorder.start(1000); // Collect data every second
            setIsRecording(true);
            setRecordingDuration(0);
            setAnalysis(null);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

            console.log('🎤 Recording started');

        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please allow microphone permissions.');
        }
    };

    const stopRecording = async () => {
        if (!mediaRecorderRef.current) return;

        // Stop timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        setIsRecording(false);
        setIsTranscribing(true);

        // Create a promise to wait for the final data
        const audioBlob = await new Promise<Blob>((resolve) => {
            const mediaRecorder = mediaRecorderRef.current!;

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                resolve(blob);
            };

            mediaRecorder.stop();

            // Stop all tracks
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        });

        console.log(`🎤 Recording stopped, size: ${audioBlob.size} bytes`);

        // Send to backend for transcription
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            console.log('📤 Sending audio for transcription...');

            const response = await axios.post<{ success: boolean; transcript: string }>(
                `${API_BASE_URL}/api/transcribe`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            if (response.data.success) {
                const newTranscript = response.data.transcript;
                setTranscript(newTranscript);
                console.log('✅ Transcription received:', newTranscript.substring(0, 100));

                // Analyze the transcript with Gemini
                await analyzeTranscript(newTranscript);
            }

        } catch (error) {
            console.error('Error transcribing audio:', error);
            alert('Error transcribing audio. Please make sure OPENAI_API_KEY is set.');
        } finally {
            setIsTranscribing(false);
        }
    };

    const analyzeTranscript = async (text: string) => {
        try {
            console.log('🧠 Analyzing transcript with Gemini...');

            const response = await axios.post<ListenerResponse>(`${API_BASE_URL}/api/listener/analyze`, {
                transcript: text,
                accumulated_context: context
            });

            if (response.data.should_trigger) {
                setAnalysis(response.data);
                console.log('✅ Trigger detected, showing trials');
            } else {
                console.log('ℹ️ No trigger detected');
            }
        } catch (error) {
            console.error('Error analyzing transcript:', error);
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div style={{ marginTop: 'var(--spacing-xl)' }}>
            <div className="flex gap-xl" style={{ alignItems: 'flex-start' }}>
                {/* Main Transcript Area */}
                <div style={{ flex: '1' }}>
                    <div className="glass-card" style={{
                        padding: 'var(--spacing-2xl)',
                        borderRadius: 'var(--radius-2xl)'
                    }}>
                        <h2 className="gradient-text" style={{ marginBottom: 'var(--spacing-lg)' }}>
                            Ambient Listener
                        </h2>
                        <p className="text-secondary" style={{ marginBottom: 'var(--spacing-xl)' }}>
                            Record your consultation with Whisper transcription. Click to start/stop recording.
                        </p>

                        {/* Recording Controls */}
                        <div className="flex gap-md items-center" style={{ marginBottom: 'var(--spacing-xl)' }}>
                            <button
                                className={`btn ${isRecording ? 'btn-primary pulse' : 'btn-secondary'}`}
                                onClick={toggleRecording}
                                disabled={isTranscribing}
                                style={{ minWidth: '200px' }}
                            >
                                {isTranscribing ? (
                                    <>
                                        <Loader size={20} className="spin" />
                                        Transcribing...
                                    </>
                                ) : isRecording ? (
                                    <>
                                        <MicOff size={20} />
                                        Stop Recording
                                    </>
                                ) : (
                                    <>
                                        <Mic size={20} />
                                        Start Recording
                                    </>
                                )}
                            </button>

                            {isRecording && (
                                <div className="flex items-center gap-sm fade-in">
                                    <div style={{
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        background: 'var(--color-error)'
                                    }} className="pulse" />
                                    <span style={{ fontWeight: '600', fontSize: 'var(--font-size-lg)' }}>
                                        {formatDuration(recordingDuration)}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Transcript Display */}
                        {(transcript || isTranscribing) && (
                            <div className="glass-card fade-in" style={{
                                padding: 'var(--spacing-xl)',
                                background: 'var(--color-bg-secondary)',
                                maxHeight: '400px',
                                overflowY: 'auto'
                            }}>
                                <h4 style={{ marginBottom: 'var(--spacing-md)' }}>
                                    {isTranscribing ? 'Transcribing with Whisper...' : 'Transcript'}
                                </h4>
                                {isTranscribing ? (
                                    <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                                        <p className="text-secondary" style={{ marginTop: 'var(--spacing-md)' }}>
                                            Processing audio with OpenAI Whisper...
                                        </p>
                                    </div>
                                ) : (
                                    <pre style={{
                                        fontFamily: 'var(--font-primary)',
                                        fontSize: 'var(--font-size-sm)',
                                        color: 'var(--color-text-secondary)',
                                        whiteSpace: 'pre-wrap',
                                        lineHeight: '1.8',
                                        margin: '0'
                                    }}>
                                        {transcript || 'Recording will appear here after you stop...'}
                                    </pre>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar - Context & Triggers */}
                <div style={{ width: '400px' }}>
                    <div className="glass-card" style={{
                        padding: 'var(--spacing-xl)',
                        borderRadius: 'var(--radius-xl)',
                        position: 'sticky',
                        top: 'var(--spacing-xl)'
                    }}>
                        <div className="flex items-center gap-md" style={{ marginBottom: 'var(--spacing-lg)' }}>
                            <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: isRecording ? 'var(--color-error)' :
                                    isTranscribing ? 'var(--color-warning)' :
                                        'var(--color-text-muted)'
                            }} className={isRecording || isTranscribing ? 'pulse' : ''} />
                            <h4 style={{ marginBottom: '0' }}>
                                {isRecording ? 'Recording...' :
                                    isTranscribing ? 'Transcribing...' :
                                        transcript ? 'Ready to analyze' : 'Idle'}
                            </h4>
                        </div>

                        {transcript && !analysis && !isTranscribing && (
                            <div className="fade-in">
                                <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <AlertCircle size={18} color="var(--color-primary)" />
                                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600' }}>
                                        Transcript Captured
                                    </span>
                                </div>
                                <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>
                                    {transcript.length} characters transcribed.
                                    {analysis === null && ' Analyzing for clinical trial triggers...'}
                                </p>
                            </div>
                        )}

                        {analysis && analysis.should_trigger && (
                            <div className="fade-in">
                                <div style={{
                                    padding: 'var(--spacing-lg)',
                                    background: 'var(--gradient-success)',
                                    borderRadius: 'var(--radius-lg)',
                                    marginBottom: 'var(--spacing-lg)'
                                }}>
                                    <div className="flex items-center gap-md" style={{ marginBottom: 'var(--spacing-sm)' }}>
                                        <Lightbulb size={24} color="white" />
                                        <span style={{ fontWeight: '700', color: 'white' }}>
                                            Trials Available!
                                        </span>
                                    </div>
                                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'white', marginBottom: '0' }}>
                                        {analysis.trigger_reason}
                                    </p>
                                </div>

                                {analysis.matches && (
                                    <div>
                                        <h5 style={{ marginBottom: 'var(--spacing-md)' }}>
                                            {analysis.matches.length} Relevant Trials
                                        </h5>
                                        <div className="flex flex-col gap-sm">
                                            {analysis.matches.map((match) => (
                                                <div
                                                    key={match.nct_id}
                                                    className="glass-card"
                                                    style={{
                                                        padding: 'var(--spacing-md)',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => window.open(`https://clinicaltrials.gov/study/${match.nct_id}`, '_blank')}
                                                >
                                                    <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--spacing-xs)' }}>
                                                        <span className="badge badge-primary" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                            {match.nct_id}
                                                        </span>
                                                        <span className="badge badge-success" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                            {match.fit_category}
                                                        </span>
                                                    </div>
                                                    <p style={{
                                                        fontSize: 'var(--font-size-sm)',
                                                        marginBottom: '0',
                                                        color: 'var(--color-text-secondary)'
                                                    }}>
                                                        {match.title.substring(0, 60)}...
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Full Trial Details (if triggered) */}
            {analysis && analysis.matches && (
                <div style={{ marginTop: 'var(--spacing-xl)' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>
                        Recommended Trials
                    </h3>
                    {analysis.matches.map((match) => (
                        <TrialCard
                            key={match.nct_id}
                            match={match}
                            onViewDetails={(nctId) => window.open(`https://clinicaltrials.gov/study/${nctId}`, '_blank')}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
