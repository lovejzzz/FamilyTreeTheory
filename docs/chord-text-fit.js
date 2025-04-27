/**
 * Chord Text Fit - Dynamically adjusts text size to fit within chord cards
 * For the Family Tree Theory project
 */

document.addEventListener('DOMContentLoaded', function() {
  // Function to adjust text size for all chord names
  function adjustChordTextSizes() {
    // Get all chord name elements
    const chordNames = document.querySelectorAll('.chord-name');
    
    chordNames.forEach(nameElement => {
      const text = nameElement.textContent;
      const containerWidth = nameElement.offsetWidth;
      
      // Create a temporary span to measure text width
      const tempSpan = document.createElement('span');
      tempSpan.style.font = window.getComputedStyle(nameElement).font;
      tempSpan.style.visibility = 'hidden';
      tempSpan.style.position = 'absolute';
      tempSpan.textContent = text;
      document.body.appendChild(tempSpan);
      
      // Get the width of the text
      const textWidth = tempSpan.offsetWidth;
      document.body.removeChild(tempSpan);
      
      // Calculate the scale factor
      let scaleFactor = (containerWidth * 0.9) / textWidth;
      
      // Get the current font size
      const currentSize = parseFloat(window.getComputedStyle(nameElement).fontSize);
      
      // Apply the new font size, but don't make it too small
      let newSize = currentSize * scaleFactor;
      
      // Set minimum and maximum font sizes
      if (newSize < 14) newSize = 14;
      if (newSize > 24) newSize = 24;
      
      // Only adjust if we need to make it smaller
      if (scaleFactor < 1) {
        nameElement.style.fontSize = `${newSize}px`;
      }
    });
  }
  
  // Run the adjustment when the page loads
  setTimeout(adjustChordTextSizes, 500);
  
  // Also run it when the window is resized
  window.addEventListener('resize', adjustChordTextSizes);
  
  // Create a MutationObserver to watch for new chord cards
  const optionsContainer = document.getElementById('optionsContainer');
  if (optionsContainer) {
    const observer = new MutationObserver(function(mutations) {
      adjustChordTextSizes();
    });
    
    observer.observe(optionsContainer, { childList: true, subtree: true });
  }
});
