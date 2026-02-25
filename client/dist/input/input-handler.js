/**
 * InputHandler — gestió de clicks i arrossegaments per planificar ordres.
 *
 * Botó esquerre en regió pròpia + arrossegar a veïna → planificar moviment.
 * Botó dret en regió pròpia + arrossegar a regió amb ordre → eliminar aquell ordre.
 * Botó dret (mousedown + mouseup a la mateixa casella) → menú contextual de la regió.
 * Botó central → desplaçament de càmera (gestionat per Camera).
 * Clic sobre l'etiqueta numèrica d'una fletxa → editar tropes (cursor "pointer" de feedback).
 */
import { hexToPixel } from "../render/hex-renderer.js";
export class InputHandler {
    canvas;
    hexRenderer;
    camera;
    myPlayerId;
    regions = [];
    orders = [];
    // ─── Drag esquerre (planificar ordre) ─────────────────────────────────────
    isDragging = false;
    dragFrom = null;
    dragCurrentPixel = null;
    // ─── Drag / clic dret (eliminar ordre / menú contextual) ──────────────────
    rightDragFrom = null; // origen del drag dret (regió pròpia)
    rightDownRegion = null; // regió on s'ha premut el botó dret
    // ─── Hover sobre etiqueta de fletxa (per a clic i cursor) ─────────────────
    /** Ordre la etiqueta de la qual es troba sota el cursor. Null si no n'hi ha cap. */
    hoveredArrowLabel = null;
    onOrderChange;
    onDragFrame = null;
    onRightDragFrame = null;
    onContextMenuCb = null;
    onArrowLabelClickCb = null;
    constructor(canvas, hexRenderer, camera, myPlayerId, onOrderChange) {
        this.canvas = canvas;
        this.hexRenderer = hexRenderer;
        this.camera = camera;
        this.myPlayerId = myPlayerId;
        this.onOrderChange = onOrderChange;
        this.attachEvents();
    }
    updateState(regions, orders) {
        this.regions = regions;
        this.orders = orders;
        // Si les ordres canvien (p. ex. al inici de ronda), netejar el hover
        if (orders.length === 0) {
            this.hoveredArrowLabel = null;
            this.canvas.style.cursor = "";
        }
    }
    /** Callback cridat en cada frame de drag esquerre (per dibuixar la fletxa de cursor). */
    onDrag(cb) {
        this.onDragFrame = cb;
    }
    /** Callback cridat en cada frame de drag dret (per dibuixar la fletxa d'eliminació). */
    onRightDrag(cb) {
        this.onRightDragFrame = cb;
    }
    /** Callback cridat quan l'usuari fa clic dret sobre una regió (mateixa casella). */
    onContextMenu(cb) {
        this.onContextMenuCb = cb;
    }
    /** Callback cridat quan l'usuari fa clic sobre l'etiqueta numèrica d'una fletxa planificada. */
    onArrowLabelClick(cb) {
        this.onArrowLabelClickCb = cb;
    }
    attachEvents() {
        this.canvas.addEventListener("mousedown", this.onMouseDown, { capture: true });
        this.canvas.addEventListener("mousemove", this.onMouseMove);
        window.addEventListener("mouseup", this.onMouseUp);
        this.canvas.addEventListener("contextmenu", this.preventContextMenu);
        this.canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
        this.canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
        this.canvas.addEventListener("touchend", this.onTouchEnd);
    }
    detach() {
        this.canvas.removeEventListener("mousedown", this.onMouseDown, { capture: true });
        this.canvas.removeEventListener("mousemove", this.onMouseMove);
        window.removeEventListener("mouseup", this.onMouseUp);
        this.canvas.removeEventListener("contextmenu", this.preventContextMenu);
        this.canvas.removeEventListener("touchstart", this.onTouchStart);
        this.canvas.removeEventListener("touchmove", this.onTouchMove);
        this.canvas.removeEventListener("touchend", this.onTouchEnd);
    }
    // ─── Ratolí ───────────────────────────────────────────────────────────────
    onMouseDown = (e) => {
        if (e.button === 0) {
            // Si el cursor és sobre l'etiqueta d'una fletxa planificada, obrir l'editor
            if (this.hoveredArrowLabel && this.onArrowLabelClickCb) {
                this.onArrowLabelClickCb(this.hoveredArrowLabel.fromRegionId, this.hoveredArrowLabel.toRegionId, { x: e.clientX, y: e.clientY });
                return;
            }
            // Botó esquerre: inici de drag per planificar ordre
            const pos = this.canvasPos(e);
            const region = this.hexRenderer.regionAt(pos.x, pos.y, this.regions);
            if (!region || region.ownerId !== this.myPlayerId)
                return;
            this.isDragging = true;
            this.dragFrom = region;
            this.dragCurrentPixel = pos;
            this.hexRenderer.selectedRegionId = region.id;
            this.hexRenderer.highlightedRegionIds = new Set(region.neighbors);
        }
        else if (e.button === 2) {
            // Botó dret: registrar la regió d'origen (per distingir clic vs. drag)
            const pos = this.canvasPos(e);
            const region = this.hexRenderer.regionAt(pos.x, pos.y, this.regions);
            this.rightDownRegion = region ?? null;
            // Només iniciem drag dret des de regions pròpies (per eliminar ordres)
            if (region?.ownerId === this.myPlayerId) {
                this.rightDragFrom = region;
                // Bloquejar el pan de càmera: volem arrossegar per eliminar un ordre, no moure la vista
                this.camera.blockRightPan(true);
            }
        }
    };
    onMouseMove = (e) => {
        const pos = this.canvasPos(e);
        if (this.isDragging && this.dragFrom) {
            this.dragCurrentPixel = pos;
            const fp = hexToPixel(this.dragFrom.coord.q, this.dragFrom.coord.r);
            const world = this.camera.canvasToWorld(pos.x, pos.y);
            this.onDragFrame?.(fp, world);
        }
        if (this.rightDragFrom) {
            const fp = hexToPixel(this.rightDragFrom.coord.q, this.rightDragFrom.coord.r);
            const world = this.camera.canvasToWorld(pos.x, pos.y);
            const hovered = this.hexRenderer.regionAt(pos.x, pos.y, this.regions);
            const isValidTarget = hovered !== null
                && hovered.id !== this.rightDragFrom.id
                && this.rightDragFrom.neighbors.includes(hovered.id)
                && this.orders.some((o) => o.fromRegionId === this.rightDragFrom.id && o.toRegionId === hovered.id);
            this.onRightDragFrame?.(fp, world, isValidTarget ? hovered.id : null);
        }
        // Actualitzar l'estat de hover sobre etiquetes de fletxes (per a cursor i clic).
        // S'omet durant drags actius o si s'està paneant (botons mig/dret premuts).
        if (!this.isDragging && !this.rightDragFrom && !(e.buttons & 6)) {
            const world = this.camera.canvasToWorld(pos.x, pos.y);
            this.hoveredArrowLabel = this.arrowLabelAt(world);
            this.canvas.style.cursor = this.hoveredArrowLabel ? "pointer" : "";
        }
    };
    onMouseUp = (e) => {
        if (e.button === 0) {
            // Botó esquerre: confirmar ordre si s'ha arrossegat a un veí
            if (!this.isDragging || !this.dragFrom)
                return;
            const pos = this.canvasPos(e);
            const target = this.hexRenderer.regionAt(pos.x, pos.y, this.regions);
            if (target && target.id !== this.dragFrom.id && this.dragFrom.neighbors.includes(target.id)) {
                this.createOrUpdateOrder(this.dragFrom, target);
            }
            this.endDrag();
        }
        else if (e.button === 2) {
            // Si no hi havia cap drag dret actiu, ignorar (evitar falsos positius)
            if (!this.rightDownRegion && !this.rightDragFrom)
                return;
            const pos = this.canvasPos(e);
            const target = this.hexRenderer.regionAt(pos.x, pos.y, this.regions);
            if (target && this.rightDownRegion?.id === target.id) {
                // Mateixa casella → menú contextual
                this.onContextMenuCb?.(target, e.clientX, e.clientY);
            }
            else if (this.rightDragFrom && target && target.id !== this.rightDragFrom.id) {
                // Casella diferent → eliminar l'ordre concret d'origen → destí
                this.removeOrder(this.rightDragFrom.id, target.id);
            }
            this.rightDragFrom = null;
            this.rightDownRegion = null;
            this.camera.blockRightPan(false);
            this.onRightDragFrame?.(null, null, null); // netejar feedback visual
        }
    };
    /** Evita que el navegador mostri el seu propi menú contextual sobre el canvas. */
    preventContextMenu = (e) => {
        e.preventDefault();
    };
    // ─── Touch ────────────────────────────────────────────────────────────────
    onTouchStart = (e) => {
        if (e.touches.length !== 1)
            return;
        e.preventDefault();
        const pos = this.touchPos(e.touches[0]);
        const region = this.hexRenderer.regionAt(pos.x, pos.y, this.regions);
        if (!region || region.ownerId !== this.myPlayerId)
            return;
        this.isDragging = true;
        this.dragFrom = region;
        this.hexRenderer.selectedRegionId = region.id;
        this.hexRenderer.highlightedRegionIds = new Set(region.neighbors);
    };
    onTouchMove = (e) => {
        if (!this.isDragging || !this.dragFrom || e.touches.length !== 1)
            return;
        e.preventDefault();
        const pos = this.touchPos(e.touches[0]);
        this.dragCurrentPixel = pos;
        const fp = hexToPixel(this.dragFrom.coord.q, this.dragFrom.coord.r);
        const world = this.camera.canvasToWorld(pos.x, pos.y);
        this.onDragFrame?.(fp, world);
    };
    onTouchEnd = (_e) => {
        if (!this.isDragging || !this.dragFrom)
            return;
        if (this.dragCurrentPixel) {
            const target = this.hexRenderer.regionAt(this.dragCurrentPixel.x, this.dragCurrentPixel.y, this.regions);
            if (target && target.id !== this.dragFrom.id && this.dragFrom.neighbors.includes(target.id)) {
                this.createOrUpdateOrder(this.dragFrom, target);
            }
        }
        this.endDrag();
    };
    // ─── Lògica d'ordres ──────────────────────────────────────────────────────
    createOrUpdateOrder(from, to) {
        const existing = this.orders.find((o) => o.fromRegionId === from.id && o.toRegionId === to.id);
        if (existing)
            return; // ja existeix
        // Distribució equitativa: (tropes − 1) / (ordres existents + 1)
        const ordersFromSame = this.orders.filter((o) => o.fromRegionId === from.id);
        const available = Math.max(0, from.troops - 1);
        const perOrder = Math.floor(available / (ordersFromSame.length + 1));
        for (const o of ordersFromSame)
            o.troops = perOrder;
        this.orders.push({ fromRegionId: from.id, toRegionId: to.id, troops: perOrder });
        this.onOrderChange([...this.orders]);
    }
    /** Elimina l'ordre específic de `fromId` → `toId` i redistribueix les tropes
     *  alliberades equitativament entre els ordres restants del mateix origen. */
    removeOrder(fromId, toId) {
        const before = this.orders.length;
        this.orders = this.orders.filter((o) => !(o.fromRegionId === fromId && o.toRegionId === toId));
        if (this.orders.length === before)
            return; // no s'ha eliminat res
        // Redistribuir tropes als ordres restants del mateix origen
        const remaining = this.orders.filter((o) => o.fromRegionId === fromId);
        if (remaining.length > 0) {
            const fromRegion = this.regions.find((r) => r.id === fromId);
            if (fromRegion) {
                const available = Math.max(0, fromRegion.troops - 1);
                const perOrder = Math.floor(available / remaining.length);
                for (const o of remaining)
                    o.troops = perOrder;
            }
        }
        this.onOrderChange([...this.orders]);
    }
    /**
     * Retorna l'ordre la etiqueta del qual es troba sota les coordenades del món indicades.
     * Retorna null si el cursor no és sobre cap etiqueta.
     *
     * L'àrea de detecció és més gran que l'etiqueta visual per facilitar la interacció.
     */
    arrowLabelAt(world) {
        if (this.orders.length === 0)
            return null;
        const regionById = new Map(this.regions.map((r) => [r.id, r]));
        for (const order of this.orders) {
            const from = regionById.get(order.fromRegionId);
            const to = regionById.get(order.toRegionId);
            if (!from || !to)
                continue;
            const fp = hexToPixel(from.coord.q, from.coord.r);
            const tp = hexToPixel(to.coord.q, to.coord.r);
            const mx = (fp.x + tp.x) / 2;
            const my = (fp.y + tp.y) / 2;
            // Font 12px bold ≈ 8px/caràcter; padding de la caixa = 12; marge extra = 8
            const halfW = (String(order.troops).length * 8 + 16) / 2 + 8;
            const halfH = 14; // > bh/2 = 10, marge de tolerància generós
            if (Math.abs(world.x - mx) <= halfW && Math.abs(world.y - my) <= halfH) {
                return order;
            }
        }
        return null;
    }
    endDrag() {
        this.isDragging = false;
        this.dragFrom = null;
        this.dragCurrentPixel = null;
        this.onDragFrame?.({ x: 0, y: 0 }, { x: 0, y: 0 }); // netejar fletxa de drag
        this.hexRenderer.selectedRegionId = null;
        this.hexRenderer.highlightedRegionIds = new Set();
    }
    // ─── Helpers ──────────────────────────────────────────────────────────────
    canvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    touchPos(t) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
}
