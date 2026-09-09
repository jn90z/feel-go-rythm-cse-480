import {
  ArcRotateCamera,
  Color3,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3
} from "@babylonjs/core";
import type { Edge, Vertex, VertexId } from "../graph/Graph";

export class GraphScene {
  private readonly engine: Engine;
  readonly scene: Scene;
  private readonly vertexMeshes = new Map<VertexId, Mesh>();
  private readonly edgeMeshes = new Map<string, Mesh>();
  private vertexIndex = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor.set(0.04, 0.05, 0.08, 1);

    const camera = new ArcRotateCamera(
      "camera",
      Math.PI / 2,
      Math.PI / 3,
      28,
      Vector3.Zero(),
      this.scene
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 8;
    camera.upperRadiusLimit = 80;

    new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);

    const ground = MeshBuilder.CreateGround("ground", { width: 40, height: 40 }, this.scene);
    const groundMat = new StandardMaterial("groundMat", this.scene);
    groundMat.diffuseColor = new Color3(0.08, 0.1, 0.14);
    ground.material = groundMat;
    ground.isPickable = false;

    this.engine.runRenderLoop(() => this.scene.render());
    window.addEventListener("resize", () => this.engine.resize());
  }

  addVertex(vertex: Vertex): void {
    const mesh = MeshBuilder.CreateSphere(vertex.id, { diameter: 1.4, segments: 24 }, this.scene);
    const angle = this.vertexIndex * 0.9;
    const radius = 3 + this.vertexIndex * 0.35;
    mesh.position = new Vector3(Math.cos(angle) * radius, 1, Math.sin(angle) * radius);

    const mat = new StandardMaterial(`vertex-${vertex.id}`, this.scene);
    mat.diffuseColor = new Color3(0.15, 0.65, 1);
    mesh.material = mat;

    this.vertexMeshes.set(vertex.id, mesh);
    this.vertexIndex++;
  }

  addEdge(edge: Edge): void {
    const from = this.vertexMeshes.get(edge.from);
    const to = this.vertexMeshes.get(edge.to);
    if (!from || !to) return;

    const delta = to.position.subtract(from.position);
    const length = delta.length();
    const midpoint = from.position.add(to.position).scale(0.5);

    const mesh = MeshBuilder.CreateCylinder(edge.id, { height: length, diameter: 0.16 }, this.scene);
    mesh.position = midpoint;
    mesh.alignWithNormal(delta.normalize());

    const mat = new StandardMaterial(`edge-${edge.id}`, this.scene);
    mat.diffuseColor = new Color3(0.8, 0.82, 0.9);
    mesh.material = mat;

    this.edgeMeshes.set(edge.id, mesh);
  }

  clear(): void {
    for (const mesh of this.vertexMeshes.values()) mesh.dispose();
    for (const mesh of this.edgeMeshes.values()) mesh.dispose();
    this.vertexMeshes.clear();
    this.edgeMeshes.clear();
    this.vertexIndex = 0;
  }
}
