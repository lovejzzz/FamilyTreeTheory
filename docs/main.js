import { playTetrachord } from './audio.js';
import { recognizeChord } from './chords.js';
import Chord3DGraph from './chord3dGraph.js';

// Set up WebSocket connection
const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${protocol}://${location.host}`);

// DOM elements
const chordNotesDiv = document.getElementById('chordNotes');
const chordTypeDiv = document.getElementById('chordType');
const nextGenerationButton = document.getElementById('nextGenerationButton');
const prevGenButton = document.getElementById('prevGenButton');
const nextGenButton = document.getElementById('nextGenButton');
const generationTitle = document.getElementById('generationTitle');
const optionsContainer = document.getElementById('optionsContainer');
const errorDiv = document.getElementById('error');

// Initialize 3D chord graph
const chordGraph = new Chord3DGraph('chord3dContainer');

// Track generations and game state
let generations = []; // Array of arrays, each containing chords for that generation
let selectedChords = []; // Array of selected chords, one per generation
let currentGeneration = 0; // Current generation being viewed
let gameActive = false;
let chordHistory = new Set(); // Track all chords that have been seen to detect cycles
let visualizedChords = new Set(); // Track chords that have been added to the 3D visualization

const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Generate a random chord progression
function generateNextChord() {
  // If we have a current chord, use its last 3 notes as the first 3 of the new chord
  let firstThreeNotes = [];
  
  if (currentChord.length === 4) {
    // Use the last 3 notes of the current chord as the first 3 of the new chord
    firstThreeNotes = currentChord.slice(1);
  } else {
    // For the first chord, start with G7 (G B D F) - [7, 11, 2, 5]
    return [7, 11, 2, 5];
  }
  
  // Find valid options for the fourth note based on voice leading rules
  // The new note should be between the first and second notes of the previous chord
  const validOptions = [];
  
  if (currentChord.length === 4) {
    // Get the first two notes of the previous chord
    const firstNote = currentChord[0]; // e.g., G in G7
    const secondNote = currentChord[1]; // e.g., B in G7
    
    // Ensure proper wrapping if needed
    let start = firstNote;
    let end = secondNote;
    
    // Handle the case where the second note is lower than the first note
    if (end < start) {
      end += 12; // Add an octave to make it higher
    }
    
    // Find notes between the first and second notes
    for (let i = 0; i < 12; i++) {
      // Normalize to the correct octave for comparison
      let normalizedNote = i;
      if (normalizedNote < start) normalizedNote += 12;
      
      // Check if the note is between first and second notes
      if (normalizedNote > start && normalizedNote < end) {
        // Also check if it doesn't duplicate any of the carried-over notes
        if (!firstThreeNotes.includes(i % 12)) {
          validOptions.push(i % 12);
        }
      }
    }
  }
  
  // If no valid options found using the between rule, fall back to the standard voice leading rules
  if (validOptions.length === 0) {
    for (let i = 0; i < 12; i++) {
      if (isValidFourthNote(currentChord, i) && !firstThreeNotes.includes(i)) {
        validOptions.push(i);
      }
    }
  }
  
  // If still no valid options, just pick a random note that's not in the first three
  if (validOptions.length === 0) {
    const allNotes = Array.from({length: 12}, (_, i) => i);
    const availableNotes = allNotes.filter(note => !firstThreeNotes.includes(note));
    if (availableNotes.length > 0) {
      return [...firstThreeNotes, availableNotes[Math.floor(Math.random() * availableNotes.length)]];
    }
  }
  
  // Choose a random valid option for the fourth note
  const fourthNote = validOptions[Math.floor(Math.random() * validOptions.length)];
  
  // Return the complete new chord
  return [...firstThreeNotes, fourthNote];
}

// Initialize the game when WebSocket connection opens
ws.addEventListener('open', () => {
  console.log('WebSocket connection established');
  gameActive = true;
  
  // Initialize the next generation button with the undiscovered class
  nextGenButton.classList.add('undiscovered');
  
  // Initialize the first generation with G7 chord
  initializeGenerations();
});

// Handle WebSocket messages
ws.addEventListener('message', ({ data }) => {
  let msg;
  try { msg = JSON.parse(data); } catch { return; }
  
  if (msg.event === 'error') {
    showError(msg.msg);
  }
});

// Handle WebSocket closure
ws.addEventListener('close', () => {
  showError('Connection closed');
  gameActive = false;
  nextGenerationButton.disabled = true;
});

// Set up generation navigation buttons
prevGenButton.addEventListener('click', () => {
  navigateToGeneration(currentGeneration - 1);
});

nextGenButton.addEventListener('click', () => {
  navigateToGeneration(currentGeneration + 1);
});

// Set up Next Generation button click handler
nextGenerationButton.addEventListener('click', () => {
  // Always create the next generation from the current view
  createNextGeneration();
});

// Initialize the first generation with G7 chord
function initializeGenerations() {
  // Clear any existing generations
  generations = [];
  selectedChords = [];
  currentGeneration = 0;
  chordHistory = new Set();
  visualizedChords = new Set();
  
  // Clear the discovery log
  const logEntries = document.getElementById('logEntries');
  if (logEntries) {
    logEntries.innerHTML = '';
  }
  
  // Create the first generation with G7 chord
  const g7Notes = [7, 11, 2, 5]; // G B D F (G7 chord)
  const g7Info = recognizeChord(g7Notes);
  
  // Create the first generation with just G7
  generations.push([{
    notes: g7Notes,
    info: g7Info,
    parentIndex: -1, // No parent for the first chord
    isCycle: false,
    id: g7Info.name // Use the chord name as a unique ID
  }]);
  
  // Select the G7 chord in the first generation
  selectedChords.push(0);
  
  // Add G7 to the discovery log, history, and visualized chords
  const g7Chord = generations[0][0];
  const normalizedG7 = [...g7Notes].sort((a, b) => a - b).join(',');
  addToDiscoveryLog(g7Chord, 1, null, null); // Use generation 1 instead of 0 to match UI
  addToHistory(g7Notes);
  visualizedChords.add(normalizedG7);
  
  // Display the first generation
  displayGeneration(0);
  
  // Display the chord info
  displayChordInfo(g7Info, g7Chord);
  
  // Add the first chord to the 3D visualization (no parent)
  // Extract the chord type for G7 to ensure it appears in the visualization
  const g7Type = g7Info.symbol.replace(/^[A-G][#b]?/, '');
  console.log('Adding G7 chord with type:', g7Type);
  chordGraph.addChord(g7Info, null, true); // Pass true as third parameter to indicate this is the sun (G7)
  
  // Create the next generation
  createNextGeneration();
}

// Navigate to a specific generation
function navigateToGeneration(genIndex) {
  // Validate the generation index
  if (genIndex < 0 || genIndex >= generations.length) return;
  
  currentGeneration = genIndex;
  displayGeneration(currentGeneration);
  
  // Update navigation buttons
  updateNavigationButtons();
}

// Update the navigation buttons based on current generation
function updateNavigationButtons() {
  // Previous generation button - disabled if at first generation
  prevGenButton.disabled = currentGeneration === 0;
  
  // Next generation button - handle differently based on discovery state
  if (currentGeneration >= generations.length - 1) {
    // No next generation available yet
    nextGenButton.disabled = true;
    nextGenButton.classList.add('undiscovered');
  } else {
    // Next generation is available
    nextGenButton.disabled = false;
    nextGenButton.classList.remove('undiscovered');
  }
}

// Display a specific generation of chords
function displayGeneration(genIndex, completionMessage = null) {
  if (!gameActive || genIndex < 0 || genIndex >= generations.length) return;
  
  currentGeneration = genIndex;
  
  // Update the generation title
  // Convert to Roman numeral
  const romanNumeral = convertToRoman(genIndex + 1);
  generationTitle.textContent = `Generation ${romanNumeral}`;
  
  // Clear previous options
  optionsContainer.innerHTML = '';
  
  // Hide any error messages
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
  
  // If we have a completion message, display it in the chord container
  if (completionMessage) {
    // Clear the options container first to make room for the completion message
    optionsContainer.innerHTML = '';
    
    // Insert the HTML content directly
    optionsContainer.innerHTML = completionMessage;
    
    // Add a class to the options container for styling purposes
    optionsContainer.classList.add('showing-completion');
    
    // Update navigation buttons
    updateNavigationButtons();
    return;
  } else {
    // Remove the completion class if we're showing regular chord options
    optionsContainer.classList.remove('showing-completion');
  }
  
  // Get the chords for this generation
  const chords = generations[genIndex];
  
  // Create an element for each chord in this generation
  chords.forEach((chord, index) => {
    // Create the chord option element
    const optionElement = document.createElement('div');
    optionElement.className = 'chord-option';
    
    // Add selected class if this chord is selected
    if (selectedChords[genIndex] === index) {
      optionElement.classList.add('selected');
    }
    
    // Add cycle class if this chord creates a cycle
    if (chord.isCycle) {
      optionElement.classList.add('cycle');
      
      // Add tooltip to explain why it's red (creates a cycle)
      optionElement.setAttribute('title', 'This chord would create a cycle in the progression');
      optionElement.setAttribute('data-tooltip', 'This chord would create a cycle in the chord progression and cannot be selected');
    }
    
    // Check if this chord type has appeared in previous generations (not the current one)
    // This is different from isCycle - isCycle means it would create a cycle if selected
    let appearedInPreviousGen = false;
    
    // Only check previous generations, not the current one
    if (genIndex > 0) {
      // We'll check both by chord type and by exact notes
      const chordType = chord.info.symbol.replace(/^[A-G][#b]?/, ''); // Remove root note to get just the chord type (e.g., '-7b5')
      const normalizedChord = [...chord.notes].sort((a, b) => a - b).join(',');
      
      // Look through all previous generations (not including the current one)
      for (let prevGen = 0; prevGen < genIndex; prevGen++) {
        // Check if this chord type exists in a previous generation
        const foundInPrevGen = generations[prevGen].some(prevChord => {
          // Check by chord type (e.g., -7b5)
          const prevChordType = prevChord.info.symbol.replace(/^[A-G][#b]?/, '');
          if (chordType === prevChordType && chordType !== '') {
            return true;
          }
          
          // Also check by exact notes as a backup
          const prevNormalized = [...prevChord.notes].sort((a, b) => a - b).join(',');
          return prevNormalized === normalizedChord;
        });
        
        if (foundInPrevGen) {
          appearedInPreviousGen = true;
          break;
        }
      }
    }
    
    // Add 'seen-before' class if this chord has appeared in previous generations
    if (appearedInPreviousGen && !chord.isCycle) {
      optionElement.classList.add('seen-before');
      
      // Add a title attribute to explain why it's gray
      optionElement.setAttribute('title', 'Previously discovered chord type');
      
      // Find the generation where this chord was first discovered
      let firstDiscoveredGen = 0;
      for (let prevGen = 0; prevGen < genIndex; prevGen++) {
        const chordType = chord.info.symbol.replace(/^[A-G][#b]?/, '');
        const normalizedChord = [...chord.notes].sort((a, b) => a - b).join(',');
        
        const foundInPrevGen = generations[prevGen].some(prevChord => {
          const prevChordType = prevChord.info.symbol.replace(/^[A-G][#b]?/, '');
          if (chordType === prevChordType && chordType !== '') {
            return true;
          }
          
          const prevNormalized = [...prevChord.notes].sort((a, b) => a - b).join(',');
          return prevNormalized === normalizedChord;
        });
        
        if (foundInPrevGen) {
          firstDiscoveredGen = prevGen + 1; // +1 because we display generation numbers starting from 1, not 0
          break;
        }
      }
      
      // Create a custom data attribute for the tooltip
      optionElement.setAttribute('data-tooltip', `This chord type was previously discovered in Generation ${firstDiscoveredGen}`);
    }
    
    // Add the notes
    const notesElement = document.createElement('div');
    notesElement.className = 'notes';
    notesElement.textContent = chord.notes.map(n => noteNames[n]).join(' ');
    optionElement.appendChild(notesElement);
    
    // Add the chord symbol (not the full name)
    const nameElement = document.createElement('div');
    nameElement.className = 'chord-name';
    if (chord.info.name !== 'Unknown' && chord.info.symbol !== '?') {
      nameElement.textContent = chord.info.symbol; // Use symbol instead of name
      
      // Dynamically adjust font size based on text length
      const symbolLength = chord.info.symbol.length;
      if (symbolLength > 5) {
        nameElement.style.fontSize = '18px'; // Smaller font for longer symbols
      } else if (symbolLength > 3) {
        nameElement.style.fontSize = '20px'; // Medium font for medium symbols
      } else {
        nameElement.style.fontSize = '24px'; // Large font for short symbols
      }
      
      // Add a data attribute for the chord symbol to use in the click handler
      optionElement.setAttribute('data-chord-symbol', chord.info.symbol);
    } else {
      nameElement.textContent = '?';
    }
    optionElement.appendChild(nameElement);
    
    // Add click handler to select this chord (if not already in a later generation)
    if (!chord.isCycle && genIndex === generations.length - 1) {
      optionElement.addEventListener('click', () => {
        console.log('Selecting chord:', chord.info.symbol);
        // Play the chord sound first for immediate feedback
        playTetrachord(chord.notes);
        // Then select the chord for further processing
        selectChord(genIndex, index);
      });
    } else {
      // For chords that can't be selected (previous generations or cycles),
      // add a click handler to focus on the chord in the 3D graph and play sound
      optionElement.addEventListener('click', () => {
        console.log('Focusing on chord:', chord.info.symbol);
        // Play the chord sound for all chord cards, even in previous generations
        playTetrachord(chord.notes);
        
        // Focus on this chord in the 3D graph
        const chordSymbol = chord.info.symbol;
        if (chordSymbol && chordSymbol !== '?' && chordGraph) {
          // Add a visual indicator that the card was clicked
          optionElement.classList.add('focusing');
          setTimeout(() => {
            optionElement.classList.remove('focusing');
          }, 300);
          
          // Focus the 3D graph on this chord
          chordGraph.focusOnChord(chordSymbol);
        }
      });
    }
    
    // Add to the options container
    optionsContainer.appendChild(optionElement);
  });
  
  // Update navigation buttons
  updateNavigationButtons();
}

// Select a chord from a specific generation
function selectChord(genIndex, chordIndex) {
  if (!gameActive || genIndex < 0 || genIndex >= generations.length || chordIndex < 0 || chordIndex >= generations[genIndex].length) return;
  
  // Update the selected chord for this generation
  selectedChords[genIndex] = chordIndex;
  
  // Get the selected chord
  const chord = generations[genIndex][chordIndex];
  
  // Display the chord info
  displayChordInfo(chord.info, chord.notes);
  
  // Find parent chord if available
  let parentChord = null;
  if (genIndex > 0 && chord.parentIndex !== undefined) {
    const parentGenIndex = genIndex - 1;
    const parentChordIndex = chord.parentIndex;
    if (generations[parentGenIndex] && generations[parentGenIndex][parentChordIndex]) {
      parentChord = generations[parentGenIndex][parentChordIndex];
    }
  }
  
  // Find child chords if available
  let childChords = [];
  if (genIndex < generations.length - 1) {
    childChords = generations[genIndex + 1].filter(c => c.parentIndex === chordIndex);
  }
  
  // No longer adding to discovery log when clicking chord cards
  // This prevents cluttering the log with repeated chord selections
  
  // Note: We're no longer playing the chord here
  // because we already play it in the click handler
  // This prevents the sound from being played twice
  
  // Refresh the display
  displayGeneration(genIndex);
}

// Create the next generation of chords based on the currently viewed generation
function createNextGeneration() {
  if (!gameActive || generations.length === 0) return;
  
  // If we're not at the last generation, we need to truncate the generations
  // to the current one before creating a new generation
  if (currentGeneration < generations.length - 1) {
    // Remove all generations after the current one
    generations = generations.slice(0, currentGeneration + 1);
    selectedChords = selectedChords.slice(0, currentGeneration + 1);
  }
  
  // Now get the current generation index (which is the last one after truncation)
  const genIndex = generations.length - 1;
  
  // Get all chords from the current generation
  const currentGenChords = generations[genIndex];
  
  // Check if all chords in the current generation are either cyclic or repeats
  let allChordsAreTerminal = true;
  let hasRepeats = false;
  let hasCycles = false;
  
  // For each chord in the current generation, check if it's terminal (cycle or repeat)
  currentGenChords.forEach((chord) => {
    // Track if we have cycles
    if (chord.isCycle) {
      hasCycles = true;
    } else {
      // Check if this chord type has appeared in previous generations
      let appearedInPreviousGen = false;
      
      // Only check generations before the current one
      if (genIndex > 0) {
        // Get the chord type by removing the root note
        const chordType = chord.info.symbol.replace(/^[A-G][#b]?/, '');
        const normalizedChord = [...chord.notes].sort((a, b) => a - b).join(',');
        
        // Look through all previous generations
        for (let prevGen = 0; prevGen < genIndex; prevGen++) {
          // Check if this chord type exists in a previous generation
          const foundInPrevGen = generations[prevGen].some(prevChord => {
            // Check by chord type (e.g., -7b5)
            const prevChordType = prevChord.info.symbol.replace(/^[A-G][#b]?/, '');
            if (chordType === prevChordType && chordType !== '') {
              return true;
            }
            
            // Also check by exact notes as a backup
            const prevNormalized = [...prevChord.notes].sort((a, b) => a - b).join(',');
            return prevNormalized === normalizedChord;
          });
          
          if (foundInPrevGen) {
            appearedInPreviousGen = true;
            hasRepeats = true;
            break;
          }
        }
      }
      
      // If this chord is not a repeat or cycle, then not all chords are terminal
      if (!appearedInPreviousGen) {
        allChordsAreTerminal = false;
      }
    }
  });
  
  // If all chords are terminal (cycles or repeats), show completion message
  console.log('Terminal check:', { allChordsAreTerminal, chordCount: currentGenChords.length, hasCycles, hasRepeats });
  
  if (allChordsAreTerminal && currentGenChords.length > 0) {
    console.log('All chords are terminal! Showing completion message.');
    
    // Count the total number of unique chord types in the visualization
    const uniqueChordTypes = new Set();
    const chordTypesList = [];
    
    // Go through all generations and collect unique chord types
    for (let gen = 0; gen <= genIndex; gen++) {
      generations[gen].forEach(chord => {
        // Get just the chord type (e.g., -7b5) without the root note
        const chordType = chord.info.symbol.replace(/^[A-G][#b]?/, '');
        if (chordType !== '') {
          if (!uniqueChordTypes.has(chordType)) {
            chordTypesList.push(chordType);
          }
          uniqueChordTypes.add(chordType);
        }
      });
    }
    
    // Count the unique chord types
    const uniqueChordCount = uniqueChordTypes.size;
    
    // Log the actual chord types for debugging
    console.log('Unique chord types found:', chordTypesList.sort());
    console.log('Total unique chord types:', uniqueChordCount);
    
    // Create a more visually impressive game-like completion message
    let message = `<div class="completion-message">
      <div class="completion-title">CONGRATULATIONS!</div>
      <div class="completion-subtitle">You have completed the full cycle of the Family Tree!</div>
    </div>`;
    
    // Display the completion message in the current generation
    displayGeneration(currentGeneration, message);
    
    // Hide the Next Generation button
    nextGenerationButton.style.display = 'none';
    console.log('Hiding Next Generation button as cycle is completed');
    
    return;
  }
  
  // Generate all possible child chords from all chords in the current generation
  let allChildChords = [];
  
  // For each chord in the current generation, generate its children
  currentGenChords.forEach((parentChord, parentIndex) => {
    // Skip cyclic chords as they won't have valid children
    if (parentChord.isCycle) return;
    
    // Check if this chord type has appeared in previous generations
    let appearedInPreviousGen = false;
    
    // Only check generations before the current one
    if (genIndex > 0) {
      // Get the chord type by removing the root note
      const chordType = parentChord.info.symbol.replace(/^[A-G][#b]?/, '');
      const normalizedChord = [...parentChord.notes].sort((a, b) => a - b).join(',');
      
      // Look through all previous generations
      for (let prevGen = 0; prevGen < genIndex; prevGen++) {
        // Check if this chord type exists in a previous generation
        const foundInPrevGen = generations[prevGen].some(prevChord => {
          // Check by chord type (e.g., -7b5)
          const prevChordType = prevChord.info.symbol.replace(/^[A-G][#b]?/, '');
          if (chordType === prevChordType && chordType !== '') {
            return true;
          }
          
          // Also check by exact notes as a backup
          const prevNormalized = [...prevChord.notes].sort((a, b) => a - b).join(',');
          return prevNormalized === normalizedChord;
        });
        
        if (foundInPrevGen) {
          appearedInPreviousGen = true;
          break;
        }
      }
    }
    
    // Skip chords that have appeared in previous generations
    // This aligns with Kingdoms of Harmony where we want to focus on new chord types
    if (appearedInPreviousGen) return;
    
    // Generate child chords for this parent
    const childChords = generateChildChords(parentChord.notes, parentIndex);
    
    // Add these children to the collection
    allChildChords = [...allChildChords, ...childChords];
  });
  
  // If no valid children were generated, show a completion message and return
  if (allChildChords.length === 0) {
    showCompletion('No new chord types available. You have completed the full cycle of the Family Tree!');
    
    // Hide the Next Generation button
    nextGenerationButton.style.display = 'none';
    console.log('Hiding Next Generation button as cycle is completed');
    return;
  }
  
  // Create the next generation
  generations.push(allChildChords);
  
  // Select the first child by default
  selectedChords.push(0);
  
  // Display chord information in the UI for the first child
  displayChordInfo(allChildChords[0].info, allChildChords[0].notes);
  
  // Add all chords from this generation to the 3D visualization with parent information
  allChildChords.forEach((chord, idx) => {
    if (!chord.isCycle) {
      // Get the parent chord from the previous generation
      const parentChord = generations[genIndex][chord.parentIndex];
      
      // Create a normalized version of the chord for tracking
      const normalizedChord = [...chord.notes].sort((a, b) => a - b).join(',');
      
      // Check if this exact chord has already been visualized
      if (!visualizedChords.has(normalizedChord)) {
        // Get the chord type (without root note) for proper linking
        const chordType = chord.info.symbol.replace(/^[A-G][#b]?/, '');
        const parentChordType = parentChord.info.symbol.replace(/^[A-G][#b]?/, '');
        
        // Add the chord with parent information for proper linking
        // We need to pass the chord types for proper connections
        chordGraph.addChord(chord.info, { 
          id: parentChordType, 
          info: parentChord.info,
          type: parentChordType
        });
        
        // Mark this chord as visualized
        visualizedChords.add(normalizedChord);
        
        // Add to discovery log (only for the first time we see this chord)
        // We use the new generation index (genIndex + 2) to match UI generation numbers
        addToDiscoveryLog(chord, genIndex + 2, parentChord, []);
      }
    }
  });
  
  // No automatic chord playing when clicking 'Next Generation'
  
  // Navigate to the new generation
  navigateToGeneration(generations.length - 1);
}

// Generate all possible child chords for a parent chord
function generateChildChords(parentChord, parentIndex) {
  if (!parentChord || parentChord.length !== 4) return [];
  
  // Get the last three notes of the parent chord to use as the first three of the child chords
  const firstThreeNotes = parentChord.slice(1);
  
  // Find all valid options for the fourth note
  const validOptions = findAllValidNextNotes(parentChord);
  
  // Create child chords
  const childChords = [];
  
  validOptions.forEach(fourthNote => {
    const childNotes = [...firstThreeNotes, fourthNote];
    const childInfo = recognizeChord(childNotes);
    
    // Check if this chord creates a cycle (has been seen before)
    const isCycle = isInHistory(childNotes);
    
    // Add to history if not a cycle
    if (!isCycle) {
      addToHistory(childNotes);
    }
    
    // Add to child chords
    childChords.push({
      notes: childNotes,
      info: childInfo,
      parentIndex: parentIndex, // Index of parent in previous generation
      isCycle: isCycle,
      id: childInfo.name // Use the chord name as a unique ID
    });
  });
  
  return childChords;
}

// Check if a chord is in the history (creates a cycle)
function isInHistory(notes) {
  // Create a normalized version of the chord for comparison
  const normalized = [...notes].sort((a, b) => a - b).join(',');
  return chordHistory.has(normalized);
}

// Add a chord to the history
function addToHistory(notes) {
  // Create a normalized version of the chord for comparison
  const normalized = [...notes].sort((a, b) => a - b).join(',');
  chordHistory.add(normalized);
}

// Find all valid next notes based on voice leading rules
function findAllValidNextNotes(chord) {
  if (!chord || chord.length !== 4) {
    // First chord is always G7
    return [7, 11, 2, 5];
  }
  
  const firstThreeNotes = chord.slice(1);
  const validOptions = [];
  
  // Get the first two notes of the previous chord
  const firstNote = chord[0]; // e.g., G in G7
  const secondNote = chord[1]; // e.g., B in G7
  
  // Ensure proper wrapping if needed
  let start = firstNote;
  let end = secondNote;
  
  // Handle the case where the second note is lower than the first note
  if (end < start) {
    end += 12; // Add an octave to make it higher
  }
  
  // Find notes between the first and second notes
  for (let i = 0; i < 12; i++) {
    // Normalize to the correct octave for comparison
    let normalizedNote = i;
    if (normalizedNote < start) normalizedNote += 12;
    
    // Check if the note is between first and second notes
    if (normalizedNote > start && normalizedNote < end) {
      // Also check if it doesn't duplicate any of the carried-over notes
      if (!firstThreeNotes.includes(i % 12)) {
        validOptions.push(i % 12);
      }
    }
  }
  
  // If no valid options found using the between rule, fall back to the standard voice leading rules
  if (validOptions.length === 0) {
    for (let i = 0; i < 12; i++) {
      if (isValidFourthNote(chord, i) && !firstThreeNotes.includes(i)) {
        validOptions.push(i);
      }
    }
  }
  
  // If still no valid options, just include any note that's not in the first three
  if (validOptions.length === 0) {
    const allNotes = Array.from({length: 12}, (_, i) => i);
    return allNotes.filter(note => !firstThreeNotes.includes(note));
  }
  
  return validOptions;
}

// Add entry to the discovery log
function addToDiscoveryLog(chord, generation, parentChord = null, childChords = null) {
  const logEntries = document.getElementById('logEntries');
  
  // Create a new log entry
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  
  // Convert generation number to Roman numeral
  const romanNumeral = convertToRoman(generation);
  
  // Add generation and chord info (using only chord symbol, not full name)
  entry.innerHTML = `
    <span class="log-gen">Gen ${romanNumeral}:</span> 
    <span class="log-chord" data-notes="${chord.notes.join(',')}">${chord.info.symbol}</span> 
    
  `;
  
  // Add parent info if available (using only chord symbol)
  if (parentChord) {
    const parentInfo = document.createElement('div');
    parentInfo.className = 'log-parent';
    parentInfo.innerHTML = `↑ Parent: <span class="log-chord" data-notes="${parentChord.notes.join(',')}">${parentChord.info.symbol}</span>`;
    entry.appendChild(parentInfo);
  }
  
  // Add children info if available (using only chord symbols)
  if (childChords && childChords.length > 0) {
    const childrenInfo = document.createElement('div');
    childrenInfo.className = 'log-children';
    childrenInfo.innerHTML = `↓ Children: ${childChords.map(c => `<span class="log-chord" data-notes="${c.notes.join(',')}">${c.info.symbol}</span>`).join(', ')}`;
    entry.appendChild(childrenInfo);
  }
  
  // Add the entry to the log
  logEntries.appendChild(entry);
  
  // Add click event listeners to all chord spans in this entry
  const chordSpans = entry.querySelectorAll('.log-chord');
  chordSpans.forEach(span => {
    span.style.cursor = 'pointer'; // Show pointer cursor on hover
    span.addEventListener('click', function() {
      // Get the notes data attribute and convert to array of numbers
      const notesStr = this.getAttribute('data-notes');
      if (notesStr) {
        const notes = notesStr.split(',').map(n => parseInt(n, 10));
        // Play the chord
        playTetrachord(notes);
        // Add visual feedback
        this.classList.add('playing');
        setTimeout(() => {
          this.classList.remove('playing');
        }, 300);
      }
    });
  });
  
  // Always scroll to show the newest content
  // Use setTimeout with a slightly longer delay to ensure this happens after the DOM is fully updated
  setTimeout(() => {
    const logContainer = document.querySelector('.discovery-log');
    if (logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
    // Also try scrolling the direct entries container
    logEntries.scrollTop = logEntries.scrollHeight;
    console.log('Auto-scrolling discovery log to show newest content');
  }, 50);
}

// Display chord information in the UI (legacy function, now just logs to discovery log)
function displayChordInfo(chordInfo, notes) {
  // This function is kept for compatibility but doesn't update the UI anymore
  // as the current chord display has been replaced with the discovery log
  // No UI updates needed as we're using the discovery log instead
  console.log('Chord info:', chordInfo.name, notes.map(n => noteNames[n]).join(', '));
}

// This function is no longer used - replaced by the generations system
function displayNextChord() {
  // Functionality moved to createNextGeneration()
  console.log('displayNextChord is deprecated - use createNextGeneration() instead');
}

// Check if a fourth note is valid based on voice leading rules
function isValidFourthNote(prevChord, fourthNote) {
  if (!prevChord || prevChord.length !== 4) {
    // If there's no previous chord, any note is valid for the first chord
    return true;
  }
  
  // Get the last three notes from the previous chord
  const firstThreeNotes = [prevChord[1], prevChord[2], prevChord[3]];
  const newChord = [...firstThreeNotes, fourthNote];
  
  // Check for duplicates in the new chord (no note can appear twice)
  const uniqueNotes = new Set(newChord);
  if (uniqueNotes.size !== 4) {
    return false;
  }
  
  // Check for voice leading - the new note should be within a reasonable
  // distance from at least one of the previous notes (within a perfect fifth)
  const maxDistance = 7; // Perfect fifth = 7 semitones
  
  for (const note of firstThreeNotes) {
    // Calculate the smallest interval between the notes (considering octave wrapping)
    const interval = Math.min(
      Math.abs(fourthNote - note),
      Math.abs(fourthNote - note + 12),
      Math.abs(fourthNote - note - 12)
    );
    
    if (interval <= maxDistance) {
      return true;
    }
  }
  
  return false;
}

// Helper function to get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  
  if (j === 1 && k !== 11) {
    return num + 'st';
  }
  if (j === 2 && k !== 12) {
    return num + 'nd';
  }
  if (j === 3 && k !== 13) {
    return num + 'rd';
  }
  
  return num + 'th';
}

// Function to convert numbers to Roman numerals
function convertToRoman(num) {
  const romanNumerals = [
    { value: 1000, numeral: 'M' },
    { value: 900, numeral: 'CM' },
    { value: 500, numeral: 'D' },
    { value: 400, numeral: 'CD' },
    { value: 100, numeral: 'C' },
    { value: 90, numeral: 'XC' },
    { value: 50, numeral: 'L' },
    { value: 40, numeral: 'XL' },
    { value: 10, numeral: 'X' },
    { value: 9, numeral: 'IX' },
    { value: 5, numeral: 'V' },
    { value: 4, numeral: 'IV' },
    { value: 1, numeral: 'I' }
  ];
  
  let result = '';
  let remaining = num;
  
  for (const { value, numeral } of romanNumerals) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  
  return result;
}

// Show error message
function showError(message) {
  console.log('Error div element:', errorDiv);
  console.log('Showing error message:', message);
  
  if (!errorDiv) {
    console.error('Error div not found!');
    alert(message); // Fallback to alert if errorDiv is not found
    return;
  }
  
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  errorDiv.className = 'error';
  
  // Hide error after 5 seconds
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

// Show completion message in the current generation
function showCompletionInGeneration(message) {
  console.log('Showing completion message in current generation:', message);
  
  // Remove any existing completion messages
  const existingCompletions = document.querySelectorAll('.generation-completion');
  existingCompletions.forEach(el => el.remove());
  
  // Create a completion message element
  const completionElement = document.createElement('div');
  completionElement.className = 'generation-completion';
  
  // Add the message
  const messageText = document.createElement('p');
  messageText.textContent = message;
  completionElement.appendChild(messageText);
  
  // Add the completion element to the body for absolute positioning
  document.body.appendChild(completionElement);
  
  // Position in the center-bottom of the screen
  completionElement.style.position = 'fixed';
  completionElement.style.top = '60%';
  completionElement.style.left = '50%';
  completionElement.style.transform = 'translateX(-50%)';
  completionElement.style.zIndex = '9999';
  
  // Make sure the error div is hidden
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
  
  // Hide the Next Generation button when cycle is completed
  if (message.includes('You have completed the full cycle')) {
    nextGenerationButton.style.display = 'none';
    console.log('Hiding Next Generation button as cycle is completed');
  }
}

// Show completion message (legacy function, now just calls showCompletionInGeneration)
function showCompletion(message) {
  showCompletionInGeneration(message);
}

// Reset functionality removed as requested

