export function encodePassphrase(passphrase: string) {
  return encodeURIComponent(passphrase);
}

export function decodePassphrase(base64String: string) {
  return decodeURIComponent(base64String);
}

export function generateRoomId(): string {
  return `${randomString(4)}-${randomString(4)}`;
}

export function randomString(length: number): string {
  let result = '';
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export function startUltrasonicTransmission(): () => void {
  const frequency = parseInt(process.env.NEXT_PUBLIC_ULTRASONIC_FREQUENCY || '20154');
  console.log('~~~~~~~~~~~~~~~~~~~~ Starting ultrasonic transmission');
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  // Configure for better ultrasonic transmission
  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
  
  // Add highpass filter to remove low-frequency artifacts
  const filter = audioContext.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(18000, audioContext.currentTime);
  
  oscillator.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.start();

  return () => {
    oscillator.stop();
    audioContext.close();
  };
}

export async function detectUltrasonic(): Promise<boolean> {
  const frequency = parseInt(process.env.NEXT_PUBLIC_ULTRASONIC_FREQUENCY || '20154');
  try {
    console.log('~~~~~~~~~~~~~~~~~~~~ Detecting ultrasonic');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext({
      // Chrome-specific optimization
      latencyHint: 'interactive',
      sampleRate: 96000 // Higher sample rate for better frequency resolution
    });
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    source.connect(analyser);
    analyser.fftSize = 4096;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Configure analyser for better detection
    analyser.smoothingTimeConstant = 0.2;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;

    return new Promise((resolve) => {
      const checkFrequency = () => {
        analyser.getByteFrequencyData(dataArray);
        const nyquist = audioContext.sampleRate / 2;
        const index = Math.floor((frequency / nyquist) * bufferLength);
        
        const energy = Math.max(
          dataArray[index - 1] || 0,
          dataArray[index] || 0,
          dataArray[index + 1] || 0
        );

        console.log('~~~~~~~~~~~~~~~~~~~~ Ultrasonic energy level:', energy);
        
        console.log('Starting detection with:', {
          frequency,
          sampleRate: audioContext.sampleRate,
          nyquist: nyquist,
          targetIndex: index,
          bufferLength
        });

        console.log('Frequency analysis:', {
          targetIndex: index,
          energy,
          bins: [dataArray[index - 1], dataArray[index], dataArray[index + 1]],
          fullSpectrum: Array.from(dataArray).slice(index - 5, index + 5)
        });

        if (energy > 64) {
          console.log('~~~~~~~~~~~~~~~~~~~~ Ultrasonic detected +++++++++++++');
          resolve(true);
          audioContext.close();
          stream.getTracks().forEach(track => track.stop());
        } else {
          requestAnimationFrame(checkFrequency);
        }
      };
      checkFrequency();
    });
  } catch (err) {
    console.error('Error accessing microphone:', err);
    return false;
  }
}
