import { InstancedMesh, Mesh, Vector3, Plane, PlaneGeometry, MeshBasicMaterial, DoubleSide, BoxBufferGeometry, Color, DataTexture, Material, Matrix4, MeshPhongMaterial, RGBFormat, Group, Scene } from "three";
import { mapToAxisAlignedVector } from "./Utilities";

export class RubiksCube extends Group { // should be group
    private instancedPlane: InstancedMesh;
    private cubeMatrix: Mesh[][][];
    private cubeDataMatrix: number[][][];
    private allCubes: Mesh[]; // Todo make group

    private selectedCubePosition: Vector3;
    private pointOnPlane: Vector3;
    private selectedPlaneId: number;

    private instanceIdNormal: Map<number, Vector3>;

    private cubesToRotate: Mesh[];
    private cubesToRotatePreviousPosition: Vector3[];

    private pointOfRotation: Vector3;
    private axisOfRotation: Vector3;
    private planeForRotation: Plane;
    private directionOfMouseMove: Vector3;

    constructor() {
        super();
        const faceCount = 6; //6 * 9
        const geometry = new PlaneGeometry(3, 3);
        // geometry.scale(0.9, 0.9, 0.9);
        const material = new MeshBasicMaterial({ transparent: true, opacity: 0, side: DoubleSide });
        this.instancedPlane = new InstancedMesh(geometry, material, faceCount)
        this.instanceIdNormal = new Map();
        this.children.push(this.instancedPlane);
        this.cubeMatrix = [];
        this.cubeDataMatrix = [];
        this.allCubes = [];
        this.selectedCubePosition = new Vector3();

        this.selectedPlaneId = -1;

        this.pointOnPlane = new Vector3();

        this.cubesToRotate = [];
        this.cubesToRotatePreviousPosition = [];

        this.pointOfRotation = new Vector3();
        this.axisOfRotation = new Vector3();
        this.planeForRotation = new Plane();
        this.directionOfMouseMove = new Vector3();
        this.buildCube();
        this.addInstancedPlanes();
    }

    getDirAxis(dir: Vector3): string {
        return Math.abs(dir.x) > Math.abs(dir.y) ? (Math.abs(dir.x) > Math.abs(dir.z) ? "x" : (Math.abs(dir.y) > Math.abs(dir.z) ? "y" : "z")) : (Math.abs(dir.y) > Math.abs(dir.z) ? "y" : "z");
    }

    collectCubes() {
        for (let i = 0; i < 3; ++i) {
            i = this.axisOfRotation.x !== 0 ? 3 : i;
            for (let j = 0; j < 3; ++j) {
                j = this.axisOfRotation.y !== 0 ? 3 : j;
                for (let k = 0; k < 3; ++k) {
                    k = this.axisOfRotation.z !== 0 ? 3 : k;
                    let x = this.axisOfRotation.x !== 0 ? this.selectedCubePosition.x : i;
                    let y = this.axisOfRotation.y !== 0 ? this.selectedCubePosition.y : j;
                    let z = this.axisOfRotation.z !== 0 ? this.selectedCubePosition.z : k;
                    this.cubesToRotate.push(this.cubeMatrix[x][y][z]);
                    this.cubesToRotatePreviousPosition.push(new Vector3(x, y, z));
                }
            }
        }
    }

    calculateAxisAndPointForRotation(dir: Vector3) {
        const planeNormal = this.instanceIdNormal.get(this.selectedPlaneId);
        if (planeNormal) {
            this.directionOfMouseMove.copy(mapToAxisAlignedVector(dir, planeNormal));
            this.axisOfRotation = new Vector3().crossVectors(planeNormal, this.directionOfMouseMove).normalize();
            const axisOfRotationString = this.getDirAxis(this.axisOfRotation);
            switch (axisOfRotationString) {
                case "x":
                    this.pointOfRotation.set(this.selectedCubePosition.x, 1, 1);
                    break;
                case "y":
                    this.pointOfRotation.set(1, this.selectedCubePosition.y, 1);
                    break;
                case "z":
                    this.pointOfRotation.set(1, 1, this.selectedCubePosition.z);
                    break;
            }
        }
    }

    createTexture(colorString: string): DataTexture {
        const width = 512 * 2;
        const height = 512 * 2;

        const size = width * height;
        const data = new Uint8Array(3 * size);
        const color = new Color(colorString);

        const r = Math.floor(color.r * 255);
        const g = Math.floor(color.g * 255);
        const b = Math.floor(color.b * 255);


        const padding = 50;
        const gap = 2;

        // used the buffer to create a DataTexture
        for (let i = 0; i < width; ++i) {
            for (let j = 0; j < height; ++j) {
                const stride = ((j * width) + i) * 3;

                if (i < gap || j < gap || i > width - gap || j > height - gap) {
                    data[stride] = 105;
                    data[stride + 1] = 105;
                    data[stride + 2] = 105;
                    continue;
                }
                if (i < padding || j < padding || i > width - padding || j > height - padding) {
                    data[stride] = 44;
                    data[stride + 1] = 44;
                    data[stride + 2] = 44;
                    continue;
                }
                data[stride] = r;
                data[stride + 1] = g;
                data[stride + 2] = b;

            }
        }
        return new DataTexture(data, width, height, RGBFormat);
    }

    buildMaterials(): Material[] {
        return ["#e34234", "orange", "royalblue", "forestgreen", "whitesmoke", "#ffe135"]// [front, back, top, bottom, left, right]
            .map((color: string) => {
                const mat = new MeshPhongMaterial({ side: DoubleSide });
                mat.map = this.createTexture(color)
                return mat;
            });
    }

    getCube(boxMaterials: Material[]) {
        return new Mesh(new BoxBufferGeometry(1, 1, 1), boxMaterials);
    }

    buildCube() {
        const boxMaterials = this.buildMaterials();
        for (let i = 0; i <= 2; ++i) {
            for (let j = 0; j <= 2; ++j) {
                for (let k = 0; k <= 2; ++k) {
                    const cube = this.getCube(boxMaterials);
                    const matrix = new Matrix4().makeTranslation(i, j, k + 1);//.scale(new Vector3(0.9, 0.9, 0.9));
                    cube.applyMatrix4(matrix);
                    this.children.push(cube);
                    // this.scene.add(cube);
                    if (!this.cubeMatrix[i]) {
                        this.cubeMatrix[i] = [];
                        this.cubeDataMatrix[i] = []
                    }
                    if (!this.cubeMatrix[i][j]) {
                        this.cubeMatrix[i][j] = [];
                        this.cubeDataMatrix[i][j] = [];
                    }
                    this.cubeMatrix[i][j][k] = cube;
                    this.cubeDataMatrix[i][j][k] = (i * 9) + (j * 3) + k;
                    this.allCubes.push(cube);
                }
            }
        }
    }

    addInstancedPlanes() {
        let index = 0;
        const color = new Color("black");

        //back
        const backmatrix = new Matrix4().setPosition(1, 1, -0.5);
        this.instancedPlane.setMatrixAt(index, backmatrix);
        this.instancedPlane.setColorAt(index, color);
        this.instanceIdNormal.set(index, new Vector3(0, 0, -1)); //normal to outside
        index++;

        //front
        const frontmatrix = new Matrix4().setPosition(1, 1, 2.5);
        this.instancedPlane.setMatrixAt(index, frontmatrix);
        this.instancedPlane.setColorAt(index, color);
        this.instanceIdNormal.set(index, new Vector3(0, 0, 1)); //normal to outside
        index++;

        //top
        const topmatrix = new Matrix4().makeRotationX(Math.PI / 2).setPosition(1, 2.5, 1);
        this.instancedPlane.setMatrixAt(index, topmatrix);
        this.instancedPlane.setColorAt(index, color);
        this.instanceIdNormal.set(index, new Vector3(0, 1, 0)); //normal to outside
        index++;

        //bottom
        const bottommatrix = new Matrix4().makeRotationX(Math.PI / 2).setPosition(1, -0.5, 1);
        this.instancedPlane.setMatrixAt(index, bottommatrix);
        this.instancedPlane.setColorAt(index, color);
        this.instanceIdNormal.set(index, new Vector3(0, -1, 0)); //normal to outside
        index++;

        //left
        const leftmatrix = new Matrix4().makeRotationY(Math.PI / 2).setPosition(-0.5, 1, 1);
        this.instancedPlane.setMatrixAt(index, leftmatrix);
        this.instancedPlane.setColorAt(index, color);
        this.instanceIdNormal.set(index, new Vector3(-1, 0, 0)); //normal to outside
        index++;

        //right
        const rightmatrix = new Matrix4().makeRotationY(Math.PI / 2).setPosition(2.5, 1, 1);
        this.instancedPlane.setMatrixAt(index, rightmatrix);
        this.instancedPlane.setColorAt(index, color);
        this.instanceIdNormal.set(index, new Vector3(1, 0, 0)); //normal to outside
        index++;
    }

}