// Chord recognition system

// Normalize a set of notes to be in root position
function normalizeChord(notes) {
  // Convert to pitch classes (0-11)
  const pitchClasses = notes.map(n => n % 12);
  
  // Find all possible rotations of the chord
  const rotations = [];
  for (let i = 0; i < pitchClasses.length; i++) {
    const rotation = [];
    for (let j = 0; j < pitchClasses.length; j++) {
      rotation.push(pitchClasses[(i + j) % pitchClasses.length]);
    }
    // Sort by the intervals from the first note
    const intervals = rotation.slice(1).map(n => {
      const interval = n - rotation[0];
      return interval < 0 ? interval + 12 : interval;
    });
    rotations.push({
      root: rotation[0],
      notes: rotation,
      intervals: intervals,
      inversion: i
    });
  }
  
  // Return all possible interpretations
  return rotations;
}

// Try all possible permutations of the notes to find a matching chord
function getAllPermutations(notes) {
  const permutations = [];
  const usedIndices = new Set();
  
  function generatePermutation(current) {
    if (current.length === notes.length) {
      permutations.push([...current]);
      return;
    }
    
    for (let i = 0; i < notes.length; i++) {
      if (!usedIndices.has(i)) {
        usedIndices.add(i);
        current.push(notes[i]);
        generatePermutation(current);
        current.pop();
        usedIndices.delete(i);
      }
    }
  }
  
  generatePermutation([]);
  return permutations;
}

// Define chord types from 43.txt
const chordTypes = [
  { name: 'Minor 7th', intervals: [3, 7, 10], symbol: '-7' },
  { name: 'Minor 7th #5', intervals: [3, 8, 10], symbol: '-7#5' },
  { name: 'Minor 7th add b2 omit 5', intervals: [1, 3, 10], symbol: '-7add*b2-omit5' },
  { name: 'Minor 7th b5', intervals: [3, 6, 10], symbol: '-7b5' },
  { name: 'Dominant 7th', intervals: [4, 7, 10], symbol: '7' },
  { name: 'Dominant 7th #5', intervals: [4, 8, 10], symbol: '7#5' },
  { name: 'Dominant 7th #5 sus2', intervals: [2, 8, 10], symbol: '7#5sus2' },
  { name: 'Dominant 7th add b2 omit 5', intervals: [1, 4, 10], symbol: '7add*b2-omit5' },
  { name: 'Dominant 7th b5', intervals: [4, 6, 10], symbol: '7b5' },
  { name: 'Dominant 7th b5 sus b2', intervals: [1, 6, 10], symbol: '7b5sus*b2' },
  { name: 'Dominant 7th sus b2', intervals: [1, 7, 10], symbol: '7sus*b2' },
  { name: 'Dominant 7th sus2', intervals: [2, 7, 10], symbol: '7sus2' },
  { name: 'Dominant 7th sus4', intervals: [5, 7, 10], symbol: '7sus4' },
  { name: 'Cluster', intervals: [1, 2, 3], symbol: 'Cluster' },
  { name: 'Diminished Major 7th', intervals: [3, 6, 11], symbol: 'dimMaj7' },
  { name: 'Diminished Major 7th sus2', intervals: [2, 6, 11], symbol: 'dimMaj7sus2' },
  { name: 'Major 7th b5 sus b2', intervals: [1, 6, 11], symbol: 'Maj7b5sus*b2' },
  { name: 'Major 7th', intervals: [4, 7, 11], symbol: 'Maj7' },
  { name: 'Major 7th #5', intervals: [4, 8, 11], symbol: 'Maj7#5' },
  { name: 'Major 7th #5 add 6 omit 3', intervals: [8, 9, 11], symbol: 'Maj7#5add6-omit3' },
  { name: 'Major 7th #5 sus b2', intervals: [1, 8, 11], symbol: 'Maj7#5sus*b2' },
  { name: 'Major 7th #5 sus2', intervals: [2, 8, 11], symbol: 'Maj7#5sus2' },
  { name: 'Major 7th #5 sus4', intervals: [5, 8, 11], symbol: 'Maj7#5sus4' },
  { name: 'Major 7th add #2 omit 5', intervals: [3, 4, 11], symbol: 'Maj7add*#2-omit5' },
  { name: 'Major 7th add #11 omit 3', intervals: [6, 7, 11], symbol: 'Maj7add#11-omit3' },
  { name: 'Major 7th add 2 omit 5', intervals: [2, 4, 11], symbol: 'Maj7add2-omit5' },
  { name: 'Major 7th add 6 omit 3', intervals: [7, 9, 11], symbol: 'Maj7add6-omit3' },
  { name: 'Major 7th add 6 omit 5', intervals: [4, 9, 11], symbol: 'Maj7add6-omit5' },
  { name: 'Major 7th b5', intervals: [4, 6, 11], symbol: 'Maj7b5' },
  { name: 'Major 7th b5 omit 3', intervals: [6, 8, 11], symbol: 'Maj7b5-omit3' },
  { name: 'Major 7th b5 sus4', intervals: [5, 6, 11], symbol: 'Maj7b5sus4' },
  { name: 'Major 7th sus b2', intervals: [1, 7, 11], symbol: 'Maj7sus*b2' },
  { name: 'Major 7th sus b2 & 4 omit 5', intervals: [1, 5, 11], symbol: 'Maj7sus*b2&4-omit5' },
  { name: 'Major 7th sus b2 omit 5', intervals: [1, 4, 11], symbol: 'Maj7sus*b2-omit5' },
  { name: 'Major 7th sus b2 add 6 omit 5', intervals: [1, 9, 11], symbol: 'Maj7sus*b2add6-omit5' },
  { name: 'Major 7th sus2', intervals: [2, 7, 11], symbol: 'Maj7sus2' },
  { name: 'Major 7th sus2 & 4', intervals: [2, 5, 11], symbol: 'Maj7sus2&4' },
  { name: 'Major 7th sus4', intervals: [5, 7, 11], symbol: 'Maj7sus4' },
  { name: 'Minor Major 7th', intervals: [3, 7, 11], symbol: 'minMaj7' },
  { name: 'Minor Major 7th #5', intervals: [3, 8, 11], symbol: 'minMaj7#5' },
  { name: 'Minor Major 7th add 4 omit 5', intervals: [3, 5, 11], symbol: 'minMaj7add4-omit5' },
  { name: 'Minor Major 7th sus b2 omit 5', intervals: [1, 3, 11], symbol: 'minMaj7sus*b2-omit5' },
  { name: 'Diminished 7th', intervals: [3, 6, 9], symbol: 'o7' },
];

// Recognize a chord from a set of notes
export function recognizeChord(notes) {
  if (!notes || notes.length !== 4) return { name: 'Unknown', symbol: '?' };
  
  // Try all possible permutations of the notes
  const permutations = getAllPermutations(notes);
  
  // For each permutation, try all possible rotations
  for (const perm of permutations) {
    const interpretations = normalizeChord(perm);
    
    // Check each interpretation against known chord types
    for (const interp of interpretations) {
      for (const chordType of chordTypes) {
        // Check if intervals match this chord type
        if (arraysEqual(interp.intervals, chordType.intervals)) {
          const rootNote = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][interp.root];
          
          // Ensure the full chord name is displayed
          const fullName = chordType.name;
          const fullSymbol = chordType.symbol;
          
          return {
            name: `${rootNote} ${fullName}`,
            symbol: `${rootNote}${fullSymbol}`,
            fullName: fullName,
            fullSymbol: fullSymbol,
            inversion: interp.inversion,
            root: rootNote
          };
        }
      }
    }
  }
  
  // If no exact match, try a more flexible matching approach
  for (const perm of permutations) {
    const interpretations = normalizeChord(perm);
    
    for (const interp of interpretations) {
      // Find the closest match by counting matching intervals
      let bestMatch = null;
      let bestScore = 0;
      
      for (const chordType of chordTypes) {
        let score = 0;
        for (let i = 0; i < interp.intervals.length; i++) {
          if (i < chordType.intervals.length && 
              Math.abs(interp.intervals[i] - chordType.intervals[i]) <= 1) {
            score++;
          }
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = chordType;
        }
      }
      
      if (bestMatch && bestScore >= 2) {
        const rootNote = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][interp.root];
        
        // Ensure the full chord name is displayed for approximate matches too
        const fullName = bestMatch.name;
        const fullSymbol = bestMatch.symbol;
        
        return {
          name: `${rootNote} ${fullName} (approx)`,
          symbol: `${rootNote}${fullSymbol}`,
          fullName: fullName,
          fullSymbol: fullSymbol,
          inversion: interp.inversion,
          root: rootNote,
          approximate: true
        };
      }
    }
  }
  
  // If still no match, return a generic label
  return { name: 'Non-standard chord', symbol: '?' };
}

// Helper function to compare arrays
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Parse the chord list from 43.txt
export function parseChordList(chordListText) {
  const chords = [];
  const lines = chordListText.split('\n');
  
  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;
    
    // Extract chord symbol and notes
    const match = line.match(/(\d+)\. ([^:]+): ([^\n]+)/);
    if (match) {
      const [, num, symbol, noteStr] = match;
      const notes = noteStr.split(',').map(n => n.trim());
      
      // Convert note names to numbers (C=0, C#=1, etc.)
      const noteMap = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 
                       'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 
                       'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
      
      const noteNumbers = notes.map(n => noteMap[n]);
      if (noteNumbers.length === 4) {
        // Calculate intervals from the root
        const intervals = [
          (noteNumbers[1] - noteNumbers[0] + 12) % 12,
          (noteNumbers[2] - noteNumbers[0] + 12) % 12,
          (noteNumbers[3] - noteNumbers[0] + 12) % 12
        ];
        
        chords.push({
          symbol,
          notes: noteNumbers,
          intervals
        });
      }
    }
  }
  
  return chords;
}
