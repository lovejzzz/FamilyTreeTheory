// Extremely simple audio implementation to play chord notes without popping

// Create audio context
let audioContext;

// Map of active oscillators to avoid memory leaks
let activeOscillators = [];

// Convert a pitch class (0-11) to a MIDI note in the C3-B4 range (48-71)
function pitchClassToMidiNote(pitchClass, octaveOffset = 0) {
  // C3 is MIDI note 48, so we add 48 to the pitch class
  const midiNote = 48 + pitchClass + (12 * octaveOffset);
  
  // Ensure the note is within the C3-B4 range (MIDI 48-71)
  if (midiNote < 48) {
    return pitchClassToMidiNote(pitchClass, octaveOffset + 1);
  } else if (midiNote > 71) {
    return pitchClassToMidiNote(pitchClass, octaveOffset - 1);
  }
  
  return midiNote;
}

// Arrange notes from low to high and map to the C3-B4 range
function arrangeNotesLowToHigh(notes) {
  // Sort the pitch classes (0-11)
  const sortedPitchClasses = [...notes].sort((a, b) => a - b);
  
  // Map the pitch classes to MIDI notes in the C3-B4 range
  let midiNotes = sortedPitchClasses.map(pc => pitchClassToMidiNote(pc));
  
  // Check if any notes are too close together (less than a semitone apart)
  // If so, move the higher note up an octave
  for (let i = 0; i < midiNotes.length - 1; i++) {
    if (midiNotes[i] === midiNotes[i + 1]) {
      // Same note, move the second one up an octave if possible
      if (midiNotes[i + 1] + 12 <= 71) { // Ensure we stay within B4 (MIDI 71)
        midiNotes[i + 1] += 12;
      }
    }
  }
  
  // Sort again to ensure they're in ascending order
  midiNotes.sort((a, b) => a - b);
  
  return midiNotes;
}

// Convert MIDI note to frequency
function midiToFrequency(midiNote) {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// Variable to track if we're currently in a quick reclick situation
let lastPlayTime = 0;

// Stop all currently playing oscillators
function stopAllOscillators() {
  // Check if this is a quick reclick (within 300ms of last play)
  const now = Date.now();
  const isQuickReclick = (now - lastPlayTime) < 300;
  
  // If it's a quick reclick, use a faster fade out to avoid sound overlap
  const fadeOutTime = isQuickReclick ? 0.05 : 0.1;
  
  // Stop all active oscillators
  activeOscillators.forEach(osc => {
    try {
      if (osc.gainNode) {
        // Fade out to avoid clicks
        const audioNow = audioContext.currentTime;
        osc.gainNode.gain.cancelScheduledValues(audioNow);
        osc.gainNode.gain.setValueAtTime(osc.gainNode.gain.value, audioNow);
        osc.gainNode.gain.linearRampToValueAtTime(0, audioNow + fadeOutTime);
        
        // Stop the oscillator after the fade out
        setTimeout(() => {
          try {
            osc.oscillator.stop();
            osc.oscillator.disconnect();
            osc.gainNode.disconnect();
          } catch (e) {
            // Ignore errors during cleanup
          }
        }, fadeOutTime * 1000);
      }
    } catch (e) {
      // Ignore errors during cleanup
    }
  });
  
  // Clear the array only after the fade out is complete if it's not a quick reclick
  if (!isQuickReclick) {
    activeOscillators = [];
  } else {
    // For quick reclicks, we'll replace the array instead of clearing it
    // This prevents the previous sound from being cut off too abruptly
    setTimeout(() => {
      activeOscillators = [];
    }, 50);
  }
}

// Play a tetrachord (4-note chord) with the given pitch classes
export async function playTetrachord(notes) {
  // Check if we have exactly 4 notes
  if (!notes || notes.length !== 4) {
    console.error('playTetrachord requires exactly 4 notes');
    return;
  }
  
  // Track the time of this play request
  lastPlayTime = Date.now();
  
  // Initialize audio context if needed (must be done in response to a user gesture)
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  // Resume audio context if it's suspended
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  
  // Stop any currently playing notes to avoid overlapping sounds
  stopAllOscillators();
  
  // Arrange the notes from low to high and map to the C3-B4 range
  const midiNotes = arrangeNotesLowToHigh(notes);
  console.log('Playing tetrachord with MIDI notes:', midiNotes);
  
  // Create a master gain node for all oscillators
  const masterGain = audioContext.createGain();
  masterGain.gain.value = 0; // Start silent to avoid clicks
  masterGain.connect(audioContext.destination);
  
  // Start with zero gain and ramp up to avoid clicks
  const now = audioContext.currentTime;
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(0.7, now + 0.05); // 50ms fade in
  
  // Play each note
  midiNotes.forEach(midiNote => {
    // Create oscillator
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'triangle'; // Triangle wave is smoother than sine
    oscillator.frequency.value = midiToFrequency(midiNote);
    
    // Create individual gain node for this oscillator
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0.25; // Lower gain to avoid distortion when playing multiple notes
    
    // Connect oscillator -> gain -> master gain -> destination
    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    
    // Start the oscillator
    oscillator.start();
    
    // Add to active oscillators list for cleanup
    activeOscillators.push({
      oscillator,
      gainNode
    });
  });
  
  // Schedule fade out with original fade-out period but 70% overall duration
  masterGain.gain.linearRampToValueAtTime(0.7, now + 0.05); // Initial fade in
  masterGain.gain.setValueAtTime(0.7, now + 0.05); // Hold at full volume
  masterGain.gain.linearRampToValueAtTime(0.6, now + 0.5); // Shorter sustain period
  // Keep the same fade-out period (0.9 seconds) as before
  masterGain.gain.linearRampToValueAtTime(0, now + 1.47); // Total duration is 70% of 2.1 seconds
  
  // Schedule cleanup after sound is done
  setTimeout(() => {
    stopAllOscillators();
  }, 1570); // Adjusted timeout to match shorter duration
}
