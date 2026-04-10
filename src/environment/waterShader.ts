/**
 * GLSL vertex + fragment shader strings for Gerstner wave ocean rendering.
 * The vertex shader applies the same Gerstner formula as gerstnerWaves.ts (CPU mirror).
 */

const NUM_WAVES = '8';
const WAVE_DATA_LENGTH = '56'; // 8 waves * 7 floats per wave

/**
 * Vertex shader: displaces a subdivided XZ plane using Gerstner waves.
 *
 * Uniforms:
 *   uTime — elapsed time in seconds
 *   uWaveData — flat array encoding 8 waves:
 *     per wave: [dirX, dirZ, steepness, wavelength, amplitude, speed, phase] = 7 floats
 */
export const vertexShader = /* glsl */ `
  #define NUM_WAVES ${NUM_WAVES}
  #define TWO_PI 6.28318530718
  #define GRAVITY 9.8

  uniform float uTime;
  // Each wave: dirX, dirZ, steepness, wavelength, amplitude, speed, phase (7 floats per wave)
  uniform float uWaveData[${WAVE_DATA_LENGTH}];

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vHeight;
  varying float vFoam;

  // Hash-based noise for spatial amplitude modulation
  float vertHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float vertNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = vertHash(i);
    float b = vertHash(i + vec2(1.0, 0.0));
    float c = vertHash(i + vec2(0.0, 1.0));
    float d = vertHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    // PlaneGeometry is in XY plane (z=0 for all verts).
    // Mesh is rotated -PI/2 around X, so local Y -> world Z, local Z -> world Y.
    // We sample waves using local X (world X) and local Y (world Z).
    vec3 pos = position;
    float gridX = pos.x;
    float gridZ = pos.y; // local Y maps to world Z after rotation

    float dx = 0.0;
    float dy = 0.0;  // vertical displacement (height)
    float dz = 0.0;
    float dNx = 0.0;
    float dNz = 0.0;
    float jacobian = 1.0;

    // Spatial amplitude modulation — drifting patches of calmer/rougher water
    float modNoise = vertNoise(vec2(gridX * 0.005, gridZ * 0.005) + uTime * 0.01);
    float ampMod = mix(0.6, 1.2, modNoise);

    for (int i = 0; i < NUM_WAVES; i++) {
      int base = i * 7;
      float dirX       = uWaveData[base + 0];
      float dirZ       = uWaveData[base + 1];
      float steepness  = uWaveData[base + 2];
      float wavelength  = uWaveData[base + 3];
      float amplitude   = uWaveData[base + 4];
      float speed       = uWaveData[base + 5];
      float phase       = uWaveData[base + 6];

      // Modulate amplitude for first 2 waves (primary + secondary swell)
      float amp = (i < 2) ? amplitude * ampMod : amplitude;

      float k = TWO_PI / wavelength;
      float theta = k * (dirX * gridX + dirZ * gridZ) - speed * k * uTime + phase;
      float s = sin(theta);
      float c = cos(theta);

      dx += dirX * amp * c;
      dz += dirZ * amp * c;
      dy += amp * s;

      dNx += dirX * k * amp * c;
      dNz += dirZ * k * amp * c;

      // Jacobian: track horizontal compression for foam
      jacobian -= k * amp * steepness * c;
    }

    // Apply displacements in LOCAL space:
    // dx  -> local X (horizontal, world X)
    // dz  -> local Y (horizontal, world Z after rotation)
    // dy  -> local Z (vertical / height, world Y after rotation)
    pos.x += dx;
    pos.y += dz;
    pos.z += dy;

    // Surface normal from partial derivatives, computed in world-aligned space.
    // Since we only need it in world space for fragment shader lighting,
    // we pass it directly without normalMatrix (which would transform to view space).
    vec3 n = normalize(vec3(-dNx, 1.0, -dNz));
    vNormal = n;
    vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
    vHeight = dy;
    vFoam = clamp((1.0 - jacobian) * 2.0, 0.0, 1.0);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

/**
 * Fragment shader: rich ocean surface with Fresnel reflections, sun specular,
 * subsurface scattering, foam, and height-based coloring.
 */
export const fragmentShader = /* glsl */ `
  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vHeight;
  varying float vFoam;

  // Simple hash-based noise for normal perturbation (no texture needed)
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // smoothstep
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Fractal Brownian Motion for layered detail (3 octaves for performance)
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 3; i++) {
      value += amplitude * noise(p);
      p *= 2.2;
      amplitude *= 0.45;
    }
    return value;
  }

  void main() {
    // --- View & normal ---
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 baseNormal = normalize(vNormal);

    // --- Micro-normal perturbation for fine surface detail ---
    // Two octaves of ripples at different scales, animated
    vec2 worldXZ = vWorldPosition.xz;

    // Single layer of medium-scale ripples (cheaper than two layers)
    float s1 = 0.6;
    float n1 = fbm(worldXZ * s1 + uTime * vec2(0.4, 0.3));
    float n1x = fbm((worldXZ + vec2(0.3, 0.0)) * s1 + uTime * vec2(0.4, 0.3)) - n1;
    float n1z = fbm((worldXZ + vec2(0.0, 0.3)) * s1 + uTime * vec2(0.4, 0.3)) - n1;

    // Blend strength: stronger close up, fade with distance
    float detailDist = length(vWorldPosition - cameraPosition);
    float detailFade = smoothstep(400.0, 15.0, detailDist);
    float strength1 = 0.35 * detailFade;

    vec3 perturbation = vec3(
      n1x * strength1 / 0.3,
      0.0,
      n1z * strength1 / 0.3
    );
    vec3 normal = normalize(baseNormal + perturbation);

    // --- Fresnel (Schlick approximation) ---
    float NdotV = max(dot(viewDir, normal), 0.0);
    float fresnel = pow(1.0 - NdotV, 4.0);
    fresnel = clamp(fresnel, 0.02, 1.0);

    // --- Sun configuration ---
    vec3 sunDir = normalize(vec3(100.0, 40.0, -100.0));
    vec3 sunColor = vec3(1.0, 0.9, 0.7);

    // --- Height-based water color ---
    // Remap vHeight to 0-1 range based on expected wave amplitude range
    float h = smoothstep(-3.5, 4.5, vHeight);

    // Vivid ocean colors — strong trough-to-crest contrast
    vec3 troughColor = vec3(0.003, 0.018, 0.07);  // deep dark navy
    vec3 midColor    = vec3(0.02, 0.10, 0.24);    // ocean blue
    vec3 faceColor   = vec3(0.05, 0.22, 0.38);    // bright blue on wave face
    vec3 crestColor  = vec3(0.12, 0.38, 0.48);    // vivid teal/cyan at peaks

    vec3 waterColor = troughColor;
    waterColor = mix(waterColor, midColor, smoothstep(0.0, 0.35, h));
    waterColor = mix(waterColor, faceColor, smoothstep(0.3, 0.65, h));
    waterColor = mix(waterColor, crestColor, smoothstep(0.6, 0.95, h));

    // --- Diffuse sun lighting ---
    // Wrap diffuse for softer falloff (half-Lambert)
    float NdotL = dot(normal, sunDir);
    float diffuseWrap = max(NdotL * 0.5 + 0.5, 0.0);
    float diffuseHard = max(NdotL, 0.0);
    float sunDiffuse = mix(diffuseWrap, diffuseHard, 0.6);

    // --- Specular: sun glints ---
    vec3 halfDir = normalize(sunDir + viewDir);
    float NdotH = max(dot(normal, halfDir), 0.0);
    float specTight = pow(NdotH, 200.0);     // sharp sun disc
    float specBroad = pow(NdotH, 20.0);      // soft sun glow
    float specWide  = pow(NdotH, 4.0);       // very broad sheen

    // --- Subsurface scattering ---
    // Approximation: light transmitting through wave crests when backlit
    float sssAngle = pow(max(dot(viewDir, -sunDir), 0.0), 2.5);
    float sssHeight = smoothstep(-1.0, 3.0, vHeight);
    float sss = sssAngle * sssHeight * 0.35;
    vec3 sssColor = vec3(0.0, 0.5, 0.4);

    // --- Ambient sky lighting (hemispherical) ---
    // This adds soft blue light from the sky dome even on surfaces facing away from sun
    float skyFactor = normal.y * 0.5 + 0.5;
    vec3 skyAmbient = vec3(0.06, 0.12, 0.22) * skyFactor;

    // --- Compose base water color ---
    vec3 ambient = waterColor * 0.5;
    vec3 diffuse = waterColor * sunDiffuse * 0.6;
    vec3 color = ambient + diffuse + skyAmbient + sssColor * sss;

    // --- Specular highlights ---
    vec3 specular = sunColor * (specTight * 4.0 + specBroad * 0.25 + specWide * 0.05);
    color += specular * fresnel;

    // --- Jacobian-based foam on wave crests ---
    float foam = vFoam;
    vec3 foamColor = vec3(0.9, 0.95, 1.0);
    color = mix(color, foamColor, foam * 0.6);

    // --- Sky reflection via Fresnel ---
    vec3 reflectDir = reflect(-viewDir, normal);
    float reflY = max(reflectDir.y, 0.0);
    // Sky gradient: warm blue-grey at horizon, deeper blue overhead
    vec3 skyHorizon = vec3(0.40, 0.52, 0.68);
    vec3 skyZenith  = vec3(0.10, 0.18, 0.38);
    vec3 skyReflect = mix(skyHorizon, skyZenith, reflY);
    // Add sun glow to sky reflection near sun direction
    float sunReflGlow = pow(max(dot(reflectDir, sunDir), 0.0), 8.0);
    skyReflect += sunColor * sunReflGlow * 0.3;
    // Apply Fresnel-driven sky reflection (moderate to preserve water color identity)
    color = mix(color, skyReflect, fresnel * 0.4);

    // --- Distance fog for seamless horizon ---
    float dist = length(vWorldPosition - cameraPosition);
    float fogFactor = smoothstep(200.0, 800.0, dist);
    vec3 fogColor = vec3(0.55, 0.65, 0.78);
    color = mix(color, fogColor, fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`;
