/**
 * Neuralab 3D Interactive Synaptic Constellation Engine
 * First-Principles 3D Perspective Projection & Raycasting
 * Industrial Systems Minimalism (Terminal Emerald & Obsidian)
 * Architected by Anay Upadhyay
 */

(function () {
  const canvas = document.getElementById('neural3dCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  // 3D Nodes Definition aligned with Systems Engineering curriculum
  const DOMAIN_LABELS = [
    { title: 'C++ Systems & RAII', category: 'Low-Level', color: '#10b981' },
    { title: 'Rust Fearless Concurrency', category: 'Memory', color: '#34d399' },
    { title: 'WebCore & Compositor', category: 'Blink', color: '#38bdf8' },
    { title: 'HTTP/3 QUIC & WebRTC', category: 'Network', color: '#10b981' },
    { title: 'LSM-Trees & Raft', category: 'Storage', color: '#f59e0b' },
    { title: 'V8 JIT & Bytecode', category: 'Runtimes', color: '#a78bfa' },
    { title: 'Reactive Primitives', category: 'UI Core', color: '#34d399' },
    { title: 'gRPC & Protobuf', category: 'APIs', color: '#06b6d4' },
    { title: 'ARM Bare-Metal & RTOS', category: 'Embedded', color: '#f43f5e' },
    { title: 'Cloud-Native & CQRS', category: 'Enterprise', color: '#10b981' },
    { title: 'Transformers & FlashAttn-2', category: 'Neural AI', color: '#8b5cf6' },
    { title: 'WebGPU Tensor Lab', category: 'Compute', color: '#06b6d4' },
    { title: 'Python 3.13 No-GIL', category: 'Data', color: '#fbbf24' },
    { title: 'GPU Shaders & WebGL', category: 'Graphics', color: '#ec4899' },
    { title: 'Quantum Qubits & Qiskit', category: 'Quantum', color: '#a855f7' },
    { title: 'Binary Exploitation & ROP', category: 'Security', color: '#ef4444' },
    { title: 'Linux eBPF & SRE', category: 'Kernel', color: '#10b981' },
    { title: 'Multi-Raft Consensus', category: 'Distributed', color: '#f97316' }
  ];

  const NUM_NODES = 42;
  const nodes = [];
  const edges = [];
  const pulses = [];

  // Generate 3D Spherical Coordinate Nodes
  for (let i = 0; i < NUM_NODES; i++) {
    const phi = Math.acos(-1 + (2 * i) / NUM_NODES);
    const theta = Math.sqrt(NUM_NODES * Math.PI) * phi;
    const r = 260 + (Math.random() - 0.5) * 80;

    const labelData = DOMAIN_LABELS[i % DOMAIN_LABELS.length];
    nodes.push({
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi),
      baseX: 0,
      baseY: 0,
      baseZ: 0,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      vz: (Math.random() - 0.5) * 0.18,
      radius: i < DOMAIN_LABELS.length ? 5.0 : 2.2,
      title: i < DOMAIN_LABELS.length ? labelData.title : null,
      color: labelData.color,
      isCore: i < DOMAIN_LABELS.length,
      hovered: false
    });
  }

  // Create Interconnected Neural Synaptic Edges
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dz = nodes[i].z - nodes[j].z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 160) {
        edges.push({ a: i, b: j, dist });
      }
    }
  }

  // Synaptic Energy Pulses
  function spawnPulse() {
    if (edges.length === 0) return;
    const edge = edges[Math.floor(Math.random() * edges.length)];
    pulses.push({
      edge,
      progress: 0,
      speed: 0.015 + Math.random() * 0.02
    });
  }
  setInterval(spawnPulse, 180);

  // 3D Camera & Parallax State
  let rotX = 0.2;
  let rotY = 0;
  let targetRotX = 0.2;
  let targetRotY = 0;
  let mouseX = 0;
  let mouseY = 0;
  let hoveredNode = null;

  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - width / 2);
    mouseY = (e.clientY - height / 2);
    targetRotY = (mouseX / width) * 0.9;
    targetRotX = (mouseY / height) * 0.6;
  });

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  // Perspective Projection: 3D point -> 2D Screen
  const fov = 480;
  function project(p, cx, cy) {
    // 3D Rotation matrices (Euler yaw & pitch)
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const x1 = p.x * cosY + p.z * sinY;
    const z1 = -p.x * sinY + p.z * cosY;

    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const y2 = p.y * cosX - z1 * sinX;
    const z2 = p.y * sinX + z1 * cosX;

    const distance = 650;
    const zTotal = z2 + distance;
    if (zTotal <= 20) return null;

    const scale = fov / zTotal;
    return {
      x: cx + x1 * scale,
      y: cy + y2 * scale,
      scale,
      depth: zTotal,
      rawZ: z2
    };
  }

  // Animation Loop (60 FPS)
  function render() {
    ctx.clearRect(0, 0, width, height);

    // Smooth camera damping
    rotX += (targetRotX - rotX) * 0.04;
    rotY += (targetRotY - rotY) * 0.04;

    // Center offset (shift slightly right for desktop hero layout)
    const cx = width > 900 ? width * 0.64 : width * 0.5;
    const cy = height * 0.5;

    // Update Node positions & gentle oscillation
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      n.x += n.vx;
      n.y += n.vy;
      n.z += n.vz;

      // Soft boundary bounce
      const d = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
      if (d > 300) {
        n.vx *= -1;
        n.vy *= -1;
        n.vz *= -1;
      }
    }

    // Project all nodes
    const projectedNodes = [];
    hoveredNode = null;
    let closestHoverDist = 24;

    for (let i = 0; i < nodes.length; i++) {
      const proj = project(nodes[i], cx, cy);
      projectedNodes.push(proj);

      if (proj && nodes[i].isCore) {
        const dx = (mouseX + width / 2) - proj.x;
        const dy = (mouseY + height / 2) - proj.y;
        const screenDist = Math.sqrt(dx * dx + dy * dy);
        if (screenDist < closestHoverDist) {
          closestHoverDist = screenDist;
          hoveredNode = i;
        }
      }
    }

    // Draw Synaptic Edges
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const p1 = projectedNodes[e.a];
      const p2 = projectedNodes[e.b];
      if (!p1 || !p2) continue;

      const avgDepth = (p1.depth + p2.depth) / 2;
      const alpha = Math.max(0.04, Math.min(0.40, 1 - (avgDepth - 350) / 450));
      
      const isHighlighted = (hoveredNode === e.a || hoveredNode === e.b);
      
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = isHighlighted 
        ? 'rgba(16, 185, 129, 0.85)' 
        : `rgba(255, 255, 255, ${alpha * 0.28})`;
      ctx.lineWidth = isHighlighted ? 1.8 : 0.75;
      ctx.stroke();
    }

    // Draw Synaptic Pulses
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.progress += p.speed;
      if (p.progress >= 1) {
        pulses.splice(i, 1);
        continue;
      }

      const p1 = projectedNodes[p.edge.a];
      const p2 = projectedNodes[p.edge.b];
      if (!p1 || !p2) continue;

      const px = p1.x + (p2.x - p1.x) * p.progress;
      const py = p1.y + (p2.y - p1.y) * p.progress;

      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#10b981';
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Draw Nodes (Sorted by depth for true 3D z-buffering)
    const sortedIndices = nodes.map((_, i) => i)
      .filter(i => projectedNodes[i] !== null)
      .sort((a, b) => projectedNodes[b].depth - projectedNodes[a].depth);

    for (const idx of sortedIndices) {
      const proj = projectedNodes[idx];
      const node = nodes[idx];
      const isHovered = (hoveredNode === idx);

      const r = node.radius * proj.scale * 1.4;
      const alpha = Math.max(0.2, Math.min(1, 1 - (proj.depth - 400) / 500));

      ctx.beginPath();
      ctx.arc(proj.x, proj.y, isHovered ? r * 1.8 : r, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? '#34d399' : node.color;
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = isHovered ? 20 : (node.isCore ? 10 : 3);
      ctx.shadowColor = isHovered ? '#10b981' : node.color;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;

      // Draw Label if hovered or core in front
      if (node.isCore && (isHovered || (proj.rawZ < 50 && proj.scale > 0.85))) {
        ctx.font = isHovered 
          ? '600 11px "Geist Mono", "JetBrains Mono", ui-monospace, monospace' 
          : '500 10px "Geist Mono", "JetBrains Mono", ui-monospace, monospace';
        ctx.fillStyle = isHovered ? '#34d399' : 'rgba(248, 250, 252, 0.85)';
        ctx.textAlign = 'center';
        ctx.fillText(node.title, proj.x, proj.y - (r + 7));
      }
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
