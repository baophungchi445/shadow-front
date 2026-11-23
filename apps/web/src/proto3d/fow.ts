import * as THREE from 'three';

/**
 * Fog of war for every lit material (v0.19 prototype): a per-tile texture (0 = never seen, 0.5 = explored, 1 = visible)
 * is sampled at the fragment's world position with linear filtering, so the edge of vision is soft. Explored ground
 * is darkened and desaturated, unexplored ground is near black.
 */
export class FogOfWarLayer {
  readonly texture: THREE.DataTexture;
  readonly uniforms: {
    uFowTex: { value: THREE.DataTexture };
    uFowOn: { value: number };
    uMapSize: { value: THREE.Vector2 };
  };
  private readonly data: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8Array(width * height);
    this.texture = new THREE.DataTexture(this.data, width, height, THREE.RedFormat, THREE.UnsignedByteType);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;
    this.uniforms = {
      uFowTex: { value: this.texture },
      uFowOn: { value: 0 },
      uMapSize: { value: new THREE.Vector2(width, height) },
    };
  }

  set enabled(on: boolean) {
    this.uniforms.uFowOn.value = on ? 1 : 0;
  }

  get enabled(): boolean {
    return this.uniforms.uFowOn.value > 0.5;
  }

  update(visible: Uint8Array | undefined, explored: Uint8Array | undefined): void {
    if (!visible || !explored) return;
    const d = this.data;
    for (let i = 0; i < d.length; i++) d[i] = visible[i] ? 255 : explored[i] ? 120 : 0;
    this.texture.needsUpdate = true;
  }

  /** Adds the fog to a built-in lit / basic material. `extra` lets callers chain their own patch. */
  patch(material: THREE.Material, extra?: (shader: THREE.WebGLProgramParametersWithUniforms) => void): void {
    const u = this.uniforms;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
#ifdef USE_INSTANCING
  vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vWPos;
uniform sampler2D uFowTex;
uniform float uFowOn;
uniform vec2 uMapSize;`,
        )
        .replace(
          '#include <fog_fragment>',
          `if (uFowOn > 0.5) {
  float v = texture2D(uFowTex, vWPos.xz / uMapSize).r;
  float outside = step(uMapSize.x, vWPos.x) + step(vWPos.x, 0.0) + step(uMapSize.y, vWPos.z) + step(vWPos.z, 0.0);
  if (outside > 0.0) v = 0.0;
  vec3 c = gl_FragColor.rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 dim = mix(vec3(l), c, 0.35) * 0.42;
  vec3 r = mix(vec3(0.012, 0.014, 0.018), dim, smoothstep(0.0, 0.47, v));
  gl_FragColor.rgb = mix(r, c, smoothstep(0.5, 0.95, v));
}
#include <fog_fragment>`,
        );
      extra?.(shader);
    };
    // Different patches must not share a cached program.
    const key = extra ? `fow+${extra.toString().length}` : 'fow';
    material.customProgramCacheKey = () => key;
  }
}
