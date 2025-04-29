// 3D Chord Graph Visualization using Three.js

class Chord3DGraph {
  constructor(containerId) {
    // Store container ID for later use
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    
    // Force container to have explicit dimensions if it doesn't already
    if (this.container) {
      if (!this.container.style.height || this.container.style.height === 'auto') {
        this.container.style.height = '100%';
      }
      this.container.style.position = 'relative';
    }
    
    // Set initial dimensions - will be updated in init3D
    this.width = window.innerWidth * 0.6; // Default to 60% of window width
    this.height = window.innerHeight * 0.8; // Default to 80% of window height
    
    // Initialize data structures
    this.nodes = [];
    this.links = [];
    this.nodeMap = new Map(); // Map chord symbols to node indices
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.nodeObjects = [];
    this.linkObjects = [];
    this.raycaster = null;
    this.mouse = null;
    this.controls = null;
    this.currentLevel = 0;
    this.resizeObserver = null;
    this.initialized = false;
    this.planetTextures = null; // Store planet textures
    
    // Delay initialization to ensure DOM is fully loaded
    setTimeout(() => {
      this.init3D();
      // Add a second delay to ensure the sun is added after initialization
      setTimeout(() => {
        this.addDefaultSun();
        // Force a render after adding the sun
        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
      }, 300);
    }, 100);
    
    // Tooltip elements
    this.tooltip = document.getElementById('chordTooltip');
    this.tooltipChord = document.getElementById('tooltipChord');
    this.tooltipParents = document.getElementById('tooltipParents');
    this.tooltipChildren = document.getElementById('tooltipChildren');
    this.hoveredNode = null;
    
    // Initialize the 3D scene
    this.init3D();
    
    // Add a default G7 chord as the sun to ensure the visualization isn't empty at startup
    this.addDefaultSun();
    
    // Start animation loop
    this.animate();
  }
  
  init3D() {
    console.log('Initializing 3D graph');
    
    // Get the container again in case it wasn't available at construction time
    this.container = document.getElementById(this.containerId);
    
    if (!this.container) {
      console.error('Container not found:', this.containerId);
      return;
    }
    
    // Set container background to transparent immediately
    this.container.style.backgroundColor = 'transparent';
    
    // Force container styles to ensure proper rendering
    this.container.style.position = 'relative';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.minHeight = '500px';
    
    // Get dimensions from container
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(rect.width, 100);  // Ensure minimum width
    this.height = Math.max(rect.height, 100); // Ensure minimum height
    
    console.log('Container dimensions:', this.width, this.height);
    
    // Create scene
    this.scene = new THREE.Scene();
    // Using transparent background instead of solid color
    
    // Create camera
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
    this.camera.position.set(0, 0, 200);
    
    // Create renderer with transparent background
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false
    });
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x000000, 0); // Set to fully transparent
    this.renderer.domElement.style.backgroundColor = 'transparent';
    this.renderer.domElement.style.opacity = '0';
    
    // We'll use this to control the fade-in of the entire scene
    this.fadeInProgress = true;
    this.fadeInStartTime = null;
    this.fadeInDuration = 1500; // 1.5 seconds for a smoother fade
    
    // Clear the container first
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    
    // Create a wrapper div to ensure proper sizing
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.top = '0';
    wrapper.style.left = '0';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.overflow = 'hidden';
    
    // Add the renderer to the wrapper
    wrapper.appendChild(this.renderer.domElement);
    
    // Add the wrapper to the container
    this.container.appendChild(wrapper);
    
    // Make the renderer's canvas fill its container
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
    
    // Add orbit controls for interaction
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.25;
    
    // Setup raycaster for mouse interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Add event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.renderer.domElement.addEventListener('click', this.onClick.bind(this));
    
    // Set up ResizeObserver to detect container size changes
    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === this.container) {
          this.onContainerResize();
        }
      }
    });
    
    // Start observing the container
    this.resizeObserver.observe(this.container);
  }
  
  onWindowResize() {
    this.onContainerResize();
  }
  
  onContainerResize() {
    if (!this.container || !this.renderer) return;
    
    // Get the actual dimensions of the container
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(rect.width, 100);  // Ensure minimum width
    this.height = Math.max(rect.height, 100); // Ensure minimum height
    
    console.log('Container resized:', this.width, this.height);
    
    // Update camera aspect ratio
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    
    // Update renderer size
    this.renderer.setSize(this.width, this.height, false);
    
    // Ensure the canvas fills the container
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
  }
  
  onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / this.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / this.height) * 2 + 1;
    
    // Get the actual mouse position for the tooltip
    // Use clientX/Y for the absolute position in the viewport
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    
    // Update the picking ray with the camera and mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Calculate objects intersecting the picking ray
    const intersects = this.raycaster.intersectObjects(this.nodeObjects);
    
    // Hide tooltip by default
    this.tooltip.style.display = 'none';
    this.hoveredNode = null;
    
    // Reset all node materials to their original colors
    this.nodeObjects.forEach(node => {
      if (node.userData && node.userData.originalColor) {
        node.material.color.set(node.userData.originalColor);
      }
      node.material.opacity = 0.7;
    });
    
    // Highlight intersected node and show tooltip
    if (intersects.length > 0) {
      const object = intersects[0].object;
      const nodeData = object.userData;
      
      // Highlight the hovered planet
      object.material.opacity = 1.0;
      object.material.color.set(0xFFFFFF); // Bright white highlight
      this.hoveredNode = object;
      
      // Get the node data from the userData
      if (nodeData && nodeData.nodeId !== undefined) {
        const node = this.nodes[nodeData.nodeId];
        if (node) {
          // Show tooltip with chord information
          this.showTooltip(node, mouseX, mouseY);
        }
      }
    }
  }
  
  // Show tooltip with chord information
  showTooltip(node, x, y) {
    if (!node) return;
    
    console.log('Showing tooltip for node:', node);
    
    // Set the chord name - use type for display since we're using chord types for identification
    this.tooltipChord.textContent = node.type || node.name;
    
    // Clear previous parent and child lists
    this.tooltipParents.innerHTML = '';
    this.tooltipChildren.innerHTML = '';
    
    // Add parent chords (fathers) - look through all links to find parents
    // A parent is any node that has a link to the current node
    const parentNodes = [];
    
    // Log the current node and all links for debugging
    console.log('Current node:', node);
    console.log('All links:', this.links);
    
    // Find all nodes that have a link to this node (parents)
    this.links.forEach(link => {
      if (link.target === node.id) {
        const parentNode = this.nodes.find(n => n.id === link.source);
        if (parentNode) {
          parentNodes.push(parentNode);
        }
      }
    });
    
    // Also check the direct parentId property
    if (node.parentId !== null && node.parentId !== undefined) {
      const directParent = this.nodes.find(n => n.id === node.parentId);
      if (directParent && !parentNodes.some(p => p.id === directParent.id)) {
        parentNodes.push(directParent);
      }
    }
    
    console.log('Parent nodes found:', parentNodes);
    
    // If there are parents, show them sorted by ID
    if (parentNodes.length > 0) {
      // Make the parents section visible
      document.querySelector('.tooltip-parents h5').style.display = 'block';
      
      // Sort parents by ID to ensure consistent display order
      parentNodes.sort((a, b) => a.id - b.id);
      
      parentNodes.forEach(parentNode => {
        const parentDiv = document.createElement('div');
        parentDiv.textContent = parentNode.type || parentNode.name;
        parentDiv.className = 'tooltip-item';
        this.tooltipParents.appendChild(parentDiv);
      });
    } else {
      // If no parents, hide the 'Parents:' heading completely
      document.querySelector('.tooltip-parents h5').style.display = 'none';
    }
    
    // Add child chords (sons) - look through all links to find children
    // A child is any node that this node has a link to
    const childNodes = [];
    
    // Find all nodes that this node has a link to (children)
    this.links.forEach(link => {
      if (link.source === node.id) {
        const childNode = this.nodes.find(n => n.id === link.target);
        if (childNode) {
          childNodes.push(childNode);
        }
      }
    });
    
    // Also check for nodes that have this node as their parent
    const directChildren = this.nodes.filter(n => n.parentId === node.id);
    directChildren.forEach(child => {
      if (!childNodes.some(c => c.id === child.id)) {
        childNodes.push(child);
      }
    });
    
    console.log('Child nodes found:', childNodes);
    
    // If there are children, show them sorted by ID
    if (childNodes.length > 0) {
      // Make the children section visible
      document.querySelector('.tooltip-children h5').style.display = 'block';
      
      // Sort children by ID to ensure consistent display order
      childNodes.sort((a, b) => a.id - b.id);
      
      childNodes.forEach(childNode => {
        const childDiv = document.createElement('div');
        childDiv.textContent = childNode.type || childNode.name;
        childDiv.className = 'tooltip-item';
        this.tooltipChildren.appendChild(childDiv);
      });
    } else {
      // If no children, hide the 'Children:' heading completely
      document.querySelector('.tooltip-children h5').style.display = 'none';
    }
    
    // Calculate tooltip position relative to the browser window
    // Get the container's position to adjust tooltip position correctly
    const containerRect = this.container.getBoundingClientRect();
    
    // Get the 3D position of the planet and convert to screen coordinates
    const planetPosition = this.hoveredNode.position.clone();
    const vector = planetPosition.project(this.camera);
    
    // Convert the normalized position to CSS coordinates
    const widthHalf = this.width / 2;
    const heightHalf = this.height / 2;
    
    // Account for page scroll position
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    // Calculate planet position in viewport coordinates
    const planetX = (vector.x * widthHalf) + widthHalf + containerRect.left + scrollX;
    const planetY = -(vector.y * heightHalf) + heightHalf + containerRect.top + scrollY;
    
    // Position the tooltip directly above the planet
    const tooltipX = planetX;
    const tooltipY = planetY - 20; // 20px above the planet
    
    // Make sure tooltip stays within the window bounds
    this.tooltip.style.left = tooltipX + 'px';
    this.tooltip.style.top = tooltipY + 'px';
    
    // Center the tooltip on the planet
    this.tooltip.style.transform = 'translateX(-50%)';
    
    // Add a scroll event listener to update tooltip position if it's currently visible
    if (!this._scrollListenerAdded) {
      window.addEventListener('scroll', () => {
        if (this.tooltip.style.display === 'block' && this.hoveredNode) {
          // Recalculate tooltip position on scroll
          this.showTooltip(this.hoveredNode, this.lastMouseX, this.lastMouseY);
        }
      });
      this._scrollListenerAdded = true;
    }
    
    // Store the last mouse position for scroll updates
    this.lastMouseX = x;
    this.lastMouseY = y;
    
    // Show the tooltip
    this.tooltip.style.display = 'block';
  }
  
  onClick(event) {
    // Handle click events (for future interaction)
  }
  
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    
    // Handle fade-in animation
    if (this.fadeInProgress) {
      if (this.fadeInStartTime === null) {
        this.fadeInStartTime = Date.now();
        // Make the container visible but with opacity 0
        const graphContainer = document.getElementById('graphContainer');
        if (graphContainer) {
          graphContainer.style.visibility = 'visible';
          graphContainer.style.opacity = '0';
          graphContainer.style.transition = `opacity ${this.fadeInDuration/1000}s ease-in-out`;
        }
      }
      
      const elapsedTime = Date.now() - this.fadeInStartTime;
      const progress = Math.min(elapsedTime / this.fadeInDuration, 1);
      
      // Gradually fade in the canvas
      this.renderer.domElement.style.opacity = progress.toString();
      
      // Gradually fade in the container
      const graphContainer = document.getElementById('graphContainer');
      if (graphContainer) {
        graphContainer.style.opacity = progress.toString();
      }
      
      // Gradually fade in and scale up each planet
      this.nodeObjects.forEach(obj => {
        // Store the original scale if we haven't already
        if (!obj.userData.originalScale) {
          obj.userData.originalScale = obj.scale.x;
          // Start with a smaller scale
          obj.scale.set(0.01, 0.01, 0.01);
        }
        
        // Scale up to the original size
        const targetScale = obj.userData.originalScale;
        const currentScale = obj.scale.x + (targetScale - obj.scale.x) * progress * 0.1;
        obj.scale.set(currentScale, currentScale, currentScale);
        
        // Also fade in the material
        if (obj.material) {
          obj.material.opacity = progress;
        }
      });
      
      // Fade in the connections
      this.linkObjects.forEach(obj => {
        if (obj.material) {
          obj.material.opacity = progress * 0.7; // Keep connections slightly transparent
        }
      });
      
      // End the fade-in when complete
      if (progress >= 1) {
        this.fadeInProgress = false;
      }
    }
    
    // Check if we need to resize
    if (this.container && this.renderer) {
      const rect = this.container.getBoundingClientRect();
      if (Math.abs(rect.width - this.width) > 5 || Math.abs(rect.height - this.height) > 5) {
        this.onContainerResize();
      }
    }
    
    // Update controls
    if (this.controls) {
      this.controls.update();
    }
    
    // Rotate planets and make labels face the camera
    this.nodeObjects.forEach(obj => {
      if (obj.rotationSpeed) {
        // Rotate the planet but keep the label facing the camera
        obj.rotation.y += obj.rotationSpeed;
      }
      
      // Add pulsing animation for sun
      if (obj.userData && obj.userData.pulseDirection !== undefined) {
        // Pulse the sun planet
        const scale = obj.scale.x;
        if (scale >= obj.userData.pulseMax) {
          obj.userData.pulseDirection = -1;
        } else if (scale <= obj.userData.pulseMin) {
          obj.userData.pulseDirection = 1;
        }
        
        const newScale = scale + (obj.userData.pulseSpeed * obj.userData.pulseDirection);
        obj.scale.set(newScale, newScale, newScale);
      }
      
      // Make any child labels face the camera - do this for ALL planets, not just rotating ones
      obj.children.forEach(child => {
        if (child.material && child.material.map) {
          // Make the label face the camera
          child.lookAt(this.camera.position);
          
          // Ensure the label is always on top by adjusting renderOrder
          child.renderOrder = 1;
          child.material.needsUpdate = true;
        }
      });
    });
    
    // Animate particles along connections
    this.linkObjects.forEach(obj => {
      if (obj.userData && obj.userData.curve) {
        // Update particle position along curve
        obj.userData.t += obj.userData.speed * obj.userData.direction;
        
        // Loop particles around the curve
        if (obj.userData.t > 1) obj.userData.t = 0;
        if (obj.userData.t < 0) obj.userData.t = 1;
        
        // Get new position on curve
        const newPos = obj.userData.curve.getPoint(obj.userData.t);
        obj.position.copy(newPos);
      }
    });
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
  
  // Add a new chord to the graph with parent information
  addChord(chordInfo, parentInfo = null, isSun = false) {
    if (!chordInfo || !chordInfo.symbol) return;
    
    // Use the full chord name and symbol
    const chordSymbol = chordInfo.symbol;
    const chordName = chordInfo.name || chordSymbol;
    const chordType = chordInfo.fullSymbol || chordSymbol.replace(/^[A-G][#b]?/, '');
    
    // Generate a unique ID for this chord based on chord type only (without root note)
    // This ensures we only create one planet per chord type (e.g., all dominant 7th chords share one planet)
    const chordId = chordType || chordSymbol.replace(/^[A-G][#b]?/, '');
    
    console.log(`Adding chord: ${chordName}, type: ${chordType}, id: ${chordId}, isSun: ${isSun}`);
    if (parentInfo) {
      console.log(`Parent info:`, parentInfo);
    }
    
    // Check if this specific chord already exists in the graph
    if (!this.nodeMap.has(chordId)) {
      // Create a new node for this chord
      const nodeIndex = this.nodes.length;
      
      // Calculate position in 3D space based on solar system model
      // G7 (the first chord) is the sun at the center
      const level = this.currentLevel;
      
      // Special case for G7 (the sun) - either it's explicitly marked as the sun or it's the first node and a dominant 7th
      if (isSun || (nodeIndex === 0 && (chordType === '7' || chordType.includes('7')))) {
        // Place G7 at the center
        var x = 0;
        var y = 0;
        var z = 0;
      } else {
        // For all other chords, create orbital positions in a more realistic universe model
        // We'll use a combination of orbital layers and golden ratio distribution
        
        // Calculate the total number of nodes we expect (based on the 43 unique chord types)
        const expectedTotalNodes = 43;
        
        // Determine the number of orbital layers based on chord complexity
        const chordComplexity = chordType.length;
        const numLayers = 5; // We'll use 5 orbital layers for different chord families
        
        // Determine which layer this chord belongs to based on its type
        let layer = 1; // Default layer
        
        if (chordType.includes('m') && !chordType.includes('dim')) {
          layer = 1; // Minor chords
        } else if (chordType.includes('7') && !chordType.includes('m')) {
          layer = 2; // Dominant 7th chords
        } else if (chordType.includes('dim') || chordType.includes('°')) {
          layer = 3; // Diminished chords
        } else if (chordType.includes('aug') || chordType.includes('+')) {
          layer = 4; // Augmented chords
        } else if (chordType.includes('sus') || chordType.includes('add')) {
          layer = 5; // Suspended or added tone chords
        }
        
        // Use golden ratio for optimal spacing within each layer
        const goldenRatio = 1.618033988749895;
        const angleIncrement = Math.PI * 2 * goldenRatio;
        
        // Calculate the angle based on node index and layer
        const angle = nodeIndex * angleIncrement;
        
        // Calculate base orbit radius with increasing distance for each layer
        const baseRadius = 120; // Increased base radius for more spread
        const layerSpacing = 80; // Increased space between layers
        const orbitRadius = baseRadius + ((layer - 1) * layerSpacing);
        
        // Calculate position using full 360-degree spherical coordinates
        // This creates a more evenly distributed pattern in 3D space
        const phi = Math.acos(-1 + (2 * (nodeIndex % 20)) / 20); // Polar angle (0 to π)
        const theta = Math.sqrt(20 * Math.PI) * phi; // Azimuthal angle (0 to 2π)
        
        // Add layer-specific rotation to create separation between layers
        const layerTheta = theta + (layer * Math.PI / 2.5);
        
        // Convert to Cartesian coordinates using spherical formula
        var x = orbitRadius * Math.sin(phi) * Math.cos(layerTheta);
        var z = orbitRadius * Math.sin(phi) * Math.sin(layerTheta);
        var y = orbitRadius * Math.cos(phi) * 0.5; // Flatten the y-axis slightly
        
        // Add controlled randomization to prevent exact patterns while maintaining structure
        const jitter = 25; // Increased jitter for more natural spacing
        x += (Math.random() - 0.5) * jitter;
        y += (Math.random() - 0.5) * jitter * 0.5; // Less vertical jitter
        z += (Math.random() - 0.5) * jitter;
      }
      
      const node = {
        id: nodeIndex,
        chordId: chordId,
        name: chordType, // Use chord type as the name for display
        type: chordType,
        level: level,
        x: x,
        y: y,
        z: z,
        parentId: parentInfo ? parentInfo.id : null
      };
      
      this.nodes.push(node);
      this.nodeMap.set(chordId, nodeIndex);
      
      // If this chord has a parent, create a link from the parent
      if (parentInfo) {
        // Get the parent chord type (without root note) for proper linking
        const parentChordType = parentInfo.info ? 
          (parentInfo.info.fullSymbol || parentInfo.info.symbol.replace(/^[A-G][#b]?/, '')) : 
          parentInfo.id.replace(/^[A-G][#b]?/, '');
          
        // Find the parent node ID using the chord type
        const parentNodeId = this.nodeMap.get(parentChordType);
        
        if (parentNodeId !== undefined) {
          // Create a link from parent to this node
          this.links.push({
            source: parentNodeId,
            target: nodeIndex,
            value: 1
          });
          
          console.log(`Created link from ${parentChordType} to ${chordId}`);
        } else {
          console.log(`Parent node not found: ${parentChordType} for child ${chordId}`);
        }
      }
      
      // Increment the level for the next generation if needed
      if (!parentInfo) {
        this.currentLevel++;
      }
    } else {
      // This chord already exists, create a link to it if there's a parent
      const targetNodeId = this.nodeMap.get(chordId);
      
      if (parentInfo) {
        const parentNodeId = this.nodeMap.get(parentInfo.id);
        
        if (parentNodeId !== undefined && parentNodeId !== targetNodeId) {
          // Check if this link already exists
          const linkExists = this.links.some(link => 
            link.source === parentNodeId && link.target === targetNodeId
          );
          
          if (!linkExists) {
            this.links.push({
              source: parentNodeId,
              target: targetNodeId,
              value: 1
            });
          }
        }
      }
    }
    
    // Update the visualization
    this.update();
    
    // Return the chord ID for reference
    return chordId;
  }
  
  // Update the 3D visualization
  update() {
    // Clear previous objects
    this.nodeObjects.forEach(obj => this.scene.remove(obj));
    this.linkObjects.forEach(obj => this.scene.remove(obj));
    
    this.nodeObjects = [];
    this.linkObjects = [];
    
    // Create planet textures if not already created
    if (!this.planetTextures) {
      this.createPlanetTextures();
    }
    
    // Create nodes (planets)
    this.nodes.forEach(node => {
      // Create planet based on chord type
      const planet = this.createPlanet(node.type);
      planet.position.set(node.x, node.y, node.z);
      planet.userData = { nodeId: node.id, type: node.type };
      
      // Add rotation animation
      planet.rotation.y = Math.random() * Math.PI * 2;
      planet.rotationSpeed = 0.002 + Math.random() * 0.005;
      
      this.scene.add(planet);
      this.nodeObjects.push(planet);
      
      // Add text label directly on the planet
      // We'll add the label to the planet object itself rather than as a separate sprite
      this.addLabelToPlanet(planet, node.type, node.x, node.y, node.z);
      
      // Add orbit ring
      const ringGeometry = new THREE.RingGeometry(8, 8.5, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: this.getChordColor(node.type),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(node.x, node.y, node.z);
      this.scene.add(ring);
      this.nodeObjects.push(ring);
    });
    
    // Create links (cosmic connections)
    this.links.forEach(link => {
      const source = this.nodes[link.source];
      const target = this.nodes[link.target];
      
      // Get colors for the connection based on source and target planets
      const sourceColor = this.getChordColor(source.type);
      const targetColor = this.getChordColor(target.type);
      
      // Create a curved path between planets to simulate orbital paths
      const curvePoints = [];
      const segments = 16; // More segments for smoother curves
      
      // Calculate a control point to create a curved path
      // For paths to/from the sun (G7), create more direct paths
      const isSunConnection = (source.x === 0 && source.y === 0 && source.z === 0) || 
                            (target.x === 0 && target.y === 0 && target.z === 0);
      
      // Create a curved path between the planets
      if (isSunConnection) {
        // More direct paths for sun connections, slight curve
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        const midZ = (source.z + target.z) / 2;
        
        // Add a small offset for the control point
        const offset = 15;
        const controlPoint = new THREE.Vector3(
          midX + (Math.random() - 0.5) * offset,
          midY + (Math.random() - 0.5) * offset,
          midZ + (Math.random() - 0.5) * offset
        );
        
        // Create a quadratic curve
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(source.x, source.y, source.z),
          controlPoint,
          new THREE.Vector3(target.x, target.y, target.z)
        );
        
        // Sample points along the curve
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          curvePoints.push(curve.getPoint(t));
        }
      } else {
        // More curved paths for planet-to-planet connections
        // Calculate the midpoint between source and target
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        const midZ = (source.z + target.z) / 2;
        
        // Create a significant offset for more dramatic curves
        const distance = Math.sqrt(
          Math.pow(target.x - source.x, 2) + 
          Math.pow(target.y - source.y, 2) + 
          Math.pow(target.z - source.z, 2)
        );
        
        const offset = distance * 0.5;
        const controlPoint = new THREE.Vector3(
          midX + (Math.random() - 0.5) * offset,
          midY + Math.abs(Math.random()) * offset, // Always curve upward a bit
          midZ + (Math.random() - 0.5) * offset
        );
        
        // Create a quadratic curve
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(source.x, source.y, source.z),
          controlPoint,
          new THREE.Vector3(target.x, target.y, target.z)
        );
        
        // Sample points along the curve
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          curvePoints.push(curve.getPoint(t));
        }
      }
      
      const curve = new THREE.CatmullRomCurve3(curvePoints);
      
      // Add tube with gradient material - make it thicker and more visible
      const tubeGeometry = new THREE.TubeGeometry(curve, 64, 1.5, 8, false);
      
      // Create custom shader material for the cosmic connection
      const tubeMaterial = new THREE.ShaderMaterial({
        uniforms: {
          color1: { value: new THREE.Color(sourceColor) },
          color2: { value: new THREE.Color(targetColor) }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 color1;
          uniform vec3 color2;
          varying vec2 vUv;
          void main() {
            gl_FragColor = vec4(mix(color1, color2, vUv.x), 0.9);
          }
        `,
        transparent: true
      });
      
      const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
      this.scene.add(tube);
      this.linkObjects.push(tube);
      
      // Add arrow at the end of the connection to show direction
      // Get the direction at the end of the curve (target)
      const endPoint = curve.getPoint(0.95); // Slightly before end to position arrow properly
      const tangent = curve.getTangent(0.95).normalize();
      
      // Create arrow cone
      const coneLength = 5;
      const coneRadius = 2;
      const coneGeometry = new THREE.ConeGeometry(coneRadius, coneLength, 8);
      const coneMaterial = new THREE.MeshBasicMaterial({ 
        color: targetColor,
        transparent: true,
        opacity: 0.8
      });
      
      const arrow = new THREE.Mesh(coneGeometry, coneMaterial);
      
      // Position the arrow at the end of the tube
      arrow.position.copy(endPoint);
      
      // Orient the arrow along the tube's direction
      // Create a quaternion to rotate from the default cone orientation (pointing up) to the tangent direction
      const upVector = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(upVector, tangent);
      arrow.setRotationFromQuaternion(quaternion);
      
      this.scene.add(arrow);
      this.linkObjects.push(arrow);
      
      // Add particles along the connection
      const particlesCount = 20;
      const particleGeometry = new THREE.SphereGeometry(0.3, 8, 8);
      
      for (let i = 0; i < particlesCount; i++) {
        const t = i / particlesCount;
        const point = curve.getPoint(t);
        
        // Interpolate color between source and target
        const color = new THREE.Color(sourceColor).lerp(new THREE.Color(targetColor), t);
        
        const particleMaterial = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.8
        });
        
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(point);
        
        // Add animation data
        particle.userData = {
          curve: curve,
          t: t,
          speed: 0.001 + Math.random() * 0.002,
          direction: Math.random() > 0.5 ? 1 : -1
        };
        
        this.scene.add(particle);
        this.linkObjects.push(particle);
      }
      
      // Note: Arrow is already added above using the curve tangent for better orientation
    });
    
    // Adjust camera to fit all nodes
    this.fitCameraToNodes();
  }
  
  // Create a text sprite for node labels
  createTextSprite(text) {
    // Format the text to display the chord type more clearly
    // If the text is empty (e.g., for the root dominant 7th chord), display '7'
    const displayText = text || '7';
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 128;
    
    // Clear background with semi-transparent white
    context.fillStyle = 'rgba(255, 255, 255, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw border
    context.strokeStyle = '#333';
    context.lineWidth = 4;
    context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    
    // Draw text
    context.font = 'bold 36px Arial';
    context.fillStyle = '#000066';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(displayText, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(15, 7.5, 1);
    
    return sprite;
  }
  
  // Add a label directly to a planet
  addLabelToPlanet(planet, text, x, y, z) {
    // Format the text to ensure it's not empty
    const displayText = text || '7';
    console.log(`Adding label to planet: ${displayText} at position (${x}, ${y}, ${z})`);
    
    // Create a canvas for the label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256; // Larger canvas for better text visibility
    canvas.height = 256;
    
    // Clear canvas with a circular background
    context.beginPath();
    context.arc(canvas.width/2, canvas.height/2, canvas.width/2, 0, Math.PI * 2);
    context.fillStyle = 'rgba(255, 255, 255, 0.9)'; // More opaque background
    context.fill();
    
    // Add a border
    context.lineWidth = 8; // Thicker border
    context.strokeStyle = '#000';
    context.stroke();
    
    // Add text
    context.font = 'bold 64px Arial'; // Larger font
    context.fillStyle = '#000';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(displayText, canvas.width/2, canvas.height/2);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    
    // Create a label plane that will always face the camera
    const labelGeometry = new THREE.PlaneGeometry(15, 15); // Larger label
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false // Ensures labels are always visible
    });
    
    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    
    // Position the label on the planet
    // For the sun (at center), position the label slightly offset
    if (x === 0 && y === 0 && z === 0) {
      label.position.set(0, 20, 0); // Higher position for the sun label
    } else {
      // For other planets, position the label at a fixed offset from the planet
      // This ensures it's always visible and not inside the planet
      label.position.set(0, 12, 0); // Position above the planet
      
      // Store original position for reference
      planet.userData.originalPosition = { x, y, z };
    }
    
    // Add the label as a child of the planet so it moves with it
    planet.add(label);
    
    // Make the label always face the camera
    planet.userData.isLabel = true;
    
    // Store the label in the planet's userData for easy access
    planet.userData.label = label;
    
    return label;
  }
  
  // Add a default G7 chord as the sun at startup
  addDefaultSun() {
    console.log('Adding default G7 sun planet');
    
    // Create a default G7 chord as the sun
    const g7Info = {
      name: 'G7',
      symbol: 'G7',
      fullSymbol: '7',
      quality: 'dominant',
      root: 'G'
    };
    
    // Add it to the visualization with a delay to ensure it's visible
    this.addChord(g7Info, null, true);
    
    // Force a redraw after a short delay to ensure the planet is visible
    setTimeout(() => {
      if (this.scene && this.camera && this.renderer) {
        console.log('Forcing redraw of G7 sun planet');
        this.renderer.render(this.scene, this.camera);
        
        // Adjust camera to focus on the sun
        if (this.nodeObjects.length > 0) {
          const sunPlanet = this.nodeObjects[0];
          this.camera.lookAt(sunPlanet.position);
          this.camera.position.z = 200;
          this.camera.updateProjectionMatrix();
        }
      }
    }, 500);
  }
  
  // Focus on a specific chord in the 3D graph
  focusOnChord(chordSymbol) {
    if (!chordSymbol || this.nodeObjects.length === 0) return false;
    
    console.log(`Focusing on chord: ${chordSymbol}`);
    
    // Find the node object that matches the chord symbol
    let targetNode = null;
    let targetIndex = -1;
    
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      if (node.symbol === chordSymbol) {
        targetIndex = i;
        break;
      }
    }
    
    if (targetIndex >= 0 && targetIndex < this.nodeObjects.length) {
      targetNode = this.nodeObjects[targetIndex];
    }
    
    // If we found the node, focus the camera on it
    if (targetNode) {
      console.log(`Found node for chord ${chordSymbol}`, targetNode);
      
      // Save the current camera position for animation
      const startPosition = this.camera.position.clone();
      const startTarget = this.controls.target.clone();
      
      // Set the new target position (the chord's position)
      const targetPosition = targetNode.position.clone();
      
      // Calculate a position slightly offset from the target for a good view
      const offset = new THREE.Vector3(30, 30, 80);
      const newCameraPosition = targetPosition.clone().add(offset);
      
      // Animate the camera movement
      const animationDuration = 1000; // 1 second
      const startTime = Date.now();
      
      const animateCamera = () => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / animationDuration, 1);
        
        // Use an easing function for smoother animation
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease out
        
        // Interpolate camera position
        this.camera.position.lerpVectors(startPosition, newCameraPosition, easeProgress);
        
        // Interpolate controls target
        this.controls.target.lerpVectors(startTarget, targetPosition, easeProgress);
        
        // Update the controls
        this.controls.update();
        
        // Continue animation if not complete
        if (progress < 1) {
          requestAnimationFrame(animateCamera);
        } else {
          // Highlight the target node temporarily
          if (targetNode.material) {
            const originalColor = targetNode.material.color.clone();
            const highlightColor = new THREE.Color(0xffff00); // Bright yellow
            
            targetNode.material.emissive = highlightColor;
            targetNode.material.needsUpdate = true;
            
            // Reset the highlight after a delay
            setTimeout(() => {
              targetNode.material.emissive = new THREE.Color(0x000000);
              targetNode.material.needsUpdate = true;
            }, 2000);
          }
        }
      };
      
      // Start the animation
      animateCamera();
      return true;
    }
    
    console.log(`Could not find node for chord ${chordSymbol}`);
    return false;
  }
  
  // Adjust camera to fit all nodes
  fitCameraToNodes() {
    if (this.nodes.length === 0) return;
    
    // Calculate bounding box
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    this.nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      minZ = Math.min(minZ, node.z);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
      maxZ = Math.max(maxZ, node.z);
    });
    
    // Center of bounding box
    const center = new THREE.Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
    );
    
    // Size of bounding box
    const size = new THREE.Vector3(
      maxX - minX,
      maxY - minY,
      maxZ - minZ
    );
    
    // Calculate distance to fit all nodes
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraDistance = (maxDim / 2) / Math.tan(fov / 2);
    
    // Add some padding
    cameraDistance *= 1.5;
    
    // Position camera
    const direction = new THREE.Vector3(0, 0, 1).normalize();
    this.camera.position.copy(center).add(direction.multiplyScalar(cameraDistance));
    this.camera.lookAt(center);
    
    // Update orbit controls target
    this.controls.target.copy(center);
    this.controls.update();
  }
  
  // Create textures for different planet types
  createPlanetTextures() {
    this.planetTextures = {
      // Base textures for different chord families
      'earth': this.createCanvasTexture(512, (ctx, canvas) => {
        // Earth-like texture for major chords
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#1E90FF');  // Blue
        gradient.addColorStop(0.5, '#4682B4'); // Steel blue
        gradient.addColorStop(1, '#87CEEB');   // Sky blue
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add continents
        ctx.fillStyle = '#228B22'; // Forest green
        for (let i = 0; i < 7; i++) {
          ctx.beginPath();
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const size = 20 + Math.random() * 60;
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Add cloud patterns
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        for (let i = 0; i < 10; i++) {
          ctx.beginPath();
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const size = 10 + Math.random() * 30;
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }),
      
      'mars': this.createCanvasTexture(512, (ctx, canvas) => {
        // Mars-like texture for dominant chords
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#CD5C5C');  // Indian red
        gradient.addColorStop(0.5, '#A52A2A'); // Brown
        gradient.addColorStop(1, '#8B0000');   // Dark red
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add craters
        ctx.fillStyle = '#D2691E'; // Chocolate
        for (let i = 0; i < 15; i++) {
          ctx.beginPath();
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const size = 5 + Math.random() * 20;
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Add polar ice caps
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(canvas.width/2, 20, 80, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(canvas.width/2, canvas.height - 20, 60, 0, Math.PI * 2);
        ctx.fill();
      }),
      
      'moon': this.createCanvasTexture(512, (ctx, canvas) => {
        // Moon-like texture for minor chords
        ctx.fillStyle = '#E0E0E0'; // Light gray
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add craters
        for (let i = 0; i < 20; i++) {
          ctx.beginPath();
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const size = 5 + Math.random() * 15;
          const shade = Math.floor(Math.random() * 40 + 150);
          ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }),
      
      'gas': this.createCanvasTexture(512, (ctx, canvas) => {
        // Gas giant texture for augmented/diminished chords (Jupiter-like)
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, '#F4A460');   // Sandy brown
        gradient.addColorStop(0.3, '#CD853F'); // Peru
        gradient.addColorStop(0.6, '#D2691E'); // Chocolate
        gradient.addColorStop(1, '#8B4513');   // Saddle brown
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add Jupiter-like bands
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          const y = i * canvas.height / 8 + Math.random() * 10;
          ctx.moveTo(0, y);
          for (let x = 0; x < canvas.width; x += 5) {
            const amplitude = 5 + Math.random() * 8;
            ctx.lineTo(x, y + Math.sin(x/20) * amplitude);
          }
          ctx.lineWidth = 15 + Math.random() * 25;
          const alpha = 0.2 + Math.random() * 0.3;
          const shade = Math.random() > 0.5 ? 'rgba(255,255,255,' + alpha + ')' : 'rgba(139,69,19,' + alpha + ')';
          ctx.strokeStyle = shade;
          ctx.stroke();
        }
        
        // Add the Great Red Spot
        ctx.beginPath();
        const spotX = canvas.width * 0.7;
        const spotY = canvas.height * 0.4;
        ctx.ellipse(spotX, spotY, 50, 30, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(178,34,34,0.7)'; // Firebrick with transparency
        ctx.fill();
      }),
      
      'lava': this.createCanvasTexture(512, (ctx, canvas) => {
        // Lava planet for sus chords
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#FF4500');   // Orange red
        gradient.addColorStop(0.5, '#FF8C00'); // Dark orange
        gradient.addColorStop(1, '#FF0000');   // Red
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add lava flows
        ctx.fillStyle = '#FFFF00'; // Yellow
        for (let i = 0; i < 10; i++) {
          ctx.beginPath();
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const width = 5 + Math.random() * 20;
          const height = 20 + Math.random() * 100;
          ctx.fillRect(x, y, width, height);
        }
      }),
      
      'ice': this.createCanvasTexture(512, (ctx, canvas) => {
        // Neptune-like ice planet for maj7 chords
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#4169E1');   // Royal blue
        gradient.addColorStop(0.5, '#1E90FF'); // Dodger blue
        gradient.addColorStop(1, '#00BFFF');   // Deep sky blue
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add white cloud patterns
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        for (let i = 0; i < 20; i++) {
          ctx.beginPath();
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const size = 10 + Math.random() * 40;
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Add the Great Dark Spot
        ctx.beginPath();
        const spotX = canvas.width * 0.6;
        const spotY = canvas.height * 0.3;
        ctx.ellipse(spotX, spotY, 60, 40, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(25,25,112,0.7)'; // Midnight blue with transparency
        ctx.fill();
      })
    };
  }
  
  // Helper to create canvas textures
  createCanvasTexture(size, drawFunction) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    drawFunction(ctx, canvas);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }
  
  // Create a planet based on chord type
  createPlanet(chordType) {
    const radius = 7;
    const planetType = this.getPlanetType(chordType);
    const planetColor = this.getChordColor(chordType);
    
    // Special case for G7 (the sun) - first chord in the visualization
    // With chord type-based approach, the sun will have chordType of '7' or similar
    // We also check if this is the first node (G7) which should always be the sun
    if ((chordType === '7' || chordType.includes('7')) && (this.nodes.length === 1 || this.nodes[0].name === '7')) {
      // Create a larger, glowing sun for G7
      const sunRadius = 15;
      const sunGeometry = new THREE.SphereGeometry(sunRadius, 32, 32);
      const sunMaterial = new THREE.MeshPhongMaterial({
        map: this.planetTextures[planetType],
        color: 0xffdd00,
        emissive: 0xffaa00,
        emissiveIntensity: 0.5,
        shininess: 20
      });
      
      const sun = new THREE.Mesh(sunGeometry, sunMaterial);
      
      // Store the original color and node ID in userData for tooltip functionality
      sun.userData = {
        originalColor: 0xffdd00,
        nodeId: 0 // The sun is always the first node (index 0)
      };
      
      // Add a glowing corona
      const coronaGeometry = new THREE.SphereGeometry(sunRadius + 3, 32, 32);
      const coronaMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide
      });
      const corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
      sun.add(corona);
      
      return sun;
    } 
    
    // For other chords, create planets with size based on chord complexity
    const complexity = chordType.length;
    const planetRadius = 5 + (complexity * 0.5);
    
    // Create geometry with more segments for better-looking planets
    const geometry = new THREE.SphereGeometry(planetRadius, 32, 32);
    
    // Create material with texture and color
    const material = new THREE.MeshPhongMaterial({
      map: this.planetTextures[planetType],
      color: planetColor,
      shininess: 70,
      emissive: new THREE.Color(planetColor).multiplyScalar(0.2)  // Add some glow based on the planet color
    });
    
    const planet = new THREE.Mesh(geometry, material);
    
    // Store the original color and node ID in userData for tooltip functionality
    // The actual nodeId will be set when the planet is created in addChord
    planet.userData = {
      originalColor: planetColor
    };
    
    // Add glowing atmosphere for all planets
    const atmosphereGeometry = new THREE.SphereGeometry(planetRadius + 0.8, 32, 32);
    const atmosphereMaterial = new THREE.MeshPhongMaterial({
      color: planetColor,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide,
      emissive: planetColor,
      emissiveIntensity: 0.4
    });
    
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    planet.add(atmosphere);
    
    return planet;
  }
  
  getPlanetType(chordType) {
    // Match each chord type to the most appropriate planet texture
    if (chordType.includes('Maj7') || chordType.includes('maj7') || chordType.includes('M7')) return 'ice';
    if (chordType === '7' && this.nodes.length <= 1) return 'mars'; // Sun (G7)
    if (chordType.includes('7')) return 'mars';
    if (chordType.includes('-') || chordType.includes('min') || chordType.includes('m7')) return 'moon';
    if (chordType.includes('o') || chordType.includes('dim')) return 'gas';
    if (chordType.includes('aug') || chordType.includes('+')) return 'lava';
    if (chordType.includes('sus')) return 'ice';
    if (chordType.includes('9') || chordType.includes('11') || chordType.includes('13')) return 'gas';
    if (chordType.includes('6')) return 'moon';
    if (chordType.includes('add')) return 'lava';
    return 'earth'; // Default for major chords
  }
  
  // Get color based on chord type
  getChordColor(chordType) {
    // Create a hash from the chord type to ensure consistent colors
    const hash = this.hashString(chordType);
    
    // Create a color palette with more diverse and realistic planet colors
    const colorPalette = {
      // Basic chord types - using realistic planet colors from our solar system and beyond
      '7': 0xFFA500,        // Orange-yellow (G7 - the sun)
      'Maj7': 0x4B0082,     // Deep indigo (Neptune-like)
      'maj7': 0x4B0082,     // Deep indigo (alternate spelling)
      'M7': 0x4B0082,       // Deep indigo (alternate spelling)
      'm7': 0x8B4513,       // Saddle brown (Mars-like)
      '-7': 0x8B4513,       // Saddle brown (alternate spelling)
      'min7': 0x8B4513,     // Saddle brown (alternate spelling)
      'dim7': 0x800080,     // Purple (exotic planet)
      'dim': 0xC71585,      // Medium violet red (exotic planet)
      'o7': 0x800080,       // Purple (alternate spelling)
      'ø7': 0xDA70D6,       // Orchid (half-diminished)
      'm7b5': 0xDA70D6,     // Orchid (half-diminished, alternate spelling)
      'aug': 0x006400,      // Dark green (exotic planet)
      '+': 0x006400,        // Dark green (alternate spelling)
      'sus4': 0xB87333,     // Copper (Mercury-like)
      'sus2': 0xCD853F,     // Peru (Venus-like)
      
      // Extended chords - gas giants and ice planets
      '9': 0xF4A460,        // Sandy brown (Jupiter-like)
      '11': 0xD2B48C,       // Tan (Saturn-like)
      '13': 0xE6E6FA,       // Lavender (Uranus-like)
      'm9': 0x483D8B,       // Dark slate blue (exotic planet)
      'Maj9': 0x00008B,     // Dark blue (exotic planet)
      
      // Added tone chords - exotic planets
      '6': 0x2E8B57,        // Sea green (exotic planet)
      'm6': 0x9400D3,       // Dark violet (exotic planet)
      'add9': 0x8FBC8F,     // Dark sea green (exotic planet)
      'add11': 0x9932CC,    // Dark orchid (exotic planet)
      
      // Altered chords - hot planets and lava worlds
      '7b9': 0x8B0000,      // Dark red (lava planet)
      '7#9': 0xB22222,      // Fire brick (lava planet)
      '7#11': 0xFF4500,     // Orange red (hot planet)
      '7b13': 0xA52A2A,     // Brown (hot planet)
      
      // Other interesting planets
      '5': 0x696969,        // Dim gray (asteroid-like)
      'sus': 0xDEB887,      // Burlywood (desert planet)
      'add': 0x556B2F,      // Dark olive green (forest planet)
      'm': 0xA0522D,        // Sienna (rocky planet)
      'maj': 0x6495ED,      // Cornflower blue (ocean planet)
      '': 0x708090         // Slate gray (default for unrecognized types)
    };
    
    // Try to find an exact match for the chord type
    for (const key in colorPalette) {
      if (chordType === key) {
        return colorPalette[key];
      }
    }
    
    // If no exact match, try to find a partial match
    for (const key in colorPalette) {
      if (key !== '' && chordType.includes(key)) {
        return colorPalette[key];
      }
    }
    
    // If still no match, generate a color based on the hash
    // This ensures that the same chord type always gets the same color
    return 0x1000000 + (hash % 0xEFFFFF); // Ensures we don't get too dark colors
  }

  // Generate a simple hash from a string
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
  
  // Clear the graph
  clear() {
    this.nodes = [];
    this.links = [];
    this.nodeMap.clear();
    this.currentLevel = 0;
    
    // Clear 3D objects
    this.nodeObjects.forEach(obj => this.scene.remove(obj));
    this.linkObjects.forEach(obj => this.scene.remove(obj));
    
    this.nodeObjects = [];
    this.linkObjects = [];
  }
}

// Add OrbitControls (simplified version)
THREE.OrbitControls = function(camera, domElement) {
  this.camera = camera;
  this.domElement = domElement;
  this.target = new THREE.Vector3();
  this.enableDamping = false;
  this.dampingFactor = 0.05;
  
  let rotateStart = new THREE.Vector2();
  let rotateEnd = new THREE.Vector2();
  let rotateDelta = new THREE.Vector2();
  
  let scope = this;
  let STATE = { NONE: -1, ROTATE: 0, DOLLY: 1, PAN: 2 };
  let state = STATE.NONE;
  
  this.update = function() {
    let offset = new THREE.Vector3();
    offset.copy(camera.position).sub(this.target);
    
    // Apply damping
    if (this.enableDamping) {
      offset.multiplyScalar(1 - this.dampingFactor);
    }
    
    camera.lookAt(this.target);
  };
  
  function onMouseDown(event) {
    event.preventDefault();
    
    if (event.button === 0) {
      state = STATE.ROTATE;
      rotateStart.set(event.clientX, event.clientY);
    }
  }
  
  function onMouseMove(event) {
    event.preventDefault();
    
    if (state === STATE.ROTATE) {
      rotateEnd.set(event.clientX, event.clientY);
      rotateDelta.subVectors(rotateEnd, rotateStart);
      
      // Rotate camera
      let element = scope.domElement;
      let theta = 2 * Math.PI * rotateDelta.x / element.clientWidth;
      let phi = 2 * Math.PI * rotateDelta.y / element.clientHeight;
      
      let position = scope.camera.position;
      let target = scope.target;
      
      // Calculate new position
      let offset = new THREE.Vector3().subVectors(position, target);
      let radius = offset.length();
      
      // Theta is longitude, phi is latitude
      let spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta -= theta * 0.5;
      spherical.phi -= phi * 0.5;
      
      // Clamp phi to avoid going below/above poles
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
      
      offset.setFromSpherical(spherical);
      position.copy(target).add(offset);
      
      scope.camera.lookAt(target);
      
      rotateStart.copy(rotateEnd);
    }
  }
  
  function onMouseUp() {
    state = STATE.NONE;
  }
  
  function onMouseWheel(event) {
    event.preventDefault();
    
    // Zoom in/out
    let delta = 0;
    if (event.wheelDelta !== undefined) {
      delta = event.wheelDelta;
    } else if (event.detail !== undefined) {
      delta = -event.detail;
    }
    
    if (delta > 0) {
      scope.camera.position.z -= 10;
    } else {
      scope.camera.position.z += 10;
    }
  }
  
  this.domElement.addEventListener('mousedown', onMouseDown, false);
  this.domElement.addEventListener('mousemove', onMouseMove, false);
  this.domElement.addEventListener('mouseup', onMouseUp, false);
  this.domElement.addEventListener('mousewheel', onMouseWheel, false);
  this.domElement.addEventListener('DOMMouseScroll', onMouseWheel, false); // Firefox
};

export default Chord3DGraph;
