import React, { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';

const vertex = `#version 300 es
precision highp float;
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
out vec4 fragColor;

void mainImage(out vec4 o, vec2 C) {
  float i = 0.0, d = 0.0, z = 0.0, T = iTime * 0.4;
  vec3 O = vec3(0.0), p, S;

  for (vec2 r = iResolution.xy, Q; i < 60.0; i++) {
    p = z * normalize(vec3(C - 0.5 * r, r.y)); 
    p.z -= 4.0; 
    S = p;
    d = p.y - T;
    
    p.x += 0.4 * (1.0 + p.y) * sin(d + p.x * 0.1) * cos(0.34 * d + p.x * 0.05); 
    
    // Explicit matrix multiplication instead of *=
    float c = cos(p.y + vec4(0, 11, 33, 0).x - T); // Simplified the cos logic
    mat2 rot = mat2(cos(p.y - T), -sin(p.y - T), sin(p.y - T), cos(p.y - T));
    p.xz = rot * p.xz;
    Q = p.xz;
    
    d = abs(length(Q)) - 0.25 * (5.0 + S.y);
    z += d / 3.0 + 8e-4; 
    
    // Using a simpler formula to accumulate color
    o = 1.0 + vec4(sin(S.y + p.z * 0.5 + S.z - length(S - p) + vec4(2, 1, 0, 8)));
    O += (o.w / d) * o.xyz;
  }
  
  o.xyz = tanh(O / 1e4);
}

bool finite1(float x){ return !(isnan(x) || isinf(x)); }
vec3 sanitize(vec3 c){
  return vec3(
    finite1(c.r) ? c.r : 0.0,
    finite1(c.g) ? c.g : 0.0,
    finite1(c.b) ? c.b : 0.0
  );
}

void main() {
  vec4 o = vec4(0.0);
  mainImage(o, gl_FragCoord.xy);
  vec3 rgb = sanitize(o.rgb);
  
  float intensity = (rgb.r + rgb.g + rgb.b) / 3.0;
  float alpha = length(rgb);
  
  fragColor = vec4(vec3(intensity), alpha);
}
`;

export const Plasma: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const containerEl = containerRef.current;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        webgl: 2,
        alpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, 2)
      });
    } catch {
      return;
    }
    const gl = renderer.gl;
    if (!gl) return;
    
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    containerEl.appendChild(canvas);

    const geometry = new Triangle(gl);

    const program = new Program(gl, {
      vertex: vertex,
      fragment: fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) }
      }
    });

    const mesh = new Mesh(gl, { geometry, program });

    const setSize = () => {
      const rect = containerEl.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height);
      const res = program.uniforms.iResolution.value as Float32Array;
      res[0] = gl.drawingBufferWidth;
      res[1] = gl.drawingBufferHeight;
    };

    const ro = new ResizeObserver(setSize);
    ro.observe(containerEl);
    setSize();

    let raf = 0;
    let contextLost = false;
    let isVisible = true;
    const t0 = performance.now();

    const loop = (t: number) => {
      if (contextLost || !isVisible) return;
      (program.uniforms.iTime as any).value = (t - t0) * 0.001;
      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(loop);
    };

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      cancelAnimationFrame(raf);
    };
    const handleContextRestored = () => {
      contextLost = false;
      if (isVisible) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      }
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    const io = new IntersectionObserver(([entry]) => {
      const wasVisible = isVisible;
      isVisible = entry.isIntersecting;
      if (isVisible && !wasVisible && !contextLost) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      }
    }, { threshold: 0 });
    io.observe(containerEl);

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      try {
        containerEl?.removeChild(canvas);
      } catch {}
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full relative overflow-hidden" />;
};
