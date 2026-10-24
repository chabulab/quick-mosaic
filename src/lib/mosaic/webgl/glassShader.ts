export const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aPos;

// Maps clip-space [-1,1] to uv [0,1] (vUv origin bottom-left)
out vec2 vUv;

void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;

uniform sampler2D uSource;
uniform vec2 uImageSize;   // source image pixel dimensions
uniform vec2 uScale;       // letterbox scale (fit image into canvas)
uniform vec2 uOffset;      // letterbox offset (uv)
uniform int uShape;        // 0 voronoi, 1 hexagon, 2 triangle, 3 square
uniform float uTile;       // tile size in source pixels
uniform float uJitter;     // 0..1
uniform float uRefraction; // px offset
uniform float uFrost;      // blur strength
uniform float uOpacity;    // 0..1
uniform vec3 uGroutColor;
uniform float uGroutWidth; // px
uniform float uBevel;      // 0 or 1
uniform vec3 uLightDir;    // normalized light direction

out vec4 outColor;

const float PI = 3.14159265359;

// --- hashing (for deterministic per-cell randomness) ---
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// --- grid generation ---
// Returns { id (cell id), center, radius, borderDist }
struct Cell {
  vec2 center;
  vec2 id;
  float radius;
  float borderDist; // distance (px) from point to nearest cell border
};

// Voronoi: nearest of jittered lattice points
Cell voronoiCell(vec2 p) {
  float cellSize = uTile;
  vec2 cellCoord = p / cellSize;
  vec2 base = floor(cellCoord);

  float d1 = 1e9, d2 = 1e9;
  vec2 seed1 = vec2(0.0), seed2 = vec2(0.0);
  vec2 id1 = vec2(0.0);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 cell = base + vec2(float(x), float(y));
      vec2 jitter = (hash22(cell) - 0.5) * uJitter;
      vec2 seed = cell + jitter;
      vec2 delta = seed - cellCoord;
      float d = dot(delta, delta);
      if (d < d1) {
        d2 = d1; seed2 = seed1;
        d1 = d; seed1 = seed; id1 = cell;
      } else if (d < d2) {
        d2 = d; seed2 = seed;
      }
    }
  }

  // cell radius ~ distance to nearest seed (scaled). Approx by cellSize/2 * avg
  float radius = cellSize * 0.7;
  // distance to nearest voronoi edge ~ half-difference of distances to nearest seeds
  float borderDist = (sqrt(d2) - sqrt(d1)) * 0.5;
  return Cell(seed1 * cellSize, id1, radius, borderDist);
}

// Regular square grid
Cell squareCell(vec2 p) {
  vec2 cell = floor(p / uTile);
  vec2 center = (cell + 0.5) * uTile;
  vec2 halfS = vec2(uTile) * 0.5;
  vec2 border = min(p - (center - halfS), (center + halfS) - p);
  float borderDist = min(border.x, border.y);
  return Cell(center, cell, uTile * 0.7071, borderDist);
}

// Pointy-top hex grid (regular honeycomb)
Cell hexCell(vec2 p) {
  float s = uTile * 0.5;                // center-to-vertex radius
  float sqrt3 = sqrt(3.0);
  float colSpacing = sqrt3 * s;         // horizontal distance between columns
  float rowSpacing = 1.5 * s;           // vertical distance between rows

  // estimate candidate base (round to nearest row)
  float row = round(p.y / rowSpacing);
  float col = round((p.x - (mod(row, 2.0) < 1.0 ? 0.0 : colSpacing * 0.5)) / colSpacing);

  vec2 best = vec2(0.0);
  float bestD = 1e9;
  vec2 bestId = vec2(0.0);
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      float c = col + float(dx);
      float r = row + float(dy);
      float hx = c * colSpacing + (mod(r, 2.0) < 1.0 ? 0.0 : colSpacing * 0.5);
      float hy = r * rowSpacing;
      vec2 center = vec2(hx, hy);
      float d = distance(p, center);
      if (d < bestD) { bestD = d; best = center; bestId = vec2(c, r); }
    }
  }
  // apothem (center to flat edge) = s * sqrt(3)/2
  float apothem = s * sqrt3 * 0.5;
  float borderDist = max(apothem - bestD, 0.0);
  return Cell(best, bestId, s, borderDist);
}

// Triangular grid (equilateral triangles, alternating up/down)
Cell triCell(vec2 p) {
  float s = uTile;                      // triangle side length
  float h = s * sqrt(3.0) * 0.5;        // triangle height (altitude)
  float rowOffset = s * 0.5;            // horizontal offset between odd rows

  // base parallelogram cell containing the point
  float row = floor(p.y / h);
  float rowShift = mod(row, 2.0) < 1.0 ? 0.0 : rowOffset;
  float col = floor((p.x - rowShift) / s);

  // each parallelogram cell (s x h) holds one up-triangle and one down-triangle
  vec2 best = vec2(0.0);
  float bestD = 1e9;
  vec2 bestId = vec2(0.0);
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      float c = col + float(dx);
      float r = row + float(dy);
      float bx = c * s + (mod(r, 2.0) < 1.0 ? 0.0 : rowOffset);
      float by = r * h;
      // up triangle centroid (base at bottom, apex at top)
      vec2 up = vec2(bx + s * 0.5, by + h * (1.0 / 3.0));
      // down triangle centroid (apex at bottom, base at top)
      vec2 dn = vec2(bx + s * 0.5, by + h * (2.0 / 3.0));
      float du = distance(p, up);
      float dd = distance(p, dn);
      if (du < bestD) { bestD = du; best = up; bestId = vec2(c, r); }
      if (dd < bestD) { bestD = dd; best = dn; bestId = vec2(c, r); }
    }
  }
  // distance to nearest triangle edge: inradius - dist-to-centroid
  // (0 on edges/vertices, max at centroid)
  float inradius = h * (1.0 / 3.0);
  float borderDist = max(inradius - bestD, 0.0);
  return Cell(best, bestId, s * 0.5, borderDist);
}

// sample source texture with refraction + optional frost (mip LOD)
vec3 sampleGlass(vec2 uv, vec2 centerPx) {
  vec2 p = uv * uImageSize;
  vec2 d = p - centerPx;
  float dist = length(d);

  // convex-lens refraction: bend outward, strongest near edges
  vec2 n = dist > 1e-4 ? d / dist : vec2(0.0);
  float edge01 = clamp(dist / (uTile * 0.7), 0.0, 1.0);
  vec2 offset = n * uRefraction * edge01;

  vec2 refUv = clamp((p + offset) / uImageSize, 0.0, 1.0);

  if (uFrost > 0.001) {
    float lod = uFrost * 0.6 * (0.3 + edge01 * 0.7);
    return textureLod(uSource, refUv, lod).rgb;
  }
  return texture(uSource, refUv).rgb;
}

void main() {
  // Letterbox: map canvas uv -> image uv, discard outside image
  vec2 imgUv = (vUv - uOffset) / uScale;
  if (imgUv.x < 0.0 || imgUv.x > 1.0 || imgUv.y < 0.0 || imgUv.y > 1.0) {
    outColor = vec4(uGroutColor, 1.0);
    return;
  }

  vec2 p = imgUv * uImageSize;

  Cell cell;
  if (uShape == 0) cell = voronoiCell(p);
  else if (uShape == 1) cell = hexCell(p);
  else if (uShape == 2) cell = triCell(p);
  else cell = squareCell(p);

  vec2 cDist = p - cell.center;
  float distFromCenter = length(cDist);
  float cellRadius = max(cell.radius, 1e-4);
  float inside01 = clamp(distFromCenter / cellRadius, 0.0, 1.0);

  // --- source color with refraction ---
  vec3 src = sampleGlass(imgUv, cell.center);

  // --- glass shading ---
  // pseudo-normal: convex dome (center higher, edges tilt outward)
  float dome = sqrt(max(0.0, 1.0 - inside01 * inside01));
  vec2 n2 = distFromCenter > 1e-4 ? cDist / distFromCenter : vec2(0.0);
  vec3 normal = normalize(vec3(n2 * 0.35, dome * 0.9 + 0.1));

  // half vector (view = (0,0,1))
  vec3 L = normalize(uLightDir);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float ndotl = max(dot(normal, L), 0.0);

  // specular (glass highlights)
  float spec = pow(max(dot(normal, H), 0.0), 48.0) * (0.5 + 0.5 * inside01);

  // fresnel: more reflectivity at grazing angles (edges)
  float fresnel = pow(1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0), 4.0) * 0.4;

  // opacity blend with grout background
  float alpha = clamp(uOpacity + fresnel * 0.6, 0.0, 1.0);
  vec3 color = mix(uGroutColor, src, alpha);

  // depth tint: thicker center slightly bluish
  float thickness = 1.0 - inside01;
  color += vec3(0.0, 0.02, 0.04) * thickness;

  // edge darkening near borders
  float edgeDarken = clamp(cell.borderDist / (uTile * 0.35), 0.0, 1.0);
  color *= 0.75 + 0.25 * edgeDarken;

  // specular + fresnel light contribution (white-ish glass reflection)
  color += vec3(1.0) * (spec * uBevel + fresnel * uBevel) * (0.5 + 0.5 * ndotl);

  // --- grout lines + bevel catch light ---
  float groutHalf = uGroutWidth * 0.5;
  float groutMask = 1.0 - smoothstep(groutHalf - 1.0, groutHalf + 1.0, cell.borderDist);
  vec3 finalColor = mix(color, uGroutColor, groutMask);

  // bevel: bright band just inside each glass edge
  if (uBevel > 0.5) {
    float bevelBand = smoothstep(0.0, 1.5, cell.borderDist) *
                      smoothstep(5.0, 1.5, cell.borderDist);
    float bevelLight = bevelBand * (0.35 + 0.65 * max(ndotl, 0.0));
    finalColor = mix(finalColor, finalColor + vec3(0.5, 0.55, 0.6) * bevelLight, bevelBand * 0.8);
  }

  outColor = vec4(finalColor, 1.0);
}
`;
