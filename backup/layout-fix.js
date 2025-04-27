// Script to fix layout issues and ensure the 3D graph properly fills the right side

document.addEventListener('DOMContentLoaded', () => {
  // Force the graph container to fill its parent
  function resizeGraph() {
    const rightColumn = document.querySelector('.right-column');
    const graphModule = document.querySelector('.graph-module');
    const graphContainer = document.querySelector('.graph-container');
    const canvas3D = document.querySelector('#chord3dContainer canvas');
    
    if (rightColumn && graphModule && graphContainer) {
      // Set explicit dimensions for the graph module
      const rightColumnRect = rightColumn.getBoundingClientRect();
      
      // Log dimensions for debugging
      console.log('Right column dimensions:', {
        width: rightColumnRect.width,
        height: rightColumnRect.height
      });
      
      // Force the graph module to fill the right column
      graphModule.style.width = '100%';
      graphModule.style.height = '100%';
      
      // Force the graph container to fill the module
      graphContainer.style.width = '100%';
      graphContainer.style.height = '100%';
      
      // If canvas exists, make sure it fills the container
      if (canvas3D) {
        canvas3D.style.width = '100%';
        canvas3D.style.height = '100%';
        canvas3D.style.display = 'block';
      }
      
      // Dispatch a resize event to force Three.js to update
      window.dispatchEvent(new Event('resize'));
    }
  }
  
  // Run initially and whenever the window is resized
  resizeGraph();
  window.addEventListener('resize', resizeGraph);
  
  // Also run after a short delay to ensure everything has loaded
  setTimeout(resizeGraph, 500);
  setTimeout(resizeGraph, 1000);
});
