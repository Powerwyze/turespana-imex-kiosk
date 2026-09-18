# Blender sun avatar

The avatar is real extruded geometry built by scripts/create-host-avatar.py in Blender on GitHub Actions. Source: https://www.spain.info/export/sites/segtur/.content/images/logo512.png (official web-app manifest). The source PNG is retained for reproducible tracing but is never shown in the interface.

Only the upper sun symbol is traced: yellow crescent, black ring/star and red centre. The España wordmark and white pixels are excluded. Closed contour shapes become filled Blender curves with depth and beveled edges, then actual meshes exported as public/assets/spain-sun.glb. Editable source: design/spain-sun.blend. The fallback SVG contains only those same coloured contours on a transparent background.

Three.js lights and gently turns the geometry to show depth. Outgoing voice energy adds a small uniform pulse. Reduced-motion mode fixes the orientation and scale. No invented face, mouth or eyes; Lola’s voice, captions and kiosk flow stay intact.
