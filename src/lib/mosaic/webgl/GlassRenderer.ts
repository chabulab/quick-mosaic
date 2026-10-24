import type { MosaicSettings } from "../types";
import { VERTEX_SHADER, FRAGMENT_SHADER } from "./glassShader";

export type GridShapeId = 0 | 1 | 2 | 3;

const SHAPE_ID: Record<string, GridShapeId> = {
  voronoi: 0,
  hexagon: 1,
  triangle: 2,
  square: 3,
};

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ];
}

export class GlassRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private sourceTexture: WebGLTexture | null = null;
  private uniforms: Record<string, WebGLUniformLocation>;
  private hasSource = false;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      throw new Error("WebGL2 is not supported by this browser.");
    }
    this.gl = gl;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.program = program;

    // Fullscreen quad
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]),
      gl.STATIC_DRAW
    );
    const loc = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.vao = vao;

    // Uniform locations
    const names = [
      "uSource",
      "uImageSize",
      "uScale",
      "uOffset",
      "uShape",
      "uTile",
      "uJitter",
      "uRefraction",
      "uFrost",
      "uOpacity",
      "uGroutColor",
      "uGroutWidth",
      "uBevel",
      "uLightDir",
    ];
    this.uniforms = {};
    gl.useProgram(program);
    for (const n of names) {
      this.uniforms[n] = gl.getUniformLocation(program, n)!;
    }

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.disable(gl.DEPTH_TEST);
  }

  setSource(image: HTMLImageElement): void {
    const gl = this.gl;
    if (this.sourceTexture) {
      gl.deleteTexture(this.sourceTexture);
    }
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.sourceTexture = tex;
    this.hasSource = true;
  }

  render(settings: MosaicSettings, canvasW: number, canvasH: number): void {
    const gl = this.gl;
    if (!this.hasSource) return;

    gl.viewport(0, 0, canvasW, canvasH);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.uniform1i(this.uniforms.uSource, 0);

    const imgW = this.imageWidth;
    const imgH = this.imageHeight;

    gl.uniform2f(this.uniforms.uImageSize, imgW, imgH);

    // Letterbox: fit image into canvas preserving aspect ratio
    const scaleX = canvasW / imgW;
    const scaleY = canvasH / imgH;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvasW - imgW * scale) / 2 / canvasW;
    const offsetY = (canvasH - imgH * scale) / 2 / canvasH;
    gl.uniform2f(this.uniforms.uScale, scale, scale);
    gl.uniform2f(this.uniforms.uOffset, offsetX, offsetY);

    gl.uniform1i(this.uniforms.uShape, SHAPE_ID[settings.grid.shape] ?? 0);
    gl.uniform1f(this.uniforms.uTile, settings.grid.tileSize);
    gl.uniform1f(this.uniforms.uJitter, settings.grid.jitter / 100);
    gl.uniform1f(this.uniforms.uRefraction, settings.glass.refraction);
    gl.uniform1f(this.uniforms.uFrost, settings.glass.frost);
    gl.uniform1f(this.uniforms.uOpacity, settings.glass.opacity / 100);
    const [gr, gg, gb] = hexToRgb(settings.grout.color);
    gl.uniform3f(this.uniforms.uGroutColor, gr, gg, gb);
    gl.uniform1f(this.uniforms.uGroutWidth, settings.grout.thickness);
    gl.uniform1f(this.uniforms.uBevel, settings.grout.bevel ? 1 : 0);
    gl.uniform3f(this.uniforms.uLightDir, 0.3, -0.4, 0.8);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindVertexArray(null);
  }

  // Render the mosaic at exact image resolution into a 2D canvas (for export)
  exportToCanvas(image: HTMLImageElement, settings: MosaicSettings): HTMLCanvasElement {
    const gl = this.gl;
    const w = image.naturalWidth;
    const h = image.naturalHeight;

    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.uniform1i(this.uniforms.uSource, 0);

    gl.uniform2f(this.uniforms.uImageSize, w, h);
    gl.uniform2f(this.uniforms.uScale, 1, 1);
    gl.uniform2f(this.uniforms.uOffset, 0, 0);

    gl.uniform1i(this.uniforms.uShape, SHAPE_ID[settings.grid.shape] ?? 0);
    gl.uniform1f(this.uniforms.uTile, settings.grid.tileSize);
    gl.uniform1f(this.uniforms.uJitter, settings.grid.jitter / 100);
    gl.uniform1f(this.uniforms.uRefraction, settings.glass.refraction);
    gl.uniform1f(this.uniforms.uFrost, settings.glass.frost);
    gl.uniform1f(this.uniforms.uOpacity, settings.glass.opacity / 100);
    const [gr, gg, gb] = hexToRgb(settings.grout.color);
    gl.uniform3f(this.uniforms.uGroutColor, gr, gg, gb);
    gl.uniform1f(this.uniforms.uGroutWidth, settings.grout.thickness);
    gl.uniform1f(this.uniforms.uBevel, settings.grout.bevel ? 1 : 0);
    gl.uniform3f(this.uniforms.uLightDir, 0.3, -0.4, 0.8);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Read pixels
    const pixels = new Uint8ClampedArray(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Flip vertically (WebGL reads bottom-up)
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      const srcRow = (h - 1 - y) * w * 4;
      const dstRow = y * w * 4;
      out.set(pixels.subarray(srcRow, srcRow + w * 4), dstRow);
    }

    const imgData = new ImageData(out, w, h);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.putImageData(imgData, 0, 0);

    gl.bindVertexArray(null);
    return canvas;
  }

  private _imageWidth = 0;
  private _imageHeight = 0;

  get imageWidth(): number {
    return this._imageWidth;
  }

  get imageHeight(): number {
    return this._imageHeight;
  }

  set imageSize(size: { width: number; height: number }) {
    this._imageWidth = size.width;
    this._imageHeight = size.height;
  }

  get canvas(): HTMLCanvasElement {
    return this.gl.canvas as HTMLCanvasElement;
  }

  resize(canvasW: number, canvasH: number): void {
    this.gl.viewport(0, 0, canvasW, canvasH);
  }

  destroy(): void {
    const gl = this.gl;
    if (this.sourceTexture) gl.deleteTexture(this.sourceTexture);
    gl.deleteProgram(this.program);
  }
}
