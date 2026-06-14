// Figma plugin: Replace challenge section icons with appropriate Phosphor icons
// Run in Figma: Plugins → Development → Open Console, paste and run

(async () => {
  // ── 1. Load all pages ──────────────────────────────────────────────────────
  for (const pg of figma.root.children) {
    await pg.loadAsync();
  }

  // ── 2. Find frame 392:63191 ────────────────────────────────────────────────
  function findById(node, id) {
    if (node.id === id) return node;
    if ('children' in node) {
      for (const child of node.children) {
        const r = findById(child, id);
        if (r) return r;
      }
    }
    return null;
  }

  let targetFrame = null;
  for (const pg of figma.root.children) {
    targetFrame = findById(pg, '392:63191');
    if (targetFrame) break;
  }

  if (!targetFrame) {
    figma.notify('❌ Frame 392:63191 not found');
    figma.closePlugin();
    return;
  }

  // ── 3. Icon definitions (Phosphor Regular, 256×256 viewBox) ───────────────
  // Order matches the 3×3 grid: row-major (left→right, top→bottom)
  const ICONS = [
    {
      label: 'Multiple legacy systems → Browsers',
      paths: [
        'M216,40H72A16,16,0,0,0,56,56V72H40A16,16,0,0,0,24,88V200a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V184h16a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM184,88v16H40V88Zm0,112H40V120H184v80Zm32-32H200V88a16,16,0,0,0-16-16H72V56H216Z'
      ],
      color: { r: 0.231, g: 0.510, b: 0.965 }, // blue
    },
    {
      label: '260 engineers, 20+ teams → UsersThree',
      paths: [
        'M244.8,150.4a8,8,0,0,1-11.2-1.6A51.6,51.6,0,0,0,192,128a8,8,0,0,1-7.37-4.89,8,8,0,0,1,0-6.22A8,8,0,0,1,192,112a24,24,0,1,0-23.24-30,8,8,0,1,1-15.5-4A40,40,0,1,1,219,117.51a67.94,67.94,0,0,1,27.43,21.68A8,8,0,0,1,244.8,150.4ZM190.92,212a8,8,0,1,1-13.84,8,57,57,0,0,0-98.16,0,8,8,0,1,1-13.84-8,72.06,72.06,0,0,1,33.74-29.92,48,48,0,1,1,58.36,0A72.06,72.06,0,0,1,190.92,212ZM128,176a32,32,0,1,0-32-32A32,32,0,0,0,128,176ZM72,120a8,8,0,0,0-8-8A24,24,0,1,1,87.24,82a8,8,0,1,0,15.5-4A40,40,0,1,0,37,117.51,67.94,67.94,0,0,0,9.6,139.19a8,8,0,1,0,12.8,9.61A51.6,51.6,0,0,1,64,128,8,8,0,0,0,72,120Z'
      ],
      color: { r: 0.918, g: 0.702, b: 0.031 }, // amber
    },
    {
      label: 'No design foundation → Compass',
      paths: [
        'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Z',
        'M172.42,72.84l-64,32a8.05,8.05,0,0,0-3.58,3.58l-32,64A8,8,0,0,0,80,184a8.1,8.1,0,0,0,3.58-.84l64-32a8.05,8.05,0,0,0,3.58-3.58l32-64a8,8,0,0,0-10.74-10.74ZM138,138,97.89,158.11,118,118l40.15-20.07Z'
      ],
      color: { r: 0.231, g: 0.510, b: 0.965 },
    },
    {
      label: '170+ countries, many workflows → Globe',
      paths: [
        'M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm88,104a87.61,87.61,0,0,1-3.33,24H174.16a157.44,157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48ZM40,128a87.61,87.61,0,0,1,3.33-24H81.84a157.44,157.44,0,0,0,0,48H43.33A87.61,87.61,0,0,1,40,128ZM154,88H102a115.11,115.11,0,0,1,26-45A115.27,115.27,0,0,1,154,88Zm52.33,0H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM107.59,42.4A135.28,135.28,0,0,0,85.29,88H49.63A88.29,88.29,0,0,1,107.59,42.4ZM49.63,168H85.29a135.28,135.28,0,0,0,22.3,45.6A88.29,88.29,0,0,1,49.63,168Zm98.78,45.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41,213.6Z'
      ],
      color: { r: 0.231, g: 0.510, b: 0.965 },
    },
    {
      label: 'Highly technical domain → Cpu',
      paths: [
        'M152,96H104a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V104A8,8,0,0,0,152,96Zm-8,48H112V112h32Zm88,0H216V112h16a8,8,0,0,0,0-16H216V56a16,16,0,0,0-16-16H160V24a8,8,0,0,0-16,0V40H112V24a8,8,0,0,0-16,0V40H56A16,16,0,0,0,40,56V96H24a8,8,0,0,0,0,16H40v32H24a8,8,0,0,0,0,16H40v40a16,16,0,0,0,16,16H96v16a8,8,0,0,0,16,0V216h32v16a8,8,0,0,0,16,0V216h40a16,16,0,0,0,16-16V160h16a8,8,0,0,0,0-16Zm-32,56H56V56H200v95.87s0,.09,0,.13,0,.09,0,.13V200Z'
      ],
      color: { r: 0.231, g: 0.510, b: 0.965 },
    },
    {
      label: 'Engineering-led roadmap → GitBranch',
      paths: [
        'M232,64a32,32,0,1,0-40,31v17a8,8,0,0,1-8,8H96a23.84,23.84,0,0,0-8,1.38V95a32,32,0,1,0-16,0v66a32,32,0,1,0,16,0V144a8,8,0,0,1,8-8h88a24,24,0,0,0,24-24V95A32.06,32.06,0,0,0,232,64ZM64,64A16,16,0,1,1,80,80,16,16,0,0,1,64,64ZM96,192a16,16,0,1,1-16-16A16,16,0,0,1,96,192ZM200,80a16,16,0,1,1,16-16A16,16,0,0,1,200,80Z'
      ],
      color: { r: 0.420, g: 0.447, b: 0.502 }, // slate
    },
    {
      label: 'No design authority → Prohibit',
      paths: [
        'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm88,104a87.56,87.56,0,0,1-20.41,56.28L71.72,60.4A88,88,0,0,1,216,128ZM40,128A87.56,87.56,0,0,1,60.41,71.72L184.28,195.6A88,88,0,0,1,40,128Z'
      ],
      color: { r: 0.231, g: 0.510, b: 0.965 },
    },
    {
      label: 'Cultural shift required → ArrowsClockwise',
      paths: [
        'M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z'
      ],
      color: { r: 0.231, g: 0.510, b: 0.965 },
    },
    {
      label: 'Distributed team → Graph',
      paths: [
        'M200,152a31.84,31.84,0,0,0-19.53,6.68l-23.11-18A31.65,31.65,0,0,0,160,128c0-.74,0-1.48-.08-2.21l13.23-4.41A32,32,0,1,0,168,104c0,.74,0,1.48.08,2.21l-13.23,4.41A32,32,0,0,0,128,96a32.59,32.59,0,0,0-5.27.44L115.89,81A32,32,0,1,0,96,88a32.59,32.59,0,0,0,5.27-.44l6.84,15.4a31.92,31.92,0,0,0-8.57,39.64L73.83,165.44a32.06,32.06,0,1,0,10.63,12l25.71-22.84a31.91,31.91,0,0,0,37.36-1.24l23.11,18A31.65,31.65,0,0,0,168,184a32,32,0,1,0,32-32Zm0-64a16,16,0,1,1-16,16A16,16,0,0,1,200,88ZM80,56A16,16,0,1,1,96,72,16,16,0,0,1,80,56ZM56,208a16,16,0,1,1,16-16A16,16,0,0,1,56,208Zm56-80a16,16,0,1,1,16,16A16,16,0,0,1,112,128Zm88,72a16,16,0,1,1,16-16A16,16,0,0,1,200,200Z'
      ],
      color: { r: 0.231, g: 0.510, b: 0.965 },
    },
  ];

  // ── 4. Find the 3×3 challenge grid ────────────────────────────────────────
  function findTextNode(node, substr) {
    if (node.type === 'TEXT' && node.characters.toLowerCase().includes(substr.toLowerCase())) return node;
    if ('children' in node) {
      for (const child of node.children) {
        const r = findTextNode(child, substr);
        if (r) return r;
      }
    }
    return null;
  }

  function findGrid(node) {
    if (node.type === 'FRAME' && node.layoutMode === 'VERTICAL' && 'children' in node) {
      const rows = node.children.filter(
        c => c.type === 'FRAME' && c.layoutMode === 'HORIZONTAL' && c.children && c.children.length === 3
      );
      if (rows.length === 3) return node;
    }
    if ('children' in node) {
      for (const child of node.children) {
        const r = findGrid(child);
        if (r) return r;
      }
    }
    return null;
  }

  // Find challenge section via "Nine forces" headline
  const headlineNode = findTextNode(targetFrame, 'Nine forces');
  if (!headlineNode) {
    figma.notify('❌ "Nine forces" headline not found in frame');
    figma.closePlugin();
    return;
  }

  // Walk up from headline to find a parent that contains the grid
  let searchRoot = headlineNode.parent;
  let grid = null;
  while (searchRoot && searchRoot.id !== targetFrame.id) {
    grid = findGrid(searchRoot);
    if (grid) break;
    searchRoot = searchRoot.parent;
  }
  if (!grid) grid = findGrid(targetFrame); // fallback: search whole frame

  if (!grid) {
    figma.notify('❌ 3×3 challenge grid not found');
    figma.closePlugin();
    return;
  }

  // Collect 9 cards in row-major order
  const cards = [];
  for (const row of grid.children) {
    if (row.layoutMode === 'HORIZONTAL') {
      for (const card of row.children) cards.push(card);
    }
  }

  if (cards.length !== 9) {
    figma.notify(`❌ Expected 9 cards, found ${cards.length}`);
    figma.closePlugin();
    return;
  }

  // ── 5. Apply color recursively to vectors ─────────────────────────────────
  function applyFill(node, color) {
    if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION' || node.type === 'STAR' || node.type === 'ELLIPSE' || node.type === 'POLYGON' || node.type === 'RECTANGLE') {
      node.fills = [{ type: 'SOLID', color }];
    }
    if ('children' in node) {
      for (const child of node.children) applyFill(child, color);
    }
  }

  // ── 6. Replace icons ───────────────────────────────────────────────────────
  let replaced = 0;

  for (let i = 0; i < 9; i++) {
    const card = cards[i];
    const iconDef = ICONS[i];

    // The icon is the first non-text child of the card
    let oldIcon = null;
    for (const child of card.children) {
      if (child.type !== 'TEXT') { oldIcon = child; break; }
    }
    if (!oldIcon) {
      console.warn(`Card ${i}: no icon node found`);
      continue;
    }

    const insertIdx = card.children.indexOf(oldIcon);
    const iconSize = Math.round(Math.max(oldIcon.width, oldIcon.height)) || 32;

    // Build SVG string (32×32 output, 256×256 viewBox)
    const pathsHtml = iconDef.paths.map(d => `<path d="${d}" fill="black"/>`).join('');
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 256 256">${pathsHtml}</svg>`;

    // Create vector node from SVG
    const newIcon = figma.createNodeFromSvg(svgStr);
    newIcon.name = `icon-${i}`;

    // Colour all vector children
    applyFill(newIcon, iconDef.color);

    // Lock sizing so it stays fixed in auto-layout
    if ('layoutSizingHorizontal' in newIcon) newIcon.layoutSizingHorizontal = 'FIXED';
    if ('layoutSizingVertical'   in newIcon) newIcon.layoutSizingVertical   = 'FIXED';

    // Insert at same position, remove old
    card.insertChild(insertIdx, newIcon);
    oldIcon.remove();

    console.log(`✓ ${iconDef.label}`);
    replaced++;
  }

  figma.notify(`✅ Replaced ${replaced}/9 challenge icons`);
  figma.closePlugin();
})();
