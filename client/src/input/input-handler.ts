/**
 * InputHandler — gestió de clicks i arrossegaments per planificar ordres.
 *
 * Clic principal en regió pròpia → seleccionar origen.
 * Arrossegament (o clic) a veïna → crear fletxa d'ordre.
 * Clic secundari (dret) sobre fletxa existent → eliminar ordre.
 */

import { Region, MoveOrder } from "../network/protocol.js";
import { HexRenderer } from "../render/hex-renderer.js";
import { Camera } from "../render/camera.js";
import { hexToPixel } from "../render/hex-renderer.js";

export type OrderChangeCallback = (orders: MoveOrder[]) => void;

export class InputHandler {
  private canvas: HTMLCanvasElement;
  private hexRenderer: HexRenderer;
  private camera: Camera;

  private myPlayerId: string;
  private regions: Region[] = [];
  private orders: MoveOrder[] = [];

  private isDragging = false;
  private dragFrom: Region | null = null;
  private dragCurrentPixel: { x: number; y: number } | null = null;

  private onOrderChange: OrderChangeCallback;
  private onDragFrame: ((from: { x: number; y: number }, to: { x: number; y: number }) => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    hexRenderer: HexRenderer,
    camera: Camera,
    myPlayerId: string,
    onOrderChange: OrderChangeCallback
  ) {
    this.canvas = canvas;
    this.hexRenderer = hexRenderer;
    this.camera = camera;
    this.myPlayerId = myPlayerId;
    this.onOrderChange = onOrderChange;

    this.attachEvents();
  }

  updateState(regions: Region[], orders: MoveOrder[]): void {
    this.regions = regions;
    this.orders = orders;
  }

  onDrag(cb: (from: { x: number; y: number }, to: { x: number; y: number }) => void): void {
    this.onDragFrame = cb;
  }

  private attachEvents(): void {
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
    this.canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    this.canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    this.canvas.addEventListener("touchend", this.onTouchEnd);
  }

  detach(): void {
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    this.canvas.removeEventListener("touchend", this.onTouchEnd);
  }

  // ─── Ratolí ───────────────────────────────────────────────────────────────

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return; // només botó esquerre
    const pos = this.canvasPos(e);
    const region = this.hexRenderer.regionAt(pos.x, pos.y, this.regions);
    if (!region || region.ownerId !== this.myPlayerId) return;

    this.isDragging = true;
    this.dragFrom = region;
    this.dragCurrentPixel = pos;
    this.hexRenderer.selectedRegionId = region.id;
    this.hexRenderer.highlightedRegionIds = new Set(region.neighbors);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging || !this.dragFrom) return;
    const pos = this.canvasPos(e);
    this.dragCurrentPixel = pos;
    const fp = hexToPixel(this.dragFrom.coord.q, this.dragFrom.coord.r);
    const world = this.camera.canvasToWorld(pos.x, pos.y);
    this.onDragFrame?.(fp, world);
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (!this.isDragging || !this.dragFrom) return;
    const pos = this.canvasPos(e);
    const target = this.hexRenderer.regionAt(pos.x, pos.y, this.regions);

    if (target && target.id !== this.dragFrom.id && this.dragFrom.neighbors.includes(target.id)) {
      this.createOrUpdateOrder(this.dragFrom, target);
    }

    this.endDrag();
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    const pos = this.canvasPos(e);
    const target = this.hexRenderer.regionAt(pos.x, pos.y, this.regions);
    if (target) this.removeOrdersTo(target.id);
  };

  // ─── Touch ────────────────────────────────────────────────────────────────

  private onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const pos = this.touchPos(e.touches[0]);
    const region = this.hexRenderer.regionAt(pos.x, pos.y, this.regions);
    if (!region || region.ownerId !== this.myPlayerId) return;

    this.isDragging = true;
    this.dragFrom = region;
    this.hexRenderer.selectedRegionId = region.id;
    this.hexRenderer.highlightedRegionIds = new Set(region.neighbors);
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (!this.isDragging || !this.dragFrom || e.touches.length !== 1) return;
    e.preventDefault();
    const pos = this.touchPos(e.touches[0]);
    this.dragCurrentPixel = pos;
    const fp = hexToPixel(this.dragFrom.coord.q, this.dragFrom.coord.r);
    const world = this.camera.canvasToWorld(pos.x, pos.y);
    this.onDragFrame?.(fp, world);
  };

  private onTouchEnd = (_e: TouchEvent): void => {
    if (!this.isDragging || !this.dragFrom) return;
    if (this.dragCurrentPixel) {
      const target = this.hexRenderer.regionAt(
        this.dragCurrentPixel.x,
        this.dragCurrentPixel.y,
        this.regions
      );
      if (target && target.id !== this.dragFrom.id && this.dragFrom.neighbors.includes(target.id)) {
        this.createOrUpdateOrder(this.dragFrom, target);
      }
    }
    this.endDrag();
  };

  // ─── Lògica d'ordres ──────────────────────────────────────────────────────

  private createOrUpdateOrder(from: Region, to: Region): void {
    const existing = this.orders.find(
      (o) => o.fromRegionId === from.id && o.toRegionId === to.id
    );

    if (existing) return; // ja existeix; l'usuari pot ajustar manualment

    // Distribució equitativa: (tropes − 1) / nombre d'ordres des d'aquest origen + 1
    const ordersFromSame = this.orders.filter((o) => o.fromRegionId === from.id);
    const available = Math.max(0, from.troops - 1);
    const perOrder = Math.floor(available / (ordersFromSame.length + 1));

    // Reequilibrar ordres existents
    for (const o of ordersFromSame) o.troops = perOrder;

    this.orders.push({ fromRegionId: from.id, toRegionId: to.id, troops: perOrder });
    this.onOrderChange([...this.orders]);
  }

  private removeOrdersTo(regionId: string): void {
    this.orders = this.orders.filter((o) => o.toRegionId !== regionId);
    this.onOrderChange([...this.orders]);
  }

  private endDrag(): void {
    this.isDragging = false;
    this.dragFrom = null;
    this.dragCurrentPixel = null;
    this.onDragFrame?.({ x: 0, y: 0 }, { x: 0, y: 0 }); // netejar
    this.hexRenderer.selectedRegionId = null;
    this.hexRenderer.highlightedRegionIds = new Set();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private canvasPos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private touchPos(t: Touch): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }
}
