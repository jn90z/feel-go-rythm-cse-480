import {
  ArcRotateCamera,
  Color3,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  StandardMaterial,
  Vector3
} from "@babylonjs/core";
import type { VertexVisualState } from "../algorithms/AlgorithmStep";
import type { Edge, EdgeId, Vertex, VertexId } from "../graph/Graph";

type Selection =
  | { kind: "vertex"; id: VertexId }
  | { kind: "edge"; id: EdgeId }
  | null;

export interface GraphSceneEvents {
  onSelect(selection: Selection): void;
  onVertexMoved(id: VertexId): void;
}

export class GraphScene {
  private readonly engine: Engine;
  readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly ground: Mesh;
  private readonly vertexMeshes = new Map<VertexId, Mesh>();
  private readonly edgeMeshes = new Map<EdgeId, Mesh>();
  private readonly edges = new Map<EdgeId, Edge>();
  private selected: Selection = null;
  private draggingVertexId: VertexId | null = null;
  private dragOffset = Vector3.Zero();
  private vertexIndex = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly events: GraphSceneEvents
  ) {
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor.set(0.04, 0.05, 0.08, 1);

    this.camera = new ArcRotateCamera(
      "camera",
      Math.PI / 2,
      Math.PI / 3,
      28,
      Vector3.Zero(),
      this.scene
    );
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 8;
    this.camera.upperRadiusLimit = 80;

    new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);

    this.ground = MeshBuilder.CreateGround("ground", { width: 60, height: 60 }, this.scene);
    const groundMat = new StandardMaterial("groundMat", this.scene);
    groundMat.diffuseColor = new Color3(0.08, 0.1, 0.14);
    this.ground.material = groundMat;
    this.ground.metadata = { kind: "ground" };

    this.installPointerInteractions();
    this.engine.runRenderLoop(() => this.scene.render());
    window.addEventListener("resize", () => this.engine.resize());
  }

  addVertex(vertex: Vertex): void {
    const mesh = MeshBuilder.CreateSphere(vertex.id, { diameter: 1.4, segments: 24 }, this.scene);
    const angle = this.vertexIndex * 0.9;
    const radius = 3 + this.vertexIndex * 0.35;
    mesh.position = new Vector3(Math.cos(angle) * radius, 1, Math.sin(angle) * radius);
    mesh.metadata = { kind: "vertex", id: vertex.id };

    const mat = new StandardMaterial(`vertex-${vertex.id}`, this.scene);
    mat.diffuseColor = new Color3(0.15, 0.65, 1);
    mesh.material = mat;

    this.vertexMeshes.set(vertex.id, mesh);
    this.vertexIndex++;
  }

  addEdge(edge: Edge): void {
    if (this.edgeMeshes.has(edge.id)) return;

    const mesh = MeshBuilder.CreateCylinder(edge.id, { height: 1, diameter: 0.16 }, this.scene);
    mesh.metadata = { kind: "edge", id: edge.id };

    const mat = new StandardMaterial(`edge-${edge.id}`, this.scene);
    mat.diffuseColor = new Color3(0.8, 0.82, 0.9);
    mesh.material = mat;

    this.edgeMeshes.set(edge.id, mesh);
    this.edges.set(edge.id, edge);
    this.updateEdge(edge.id);
  }

  removeVertex(id: VertexId): void {
    this.vertexMeshes.get(id)?.dispose();
    this.vertexMeshes.delete(id);
    if (this.selected?.kind === "vertex" && this.selected.id === id) this.setSelection(null);
  }

  removeEdge(id: EdgeId): void {
    this.edgeMeshes.get(id)?.dispose();
    this.edgeMeshes.delete(id);
    this.edges.delete(id);
    if (this.selected?.kind === "edge" && this.selected.id === id) this.setSelection(null);
  }

  setSelection(selection: Selection): void {
    this.selected = selection;
    this.applySelectionHighlight();
    this.events.onSelect(selection);
  }

  applyAlgorithmState(states: Map<VertexId, VertexVisualState>): void {
    for (const [id, mesh] of this.vertexMeshes) {
      const mat = mesh.material as StandardMaterial;
      switch (states.get(id) ?? "default") {
        case "frontier":
          mat.diffuseColor = new Color3(1, 0.62, 0.12);
          break;
        case "active":
          mat.diffuseColor = new Color3(1, 0.22, 0.22);
          break;
        case "visited":
          mat.diffuseColor = new Color3(0.24, 0.78, 0.38);
          break;
        default:
          mat.diffuseColor = new Color3(0.15, 0.65, 1);
      }
    }
    this.applySelectionHighlight();
  }

  resetAlgorithmState(): void {
    for (const mesh of this.vertexMeshes.values()) {
      const mat = mesh.material as StandardMaterial;
      mat.diffuseColor = new Color3(0.15, 0.65, 1);
    }
    this.applySelectionHighlight();
  }

  clear(): void {
    for (const mesh of this.vertexMeshes.values()) mesh.dispose();
    for (const mesh of this.edgeMeshes.values()) mesh.dispose();
    this.vertexMeshes.clear();
    this.edgeMeshes.clear();
    this.edges.clear();
    this.vertexIndex = 0;
    this.selected = null;
    this.draggingVertexId = null;
  }

  private applySelectionHighlight(): void {
    for (const [id, mesh] of this.vertexMeshes) {
      const mat = mesh.material as StandardMaterial;
      mat.emissiveColor =
        this.selected?.kind === "vertex" && this.selected.id === id
          ? new Color3(0.15, 0.55, 0.9)
          : Color3.Black();
    }

    for (const [id, mesh] of this.edgeMeshes) {
      const mat = mesh.material as StandardMaterial;
      mat.emissiveColor =
        this.selected?.kind === "edge" && this.selected.id === id
          ? new Color3(0.5, 0.4, 0.1)
          : Color3.Black();
    }
  }

  private installPointerInteractions(): void {
    this.scene.onPointerObservable.add(pointerInfo => {
      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
        const metadata = pick?.pickedMesh?.metadata;

        if (metadata?.kind === "vertex") {
          const id = metadata.id as VertexId;
          this.setSelection({ kind: "vertex", id });
          this.draggingVertexId = id;

          const groundPick = this.pickGround();
          const mesh = this.vertexMeshes.get(id);
          if (groundPick && mesh) {
            this.dragOffset = mesh.position.subtract(groundPick);
            this.camera.detachControl();
          }
          return;
        }

        if (metadata?.kind === "edge") {
          this.setSelection({ kind: "edge", id: metadata.id as EdgeId });
          return;
        }

        this.setSelection(null);
      }

      if (pointerInfo.type === PointerEventTypes.POINTERMOVE && this.draggingVertexId) {
        const point = this.pickGround();
        const mesh = this.vertexMeshes.get(this.draggingVertexId);
        if (!point || !mesh) return;

        const next = point.add(this.dragOffset);
        mesh.position.x = next.x;
        mesh.position.z = next.z;
        this.updateConnectedEdges(this.draggingVertexId);
        this.events.onVertexMoved(this.draggingVertexId);
      }

      if (pointerInfo.type === PointerEventTypes.POINTERUP && this.draggingVertexId) {
        this.draggingVertexId = null;
        this.camera.attachControl(this.canvas, true);
      }
    });
  }

  private pickGround(): Vector3 | null {
    const pick = this.scene.pick(
      this.scene.pointerX,
      this.scene.pointerY,
      mesh => mesh === this.ground
    );
    return pick?.hit && pick.pickedPoint ? pick.pickedPoint.clone() : null;
  }

  private updateConnectedEdges(vertexId: VertexId): void {
    for (const edge of this.edges.values()) {
      if (edge.from === vertexId || edge.to === vertexId) this.updateEdge(edge.id);
    }
  }

  private updateEdge(edgeId: EdgeId): void {
    const edge = this.edges.get(edgeId);
    const mesh = this.edgeMeshes.get(edgeId);
    if (!edge || !mesh) return;

    const from = this.vertexMeshes.get(edge.from);
    const to = this.vertexMeshes.get(edge.to);
    if (!from || !to) return;

    const delta = to.position.subtract(from.position);
    const length = delta.length();
    if (length === 0) return;

    mesh.position = from.position.add(to.position).scale(0.5);
    mesh.scaling.y = length;
    mesh.rotationQuaternion = null;
    mesh.alignWithNormal(delta.normalize());
  }
}
