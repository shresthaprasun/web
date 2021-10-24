import { AmbientLight, BoxBufferGeometry, Color, DataTexture, DoubleSide, InstancedMesh, Material, Matrix4, Mesh, MeshBasicMaterial, MeshPhongMaterial, Object3D, PerspectiveCamera, Plane, PlaneGeometry, Quaternion, Raycaster, RGBFormat, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
import { VRButton } from "../node_modules/three/examples/jsm/webxr/VRButton";


//VR - default camera at 0,0,0 looking at (0,0,-1), scaling and offset to control the position
//features grab to scale, grab to rotate each side, grabe to rtate all cube

//https://github.com/mrdoob/three.js/blob/master/examples/webxr_vr_dragging.html



const EPS = 0.000001;
export class Project {

    private renderer: WebGLRenderer;
    private scene: Scene;
    private camera: PerspectiveCamera;

    private pointerDown: boolean;
    private pointerMoved: boolean;
    private isModelSelected: boolean;
    private screen: { left: number, top: number, width: number, height: number };

    private target: Vector3;
    private _moveCurr: Vector2;
    private _movePrev: Vector2;
    private _eye: Vector3;
    private rotateSpeed: number;
    private _lastAxis: Vector3;
    private _lastAngle: number;
    private staticMoving: boolean;
    private dynamicDampingFactor: number;

    private raycaster: Raycaster;

    private mouse: Vector2;

    constructor() {
        this.renderer = new WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0xFFFFFF, 1);

        this.scene = new Scene();
        this.camera = new PerspectiveCamera(60, 1, 0.1, 100);

        const light1 = new AmbientLight(0xffffff);
        this.scene.add(light1)

        this.target = new Vector3(1, 1, 1);
        this._moveCurr = new Vector2();
        this._movePrev = new Vector2();
        this._eye = new Vector3();
        this.rotateSpeed = 2.0;
        this._lastAxis = new Vector3();
        this._lastAngle = 0;
        this.staticMoving = false;
        this.dynamicDampingFactor = 0.2;
        this.screen = { left: 0, top: 0, width: 0, height: 0 };

        this.pointerDown = false;
        this.pointerMoved = false;

        this.raycaster = new Raycaster();
        this.mouse = new Vector2();       
        this.isModelSelected = false;
        
    }



    init(container: HTMLElement) {
        this.camera = new PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
        // this.camera.up.set(0, 1, 0);
        // this.camera.position.set(1, 0, 5);
        this.camera.lookAt(1, 1, 1);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        // this.camera.aspect = container.clientWidth / container.clientHeight;
        container.appendChild(this.renderer.domElement);

        this.renderer.xr.enabled = true;
        document.body.appendChild(VRButton.createButton(this.renderer));

        const box = this.renderer.domElement.getBoundingClientRect();
        // adjustments come from similar code in the jquery offset() function
        const d = this.renderer.domElement.ownerDocument.documentElement;

        this.screen.left = box.left + window.pageXOffset - d.clientLeft;
        this.screen.top = box.top + window.pageYOffset - d.clientTop;
        this.screen.width = box.width;
        this.screen.height = box.height;

        this.addEventListeners();       

        // const axisHelper = new AxesHelper();
        // axisHelper.position.set(-1, -1, -1);
        // this.scene.add(axisHelper);
    }





    addEventListeners() {
        this.renderer.domElement.addEventListener("pointerdown", (event) => {
            this._moveCurr.copy(this.getMouseOnCircle(event.pageX, event.pageY));
            this._movePrev.copy(this._moveCurr);
            this.pointerDown = true;
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const planeIntersections = this.raycaster.intersectObject(this.instancedPlane);

            if (planeIntersections.length > 0) {
                this.selectedPlaneId = planeIntersections[0].instanceId || 0;
                const normal = this.instanceIdNormal.get(this.selectedPlaneId) || new Vector3();
                const intersections = this.raycaster.intersectObjects(this.allCubes);
                if (intersections.length > 0) {
                    this.isModelSelected = true;
                    this.selectedCubePosition.copy(intersections[0].object.position);
                    this.planeForRotation.setFromNormalAndCoplanarPoint(normal, this.selectedCubePosition);
                    const hit = this.raycaster.ray.intersectPlane(this.planeForRotation, new Vector3());
                    hit && this.pointOnPlane.copy(hit);
                }
            }
            this.pointerMoved = false;
        });

        this.renderer.domElement.addEventListener("pointermove", (event: PointerEvent) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
            if (this.isModelSelected) {
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const hit = this.raycaster.ray.intersectPlane(this.planeForRotation, new Vector3());
                if (hit) {
                    const dir = new Vector3().subVectors(hit, this.pointOnPlane);
                    const len = dir.length()
                    if (len > EPS) {
                        if (!this.pointerMoved) {
                            this.calculateAxisAndPointForRotation(dir);
                            this.collectCubes();
                        }
                        else {
                            const planeNormal = this.instanceIdNormal.get(this.selectedPlaneId);
                            if (planeNormal) {
                                dir.multiply(this.directionOfMouseMove).multiply(this.directionOfMouseMove);
                                this.axisOfRotation = new Vector3().crossVectors(planeNormal, dir).normalize();
                            }
                        }

                        const angle = dir.length();
                        for (const cube of this.cubesToRotate) {
                            rotateAboutPoint(cube, this.pointOfRotation, this.axisOfRotation, angle);
                        }
                        this.pointOnPlane.copy(hit);
                        this.pointerMoved = true;
                    }
                }
            }
            else {
                if (this.pointerDown) {
                    this._movePrev.copy(this._moveCurr);
                    this._moveCurr.copy(this.getMouseOnCircle(event.pageX, event.pageY));
                }
            }

        });

        this.renderer.domElement.addEventListener("pointerup", () => {
            if (this.isModelSelected && this.cubesToRotate.length) {
                //snapping logic
                const accumulatedAngle = new Vector3().subVectors(this.cubesToRotatePreviousPosition[0], this.pointOfRotation).angleTo(new Vector3().subVectors(this.cubesToRotate[0].position, this.pointOfRotation));
                const plane = new Plane().setFromCoplanarPoints(this.pointOfRotation, this.cubesToRotatePreviousPosition[0], this.cubesToRotate[0].position);
                const noOf90degrees = Math.round(accumulatedAngle * 2 / Math.PI);
                const remainingRotationDegrees = (noOf90degrees * Math.PI / 2) - accumulatedAngle;
                for (let i = 0; i < this.cubesToRotate.length; ++i) {
                    rotateAboutPoint(this.cubesToRotate[i], this.pointOfRotation, plane.normal, remainingRotationDegrees);
                    const position = new Vector3(Math.round(this.cubesToRotate[i].position.x), Math.round(this.cubesToRotate[i].position.y), Math.round(this.cubesToRotate[i].position.z));
                    this.cubesToRotate[i].position.copy(position);
                }

                for (let i = 0; i < this.cubesToRotate.length; ++i) {
                    const position = this.cubesToRotate[i].position;
                    this.cubeMatrix[position.x][position.y][position.z] = this.cubesToRotate[i];
                    this.cubeDataMatrix[this.cubesToRotatePreviousPosition[i].x][this.cubesToRotatePreviousPosition[i].y][this.cubesToRotatePreviousPosition[i].z] = position.x * 9 + position.y * 3 + position.z;

                }

                for (let i = 0; i <= 2; ++i) {
                    for (let j = 0; j <= 2; ++j) {
                        for (let k = 0; k <= 2; ++k) {
                            console.log(this.cubeMatrix[i][j][k].position.x * 9 + this.cubeMatrix[i][j][k].position.y * 3 + this.cubeMatrix[i][j][k].position.z);
                        }
                    }
                }
            }
            // }
            this.cubesToRotate = [];
            this.cubesToRotatePreviousPosition = [];
            this.pointerDown = false;
            this.isModelSelected = false;
            this.pointerMoved = false;
        });
    }






    render() {
        // this.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), 0.001);
        // this.camera.up.applyQuaternion(this.quaternion);
        this.renderer.clear();
        if (this.pointerDown) {
            this.update();
        }
        this.renderer.render(this.scene, this.camera)
    }

    animate() {
        this.renderer.setAnimationLoop(this.render.bind(this));
        // requestAnimationFrame(this.animate.bind(this));
        // this.render();
    }

    getMouseOnCircle(pageX: number, pageY: number) {

        const vector = new Vector2();
        vector.set(
            ((pageX - this.screen.width * 0.5 - this.screen.left) / (this.screen.width * 0.5)),
            ((this.screen.height + 2 * (this.screen.top - pageY)) / this.screen.width) // screen.width intentional
        );
        return vector;
    }



    update() {
        this._eye.subVectors(this.camera.position, this.target);

        this.rotateCamera();

        this.camera.position.addVectors(this.target, this._eye);
        this.camera.lookAt(this.target);


    }

    rotateCamera() {

        const axis = new Vector3(),
            quaternion = new Quaternion(),
            eyeDirection = new Vector3(),
            objectUpDirection = new Vector3(),
            objectSidewaysDirection = new Vector3(),
            moveDirection = new Vector3();


        moveDirection.set(this._moveCurr.x - this._movePrev.x, this._moveCurr.y - this._movePrev.y, 0);
        let angle = moveDirection.length();

        if (angle) {

            this._eye.copy(this.camera.position).sub(this.target);

            eyeDirection.copy(this._eye).normalize();
            objectUpDirection.copy(this.camera.up).normalize();
            objectSidewaysDirection.crossVectors(objectUpDirection, eyeDirection).normalize();

            objectUpDirection.setLength(this._moveCurr.y - this._movePrev.y);
            objectSidewaysDirection.setLength(this._moveCurr.x - this._movePrev.x);

            moveDirection.copy(objectUpDirection.add(objectSidewaysDirection));

            axis.crossVectors(moveDirection, this._eye).normalize();

            angle *= this.rotateSpeed;
            quaternion.setFromAxisAngle(axis, angle);

            this._eye.applyQuaternion(quaternion);
            this.camera.up.applyQuaternion(quaternion);

            this._lastAxis.copy(axis);
            this._lastAngle = angle;

            this.camera.updateMatrixWorld();

        } else if (!this.staticMoving && this._lastAngle) {

            this._lastAngle *= Math.sqrt(1.0 - this.dynamicDampingFactor);
            this._eye.copy(this.camera.position).sub(this.target);
            quaternion.setFromAxisAngle(this._lastAxis, this._lastAngle);
            this._eye.applyQuaternion(quaternion);
            this.camera.up.applyQuaternion(quaternion);

        }
        this._movePrev.copy(this._moveCurr);
    }
}

function mapToAxisAlignedVector(dir: Vector3, planeNormal: Vector3): Vector3 {
    throw new Error('Function not implemented.');
}

function rotateAboutPoint(cube: Mesh<import("three").BufferGeometry, Material | Material[]>, pointOfRotation: Vector3, axisOfRotation: Vector3, angle: number) {
    throw new Error('Function not implemented.');
}

