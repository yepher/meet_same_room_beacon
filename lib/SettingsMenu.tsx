'use client';
import * as React from 'react';
import { Track } from 'livekit-client';
import {
  useMaybeLayoutContext,
  MediaDeviceMenu,
  TrackToggle,
  useRoomContext,
  useIsRecording,
} from '@livekit/components-react';
import { useKrispNoiseFilter } from '@livekit/components-react/krisp';
import styles from '../styles/SettingsMenu.module.css';
import { startUltrasonicTransmission, detectUltrasonic } from '@/lib/client-utils';

/**
 * @alpha
 */
export interface SettingsMenuProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * @alpha
 */
export function SettingsMenu(props: SettingsMenuProps) {
  const layoutContext = useMaybeLayoutContext();
  const room = useRoomContext();
  const recordingEndpoint = process.env.NEXT_PUBLIC_LK_RECORD_ENDPOINT;

  const settings = React.useMemo(() => {
    return {
      media: { camera: true, microphone: true, label: 'Media Devices', speaker: true },
      effects: { label: 'Effects' },
      recording: recordingEndpoint ? { label: 'Recording' } : undefined,
    };
  }, []);

  const tabs = React.useMemo(
    () => Object.keys(settings).filter((t) => t !== undefined) as Array<keyof typeof settings>,
    [settings],
  );
  const [activeTab, setActiveTab] = React.useState(tabs[0]);

  const { isNoiseFilterEnabled, setNoiseFilterEnabled, isNoiseFilterPending } =
    useKrispNoiseFilter();

  React.useEffect(() => {
    // enable Krisp by default
    setNoiseFilterEnabled(true);
  }, []);

  const isRecording = useIsRecording();
  const [initialRecStatus, setInitialRecStatus] = React.useState(isRecording);
  const [processingRecRequest, setProcessingRecRequest] = React.useState(false);

  React.useEffect(() => {
    if (initialRecStatus !== isRecording) {
      setProcessingRecRequest(false);
    }
  }, [isRecording, initialRecStatus]);

  const toggleRoomRecording = async () => {
    if (!recordingEndpoint) {
      throw TypeError('No recording endpoint specified');
    }
    if (room.isE2EEEnabled) {
      throw Error('Recording of encrypted meetings is currently not supported');
    }
    setProcessingRecRequest(true);
    setInitialRecStatus(isRecording);
    let response: Response;
    if (isRecording) {
      response = await fetch(recordingEndpoint + `/stop?roomName=${room.name}`);
    } else {
      response = await fetch(recordingEndpoint + `/start?roomName=${room.name}`);
    }
    if (response.ok) {
    } else {
      console.error(
        'Error handling recording request, check server logs:',
        response.status,
        response.statusText,
      );
      setProcessingRecRequest(false);
    }
  };

  const [isTransmitting, setIsTransmitting] = React.useState(false);
  const [transmitStop, setTransmitStop] = React.useState<(() => void) | null>(null);
  const [isDetecting, setIsDetecting] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (transmitStop) {
        transmitStop();
      }
    };
  }, [transmitStop]);

  return (
    <div className="settings-menu" style={{ width: '100%' }} {...props}>
      <div className={styles.tabs}>
        {tabs.map(
          (tab) =>
            settings[tab] && (
              <button
                className={`${styles.tab} lk-button`}
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-pressed={tab === activeTab}
              >
                {
                  // @ts-ignore
                  settings[tab].label
                }
              </button>
            ),
        )}
      </div>
      <div className="tab-content">
        {activeTab === 'media' && (
          <>
            {settings.media && settings.media.camera && (
              <>
                <h3>Camera</h3>
                <section className="lk-button-group">
                  <TrackToggle source={Track.Source.Camera}>Camera</TrackToggle>
                  <div className="lk-button-group-menu">
                    <MediaDeviceMenu kind="videoinput" />
                  </div>
                </section>
              </>
            )}
            {settings.media && settings.media.microphone && (
              <>
                <h3>Microphone</h3>
                <section className="lk-button-group">
                  <TrackToggle source={Track.Source.Microphone}>Microphone</TrackToggle>
                  <div className="lk-button-group-menu">
                    <MediaDeviceMenu kind="audioinput" />
                  </div>
                </section>
              </>
            )}
            {settings.media && settings.media.speaker && (
              <>
                <h3>Speaker & Headphones</h3>
                <section className="lk-button-group">
                  <span className="lk-button">Audio Output</span>
                  <div className="lk-button-group-menu">
                    <MediaDeviceMenu kind="audiooutput"></MediaDeviceMenu>
                  </div>
                </section>
              </>
            )}
          </>
        )}
        {activeTab === 'effects' && (
          <>
            <h3>Audio</h3>
            <section>
              <label htmlFor="noise-filter"> Enhanced Noise Cancellation</label>
              <input
                type="checkbox"
                id="noise-filter"
                onChange={(ev) => setNoiseFilterEnabled(ev.target.checked)}
                checked={isNoiseFilterEnabled}
                disabled={isNoiseFilterPending}
              ></input>
            </section>
            {process.env.NEXT_PUBLIC_ULTRASONIC_DETECTION_ENABLED === 'true' && (
              <section>
                <h3>Local Client Detection</h3>
                <div className={styles.ultrasonicControls}>
                  {/* Transmit Button */}
                  <button
                    onClick={() => {
                      if (!isTransmitting) {
                        const stop = startUltrasonicTransmission();
                        setTransmitStop(() => stop);
                      } else {
                        transmitStop?.();
                        setTransmitStop(null);
                      }
                      setIsTransmitting(!isTransmitting);
                    }}
                    className={isTransmitting ? styles.activeTransmit : ''}
                  >
                    {isTransmitting ? 'Stop Transmitting Tone' : 'Transmit Test Tone'}
                  </button>

                  {/* Detect Button */}
                  <button
                    onClick={async () => {
                      try {
                        setIsDetecting(true);
                        const detected = await Promise.race([
                          detectUltrasonic(),
                          new Promise((_, reject) => setTimeout(() => reject('Timeout (10s)'), 10000))
                        ]);

                        if (detected) {
                          alert('Local client detected! TODO: Identify same-room participant and unsubscribe from their audio stream');
                        } else {
                          alert('No local clients detected');
                        }
                      } catch (err) {
                        alert(`⚠️ Detection failed: ${err}`);
                      } finally {
                        setIsDetecting(false);
                      }
                    }}
                    disabled={isDetecting}
                  >
                    {isDetecting ? 'Scanning for Tones...' : 'Detect Local Clients'}
                  </button>
                </div>
              </section>
            )}
          </>
        )}
        {activeTab === 'recording' && (
          <>
            <h3>Record Meeting</h3>
            <section>
              <p>
                {isRecording
                  ? 'Meeting is currently being recorded'
                  : 'No active recordings for this meeting'}
              </p>
              <button disabled={processingRecRequest} onClick={() => toggleRoomRecording()}>
                {isRecording ? 'Stop' : 'Start'} Recording
              </button>
            </section>
          </>
        )}
      </div>
      <button
        className={`lk-button ${styles.settingsCloseButton}`}
        onClick={() => layoutContext?.widget.dispatch?.({ msg: 'toggle_settings' })}
      >
        Close
      </button>
    </div>
  );
}
