// Direct fix for the 3D graph rendering

document.addEventListener('DOMContentLoaded', function() {
  // Wait for everything to load
  setTimeout(function() {
    // Get the graph container and ensure it has proper dimensions
    const chordGraph = document.getElementById('chordGraph');
    const chord3dContainer = document.getElementById('chord3dContainer');
    
    if (chordGraph && chord3dContainer) {
      // Force the graph container to have explicit dimensions
      chordGraph.style.width = '100%';
      chordGraph.style.height = '600px';
      chordGraph.style.position = 'relative';
      chordGraph.style.backgroundColor = 'rgba(16, 23, 41, 0.8)';
      chordGraph.style.borderRadius = '12px';
      chordGraph.style.overflow = 'hidden';
      
      // Force the 3D container to fill its parent
      chord3dContainer.style.position = 'absolute';
      chord3dContainer.style.top = '0';
      chord3dContainer.style.left = '0';
      chord3dContainer.style.width = '100%';
      chord3dContainer.style.height = '100%';
      
      // Find the canvas element and force it to fill the container
      const canvas = chord3dContainer.querySelector('canvas');
      if (canvas) {
        canvas.style.width = '100%';
        canvas.style.height = '100%';
      } else {
        console.log('Canvas not found yet, will try again');
        // Try again after a delay if canvas isn't created yet
        setTimeout(function() {
          const canvas = chord3dContainer.querySelector('canvas');
          if (canvas) {
            canvas.style.width = '100%';
            canvas.style.height = '100%';
          }
        }, 1000);
      }
      
      // Force a resize event to make Three.js update
      window.dispatchEvent(new Event('resize'));
    }
  }, 500);
});
