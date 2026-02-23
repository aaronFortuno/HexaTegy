/**
 * Camera — zoom i pan sobre el Canvas.
 *
 * Gestiona la transformació afí (translate + scale) aplicada
 * al context 2D abans de renderitzar el mapa.
 *
 * Controls:
 *   - Roda del ratolí: zoom centrat al cursor
 *   - Click + arrossegament (botó mig o botó dret): pan
 *   - Botons +/−/reset externs via mètodes públics
 */

export interface CameraState {
  x: number;      // offset X en píxels (pan)
  y: number;      // offset Y en píxels (pan)
  scale: number;  // factor de zoom (1.0 = original)
}

export class Camera {
  private state: CameraState = { x: 0, y: 0, scale: 1 };

  readonly minScale: number;
  readonly maxScale: number;
  readonly zoomStep = 0.1;

  private isPanning = false;
  private lastPanPoint = { x: 0, y: 0 };

  private canvas: HTMLCanvasElement;
  private onChangeCallback: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement, options?: { minScale?: number; maxScale?: number }) {
    this.canvas = canvas;
    this.minScale = options?.minScale ?? 0.3;
    this.maxScale = options?.maxScale ?? 4.0;

    this.attachEvents();
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  private attachEvents(): void {
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);

    // Touch (pinch-to-zoom)
    this.canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    this.canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    this.canvas.addEventListener("touchend", this.onTouchEnd);
  }

  detachEvents(): void {
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    this.canvas.removeEventListener("touchend", this.onTouchEnd);
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -this.zoomStep : this.zoomStep;
    const rect = this.canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    this.zoomAt(cx, cy, delta);
  };

  private onMouseDown = (e: MouseEvent): void => {
    // Pan amb botó mig (1) o dret (2)
    if (e.button === 1 || e.button === 2) {
      this.isPanning = true;
      this.lastPanPoint = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = "grabbing";
      e.preventDefault();
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isPanning) return;
    const dx = e.clientX - this.lastPanPoint.x;
    const dy = e.clientY - this.lastPanPoint.y;
    this.lastPanPoint = { x: e.clientX, y: e.clientY };
    this.pan(dx, dy);
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 1 || e.button === 2) {
      this.isPanning = false;
      this.canvas.style.cursor = "";
    }
  };

  // ─── Touch / pinch ────────────────────────────────────────────────────────

  private lastTouchDist = 0;

  private onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length === 2) {
      e.preventDefault();
      this.lastTouchDist = touchDistance(e);
    } else if (e.touches.length === 1) {
      this.isPanning = true;
      this.lastPanPoint = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = touchDistance(e);
      const center = touchCenter(e, this.canvas);
      const scaleDelta = (dist - this.lastTouchDist) / this.lastTouchDist * 0.5;
      this.zoomAt(center.x, center.y, scaleDelta);
      this.lastTouchDist = dist;
    } else if (e.touches.length === 1 && this.isPanning) {
      const dx = e.touches[0].clientX - this.lastPanPoint.x;
      const dy = e.touches[0].clientY - this.lastPanPoint.y;
      this.lastPanPoint = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.pan(dx, dy);
    }
  };

  private onTouchEnd = (): void => {
    this.isPanning = false;
    this.lastTouchDist = 0;
  };

  // ─── Operacions de càmera ─────────────────────────────────────────────────

  /** Zoom centrat en un punt del canvas (coordenades del canvas, no del món) */
  zoomAt(cx: number, cy: number, delta: number): void {
    const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.state.scale + delta));
    if (newScale === this.state.scale) return;

    // Ajustar offset per mantenir el punt cx,cy estable
    const ratio = newScale / this.state.scale;
    this.state.x = cx - ratio * (cx - this.state.x);
    this.state.y = cy - ratio * (cy - this.state.y);
    this.state.scale = newScale;
    this.onChange();
  }

  zoomIn(): void {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    this.zoomAt(cx, cy, this.zoomStep * 2);
  }

  zoomOut(): void {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    this.zoomAt(cx, cy, -this.zoomStep * 2);
  }

  resetZoom(): void {
    this.state = { x: 0, y: 0, scale: 1 };
    this.centerOnCanvas();
    this.onChange();
  }

  pan(dx: number, dy: number): void {
    this.state.x += dx;
    this.state.y += dy;
    this.onChange();
  }

  /** Centrar la càmera al canvas (útil en inicialitzar) */
  centerOnCanvas(): void {
    this.state.x = this.canvas.width / 2;
    this.state.y = this.canvas.height / 2;
  }

  // ─── Aplicar al context ───────────────────────────────────────────────────

  /**
   * Aplica la transformació al context 2D.
   * Crideu-ho a l'inici de cada frame, entre save() i restore().
   */
  applyToContext(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(this.state.scale, 0, 0, this.state.scale, this.state.x, this.state.y);
  }

  /** Convertir coordenades del canvas (pixel) a coordenades del món */
  canvasToWorld(cx: number, cy: number): { x: number; y: number } {
    return {
      x: (cx - this.state.x) / this.state.scale,
      y: (cy - this.state.y) / this.state.scale,
    };
  }

  get currentScale(): number { return this.state.scale; }
  get snapshot(): CameraState { return { ...this.state }; }

  onChange(cb?: () => void): void {
    if (cb) { this.onChangeCallback = cb; return; }
    this.onChangeCallback?.();
  }
}

// ─── Helpers touch ────────────────────────────────────────────────────────────

function touchDistance(e: TouchEvent): number {
  const dx = e.touches[0].clientX - e.touches[1].clientX;
  const dy = e.touches[0].clientY - e.touches[1].clientY;
  return Math.hypot(dx, dy);
}

function touchCenter(e: TouchEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
    y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top,
  };
}
